from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)

from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    username = Column(String, nullable=False, unique=True)
    password_hash = Column(String, nullable=False)  # "scrypt$saltB64$hashB64"
    is_admin = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class GitToken(Base):
    __tablename__ = "tokens"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    label = Column(String, nullable=False)  # GitHub username/login derived from token
    organization = Column(String, nullable=True)  # org used to filter repos listing
    encrypted_token = Column(Text, nullable=False)
    scopes = Column(String, nullable=True)  # comma separated
    created_at = Column(DateTime, default=datetime.utcnow)

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
    message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    token = relationship("GitToken", back_populates="deployments")