import { useEffect, useState } from "react";
import { api, setOnUnauthorized } from "./api";
import Login from "./components/Login";
import TokenManager from "./components/TokenManager";
import UserManager from "./components/UserManager";
import ChangePassword from "./components/ChangePassword";
import DeploymentConsole from "./components/DeploymentConsole";
import DeploymentHistory from "./components/DeploymentHistory";
import { Badge, Button } from "./components/ui";

const TABS = [
  { id: "deploy", label: "Deploy" },
  { id: "configure", label: "Configure" },
  { id: "history", label: "History" },
];

export default function App() {
  const [authState, setAuthState] = useState("checking"); // checking | anon | authed
  const [user, setUser] = useState(null);
  const [activeToken, setActiveToken] = useState(null);
  const [historyKey, setHistoryKey] = useState(0);
  const [tab, setTab] = useState("deploy");

  async function refreshMe() {
    try {
      const me = await api.me();
      setUser(me);
      setAuthState("authed");
    } catch {
      setUser(null);
      setAuthState("anon");
    }
  }

  useEffect(() => {
    setOnUnauthorized(() => setAuthState("anon"));
    refreshMe();
  }, []);

  async function logout() {
    try {
      await api.logout();
    } catch {
      /* ignore */
    }
    setUser(null);
    setActiveToken(null);
    setAuthState("anon");
  }

  if (authState === "checking") {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-500 grid place-items-center">
        Loading…
      </div>
    );
  }

  if (authState === "anon") {
    return <Login onSuccess={refreshMe} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/40">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded bg-indigo-600 grid place-items-center font-bold">
              b
            </div>
            <h1 className="text-lg font-semibold">BranchStack</h1>
          </div>
          <div className="flex items-center gap-3">
            {activeToken && (
              <Badge color="green">
                token: {activeToken.name} ({activeToken.label})
              </Badge>
            )}
            {user && (
              <span className="text-xs text-slate-400">
                signed in as {user.username}
              </span>
            )}
            <Button size="sm" variant="ghost" onClick={logout}>
              Sign out
            </Button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-1 px-4">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${tab === t.id
                  ? "border-indigo-500 text-slate-100"
                  : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-7xl space-y-4 px-4 py-5">
        {tab === "deploy" && (
          <DeploymentConsole
            activeTokenId={activeToken?.id}
            onDeployed={() => setHistoryKey((k) => k + 1)}
            onViewHistory={() => setTab("history")}
          />
        )}
        {/* Always mounted so it loads tokens + sets the active one on startup,
            even when the user lands on the Deploy tab. Hidden when not active. */}
        <div className={tab === "configure" ? "space-y-4" : "hidden"}>
          <TokenManager user={user} onActiveChange={setActiveToken} />
          <UserManager />
          <ChangePassword />
        </div>
        {tab === "history" && <DeploymentHistory refreshKey={historyKey} />}
      </main>

      <footer className="mx-auto max-w-7xl px-4 py-6 text-center text-xs text-slate-600">
        BranchStack
      </footer>
    </div>
  );
}
