import os
from contextlib import contextmanager

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker

from .config import settings
from .models import Base, User
from .security import hash_password

engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False} if settings.database_url.startswith("sqlite") else {},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db() -> None:
    from .config import ensure_data_dir

    ensure_data_dir()
    _migrate()
    Base.metadata.create_all(bind=engine)
    _bootstrap_admin()
    _ensure_admin()
    _reassign_orphans()


def _migrate() -> None:
    """Lightweight in-place migration for old schemas.

    Adds missing columns by ALTER TABLE (SQLite supports adding columns but
    not constraints on existing data, so columns are declared nullable at the
    DB level; application code always sets them).
    """
    insp = inspect(engine)

    if insp.has_table("users"):
        ucols = {c["name"] for c in insp.get_columns("users")}
        if "is_admin" not in ucols:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT 0"))

    if not insp.has_table("tokens"):
        return  # fresh DB: create_all will build everything from the models

    with engine.begin() as conn:
        cols = {c["name"] for c in insp.get_columns("tokens")}
        if "organization" not in cols:
            conn.execute(text("ALTER TABLE tokens ADD COLUMN organization TEXT"))

        if insp.has_table("deployments"):
            dcols = {c["name"] for c in insp.get_columns("deployments")}
            if "user_id" not in dcols:
                conn.execute(text("ALTER TABLE deployments ADD COLUMN user_id INTEGER"))
            for c in insp.get_columns("deployments"):
                if (
                    c["name"] == "run_id"
                    and str(c["type"]).upper().startswith("INTEGER")
                    and not settings.database_url.startswith("sqlite")
                ):
                    conn.execute(
                        text(
                            "ALTER TABLE deployments ALTER COLUMN run_id TYPE BIGINT "
                            "USING run_id::bigint"
                        )
                    )


def _bootstrap_admin() -> None:
    """Seed a bootstrap admin from env vars when the users table is empty."""
    username = (os.getenv("BRANCHSTACK_BOOTSTRAP_USERNAME") or "admin").strip()
    password = os.getenv("BRANCHSTACK_BOOTSTRAP_PASSWORD") or "admin"
    if not username:
        return
    with get_db_session() as db:
        if db.query(User).count() > 0:
            return
        if db.query(User).filter(User.username == username).first():
            return
        db.add(User(username=username, password_hash=hash_password(password), is_admin=True))
        db.commit()


def _ensure_admin() -> None:
    """Make sure at least one user (the bootstrap admin / first user) is admin.

    Runs on every startup: if no admin exists yet, promote the bootstrap
    username (or the first user by id) so tokens can be configured.
    """
    from .models import User as _User

    with get_db_session() as db:
        if db.query(_User).filter(_User.is_admin.is_(True)).first():
            return
        username = (os.getenv("BRANCHSTACK_BOOTSTRAP_USERNAME") or "admin").strip()
        target = db.query(_User).filter(_User.username == username).first()
        if not target:
            target = db.query(_User).order_by(_User.id.asc()).first()
        if not target:
            return
        target.is_admin = True
        db.commit()


def _reassign_orphans() -> None:
    """Assign pre-auth deployments (user_id NULL) to the bootstrap admin."""
    from .models import Deployment

    with get_db_session() as db:
        admin = db.query(User).order_by(User.id.asc()).first()
        if not admin:
            return
        db.query(Deployment).filter(Deployment.user_id.is_(None)).update({Deployment.user_id: admin.id})
        db.commit()


def get_db():
    """FastAPI dependency: yields a session and closes it after the request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def get_db_session():
    """Manual context-managed session for non-request scopes."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()