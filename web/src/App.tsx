import { useEffect, useState } from 'react'
import { useStore } from './store'
import { Login } from './views/Login'
import { Today } from './views/Today'
import { History } from './views/History'
import { Assets } from './views/Assets'
import { Pension } from './views/Pension'
import { Fire } from './views/Fire'
import { Invest } from './views/Invest'
import { Settings } from './views/Settings'

const VIEWS = [
  { key: 'today', label: '打工人仪表盘', icon: '🏠', el: Today },
  { key: 'history', label: '在司时长', icon: '📅', el: History },
  { key: 'assets', label: '净资产', icon: '💰', el: Assets },
  { key: 'pension', label: '养老账户', icon: '🏦', el: Pension },
  { key: 'fire', label: 'FIRE', icon: '🔥', el: Fire },
  { key: 'invest', label: '投资', icon: '📈', el: Invest },
  { key: 'settings', label: '设置', icon: '⚙️', el: Settings },
] as const

export default function App() {
  const authed = useStore((s) => s.authed)
  const ready = useStore((s) => s.ready)
  const username = useStore((s) => s.username)
  const loadState = useStore((s) => s.loadState)
  const logout = useStore((s) => s.logout)
  const [view, setView] = useState<(typeof VIEWS)[number]['key']>('today')
  const [dark, setDark] = useState(() => (localStorage.getItem('wc_mode') === 'dark'))

  useEffect(() => {
    document.documentElement.setAttribute('data-mode', dark ? 'dark' : 'light')
    localStorage.setItem('wc_mode', dark ? 'dark' : 'light')
  }, [dark])

  useEffect(() => {
    if (authed && !ready) {
      loadState().catch(() => logout())
    }
  }, [authed, ready, loadState, logout])

  if (!authed) return <Login />
  if (!ready) return <div className="view"><div className="muted">加载中…</div></div>

  const active = VIEWS.find((v) => v.key === view) || VIEWS[0]
  const Active = active.el

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">打工人仪表盘<small>work·calculator</small></div>
        <nav className="nav">
          {VIEWS.map((v) => (
            <button key={v.key} className={`nav-item ${v.key === view ? 'active' : ''}`} onClick={() => setView(v.key)}>
              <span>{v.icon}</span><span>{v.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <div className="main">
        <header className="topbar">
          <h2>{active.label}</h2>
          <div className="spacer" />
          <span className="muted">{username}</span>
          <button className="icon-btn" title="切换主题" onClick={() => setDark((d) => !d)}>{dark ? '☀️' : '🌙'}</button>
          <button className="btn ghost" onClick={() => { logout(); setView('today') }}>退出</button>
        </header>
        <main className="view">
          <Active />
        </main>
        <nav className="tab-bar">
          {VIEWS.map((v) => (
            <div key={v.key} className={`tab ${v.key === view ? 'active' : ''}`} onClick={() => setView(v.key)}>{v.icon}<br />{v.label.slice(0, 4)}</div>
          ))}
        </nav>
      </div>
    </div>
  )
}
