import { useEffect, useState } from 'react'
import { Routes, Route, NavLink, Navigate, useNavigate, useLocation } from 'react-router-dom'
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
  { key: 'today', label: '打工人仪表盘', short: '首页', icon: '🏠', el: Today },
  { key: 'history', label: '在司时长', short: '在司', icon: '📅', el: History },
  { key: 'assets', label: '净资产', short: '净资产', icon: '💰', el: Assets },
  { key: 'pension', label: '养老账户', short: '养老', icon: '🏦', el: Pension },
  { key: 'fire', label: 'FIRE', short: 'FIRE', icon: '🔥', el: Fire },
  { key: 'invest', label: '投资', short: '投资', icon: '📈', el: Invest },
  { key: 'settings', label: '设置', short: '设置', icon: '⚙️', el: Settings },
] as const

export default function App() {
  const authed = useStore((s) => s.authed)
  const ready = useStore((s) => s.ready)
  const username = useStore((s) => s.username)
  const loadState = useStore((s) => s.loadState)
  const logout = useStore((s) => s.logout)
  const navigate = useNavigate()
  const location = useLocation()
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

  // 监听视图切换事件（来自 Today 等页面的快捷跳转）
  useEffect(() => {
    const fn = (e: Event) => {
      const v = (e as CustomEvent<string>).detail
      if (typeof v === 'string') navigate(`/${v}`)
    }
    window.addEventListener('wc:setView', fn)
    return () => window.removeEventListener('wc:setView', fn)
  }, [navigate])

  if (!authed) return <Login />
  if (!ready) return <div className="view"><div className="muted">加载中…</div></div>

  const key = location.pathname.replace(/^\//, '') || 'today'
  const active = VIEWS.find((v) => v.key === key) || VIEWS[0]

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">打工人仪表盘<small>work·calculator</small></div>
        <nav className="nav">
          {VIEWS.map((v) => (
            <NavLink key={v.key} to={`/${v.key}`} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <span>{v.icon}</span><span>{v.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar-inner">
            <h2>{active.label}</h2>
            <div className="spacer" />
            <span className="muted">{username}</span>
            <button className="icon-btn" title="切换主题" onClick={() => setDark((d) => !d)}>{dark ? '☀️' : '🌙'}</button>
            <button className="btn ghost" onClick={() => { logout(); navigate('/today') }}>退出</button>
          </div>
        </header>
        <main className="view">
          <Routes>
            {VIEWS.map((v) => (
              <Route key={v.key} path={`/${v.key}`} element={<v.el />} />
            ))}
            <Route path="*" element={<Navigate to="/today" replace />} />
          </Routes>
        </main>
        <nav className="tab-bar">
          {VIEWS.map((v) => (
            <NavLink key={v.key} to={`/${v.key}`} className={({ isActive }) => `tab ${isActive ? 'active' : ''}`}>{v.icon}<br />{v.short}</NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}
