import React, { useEffect, useState } from 'react'
import { api, apiError } from '../api'
import { Badge, Button, Card, Empty, ErrorBanner, Spinner } from './ui'

function statusColor(status) {
  if (!status) return 'slate'
  if (status.includes('success')) return 'green'
  if (status.includes('failure') || status.includes('cancelled')) return 'red'
  if (status.includes('in_progress') || status.includes('queued')) return 'amber'
  return 'indigo'
}

export default function DeploymentHistory({ refreshKey }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      setItems(await api.listDeployments())
    } catch (e) {
      setError(apiError(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [refreshKey])

  const poll = async (id) => {
    try {
      await api.refreshDeployment(id)
      await load()
    } catch (e) {
      setError(apiError(e))
    }
  }

  return (
    <Card
      title="Deployment history"
      right={
        <Button size="sm" variant="ghost" onClick={load}>
          Refresh
        </Button>
      }
    >
      <ErrorBanner message={error} />
      {loading ? (
        <Spinner label="Loading history…" />
      ) : items.length === 0 ? (
        <Empty text="No deployments yet." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-1.5 pr-3 text-left">Repo</th>
                <th className="py-1.5 pr-3 text-left">Branches</th>
                <th className="py-1.5 pr-3 text-left">Temp</th>
                <th className="py-1.5 pr-3 text-left">Workflow</th>
                <th className="py-1.5 pr-3 text-left">Status</th>
                <th className="py-1.5 pr-3 text-left">Run</th>
                <th className="py-1.5 text-left">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {items.map((d) => {
                const branches = (() => {
                  try {
                    return JSON.parse(d.selected_branches || '[]').join(', ')
                  } catch {
                    return d.selected_branches
                  }
                })()
                const inputs = (() => {
                  try {
                    return JSON.parse(d.inputs || '{}')
                  } catch {
                    return {}
                  }
                })()
                return (
                  <tr key={d.id} className="align-top">
                    <td className="py-2 pr-3 font-medium">{d.repo_full_name}</td>
                    <td className="py-2 pr-3 text-slate-400">{branches || '—'}</td>
                    <td className="py-2 pr-3 font-mono text-xs text-slate-300">{d.temp_branch}</td>
                    <td className="py-2 pr-3 text-slate-300">
                      {d.workflow_name || d.workflow_id}
                      {Object.keys(inputs).length > 0 && (
                        <details className="text-xs text-slate-500">
                          <summary className="cursor-pointer">inputs ({Object.keys(inputs).length})</summary>
                          <pre className="mt-1 max-w-xs overflow-auto rounded bg-slate-900 p-2">
                            {JSON.stringify(inputs, null, 2)}
                          </pre>
                        </details>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      <Badge color={statusColor(d.status)}>{d.status || 'queued'}</Badge>
                    </td>
                    <td className="py-2 pr-3">
                      {d.html_url ? (
                        <a className="text-indigo-400 hover:underline" target="_blank" rel="noreferrer" href={d.html_url}>
                          #{d.run_id ?? 'view'} ↗
                        </a>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                      {d.run_id && (
                        <div className="mt-1 flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => poll(d.id)}>
                            poll
                          </Button>
                          {d.temp_branch.startsWith('branchstack/') && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={async () => {
                                if (!confirm(`Delete temp branch ${d.temp_branch} on ${d.repo_full_name}?`)) return
                                try {
                                  await api.cleanupBranch(d.id)
                                  await load()
                                } catch (e) {
                                  setError(apiError(e))
                                }
                              }}
                            >
                              cleanup
                            </Button>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-2 text-xs text-slate-500">
                      {new Date(d.created_at).toLocaleString()}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}