import React, { useEffect, useMemo, useState } from "react";
import { api, apiError } from "../api";
import { Badge, Button, Card, Empty, ErrorBanner, Spinner } from "./ui";

function RepoPicker({ repos, repo, onSelect, favorites, favOnly, onFavOnlyChange, onToggleFav }) {
  const [q, setQ] = useState("");
  const favSet = useMemo(() => new Set((favorites || []).map((f) => f.repo_full_name)), [favorites]);
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    let out = repos;
    if (favOnly) out = out.filter((r) => favSet.has(r.full_name));
    if (term) out = out.filter((r) => r.full_name.toLowerCase().includes(term));
    return out;
  }, [repos, q, favOnly, favSet]);

  return (
    <div>
      <div className="flex gap-2">
        <input
          className="flex-1 rounded bg-slate-800 border border-slate-700 px-2.5 py-1.5 text-sm"
          placeholder="Filter repositories…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <label className="flex items-center gap-1.5 rounded border border-slate-700 bg-slate-800 px-2 text-xs text-slate-300 whitespace-nowrap">
          <input
            type="checkbox"
            checked={favOnly}
            onChange={(e) => onFavOnlyChange(e.target.checked)}
          />
          ★ favorites
        </label>
      </div>
      <div className="mt-2 max-h-64 overflow-auto rounded border border-slate-800">
        {filtered.length === 0 ? (
          <Empty text={favOnly ? "No favorite repositories." : "No repositories match."} />
        ) : (
          filtered.map((r) => {
            const isFav = favSet.has(r.full_name);
            return (
              <div
                key={r.id}
                className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-800 ${repo?.id === r.id ? "bg-indigo-900/30 ring-1 ring-indigo-700" : ""}`}
              >
                <button className="flex flex-1 items-center gap-2 text-left" onClick={() => onSelect(r)}>
                  <span
                    role="button"
                    title={isFav ? "Remove from favorites" : "Add to favorites"}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFav(r.full_name, isFav);
                    }}
                    className={`text-base leading-none select-none ${isFav ? "text-amber-400" : "text-slate-600 hover:text-slate-400"}`}
                  >
                    {isFav ? "★" : "☆"}
                  </span>
                  <span className="font-medium">{r.full_name}</span>
                </button>
                <span className="flex items-center gap-2 text-xs text-slate-400">
                  {r.private && <Badge color="amber">private</Badge>}
                  <span className="text-slate-500">default: {r.default_branch}</span>
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function BranchMultiSelect({
  branches,
  base,
  onBase,
  selected,
  onToggleSelected,
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const matched = term
      ? branches.filter((b) => {
          const haystack = [b.name, b.commit_message, b.author]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return haystack.includes(term);
        })
      : branches;
    return [...matched].sort((a, b) => {
      const ta = a.commit_date ? new Date(a.commit_date).getTime() : 0;
      const tb = b.commit_date ? new Date(b.commit_date).getTime() : 0;
      return tb - ta;
    });
  }, [branches, q]);

  return (
    <div>
      <div className="mb-2 flex items-start gap-3 text-xs text-slate-400">
        <label className="flex flex-col items-center gap-1.5">
          Base branch:
          <select
            value={base}
            onChange={(e) => onBase(e.target.value)}
            className="rounded bg-slate-800 border border-slate-700 px-2 py-1 text-sm text-slate-100"
          >
            {branches.map((b) => (
              <option key={b.name} value={b.name}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <input
        type="search"
        className="mt-2 mb-2 w-full rounded border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-sm placeholder-slate-500 outline-none focus:border-indigo-500"
        placeholder="Search branches by name, commit message, or author…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="max-h-64 overflow-auto rounded border border-slate-800">
        {branches.length === 0 ? (
          <Empty text="No branches." />
        ) : filtered.length === 0 ? (
          <Empty text={`No branches match "${q}".`} />
        ) : (
          filtered.map((b) => {
            const checked = selected.includes(b.name);
            const isBase = b.name === base;
            return (
              <label
                key={b.name}
                className={`flex cursor-pointer items-start gap-2 px-3 py-2 text-sm hover:bg-slate-800 ${checked ? "bg-indigo-900/20" : ""
                  } ${isBase ? "opacity-60" : ""}`}
              >
                <input
                  type="checkbox"
                  className="mt-0.5"
                  disabled={isBase}
                  checked={checked}
                  onChange={() => onToggleSelected(b.name)}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{b.name}</span>
                    {isBase && <Badge color="indigo">base</Badge>}
                    {b.protected && <Badge color="amber">protected</Badge>}
                  </div>
                  <div className="truncate text-xs text-slate-500">
                    {b.commit_message || b.commit_sha?.slice(0, 7)}
                    {b.author && ` · ${b.author}`}
                    {b.commit_date &&
                      ` · ${new Date(b.commit_date).toLocaleString()}`}
                  </div>
                </div>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}

function WorkflowPicker({
  workflows,
  workflowPath,
  onPick,
  inputs,
  inputsLoading,
}) {
  return (
    <div>
      <select
        value={workflowPath}
        onChange={(e) => onPick(e.target.value)}
        className="w-full rounded bg-slate-800 border border-slate-700 px-2.5 py-1.5 text-sm"
      >
        <option value="">Select a workflow…</option>
        {workflows.map((w) => (
          <option key={w.id} value={w.path}>
            {w.name} — {w.path} ({w.state})
          </option>
        ))}
      </select>
      {inputsLoading && (
        <p className="mt-2 text-xs text-slate-500">Loading inputs…</p>
      )}
      {inputs && inputs.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-slate-400">
          {inputs.map((i) => (
            <li key={i.name} className="flex justify-between gap-2">
              <span className="font-mono text-slate-300">
                {i.name}
                {i.required ? " *" : ""}
              </span>
              <span>
                {i.type}
                {i.options ? ` (${i.options.join("|")})` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
      {inputs && inputs.length === 0 && (
        <p className="mt-2 text-xs text-slate-500">
          This workflow has no <code>workflow_dispatch</code> inputs.
        </p>
      )}
    </div>
  );
}

function InputField({ spec, value, onChange }) {
  const label = (
    <label className="flex flex-col text-xs text-slate-400">
      <span className="flex items-center gap-1.5">
        {spec.name}
        {spec.required && <span className="text-rose-400">*</span>}
      </span>
      {spec.description && (
        <span className="text-slate-500">{spec.description}</span>
      )}
    </label>
  );

  if (spec.options) {
    return (
      <div>
        {label}
        <select
          className="mt-1 rounded bg-slate-800 border border-slate-700 px-2 py-1.5 text-sm text-slate-100"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        >
          {!spec.required && <option value="">(none)</option>}
          {spec.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>
    );
  }
  if (spec.type === "boolean") {
    return (
      <div className="flex items-center gap-2 pt-5">
        {label}
        <input
          type="checkbox"
          className="mt-0.5"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked)}
        />
      </div>
    );
  }
  if (
    spec.type === "number" ||
    spec.type === "integer" ||
    spec.type === "int"
  ) {
    return (
      <div>
        {label}
        <input
          type="number"
          className="mt-1 rounded bg-slate-800 border border-slate-700 px-2 py-1.5 text-sm text-slate-100"
          value={value ?? ""}
          onChange={(e) =>
            onChange(e.target.value === "" ? "" : Number(e.target.value))
          }
        />
      </div>
    );
  }
  return (
    <div>
      {label}
      <input
        type="text"
        className="mt-1 rounded bg-slate-800 border border-slate-700 px-2 py-1.5 text-sm text-slate-100"
        value={value ?? ""}
        placeholder={spec.default != null ? String(spec.default) : ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function ParamForm({ inputs, values, onValueChange }) {
  if (!inputs || inputs.length === 0) {
    return (
      <Empty text="No custom parameters for this workflow. The deploy run will use defaults." />
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {inputs.map((spec) => (
        <InputField
          key={spec.name}
          spec={spec}
          value={values[spec.name]}
          onChange={(v) => onValueChange(spec.name, v)}
        />
      ))}
    </div>
  );
}

export default function DeploymentConsole({
  activeTokenId,
  onDeployed,
  onViewHistory,
}) {
  const [repos, setRepos] = useState([]);
  const [repo, setRepo] = useState(null);
  const [branches, setBranches] = useState([]);
  const [base, setBase] = useState("");
  const [selected, setSelected] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [workflowPath, setWorkflowPath] = useState("");
  const [wfInputs, setWfInputs] = useState([]);
  const [inputsLoading, setInputsLoading] = useState(false);
  const [inputValues, setInputValues] = useState({});
  const [envName, setEnvName] = useState("staging");
  const [tempBranch, setTempBranch] = useState("");

  const [favorites, setFavorites] = useState([]);
  const [favOnly, setFavOnly] = useState(false);

  const [loadingRepos, setLoadingRepos] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [working, setWorking] = useState(false);
  const [deployResult, setDeployResult] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadFavorites() {
    try {
      setFavorites(await api.listFavorites());
    } catch {
      /* favorites are non-critical */
    }
  }

  async function toggleFav(fullName, currentlyFav) {
    try {
      if (currentlyFav) {
        await api.removeFavorite(fullName);
        setFavorites((f) => f.filter((x) => x.repo_full_name !== fullName));
      } else {
        const added = await api.addFavorite(fullName);
        setFavorites((f) =>
          f.some((x) => x.repo_full_name === fullName)
            ? f
            : [...f, added],
        );
      }
    } catch (e) {
      setError(apiError(e));
    }
  }

  async function loadRepos(refresh = false) {
    setLoadingRepos(true);
    setError("");
    try {
      setRepos(await api.listRepos(refresh));
    } catch (e) {
      setError(apiError(e));
    } finally {
      setLoadingRepos(false);
    }
  }

  useEffect(() => {
    if (activeTokenId !== undefined) loadRepos();
  }, [activeTokenId]);

  useEffect(() => {
    loadFavorites();
  }, []);

  async function pickRepo(r) {
    setRepo(r);
    setSelected([]);
    setBranches([]);
    setWorkflows([]);
    setWorkflowPath("");
    setWfInputs([]);
    setDeployResult(null);
    setInputValues({});
    setError("");
    setMessage("");
    setLoadingBranches(true);
    const [owner, rname] = r.full_name.split("/");
    setBase(r.default_branch || "main");
    try {
      const [bs, wfs] = await Promise.all([
        api.listBranches(owner, rname),
        api.listWorkflows(owner, rname).catch(() => []),
      ]);
      setBranches(bs);
      setWorkflows(wfs);
      if (bs.length && !bs.some((b) => b.name === r.default_branch))
        setBase(bs[0].name);
    } catch (e) {
      setError(apiError(e));
    } finally {
      setLoadingBranches(false);
    }
  }

  function toggleSelected(name) {
    setSelected((s) =>
      s.includes(name) ? s.filter((x) => x !== name) : [...s, name],
    );
  }

  async function refreshBranches() {
    if (!repo) return;
    const [owner, rname] = repo.full_name.split("/");
    setLoadingBranches(true);
    try {
      setBranches(await api.listBranches(owner, rname, true));
    } catch (e) {
      setError(apiError(e));
    } finally {
      setLoadingBranches(false);
    }
  }

  // Auto-load workflow inputs whenever a workflow is selected.
  async function loadWorkflowInputs(owner, rname, path) {
    setInputsLoading(true);
    try {
      const data = await api.workflowInputs(owner, rname, path);
      const inputs = data.inputs || [];
      setWfInputs(inputs);
      const defaults = {};
      inputs.forEach((i) => {
        if (i.default != null) defaults[i.name] = i.default;
      });
      setInputValues(defaults);
    } catch (e) {
      setError(apiError(e));
    } finally {
      setInputsLoading(false);
    }
  }

  function pickWorkflow(path) {
    setWorkflowPath(path);
    setWfInputs([]);
    setInputValues({});
    if (path && repo) {
      const [owner, rname] = repo.full_name.split("/");
      loadWorkflowInputs(owner, rname, path);
    }
  }

  async function doDeploy() {
    if (!repo || !workflowPath || selected.length === 0) return;
    const missing = wfInputs.filter(
      (i) =>
        i.required &&
        (inputValues[i.name] === undefined || inputValues[i.name] === ""),
    );
    if (missing.length) {
      setError(
        `Missing required inputs: ${missing.map((m) => m.name).join(", ")}`,
      );
      return;
    }
    setWorking(true);
    setError("");
    setMessage("");
    setDeployResult(null);
    try {
      const [owner, rname] = repo.full_name.split("/");
      const wf = workflows.find((w) => w.path === workflowPath);
      const result = await api.deploy(owner, rname, {
        base_branch: base,
        branches: selected,
        temp_branch: tempBranch || null,
        workflow_id: String(wf.id),
        workflow_name: wf.name,
        inputs: inputValues,
        environment: envName,
      });
      setDeployResult(result);
      setTempBranch(result.temp_branch);
      setMessage(
        `Merged into ${result.temp_branch} and dispatched run ${result.deployment.run_id ?? ""}.`,
      );
      onDeployed?.();
    } catch (e) {
      setError(apiError(e));
    } finally {
      setWorking(false);
    }
  }

  const canDeploy =
    repo && workflowPath && selected.length > 0 && base && !working;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card
        title="1 · Repository"
        right={
          repos.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => loadRepos(true)}
              disabled={loadingRepos}
            >
              {loadingRepos ? "Refreshing…" : "Refresh"}
            </Button>
          )
        }
      >
        {!activeTokenId && activeTokenId !== undefined && (
          <Empty text="Activate a token first in the Configure tab." />
        )}
        {loadingRepos ? (
          <Spinner label="Fetching repositories…" />
        ) : (
          repos.length > 0 && (
            <RepoPicker
              repos={repos}
              repo={repo}
              onSelect={pickRepo}
              favorites={favorites}
              favOnly={favOnly}
              onFavOnlyChange={setFavOnly}
              onToggleFav={toggleFav}
            />
          )
        )}
        {repo && (
          <div className="mt-3 text-xs text-slate-400">
            <a
              className="text-indigo-400 hover:underline"
              target="_blank"
              rel="noreferrer"
              href={repo.html_url}
            >
              View {repo.full_name} on GitHub ↗
            </a>
          </div>
        )}
      </Card>

      <Card
        title="2 · Branches to merge"
        right={
          <div className="flex items-center gap-2">
            {repo && <Badge color="slate">{selected.length} selected</Badge>}
            {repo && (
              <Button
                size="sm"
                variant="ghost"
                onClick={refreshBranches}
                disabled={loadingBranches}
              >
                {loadingBranches ? "Refreshing…" : "Refresh"}
              </Button>
            )}
          </div>
        }
      >
        {!repo ? (
          <Empty text="Pick a repository to load its branches." />
        ) : loadingBranches ? (
          <Spinner label="Loading branches…" />
        ) : (
          <BranchMultiSelect
            branches={branches}
            base={base}
            onBase={setBase}
            selected={selected}
            onToggleSelected={toggleSelected}
          />
        )}
        {repo && (
          <div className="mt-3">
            <label className="flex flex-col text-xs text-slate-400">
              Temp branch name (optional — auto-generated if blank)
              <input
                className="mt-1 rounded bg-slate-800 border border-slate-700 px-2 py-1.5 text-sm font-mono"
                value={tempBranch}
                onChange={(e) => setTempBranch(e.target.value)}
                placeholder="branchstack/_merge-…"
              />
            </label>
          </div>
        )}
      </Card>

      <Card title="3 · Deploy workflow" className="lg:col-span-2">
        {!repo ? (
          <Empty text="Select a repository first." />
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <WorkflowPicker
                workflows={workflows}
                workflowPath={workflowPath}
                onPick={pickWorkflow}
                inputs={wfInputs}
                inputsLoading={inputsLoading}
              />
              <label className="flex flex-col text-xs text-slate-400">
                Target environment
                <select
                  className="mt-1 rounded bg-slate-800 border border-slate-700 px-2 py-1.5 text-sm text-slate-100"
                  value={envName}
                  onChange={(e) => setEnvName(e.target.value)}
                >
                  <option>staging</option>
                  <option>production</option>
                  <option>dev</option>
                  <option>qa</option>
                </select>
              </label>
            </div>

            <div className="mt-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Custom parameters
              </h3>
              <ParamForm
                inputs={wfInputs}
                values={inputValues}
                onValueChange={(n, v) =>
                  setInputValues((s) => ({ ...s, [n]: v }))
                }
              />
            </div>
          </>
        )}
      </Card>

      <Card title="4 · Review & deploy" className="lg:col-span-2">
        <ErrorBanner message={error} />
        {message && (
          <div className="mb-2 rounded border border-emerald-800/50 bg-emerald-900/10 p-2 text-sm text-emerald-300">
            {message}
          </div>
        )}
        <div className="text-sm text-slate-300 space-y-0.5">
          <div>
            Repo: <span className="font-medium">{repo?.full_name ?? "—"}</span>
          </div>
          <div>
            Base: <code>{base || "—"}</code> · Branches:{" "}
            <code>{selected.join(", ") || "—"}</code>
          </div>
          <div>
            Workflow: <code>{workflowPath || "—"}</code> · Environment:{" "}
            <code>{envName}</code>
          </div>
          {deployResult && (
            <div>
              Temp branch:{" "}
              <code className="text-emerald-300">
                {deployResult.temp_branch}
              </code>{" "}
              · Run: {deployResult.deployment.run_id ?? "—"}
            </div>
          )}
        </div>

        {deployResult && (
          <div className="mt-3 rounded border border-emerald-800/50 bg-emerald-900/10 p-2 text-xs">
            <div className="mb-1 font-mono text-emerald-300">
              {deployResult.temp_branch}
            </div>
            <ul className="space-y-0.5 text-slate-400">
              {deployResult.merge_log.map((l, idx) => (
                <li key={idx}>
                  <Badge
                    color={
                      l.action === "merged"
                        ? "green"
                        : l.action === "noop"
                          ? "slate"
                          : "indigo"
                    }
                  >
                    {l.action}
                  </Badge>{" "}
                  {l.branch} {l.sha ? `(${l.sha.slice(0, 7)})` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-3 flex items-center gap-2">
          <Button
            variant="primary"
            size="lg"
            onClick={doDeploy}
            disabled={!canDeploy}
          >
            {working ? "Deploying…" : "Deploy"}
          </Button>
          {!activeTokenId && activeTokenId !== undefined && (
            <span className="text-xs text-slate-500">
              Activate a token in the Configure tab first.
            </span>
          )}
          {deployResult && (
            <Button size="md" variant="outline" onClick={onViewHistory}>
              View in history
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}

// small inline wrapper to keep param grid tidy
