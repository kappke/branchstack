# BranchStack

Merge selected GitHub branches into a throwaway temp branch, then dispatch a
GitHub Actions `workflow_dispatch` workflow to deploy them to the environment
you choose — passing **custom parameters** you fill in by hand in the UI.

- **Frontend:** React + Vite + Tailwind
- **Backend:** FastAPI + SQLAlchemy/SQLite
- **Glue:** `docker compose` (FastAPI + nginx-served React)

Tokens are GitHub **fine-grained PATs**, encrypted at rest (Fernet, key derived
from `BRANCHSTACK_SECRET_KEY`) and stored in SQLite. Multiple tokens are
supported with one active at a time. Deployment history is persisted so you can
re-check run status and clean up temp branches later.

## Flow

1. Add a fine-grained PAT in the UI (the backend validates it against `/user`).
2. Activate a token.
3. Pick a repository → its branches and workflows load.
4. Choose the **base branch** (the temp branch is cut from it) and tick the
   **branches to merge**.
5. Click **Create temp branch & merge selected**. The backend creates a
   `branchstack/_merge-…` ref off the base and merges each selected branch into
   it via the GitHub Merge API (conflicts are reported; the temp branch is
   removed on failure).
6. Pick a deploy **workflow**, **Load workflow inputs** (parsed from the
   workflow file's `on.workflow_dispatch.inputs`), fill in **custom parameters**
   and the **target environment**.
7. **Dispatch to GitHub Actions** — the workflow runs on the temp branch ref
   with your inputs. The run is recorded in history, where you can **poll**
   status and **cleanup** (delete) the temp branch when done.

## Quick start (Docker)

```bash
# 1. pick a strong secret (used to encrypt tokens at rest)
cp .env.example .env
python -c "import secrets; print('BRANCHSTACK_SECRET_KEY=' + secrets.token_hex(32))" >> .env

# 2. build & run
docker compose up --build -d

# 3. open
open http://localhost:8080
```

- Frontend: http://localhost:8080
- Backend API: http://localhost:8000/api (and `/docs` for OpenAPI)
- SQLite data volume: `branchstack-data`

## Local development (no Docker)

Backend:

```bash
cd backend
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
export BRANCHSTACK_SECRET_KEY=$(python -c "import secrets; print(secrets.token_hex(32))")
uvicorn app.main:app --reload
```

Frontend (proxies `/api` → backend, override with `BRANCHSTACK_BACKEND`):

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
# if backend isn't on 8000:
BRANCHSTACK_BACKEND=http://localhost:8001 npm run dev
```

## GitHub token permissions (fine-grained PAT)

On the repositories you want to use, grant:

- **Contents:** Read & Write — to create/merge/delete branches
- **Pull requests:** Write — required by the GitHub Merge API
- **Actions:** Read & Write — to list workflows and dispatch runs
- **Metadata:** Read — always required

Repository access: select the repos you intend to merge+deploy from.

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `BRANCHSTACK_SECRET_KEY` | `change-me-please` | Derives the Fernet key for token encryption. **Set this.** |
| `BRANCHSTACK_CORS_ORIGINS` | `http://localhost:8080` | Comma-separated allowed origins |
| `BRANCHSTACK_DATABASE_URL` | `sqlite:///./data/branchstack.db` | SQLAlchemy URL |
| `BRANCHSTACK_GITHUB_API` | `https://api.github.com` | GitHub API base (GHES-friendly) |
| `BRANCHSTACK_BOOTSTRAP_USERNAME` | `admin` | Bootstrap admin username (seeded when users table is empty) |
| `BRANCHSTACK_BOOTSTRAP_PASSWORD` | `admin` | Bootstrap admin password (change after first login) |

Docker-only (host port mapping, set in `.env`, see `docker-compose.yml`):

| Variable | Default | Purpose |
|---|---|---|
| `BRANCHSTACK_BACKEND_PORT` | `8000` | Host port for the FastAPI backend |
| `BRANCHSTACK_FRONTEND_PORT` | `8080` | Host port for the nginx-served frontend |

## API

```
POST   /api/auth/login                   { username, password }    -> { token, user }
POST   /api/auth/logout
GET    /api/auth/me

GET    /api/users                        (authenticated)
POST   /api/users                        { username, password }     (authenticated; no public registration)

GET    /api/favorites                    (per current user)
POST   /api/favorites                    { repo_full_name }
DELETE /api/favorites/{repo_full_name}

GET    /api/health
GET    /api/tokens
POST   /api/tokens                       { name, token }
POST   /api/tokens/{id}/activate
DELETE /api/tokens/{id}

GET    /api/repos
GET    /api/repos/{owner}/{repo}/branches
GET    /api/repos/{owner}/{repo}/workflows
GET    /api/repos/{owner}/{repo}/workflows/{path}/inputs

POST   /api/repos/{owner}/{repo}/merge   { base_branch, branches[], temp_branch? }
POST   /api/repos/{owner}/{repo}/dispatch { workflow_id, ref, inputs{}, environment?,
                                            selected_branches[], base_branch? }

GET    /api/deployments
POST   /api/deployments/{id}/refresh
DELETE /api/deployments/{id}/branch
```

## Notes

- **Auth (username + password):** the app requires login. A bootstrap admin
  (`admin`/`admin` by default, configurable via `BRANCHSTACK_BOOTSTRAP_*`) is
  seeded on first startup when no users exist. New users are added only from the
  **Configure** tab (no public sign-up on the login page). Sessions are
  stateless HMAC-signed tokens stored in `localStorage`; tokens, deployments and
  favorite repos are all scoped per authenticated user.
- **Favorite repos:** click ★ next to a repo to star it; toggle the
  **★ favorites** filter to see only your starred repos.

- Merge is done purely through the GitHub Merge API (no local git clone).
  No-op merges (already up to date) are skipped; conflicts abort the batch and
  delete the half-created temp branch.
- Workflow inputs are read from the workflow file's
  `on.workflow_dispatch.inputs`; `choice` inputs render as dropdowns, `boolean`
  as checkboxes, `number`/integer as number fields, others as text.
- The dispatched run id is matched by polling recent runs for the workflow on
  the temp branch ref (GitHub registers the run asynchronously).
- Temp branches are prefixed `branchstack/` so the **cleanup** button only
  offers to remove auto-generated ones (your explicit names are left alone).