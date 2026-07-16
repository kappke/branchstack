from typing import Any, Optional

from pydantic import BaseModel, Field


class TokenCreate(BaseModel):
    name: str
    token: str


class TokenOut(BaseModel):
    id: int
    name: str
    label: str
    scopes: Optional[str] = None
    is_active: bool
    created_at: Any

    class Config:
        from_attributes = True


class MergeRequest(BaseModel):
    base_branch: str = Field(default="main", description="Branch to branch the temp branch off")
    branches: list[str] = Field(description="Branches to merge into the temp branch, in order")
    temp_branch: Optional[str] = Field(default=None, description="Optional explicit temp branch name")
    token_id: Optional[int] = None


class DeployRequest(BaseModel):
    workflow_id: str
    workflow_name: Optional[str] = None
    ref: str = Field(description="Branch ref to run the workflow on (usually the temp branch)")
    inputs: dict[str, Any] = Field(default_factory=dict)
    environment: Optional[str] = None
    repo_full_name: str
    token_id: Optional[int] = None


class DeploymentOut(BaseModel):
    id: int
    repo_full_name: str
    base_branch: str
    temp_branch: str
    selected_branches: str
    workflow_id: Optional[str]
    workflow_name: Optional[str]
    inputs: Optional[str]
    run_id: Optional[int]
    html_url: Optional[str]
    status: Optional[str]
    environment: Optional[str]
    message: Optional[str]
    created_at: Any
    updated_at: Any

    class Config:
        from_attributes = True


# ---- auth / users ----

class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    token: str
    user: "UserOut"


class UserCreate(BaseModel):
    username: str
    password: str


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str


class UserOut(BaseModel):
    id: int
    username: str
    created_at: Any

    class Config:
        from_attributes = True


class FavoriteRepoCreate(BaseModel):
    repo_full_name: str


class FavoriteRepoOut(BaseModel):
    id: int
    repo_full_name: str
    created_at: Any

    class Config:
        from_attributes = True


LoginResponse.model_rebuild()