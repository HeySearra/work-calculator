// 后端 API 客户端：相对路径 /api（开发走 Vite 代理，生产由 FastAPI 同源托管）
const TOKEN_KEY = 'wc_token'
const USER_KEY = 'wc_user'

export function getToken(): string {
  return (typeof localStorage !== 'undefined' && localStorage.getItem(TOKEN_KEY)) || ''
}
export function getUsername(): string {
  return (typeof localStorage !== 'undefined' && localStorage.getItem(USER_KEY)) || ''
}
export function setToken(token: string, username: string) {
  if (typeof localStorage === 'undefined') return
  if (token) {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(USER_KEY, username)
  } else {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  }
}

async function req(path: string, opts: RequestInit = {}) {
  const token = getToken()
  const headers: Record<string, string> = { ...(opts.headers as Record<string, string>) }
  if (opts.body && typeof opts.body === 'string') headers['Content-Type'] = 'application/json'
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(path, { ...opts, headers })
  if (res.status === 401) {
    setToken('', '')
    throw new Error('未登录或登录已过期')
  }
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`${res.status} ${txt}`)
  }
  return res
}

export const api = {
  async register(username: string, password: string) {
    const r = await req('/api/auth/register', { method: 'POST', body: JSON.stringify({ username, password }) })
    return r.json()
  },
  async login(username: string, password: string) {
    const r = await req('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) })
    return r.json()
  },
  async me() {
    const r = await req('/api/auth/me')
    return r.json()
  },
  async getState() {
    const r = await req('/api/state')
    return r.json()
  },
  async putState(state: unknown) {
    const r = await req('/api/state', { method: 'PUT', body: JSON.stringify(state) })
    return r.json().catch(() => ({}))
  },
  async savePunch(date: string, rec: unknown) {
    const r = await req(`/api/punch/${date}`, { method: 'POST', body: JSON.stringify(rec) })
    return r.json()
  },
  async deletePunch(date: string) {
    await req(`/api/punch/${date}`, { method: 'DELETE' })
  },
  async saveInvest(kind: string, payload: unknown) {
    const r = await req(`/api/invest/${kind}`, { method: 'POST', body: JSON.stringify(payload) })
    return r.json()
  },
  async exportData(): Promise<Blob> {
    const r = await req('/api/export')
    return r.blob()
  },
  async importData(obj: unknown) {
    const r = await req('/api/import', { method: 'POST', body: JSON.stringify(obj) })
    return r.json()
  },
  async getHolidays(year: number): Promise<{ year: number; holidays: string[]; workdays: string[] }> {
    const r = await req(`/api/holidays/${year}`)
    return r.json()
  },
  async syncBenchmarks(): Promise<{ updated: string; data: Record<string, Record<string, number>> }> {
    const r = await req(`/api/benchmarks/sync`)
    return r.json()
  },
  async getPensionBases(): Promise<{ year: number; note: string; bases: Record<string, number> }> {
    const r = await req(`/api/pension-bases`)
    return r.json()
  },
}
