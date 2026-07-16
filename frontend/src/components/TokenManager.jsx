import React, { useEffect, useState } from 'react'
import { api, apiError } from '../api'
import { Button, Card, Badge, Empty, ErrorBanner, Spinner } from './ui'

export default function TokenManager({ onActiveChange }) {
  const [tokens, setTokens] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [token, setToken] = useState('')
  const [adding, setAdding] = useState(false)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const data = await api.listTokens()
      setTokens(data)
      const active = data.find((t) => t.is_active)
      if (active) onActiveChange?.(active)
    } catch (e) {
      setError(apiError(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function add(e) {
    e.preventDefault()
    setAdding(true)
    setError('')
    try {
      await api.addToken(name.trim(), token.trim())
      setName('')
      setToken('')
      await load()
    } catch (e) {
      setError(apiError(e))
    } finally {
      setAdding(false)
    }
  }

  async function activate(id) {
    try {
      const updated = await api.activateToken(id)
      await load()
      onActiveChange?.(updated)
    } catch (e) {
      setError(apiError(e))
    }
  }

  async function remove(id) {
    if (!confirm('Delete this token? Its deployment history remains but statuses can no longer be refreshed.')) return
    try {
      await api.deleteToken(id)
      await load()
    } catch (e) {
      setError(apiError(e))
    }
  }

  return (
    <Card
      title="GitHub Tokens (fine-grained PATs)"
      right={
        tokens.length > 0 && (
          <Badge color={tokens.some((t) => t.is_active) ? 'green' : 'amber'}>
            {tokens.some((t) => t.is_active) ? '1 active' : 'none active'}
          </Badge>
        )
      }
    >
      <ErrorBanner message={error} />
      <form onSubmit={add} className="mt-2 flex flex-wrap items-end gap-2">
        <label className="flex flex-col text-xs text-slate-400">
          Name
          <input
            className="mt-1 rounded bg-slate-800 border border-slate-700 px-2 py-1.5 text-sm text-slate-100"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. work-github"
            required
          />
        </label>
        <label className="flex flex-1 min-w-[220px] flex-col text-xs text-slate-400">
          Token
          <input
            className="mt-1 rounded bg-slate-800 border border-slate-700 px-2 py-1.5 text-sm text-slate-100 font-mono"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="github_pat_..."
            type="password"
            required
          />
        </label>
        <Button type="submit" disabled={adding}>
          {adding ? 'Adding…' : 'Add token'}
        </Button>
      </form>

      <div className="mt-4 space-y-2">
        {loading ? (
          <Spinner label="Loading tokens…" />
        ) : tokens.length === 0 ? (
          <Empty text="No tokens yet. Add one above (repo + Actions read/write permissions)." />
        ) : (
          tokens.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-900/40 px-3 py-2"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{t.name}</span>
                  <Badge color={t.is_active ? 'green' : 'slate'}>{t.is_active ? 'ACTIVE' : 'idle'}</Badge>
                </div>
                <div className="text-xs text-slate-500">
                  {t.label} · scopes: {t.scopes || '(fine-grained)'} · added {new Date(t.created_at).toLocaleString()}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!t.is_active && (
                  <Button size="sm" variant="secondary" onClick={() => activate(t.id)}>
                    Activate
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => remove(t.id)}>
                  Delete
                </Button>
              </div>
            </div>
          ))
        )}
        <p className="text-xs text-slate-500 pt-1">
          Tip: fine-grained PATs need <code>Contents: Read/Write</code>, <code>Actions: Write</code>, and{' '}
          <code>Pull requests: Write</code> on the repos you want to merge+deploy.
        </p>
      </div>
    </Card>
  )
}