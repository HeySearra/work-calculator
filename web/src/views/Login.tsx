import { useState, type FormEvent } from 'react'
import { api } from '../api'
import { useStore } from '../store'

export function Login() {
  const setAuth = useStore((s) => s.setAuth)
  const loadState = useStore((s) => s.loadState)
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setErr('')
    if (username.trim().length < 2 || password.length < 6) {
      setErr('用户名至少 2 位，密码至少 6 位')
      return
    }
    setBusy(true)
    try {
      const fn = mode === 'login' ? api.login : api.register
      const r = await fn(username.trim(), password)
      if (!r || !r.token) {
        setErr(mode === 'login' ? '用户名或密码错误' : '注册失败（用户名可能已被占用）')
        return
      }
      setAuth(r.token, r.username || username.trim())
      await loadState()
    } catch (e: any) {
      setErr(e?.message || '网络错误')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="view" style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: 80 }}>
      <div className="card" style={{ width: 360 }}>
        <div className="brand" style={{ padding: '4px 0 16px' }}>打工人仪表盘<small>work·calculator · 多用户版</small></div>
        <div className="row" style={{ marginBottom: 16 }}>
          <button className={`btn ${mode === 'login' ? 'primary' : 'ghost'}`} style={{ flex: 1 }} onClick={() => setMode('login')}>登录</button>
          <button className={`btn ${mode === 'register' ? 'primary' : 'ghost'}`} style={{ flex: 1 }} onClick={() => setMode('register')}>注册</button>
        </div>
        <form onSubmit={submit}>
          <div className="field">
            <label>用户名</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="letter / 数字" autoFocus />
          </div>
          <div className="field">
            <label>密码</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="至少 6 位" />
          </div>
          {err && <div className="hint" style={{ color: 'var(--up)', marginBottom: 10 }}>{err}</div>}
          <button className="btn primary" style={{ width: '100%' }} disabled={busy}>{busy ? '处理中…' : mode === 'login' ? '登录' : '创建账号'}</button>
        </form>
        <div className="hint" style={{ marginTop: 12 }}>数据保存在服务器数据库，换设备登录即可同步。</div>
      </div>
    </div>
  )
}
