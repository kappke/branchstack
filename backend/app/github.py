from typing import Any, Optional

import httpx
import yaml


class GitHubError(Exception):
    def __init__(self, status_code: int, message: str):
        super().__init__(message)
        self.status_code = status_code
        self.message = message


class GitHubClient:
    def __init__(self, token: str, api_base: str = "https://api.github.com", token_label: Optional[str] = None):
        self._token = token
        self._api = api_base.rstrip("/")
        self._client = httpx.Client(
            base_url=self._api,
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
                "User-Agent": "branchstack",
            },
            timeout=30.0,
        )

    def __enter__(self) -> "GitHubClient":
        return self

    def __exit__(self, *args: Any) -> None:
        self.close()

    def close(self) -> None:
        self._client.close()

    def _request(self, method: str, path: str, **kwargs: Any) -> httpx.Response:
        resp = self._client.request(method, path, **kwargs)
        if resp.status_code >= 400:
            try:
                msg = resp.json().get("message", resp.text)
            except Exception:
                msg = resp.text
            raise GitHubError(resp.status_code, msg)
        return resp

    # ---- whoami ----

    def whoami(self) -> dict:
        r = self._request("GET", "/user")
        data = r.json()
        data["scopes"] = r.headers.get("x-oauth-scopes", "")
        return data

    # ---- repos ----

    def list_repos(self, per_page: int = 100) -> list[dict]:
        repos = []
        page = 1
        while True:
            r = self._request("GET", "/user/repos", params={
                "per_page": per_page,
                "page": page,
                "affiliation": "owner,collaborator,organization_member",
                "sort": "updated",
            })
            chunk = r.json()
            if not chunk:
                break
            repos.extend(chunk)
            if len(chunk) < per_page:
                break
            page += 1
        return repos

    # ---- branches ----

    _BRANCHES_QUERY = """
    query($owner: String!, $name: String!, $first: Int!, $cursor: String) {
      repository(owner: $owner, name: $name) {
        refs(refPrefix: "refs/heads/", first: $first, after: $cursor,
             orderBy: {field: TAG_COMMIT_DATE, direction: DESC}) {
          nodes {
            name
            target {
              ... on Commit {
                oid
                committedDate
                message
                author { name }
                committer { name }
              }
            }
          }
          pageInfo { hasNextPage endCursor }
        }
      }
    }
    """

    def list_branches(self, owner: str, repo: str, per_page: int = 100) -> list[dict]:
        """List branches ordered by most recent commit date (descending).

        Uses GraphQL because the REST `GET /repos/.../branches` endpoint
        returns only a short branch (name + sha) and does not support
        `sort`; GraphQL lets us fetch each branch's latest commit metadata
        (date/message/author) and order by commit date in a single request.
        """
        branches = []
        cursor: Optional[str] = None
        guard = 0
        while True:
            guard += 1
            if guard > 1000:
                break
            r = self._request("POST", "/graphql", json={
                "query": self._BRANCHES_QUERY,
                "variables": {
                    "owner": owner,
                    "name": repo,
                    "first": min(per_page, 100),
                    "cursor": cursor,
                },
            })
            data = r.json() or {}
            if data.get("errors"):
                raise GitHubError(502, "; ".join(e.get("message", "GraphQL error") for e in data["errors"]))
            refs = (data.get("data") or {}).get("repository", {}).get("refs") or {}
            nodes = refs.get("nodes") or []
            for n in nodes:
                target = n.get("target") or {}
                date = target.get("committedDate")
                message = (target.get("message") or "")
                author = (target.get("author") or {}).get("name")
                committer = (target.get("committer") or {}).get("name")
                branches.append({
                    "name": n["name"],
                    "protected": False,
                    "commit": {
                        "sha": target.get("oid"),
                        "commit": {
                            "author": {"date": date, "name": author} if date else None,
                            "committer": {"date": date, "name": committer} if date else None,
                            "message": message,
                        },
                    },
                })
            page = refs.get("pageInfo") or {}
            if not page.get("hasNextPage"):
                break
            cursor = page.get("endCursor")
            if not nodes:
                break
        return branches

    def get_branch(self, owner: str, repo: str, branch: str) -> dict:
        r = self._request("GET", f"/repos/{owner}/{repo}/branches/{branch}")
        return r.json()

    def get_ref(self, owner: str, repo: str, branch: str) -> dict:
        r = self._request("GET", f"/repos/{owner}/{repo}/git/ref/heads/{branch}")
        return r.json()

    def create_branch(self, owner: str, repo: str, new_branch: str, from_sha: str) -> dict:
        r = self._request("POST", f"/repos/{owner}/{repo}/git/refs", json={
            "ref": f"refs/heads/{new_branch}",
            "sha": from_sha,
        })
        return r.json()

    def delete_branch(self, owner: str, repo: str, branch: str) -> None:
        self._request("DELETE", f"/repos/{owner}/{repo}/git/refs/heads/{branch}")

    def merge_branch(self, owner: str, repo: str, base: str, head: str, message: str) -> dict:
        r = self._request("POST", f"/repos/{owner}/{repo}/merges", json={
            "base": base,
            "head": head,
            "commit_message": message,
        })
        try:
            return r.json()
        except Exception:
            return {"sha": None, "merged": False, "message": "No merge commit (base already up to date)"}

    # ---- workflows ----

    def list_workflows(self, owner: str, repo: str) -> list[dict]:
        r = self._request("GET", f"/repos/{owner}/{repo}/actions/workflows", params={"per_page": 100})
        return r.json().get("workflows", [])

    def get_workflow_file_inputs(self, owner: str, repo: str, workflow_path: str) -> list[dict]:
        """Fetch workflow file and parse workflow_dispatch inputs."""
        r = self._request("GET", f"/repos/{owner}/{repo}/contents/{workflow_path}")
        data = r.json()
        import base64
        content = base64.b64decode(data["content"]).decode()
        parsed = yaml.safe_load(content)
        triggers = parsed.get("on") or parsed.get(True) or {}
        if isinstance(triggers, str):
            triggers = {triggers: {}}
        wfd = triggers.get("workflow_dispatch") or {}
        inputs = wfd.get("inputs") or {}
        result = []
        for name, spec in inputs.items():
            if not isinstance(spec, dict):
                continue
            result.append({
                "name": name,
                "description": spec.get("description", ""),
                "type": spec.get("type", "string"),
                "required": bool(spec.get("required", False)),
                "default": spec.get("default"),
                "options": spec.get("options"),
            })
        return result

    # ---- dispatch ----

    def dispatch_workflow(self, owner: str, repo: str, workflow_id: str, ref: str, inputs: dict) -> None:
        self._request("POST", f"/repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches", json={
            "ref": ref,
            "inputs": inputs or {},
        })

    def list_workflow_runs(self, owner: str, repo: str, workflow_id: Optional[str] = None, per_page: int = 10) -> list[dict]:
        path = f"/repos/{owner}/{repo}/actions/runs"
        params = {"per_page": per_page}
        if workflow_id:
            params["workflow_id"] = workflow_id
        r = self._request("GET", path, params=params)
        return r.json().get("workflow_runs", [])

    def get_run(self, owner: str, repo: str, run_id: int) -> dict:
        r = self._request("GET", f"/repos/{owner}/{repo}/actions/runs/{run_id}")
        return r.json()

    def cancel_run(self, owner: str, repo: str, run_id: int) -> None:
        self._request("POST", f"/repos/{owner}/{repo}/actions/runs/{run_id}/cancel")