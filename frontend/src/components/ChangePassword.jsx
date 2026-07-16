import React, { useState } from 'react'
import { api, apiError } from '../api'
import { Button, Card, ErrorBanner } from './ui'

export default function ChangePassword() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')
    setDone(false)
    if (newPassword !== confirm) {
      setError('New password and confirmation do not match')
      return
    }
    if (!newPassword) {
      setError('New password must not be empty')
      return
    }
    setSubmitting(true)
    try {
      await api.changePassword(currentPassword, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setConfirm('')
      setDone(true)
    } catch (err) {
      setError(apiError(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card title="Change password">
      <ErrorBanner message={error} />
      {done && (
        <div className="mb-3 rounded-md border border-emerald-800 bg-emerald-900/30 px-3 py-2 text-sm text-emerald-300">
          Password updated.
        </div>
      )}
      <form onSubmit={submit} className="space-y-3">
        <label className="flex flex-col text-xs text-slate-400">
          Current password
          <input
            type="password"
            className="mt-1 rounded bg-slate-800 border border-slate-700 px-2.5 py-1.5 text-sm text-slate-100"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
        </label>
        <label className="flex flex-col text-xs text-slate-400">
          New password
          <input
            type="password"
            className="mt-1 rounded bg-slate-800 border border-slate-700 px-2.5 py-1.5 text-sm text-slate-100"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
        </label>
        <label className="flex flex-col text-xs text-slate-400">
          Confirm new password
          <input
            type="password"
            className="mt-1 rounded bg-slate-800 border border-slate-700 px-2.5 py-1.5 text-sm text-slate-100"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </label>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Updating…' : 'Update password'}
        </Button>
      </form>
    </Card>
  )
}