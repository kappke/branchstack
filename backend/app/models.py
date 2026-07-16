from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    username = Column(String, nullable=False, unique=True)
    password_hash = Column(String, nullable=False)  # "scrypt$saltB64$hashB64"
    created_at = Column(DateTime, default=datetime.utcnow)

    tokens = relationship(
        "GitToken", back_populates="user", cascade="all, delete-orphan"
    )
    favorites = relationship(
        "FavoriteRepo", back_populates="user", cascade="all, delete-orphan"
    )


class GitToken(Base):
    __tablename__ = "tokens"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String, nullable=False, unique=True)
    label = Column(String, nullable=False)  # GitHub username/login derived from token
    encrypted_token = Column(Text, nullable=False)
    scopes = Column(String, nullable=True)  # comma separated
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=False)

    user = relationship("User", back_populates="tokens")
    deployments = relationship(
        "Deployment", back_populates="token", cascade="all, delete-orphan"
    )


class Deployment(Base):
    __tablename__ = "deployments"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    token_id = Column(Integer, ForeignKey("tokens.id"), nullable=False)
    repo_full_name = Column(String, nullable=False)  # owner/repo
    base_branch = Column(String, nullable=False)
    temp_branch = Column(String, nullable=False)
    selected_branches = Column(Text, nullable=False)  # JSON list
    workflow_id = Column(String, nullable=True)  # GitHub workflow id or filename
    workflow_name = Column(String, nullable=True)
    inputs = Column(Text, nullable=True)  # JSON object
    run_id = Column(Integer, nullable=True)  # GitHub Actions run id after dispatch
    html_url = Column(String, nullable=True)
    status = Column(String, nullable=True)  # queued/in_progress/completed/failed
    environment = Column(String, nullable=True)
    message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    token = relationship("GitToken", back_populates="deployments")


class FavoriteRepo(Base):
    __tablename__ = "favorite_repos"
    __table_args__ = (
        UniqueConstraint("user_id", "repo_full_name", name="uq_user_favorite_repo"),
    )

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    repo_full_name = Column(String, nullable=False)  # owner/repo
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="favorites")