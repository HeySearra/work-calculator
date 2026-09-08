import { useState } from 'react'
import { useStore } from '../store'
import { appToday, todayKey, fmt, fmtN } from '../format'
import {
  parseHM, stdMinutes, payDays, workdaysPassed, dailyPay,
  computePayday, payPeriod, punchInfo,
} from '../calc'
import { PunchModal } from '../components/PunchModal'

// 通知 App 切换视图
function goView(v: string) {
  window.dispatchEvent(new CustomEvent('wc:setView', { detail: v }))
}

export function Today() {
  const S = useStore((s) => s.S)
  const [punchDate, setPunchDate] = useState<string | null>(null)

  const now = appToday()
  const realNow = new Date()
  const p = S.profile
  const ws = parseHM(p.workStart), we = parseHM(p.workEnd)
  const ls = parseHM(p.lunchStart), le = parseHM(p.lunchEnd)
  const workMins = stdMinutes(p)
  const daily = dailyPay(p, now, S.holidays)
  const rate = workMins > 0 ? daily / (workMins / 60) : 0
  const nowM = realNow.getHours() * 60 + realNow.getMinutes()

  // 已工作分钟（按早班 / 午休 / 晚班阶段，午休薪资暂停）
  let worked = 0
  if (nowM > ws) {
    if (nowM <= ls) worked = nowM - ws
    else if (nowM <= le) worked = ls - ws
    else worked = nowM - le + (ls - ws)
    worked = Math.min(worked, workMins)
  }
  const pct = workMins > 0 ? worked / workMins : 0
  const earned = daily * pct
  const remaining = Math.max(0, daily - earned)

  // 阶段文案
  let stage = '尚未开始'
  if (nowM >= ws && nowM < ls) stage = '上午工作中'
  else if (nowM >= ls && nowM < le) stage = '午休中（薪资暂停跳动）'
  else if (nowM >= le && nowM < we) stage = '下午工作中'
  else if (nowM >= we) stage = '已下班，加班可登记'

  // 下班倒计时
  let leftLbl = '还有多久下班'
  let leftText = ''
  if (nowM < ws) {
    leftLbl = '距上班还有'
    const m = ws - nowM
    leftText = (m >= 60 ? Math.floor(m / 60) + ' 时 ' : '') + (m % 60) + ' 分'
  } else if (nowM >= ws && nowM < we) {
    const leftM = we - nowM
    leftText = (leftM >= 60 ? Math.floor(leftM / 60) + ' 小时 ' : '') + (leftM % 60) + ' 分'
  } else {
    leftLbl = '今日已收工'
    leftText = '已下班'
  }

  // 今日进度条
  const totalSpan = we - ws
  const lunchLeft = totalSpan > 0 ? ((ls - ws) / totalSpan) * 100 : 0
  const lunchW = totalSpan > 0 ? ((le - ls) / totalSpan) * 100 : 0
  const fillColor = nowM > we ? 'var(--amber)' : 'var(--up)'

  // 发工资
  const pay = computePayday(now, S.payday)
  const period = payPeriod(now, S.payday, S.payday.amount)

  // 本周 / 本月
  const dow = (realNow.getDay() + 6) % 7 // 周一=0
  const weekDone = Math.min(dow + 1, 5)
  const monthTotal = payDays(now, S.holidays)
  const monthDone = workdaysPassed(now, S.holidays)
  const nextMonthFirst = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const holidayDays = Math.max(0, Math.round((nextMonthFirst.getTime() - now.getTime()) / 86400000))

  // 今日打卡
  const todayRec = S.punches[todayKey(now)]
  const tInfo = punchInfo(todayRec, now, p, S.holidays)
  const punchNode = (() => {
    if (todayRec?.leave) return <span className="tag purple">请假</span>
    if (tInfo && tInfo.real) {
      const r = todayRec!
      return <span className="tnum">打卡 <b>{r.in}–{r.out}</b> · 在司 {tInfo.h.toFixed(1)}h</span>
    }
    return <span className="tag">未打卡</span>
  })()

  // 里程碑
  const ms = [
    { p: 0.25, label: '今天赚到了 25%（开局稳住）', reach: pct >= 0.25 },
    { p: 0.5, label: '今天赚到了 50%（半天白送）', reach: pct >= 0.5 },
    { p: 0.75, label: '今天赚到了 75%（胜利在望）', reach: pct >= 0.75 },
    { p: 1, label: '今天赚到了 100%（收工大吉）', reach: pct >= 1 },
  ]

  return (
    <div>
      {/* 顶部四宫格 */}
      <div className="today-row4">
        <div className="td-card">
          <div className="td-lbl">今日已赚</div>
          <div className="td-money td-orange tnum">¥{fmtN(earned, 2)}</div>
          <div className="td-sub">时薪 ¥{rate.toFixed(1)} · 目标 ¥{fmtN(daily, 0)}</div>
        </div>
        <div className="td-card">
          <div className="td-lbl">{leftLbl}</div>
          <div className="td-money tnum">{leftText}</div>
          <div className="td-sub">{stage}</div>
        </div>
        <div className="td-card">
          <div className="td-lbl">今日还剩没赚到</div>
          <div className="td-money tnum">¥{fmtN(remaining, 2)}</div>
          <div className="td-sub">占今日目标 {daily > 0 ? Math.round((remaining / daily) * 100) : 0}%</div>
        </div>
        <div className="td-card">
          <div className="td-lbl">距发工资</div>
          <div className="td-money td-green tnum">{pay.daysLeft} 天</div>
          <div className="td-sub">{pay.next.getMonth() + 1}月{pay.next.getDate()}日</div>
        </div>
      </div>

      {/* 今日进度条 */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 700, fontSize: 14 }}>
            <span className="card-title-ico">▣</span>今日进度
          </div>
          <div className="tnum" style={{ fontWeight: 700, color: 'var(--text)' }}>{(pct * 100).toFixed(1)}%</div>
        </div>
        <div className="td-bar">
          <div className="td-lunch" style={{ left: `${lunchLeft}%`, width: `${lunchW}%` }} />
          <div className="td-fill" style={{ width: `${pct * 100}%`, background: fillColor }} />
        </div>
        <div className="td-axis">
          <span>{p.workStart}</span>
          <span>午休 {p.lunchStart}-{p.lunchEnd}</span>
          <span>{p.workEnd}</span>
        </div>
      </div>

      {/* 三联卡 */}
      <div className="today-row3">
        {/* 发工资进度 */}
        <div className="card">
          <div className="card-title">
            <span className="ico">⏱</span>发工资进度
            <span className="badge" style={{ marginLeft: 'auto' }}>本薪资周期</span>
          </div>
          <p className="muted" style={{ fontSize: 13, margin: '0 0 8px' }}>
            这笔 <b className="tnum" style={{ color: 'var(--text)' }}>{fmtN(p.salary, 0)}</b> 你已赚到{' '}
            <b className="tnum" style={{ color: 'var(--brand-2)' }}>{(period.pct * 100).toFixed(0)}%</b>
          </p>
          <div className="progress" style={{ margin: '8px 0 10px' }}>
            <div className="fill" style={{ width: `${period.pct * 100}%`, background: 'var(--brand)' }} />
          </div>
          <p className="muted" style={{ fontSize: 12, margin: '8px 0 0' }}>
            已过 {period.passD} / {period.totalD} 天 · 预计到账 <b className="tnum" style={{ color: 'var(--text)' }}>{fmt(period.earned)}</b>
          </p>
          <div className="row" style={{ marginTop: 14, gap: 8 }}>
            <button className="btn ghost" onClick={() => goView('settings')}>发薪日设置</button>
            <button className="btn ghost" onClick={() => goView('settings')}>工资日历 →</button>
          </div>
        </div>

        {/* 本周 / 本月 */}
        <div className="card">
          <div className="card-title">
            <span className="ico">📅</span>本周 / 本月
            <span className="badge" style={{ marginLeft: 'auto' }}>本月计薪 {monthTotal} 天 · 已过 {monthDone} 天</span>
          </div>
          <div className="kv" style={{ padding: 0, border: 'none' }}>
            <div className="kv-cell">
              <p>本周进度</p>
              <h3 className="tnum">
                {weekDone}/<span style={{ fontSize: 14, color: 'var(--text-3)', fontWeight: 500 }}>5天</span>
              </h3>
            </div>
            <div className="kv-cell">
              <p>本月已赚</p>
              <h3 className="tnum">{fmtN(daily * monthDone, 0)}</h3>
            </div>
            <div className="kv-cell">
              <p>距下个假期</p>
              <h3 className="tnum">{holidayDays} 天</h3>
            </div>
          </div>
          <div className="list" style={{ marginTop: 10, borderTop: '1px solid var(--border-2)', paddingTop: 6 }}>
            <div className="list-item" style={{ cursor: 'pointer' }} onClick={() => setPunchDate(todayKey(now))}>
              <div className="li-main">今日打卡</div>
              <div className="li-right">{punchNode}</div>
            </div>
          </div>
        </div>

        {/* 里程碑 */}
        <div className="card">
          <div className="card-title"><span className="ico">⚑</span>里程碑</div>
          <div className="list">
            {ms.map((m, i) => (
              <div key={i} className="list-item">
                <div
                  className="li-main"
                  style={{ textDecoration: m.reach ? 'line-through' : 'none', color: m.reach ? 'var(--text-3)' : 'var(--text)' }}
                >
                  {m.label}
                </div>
                <div className="li-right">
                  {m.reach ? <span className="tag up">已达成</span> : <span className="tag">{m.p * 100}%</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 悬浮 + */}
      <button className="fab" onClick={() => setPunchDate(todayKey(now))} title="今日打卡">＋</button>

      {punchDate && <PunchModal date={punchDate} onClose={() => setPunchDate(null)} />}
    </div>
  )
}
