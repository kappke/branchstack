import React, { useEffect, useState } from 'react'
import { api, apiError } from '../api'
import { Button, Card, Badge, Empty, ErrorBanner, Spinner } from './ui'

export default function TokenManager({ user, onActiveChange }) {
  const [token, setToken] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [githubToken, setGithubToken] = useState('')
  const [organization, setOrganization] = useState('')
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)

  const isAdmin = !!user?.is_admin

  async function load() {
    setLoading(true)
    setError('')
    try {
      const data = await api.getToken()
      setToken(data)
      if (data) {
        onActiveChange?.(data)
        setName(data.name || '')
        setOrganization(data.organization || '')
      } else {
        onActiveChange?.(null)
      }
    } catch (e) {
      setError(apiError(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const saved = await api.setToken(name.trim(), githubToken.trim(), organization.trim())
      setGithubToken('')
      setToken(saved)
      onActiveChange?.(saved)
      setName(saved.name || name.trim())
      setOrganization(saved.organization || organization.trim())
    } catch (e) {
      setError(apiError(e))
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!confirm('Remove the configured GitHub token? Deployments and repo listing will stop working until a new one is set.')) return
    setRemoving(true)
    setError('')
    try {
      await api.deleteToken()
      setToken(null)
      setName('')
      setOrganization('')
      onActiveChange?.(null)
    } catch (e) {
      setError(apiError(e))
    } finally {
      setRemoving(false)
    }
  }

  const title = token
    ? 'GitHub token — configured'
    : 'GitHub token — not configured yet'

  return (
    <Card
      title={title}
      right={
        token ? (
          <Badge color="green">active</Badge>
        ) : (
          <Badge color="amber">none</Badge>
        )
      }
    >
      <ErrorBanner message={error} />

      {loading ? (
        <Spinner label="Loading token…" />
      ) : token ? (
        <div className="space-y-2">
          <div className="rounded-md border border-slate-800 bg-slate-900/40 px-3 py-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{token.name}</div>
                <div className="text-xs text-slate-500">
                  {token.label}
                  {token.organization ? ` · org: ${token.organization}` : ''}
                  {' · scopes: '}
                  {token.scopes || '(fine-grained)'}
                  {' · added '}
                  {new Date(token.created_at).toLocaleString()}
                </div>
              </div>
              {isAdmin && (
                <Button size="sm" variant="ghost" onClick={remove} disabled={removing}>
                  {removing ? 'Removing…' : 'Delete'}
                </Button>
              )}
            </div>
          </div>
          {isAdmin && (
            <details className="text-xs text-slate-400">
              <summary className="cursor-pointer">Replace token / change organization</summary>
              <form onSubmit={save} className="mt-2 flex flex-wrap items-end gap-2">
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
                <label className="flex flex-col text-xs text-slate-400">
                  Organization
                  <input
                    className="mt-1 rounded bg-slate-800 border border-slate-700 px-2 py-1.5 text-sm text-slate-100"
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                    placeholder="my-org (repos will be filtered to this org)"
                  />
                </label>
                <label className="flex flex-1 min-w-[220px] flex-col text-xs text-slate-400">
                  Token
                  <input
                    className="mt-1 rounded bg-slate-800 border border-slate-700 px-2 py-1.5 text-sm text-slate-100 font-mono"
                    value={githubToken}
                    onChange={(e) => setGithubToken(e.target.value)}
                    placeholder="github_pat_…"
                    type="password"
                    required
                  />
                </label>
                <Button type="submit" disabled={saving}>
                  {saving ? 'Saving…' : 'Replace token'}
                </Button>
              </form>
            </details>
          )}
        </div>
      ) : isAdmin ? (
        <form onSubmit={save} className="flex flex-wrap items-end gap-2">
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
          <label className="flex flex-col text-xs text-slate-400">
            Organization
            <input
              className="mt-1 rounded bg-slate-800 border border-slate-700 px-2 py-1.5 text-sm text-slate-100"
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
              placeholder="my-org (repos will be filtered to this org)"
            />
          </label>
          <label className="flex flex-1 min-w-[220px] flex-col text-xs text-slate-400">
            Token
            <input
              className="mt-1 rounded bg-slate-800 border border-slate-700 px-2 py-1.5 text-sm text-slate-100 font-mono"
              value={githubToken}
              onChange={(e) => setGithubToken(e.target.value)}
              placeholder="github_pat_…"
              type="password"
              required
            />
          </label>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save token'}
          </Button>
        </form>
      ) : (
        <Empty text="No GitHub token configured. Ask an admin to add one in the Configure tab." />
      )}

      <p className="mt-4 text-xs text-slate-500">
        Tip: fine-grained PATs need <code>Contents: Read/Write</code>, <code>Actions: Write</code>, and{' '}
        <code>Pull requests: Write</code> on the repos you want to merge+deploy.
      </p>
    </Card>
  )
}