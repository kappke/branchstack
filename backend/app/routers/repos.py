from fastapi import APIRouter, Depends, HTTPException, status

from ..auth import get_active_client, get_current_user
from ..cache import get_cache
from ..github import GitHubClient, GitHubError
from ..models import User

router = APIRouter(prefix="/api/repos", tags=["repos"])


def _list_repos_cached(token_id: int, organization, refresh: bool) -> list[dict]:
    cache = get_cache(token_id)
    key = ("repos", organization or "")

    def factory() -> list[dict]:
        client, _ = get_active_client(token_id=token_id)
        try:
            with client as gh:
                repos = gh.list_repos()
        finally:
            client.close()
        if organization:
            org = organization.lower()
            repos = [r for r in repos if str((r.get("owner") or {}).get("login", "")).lower() == org]
        return [
            {
                "id": r["id"],
                "full_name": r["full_name"],
                "name": r["name"],
                "private": r["private"],
                "default_branch": r.get("default_branch"),
                "updated_at": r.get("updated_at"),
                "html_url": r.get("html_url"),
                "open_issues_count": r.get("open_issues_count"),
            }
            for r in repos
        ]

    if refresh:
        value = factory()
        cache.set(key, value)
        return value
    return cache.get_or_set(key, factory)


@router.get("")
def list_repos(refresh: bool = False, user: User = Depends(get_current_user)):
    client, token = get_active_client()
    try:
        return _list_repos_cached(token.id, token.organization, refresh)
    finally:
        client.close()


def _branches_key(owner: str, repo: str) -> tuple:
    return ("branches", owner, repo)


def _list_branches_cached(token_id: int, owner: str, repo: str, refresh: bool) -> list[dict]:
    cache = get_cache(token_id)
    key = _branches_key(owner, repo)

    def factory() -> list[dict]:
        client, _ = get_active_client(token_id=token_id)
        try:
            with client as gh:
                branches = gh.list_branches(owner, repo)
        finally:
            client.close()
        return [
            {
                "name": b["name"],
                "protected": b.get("protected", False),
                "commit_sha": b["commit"]["sha"],
                "commit_message": (b["commit"].get("commit", {}).get("message", "") or "").splitlines()[0] if b["commit"].get("commit") else "",
                "author": (b["commit"].get("commit", {}).get("author", {}) or {}).get("name"),
                "commit_date": ((b["commit"].get("commit", {}).get("committer", {}) or {}).get("date")
                                or (b["commit"].get("commit", {}).get("author", {}) or {}).get("date")),
            }
            for b in branches
        ]

    if refresh:
        value = factory()
        cache.set(key, value)
        return value
    return cache.get_or_set(key, factory)


@router.get("/{owner}/{repo}/branches")
def list_branches(owner: str, repo: str, refresh: bool = False, user: User = Depends(get_current_user)):
    client, token = get_active_client()
    try:
        return _list_branches_cached(token.id, owner, repo, refresh)
    finally:
        client.close()


def _workflows_key(owner: str, repo: str) -> tuple:
    return ("workflows", owner, repo)


def _list_workflows_cached(token_id: int, owner: str, repo: str, refresh: bool) -> list[dict]:
    cache = get_cache(token_id)
    key = _workflows_key(owner, repo)

    def factory() -> list[dict]:
        client, _ = get_active_client(token_id=token_id)
        try:
            with client as gh:
                workflows = gh.list_workflows(owner, repo)
        finally:
            client.close()
        return [
            {"id": w["id"], "name": w["name"], "path": w["path"], "state": w["state"]}
            for w in workflows
        ]

    if refresh:
        value = factory()
        cache.set(key, value)
        return value
    return cache.get_or_set(key, factory)


@router.get("/{owner}/{repo}/workflows")
def list_workflows(owner: str, repo: str, refresh: bool = False, user: User = Depends(get_current_user)):
    client, token = get_active_client()
    try:
        return _list_workflows_cached(token.id, owner, repo, refresh)
    finally:
        client.close()


def _inputs_key(owner: str, repo: str, workflow_path: str) -> tuple:
    return ("inputs", owner, repo, workflow_path)


def _workflow_inputs_cached(token_id: int, owner: str, repo: str, workflow_path: str, refresh: bool) -> dict:
    cache = get_cache(token_id)
    key = _inputs_key(owner, repo, workflow_path)

    def factory() -> dict:
        client, _ = get_active_client(token_id=token_id)
        try:
            with client as gh:
                inputs = gh.get_workflow_file_inputs(owner, repo, workflow_path)
        finally:
            client.close()
        return {"path": workflow_path, "inputs": inputs}

    if refresh:
        value = factory()
        cache.set(key, value)
        return value
    return cache.get_or_set(key, factory)


@router.get("/{owner}/{repo}/workflows/{workflow_path:path}/inputs")
def workflow_inputs(owner: str, repo: str, workflow_path: str, refresh: bool = False, user: User = Depends(get_current_user)):
    """workflow_path is the path within repo, e.g. .github/workflows/deploy.yml"""
    client, token = get_active_client()
    try:
        return _workflow_inputs_cached(token.id, owner, repo, workflow_path, refresh)
    finally:
        client.close()