import React, { useState } from 'react'
import { api, apiError } from '../api'
import { Button, ErrorBanner } from './ui'

export default function Login({ onSuccess }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      await api.login(username.trim(), password)
      onSuccess?.()
    } catch (err) {
      setError(apiError(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2 justify-center">
          <div className="h-8 w-8 rounded bg-indigo-600 grid place-items-center font-bold">b</div>
          <h1 className="text-xl font-semibold">BranchStack</h1>
        </div>
        <form
          onSubmit={submit}
          className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-3"
        >
          <h2 className="text-sm font-semibold tracking-wide text-slate-200">Sign in</h2>
          <ErrorBanner message={error} />
          <label className="flex flex-col text-xs text-slate-400">
            Username
            <input
              className="mt-1 rounded bg-slate-800 border border-slate-700 px-2.5 py-1.5 text-sm text-slate-100"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              required
            />
          </label>
          <label className="flex flex-col text-xs text-slate-400">
            Password
            <input
              type="password"
              className="mt-1 rounded bg-slate-800 border border-slate-700 px-2.5 py-1.5 text-sm text-slate-100"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
          <p className="text-xs text-slate-500 text-center">
            New users are created from the Configure panel after sign-in.
          </p>
        </form>
      </div>
    </div>
  )
}