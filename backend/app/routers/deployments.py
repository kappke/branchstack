import json
import secrets
import time
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth import get_active_client, get_current_user
from ..cache import get_cache
from ..db import get_db
from ..github import GitHubClient, GitHubError
from ..models import Deployment, User
from ..schemas import DeploymentOut, MergeRequest

router = APIRouter(tags=["deployments"])


def _split(full_name: str) -> tuple[str, str]:
    owner, _, repo = full_name.partition("/")
    if not repo:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "repo_full_name must be owner/repo")
    return owner, repo


def _temp_branch_name(explicit: str | None, base: str) -> str:
    return explicit or f"branchstack/_merge-{secrets.token_hex(4)}"


def _is_not_found_error(e: GitHubError) -> bool:
    if e.status_code == 404:
        return True
    msg = (e.message or "").lower()
    return "not found" in msg or "does not exist" in msg


def _invalidate_branches(token_id: int, owner: str, repo: str) -> None:
    get_cache(token_id).invalidate(("branches", owner, repo))


def _check_ownership(dep: Optional[Deployment], user: User) -> Deployment:
    if not dep or (dep.user_id is not None and dep.user_id != user.id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Deployment not found")
    return dep


# ---------- merge ----------

class MergeResult(BaseModel):
    temp_branch: str
    base_sha: str
    log: list[dict]


def _do_merge(gh: GitHubClient, owner: str, repo: str, payload: MergeRequest) -> MergeResult:
    ref = gh.get_ref(owner, repo, payload.base_branch)
    base_sha = ref["object"]["sha"]

    temp_branch = _temp_branch_name(payload.temp_branch, payload.base_branch)
    gh.create_branch(owner, repo, temp_branch, base_sha)
    log: list[dict] = [{"branch": temp_branch, "action": "created", "from": payload.base_branch, "sha": base_sha}]

    for br in payload.branches:
        try:
            result = gh.merge_branch(
                owner, repo,
                base=temp_branch,
                head=br,
                message=f"branchstack: merge {br} into {temp_branch}",
            )
            log.append({
                "branch": br, "action": "merged",
                "sha": result.get("sha"), "merged": result.get("merged", True),
            })
        except GitHubError as e:
            msg = (e.message or "").lower()
            if "nothing to merge" in msg or "already up to date" in msg:
                log.append({"branch": br, "action": "noop", "message": "Already up to date"})
                continue
            gh.delete_branch(owner, repo, temp_branch)
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                f"Merge conflict on branch '{br}': {e.message}. Temp branch {temp_branch} was removed.",
            )

    return MergeResult(temp_branch=temp_branch, base_sha=base_sha, log=log)


@router.post("/api/repos/{owner}/{repo}/merge", response_model=MergeResult)
def merge_branches(owner: str, repo: str, payload: MergeRequest, user: User = Depends(get_current_user)):
    if not payload.branches:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Select at least one branch")

    client, token = get_active_client(user_id=user.id)
    try:
        gh: GitHubClient = client
        result = _do_merge(gh, owner, repo, payload)
    finally:
        client.close()

    _invalidate_branches(token.id, owner, repo)
    return result


# ---------- deploy (dispatch) ----------

class DispatchBody(BaseModel):
    workflow_id: str
    workflow_name: str | None = None
    ref: str  # usually the temp branch
    inputs: dict = {}
    environment: str | None = None
    selected_branches: list[str] = []
    base_branch: str | None = None


def _do_dispatch(gh: GitHubClient, owner: str, repo: str, body: DispatchBody) -> tuple[Optional[int], Optional[str], str]:
    try:
        gh.dispatch_workflow(owner, repo, body.workflow_id, body.ref, body.inputs)
    except GitHubError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Dispatch failed: {e.message}")

    run_id = None
    html_url = None
    run_status = "queued"
    time.sleep(1.5)  # let run register
    try:
        runs = gh.list_workflow_runs(owner, repo, workflow_id=body.workflow_id, per_page=5)
        ref_norm = body.ref.removeprefix("refs/heads/")
        for r in runs:
            if r.get("head_branch") == ref_norm or r.get("head_branch") == body.ref:
                run_id = r["id"]
                html_url = r.get("html_url")
                run_status = r.get("status")
                break
        if run_id is None and runs:
            run_id = runs[0]["id"]
            html_url = runs[0].get("html_url")
            run_status = runs[0].get("status")
    except GitHubError:
        pass
    return run_id, html_url, run_status


def _record_deployment(db: Session, user_id: int, token_id: int, owner: str, repo: str, body: DispatchBody, ref: str,
                      run_id: Optional[int], html_url: Optional[str], run_status: str,
                      selected_branches: list[str], base_branch: Optional[str]) -> Deployment:
    dep = Deployment(
        user_id=user_id,
        token_id=token_id,
        repo_full_name=f"{owner}/{repo}",
        base_branch=base_branch or "",
        temp_branch=ref,
        selected_branches=json.dumps(selected_branches),
        workflow_id=body.workflow_id,
        workflow_name=body.workflow_name,
        inputs=json.dumps(body.inputs),
        run_id=run_id,
        html_url=html_url,
        status=run_status,
        environment=body.environment,
        message="Dispatched",
    )
    db.add(dep)
    db.commit()
    db.refresh(dep)
    return dep


@router.post("/api/repos/{owner}/{repo}/dispatch", response_model=DeploymentOut)
def dispatch_workflow(owner: str, repo: str, body: DispatchBody, user: User = Depends(get_current_user),
                      db: Session = Depends(get_db)):
    client, token = get_active_client(user_id=user.id)
    try:
        gh: GitHubClient = client
        run_id, html_url, run_status = _do_dispatch(gh, owner, repo, body)
    finally:
        client.close()

    return _record_deployment(db, user.id, token.id, owner, repo, body, body.ref, run_id, html_url, run_status,
                              body.selected_branches, body.base_branch)


# ---------- combined one-click deploy ----------

class OneClickDeployBody(BaseModel):
    base_branch: str = "main"
    branches: list[str]
    temp_branch: Optional[str] = None
    workflow_id: str
    workflow_name: Optional[str] = None
    inputs: dict = {}
    environment: Optional[str] = None


class OneClickDeployResponse(BaseModel):
    temp_branch: str
    merge_log: list[dict]
    deployment: DeploymentOut


@router.post("/api/repos/{owner}/{repo}/deploy", response_model=OneClickDeployResponse)
def deploy_one_click(owner: str, repo: str, body: OneClickDeployBody, user: User = Depends(get_current_user),
                     db: Session = Depends(get_db)):
    if not body.branches:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Select at least one branch")
    if not body.workflow_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Workflow is required")

    client, token = get_active_client(user_id=user.id)
    try:
        gh: GitHubClient = client
        merge_result = _do_merge(gh, owner, repo, MergeRequest(
            base_branch=body.base_branch,
            branches=body.branches,
            temp_branch=body.temp_branch,
        ))
        dispatch_body = DispatchBody(
            workflow_id=body.workflow_id,
            workflow_name=body.workflow_name,
            ref=merge_result.temp_branch,
            inputs=body.inputs,
            environment=body.environment,
            selected_branches=body.branches,
            base_branch=body.base_branch,
        )
        run_id, html_url, run_status = _do_dispatch(gh, owner, repo, dispatch_body)
    finally:
        client.close()

    _invalidate_branches(token.id, owner, repo)

    dep = _record_deployment(db, user.id, token.id, owner, repo, dispatch_body, merge_result.temp_branch,
                             run_id, html_url, run_status, body.branches, body.base_branch)

    return OneClickDeployResponse(
        temp_branch=merge_result.temp_branch,
        merge_log=merge_result.log,
        deployment=dep,
    )


# ---------- history ----------

@router.get("/api/deployments", response_model=list[DeploymentOut])
def list_deployments(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return (
        db.query(Deployment)
        .filter(Deployment.user_id == user.id)
        .order_by(Deployment.created_at.desc())
        .limit(200)
        .all()
    )


@router.post("/api/deployments/{dep_id}/refresh", response_model=DeploymentOut)
def refresh_status(dep_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    dep = _check_ownership(db.get(Deployment, dep_id), user)
    if not dep.run_id:
        return dep
    owner, repo = _split(dep.repo_full_name)
    client, _ = get_active_client(token_id=dep.token_id, user_id=user.id)
    try:
        run = client.get_run(owner, repo, dep.run_id)
    except GitHubError as e:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"GitHub: {e.message}")
    finally:
        client.close()

    dep.status = run.get("status")
    if run.get("conclusion"):
        dep.status = f"{run['status']}:{run['conclusion']}"
    dep.html_url = dep.html_url or run.get("html_url")
    db.commit()
    db.refresh(dep)
    return dep


class CleanupResponse(BaseModel):
    deleted: bool


@router.delete("/api/deployments/{dep_id}/branch", response_model=CleanupResponse)
def cleanup_branch(dep_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    dep = _check_ownership(db.get(Deployment, dep_id), user)
    if dep.temp_branch.startswith("branchstack/"):
        owner, repo = _split(dep.repo_full_name)
        client, _ = get_active_client(token_id=dep.token_id, user_id=user.id)
        try:
            client.delete_branch(owner, repo, dep.temp_branch)
        except GitHubError as e:
            if not _is_not_found_error(e):
                raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"GitHub: {e.message}")
        finally:
            client.close()
    dep.status = dep.status or "cleanup"
    db.commit()
    return CleanupResponse(deleted=True)