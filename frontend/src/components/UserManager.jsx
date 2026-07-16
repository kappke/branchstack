import React, { useEffect, useState } from "react";
import { api, apiError } from "../api";
import { Badge, Button, Card, Empty, ErrorBanner, Spinner } from "./ui";

export default function UserManager() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [adding, setAdding] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      setUsers(await api.listUsers());
    } catch (e) {
      setError(apiError(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function add(e) {
    e.preventDefault();
    setAdding(true);
    setError("");
    try {
      await api.addUser(username.trim(), password);
      setUsername("");
      setPassword("");
      await load();
    } catch (e) {
      setError(apiError(e));
    } finally {
      setAdding(false);
    }
  }

  return (
    <Card
      title="Users"
      right={
        users.length > 0 ? (
          <Badge color="slate">{users.length} total</Badge>
        ) : null
      }
    >
      <ErrorBanner message={error} />
      <form onSubmit={add} className="mt-2 flex flex-wrap items-end gap-2">
        <label className="flex flex-col text-xs text-slate-400">
          Username
          <input
            className="mt-1 rounded bg-slate-800 border border-slate-700 px-2 py-1.5 text-sm text-slate-100"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="newuser"
            required
          />
        </label>
        <label className="flex flex-1 min-w-[220px] flex-col text-xs text-slate-400">
          Password
          <input
            type="password"
            className="mt-1 rounded bg-slate-800 border border-slate-700 px-2 py-1.5 text-sm text-slate-100"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="set a strong password"
            required
          />
        </label>
        <Button type="submit" disabled={adding}>
          {adding ? "Adding…" : "Add user"}
        </Button>
      </form>

      <div className="mt-4 space-y-2">
        {loading ? (
          <Spinner label="Loading users…" />
        ) : users.length === 0 ? (
          <Empty text="No users." />
        ) : (
          users.map((u) => (
            <div
              key={u.id}
              className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-900/40 px-3 py-2"
            >
              <div className="text-sm">
                <span className="font-medium">{u.username}</span>
                <span className="ml-2 text-xs text-slate-500">
                  added {new Date(u.created_at).toLocaleString()}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
