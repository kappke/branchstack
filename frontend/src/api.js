import axios from 'axios'

const SESSION_KEY = 'branchstack_session'

export function getSessionToken() {
  return localStorage.getItem(SESSION_KEY)
}

export function setSessionToken(token) {
  if (token) localStorage.setItem(SESSION_KEY, token)
  else localStorage.removeItem(SESSION_KEY)
}

const http = axios.create({ baseURL: '/api' })

http.interceptors.request.use((config) => {
  const token = getSessionToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

let onUnauthorized = null
export function setOnUnauthorized(fn) {
  onUnauthorized = fn
}

http.interceptors.response.use(
  (r) => r,
  (err) => {
    const status = err?.response?.status
    const url = err?.config?.url || ''
    if (status === 401 && url !== '/auth/login' && url !== '/auth/me') {
      setSessionToken(null)
      if (onUnauthorized) onUnauthorized()
    }
    return Promise.reject(err)
  },
)

export function apiError(err) {
  return (
    err?.response?.data?.detail ||
    err?.response?.data?.message ||
    err?.message ||
    'Unknown error'
  )
}

export const api = {
  // auth
  login: (username, password) =>
    http.post('/auth/login', { username, password }).then((r) => {
      setSessionToken(r.data.token)
      return r.data
    }),
  logout: () => http.post('/auth/logout').then((r) => r.data).finally(() => setSessionToken(null)),
  me: () => http.get('/auth/me').then((r) => r.data),
  changePassword: (currentPassword, newPassword) =>
    http.post('/auth/password', { current_password: currentPassword, new_password: newPassword }).then((r) => r.data),

  // users (add new user — only from the config panel, no public registration)
  listUsers: () => http.get('/users').then((r) => r.data),
  addUser: (username, password) => http.post('/users', { username, password }).then((r) => r.data),

  // favorites (per user)
  listFavorites: () => http.get('/favorites').then((r) => r.data),
  addFavorite: (repo_full_name) =>
    http.post('/favorites', { repo_full_name }).then((r) => r.data),
  removeFavorite: (repo_full_name) =>
    http.delete(`/favorites/${encodeURIComponent(repo_full_name)}`, { validateStatus: () => true }),

  // tokens
  listTokens: () => http.get('/tokens').then((r) => r.data),
  addToken: (name, token) => http.post('/tokens', { name, token }).then((r) => r.data),
  activateToken: (id) => http.post(`/tokens/${id}/activate`).then((r) => r.data),
  deleteToken: (id) => http.delete(`/tokens/${id}`),

  // repos (cached server-side; pass refresh=true to bypass cache)
  listRepos: (refresh = false) => http.get('/repos', { params: refresh ? { refresh: true } : {} }).then((r) => r.data),
  listBranches: (owner, repo, refresh = false) =>
    http.get(`/repos/${owner}/${repo}/branches`, { params: refresh ? { refresh: true } : {} }).then((r) => r.data),
  listWorkflows: (owner, repo, refresh = false) =>
    http.get(`/repos/${owner}/${repo}/workflows`, { params: refresh ? { refresh: true } : {} }).then((r) => r.data),
  workflowInputs: (owner, repo, path, refresh = false) =>
    http.get(`/repos/${owner}/${repo}/workflows/${path}/inputs`, { params: refresh ? { refresh: true } : {} }).then((r) => r.data),

  // merge + deploy (separate, kept for advanced/manual use)
  merge: (owner, repo, body) => http.post(`/repos/${owner}/${repo}/merge`, body).then((r) => r.data),
  dispatch: (owner, repo, body) => http.post(`/repos/${owner}/${repo}/dispatch`, body).then((r) => r.data),

  // one-click deploy (merge + dispatch in a single call)
  deploy: (owner, repo, body) => http.post(`/repos/${owner}/${repo}/deploy`, body).then((r) => r.data),

  // history
  listDeployments: () => http.get('/deployments').then((r) => r.data),
  refreshDeployment: (id) => http.post(`/deployments/${id}/refresh`).then((r) => r.data),
  cleanupBranch: (id) => http.delete(`/deployments/${id}/branch`).then((r) => r.data),
}