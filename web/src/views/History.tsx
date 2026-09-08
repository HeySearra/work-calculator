import { useState } from 'react'
import { useStore } from '../store'
import { appToday, fmt, fmtN } from '../format'
import { isWorkday, punchInfo, fmtDur, stdMinutes, unpunchedAsOff } from '../calc'
import { Heatmap } from '../components/Heatmap'
import { PunchModal } from '../components/PunchModal'

const WK = ['日', '一', '二', '三', '四', '五', '六']

function seed(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return (h >>> 0) % 100000
}
function seedIncome(key: string): number {
  return (seed(key) % 1700) / 100 + 0.2
}
function incLevel(v: number): number {
  return v < 2 ? 1 : v < 5 ? 2 : v < 9 ? 3 : v < 13 ? 4 : 5
}
function hoursLevel(h: number): number {
  return h < 8 ? 1 : h < 9 ? 2 : h < 10 ? 3 : h < 11 ? 4 : 5
}

export function History() {
  const S = useStore((s) => s.S)
  const [year, setYear] = useState(appToday().getFullYear())
  const [mode, setMode] = useState<'income' | 'hours'>('income')
  const [punchDate, setPunchDate] = useState<string | null>(null)

  const today = appToday()
  const nowY = today.getFullYear()

  // 全年统计（截至今天）
  let incSum = 0, hoursSum = 0, days = 0, maxH = 0, otSum = 0, lateN = 0, outSum = 0, outN = 0
  const d0 = new Date(year, 0, 1)
  for (let i = 0; i < 365; i++) {
    const d = new Date(d0.getTime() + i * 86400000)
    if (d.getFullYear() !== year || d > today) break
    const key = `${year}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const rec = S.punches[key]
    const info = punchInfo(rec, d, S.profile, S.holidays)
    if (mode === 'income') {
      if (!isWorkday(d, S.holidays) || S.holidays[key] === 1) continue
      if (rec?.leave) continue
      incSum += seedIncome(key)
    } else {
      if (!info) continue
      hoursSum += info.h
      if (info.h > maxH) maxH = info.h
      otSum += info.ot
      if (info.late > 0) lateN++
      if (info.real) { outSum += (d.getHours() * 60 + d.getMinutes()); outN++ }
      days++
    }
  }

  const cell = (d: Date, key: string) => {
    const isFuture = d > today
    if (isFuture) return { future: true }
    const rec = S.punches[key]
    if (S.holidays[key] === 1) return { cls: 'holiday', title: `${key} 法定节假日` }
    if (!isWorkday(d, S.holidays)) return {}
    if (rec?.leave) return { cls: 'leave', title: `${key} 请假` }
    if (mode === 'income') {
      const v = seedIncome(key)
      return { cls: `l${incLevel(v)}`, title: `${key} 收入 ¥${Math.round(v)}` }
    }
    const info = punchInfo(rec, d, S.profile, S.holidays)
    if (!info) return { cls: 'past-empty', title: `${key} 未打卡` }
    return { cls: `l${hoursLevel(info.h)}`, title: `${key} 在司 ${fmtDur(info.h)}` }
  }

  // 本月明细
  const y = today.getFullYear(), m = today.getMonth()
  const rows: { key: string; label: string }[] = []
  for (let day = 1; day <= today.getDate(); day++) {
    rows.push({ key: `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`, label: `${m + 1}月${day}日 周${WK[new Date(y, m, day).getDay()]}` })
  }

  return (
    <div>
      <div className="row" style={{ marginBottom: 14 }}>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ flex: '0 0 120px' }}>
          {[nowY - 1, nowY, nowY + 1].map((y) => <option key={y} value={y}>{y} 年</option>)}
        </select>
        <div className="row" style={{ flex: 1, gap: 8 }}>
          <button className={`btn ${mode === 'income' ? 'primary' : 'ghost'}`} onClick={() => setMode('income')}>按收入</button>
          <button className={`btn ${mode === 'hours' ? 'primary' : 'ghost'}`} onClick={() => setMode('hours')}>按在司时长</button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <Heatmap year={year} cell={cell} onPick={(d, key) => setPunchDate(key)} />
        <div className="heat-legend">
          {mode === 'income'
            ? <>少<i className="d l1" /><i className="d l2" /><i className="d l3" /><i className="d l4" /><i className="d l5" />多 · <i className="d holiday" />节假日 · <i className="d leave" />请假</>
            : <>短<i className="d l1" /><i className="d l2" /><i className="d l3" /><i className="d l4" /><i className="d l5" />长 · <i className="d past-empty" />未打卡 · <i className="d leave" />请假</>}
        </div>
      </div>

      <div className="grid" style={{ marginBottom: 14 }}>
        {mode === 'income' ? (
          <>
            <div className="card"><div className="lbl" style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 8 }}>年累计收入</div><div className="big tnum" style={{ fontSize: 24 }}>{fmt(incSum)}</div></div>
            <div className="card"><div className="lbl" style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 8 }}>日均收入</div><div className="big tnum" style={{ fontSize: 24 }}>{fmt(incSum / Math.max(1, days || workdaysSoFar(year, today, S.holidays)))}</div></div>
          </>
        ) : (
          <>
            <div className="card"><div className="lbl" style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 8 }}>在司总时长</div><div className="big tnum" style={{ fontSize: 24 }}>{fmtDur(hoursSum)}</div></div>
            <div className="card"><div className="lbl" style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 8 }}>日均</div><div className="big tnum" style={{ fontSize: 24 }}>{fmtDur(days ? hoursSum / days : 0)}</div></div>
            <div className="card"><div className="lbl" style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 8 }}>最长一天</div><div className="big tnum" style={{ fontSize: 24 }}>{fmtDur(maxH)}</div></div>
            <div className="card"><div className="lbl" style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 8 }}>加班时长</div><div className="big tnum" style={{ fontSize: 24, color: 'var(--amber)' }}>{fmtDur(otSum)}</div></div>
            <div className="card"><div className="lbl" style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 8 }}>迟到次数</div><div className="big tnum" style={{ fontSize: 24 }}>{lateN} 次</div></div>
          </>
        )}
      </div>

      <div className="card">
        <h3>本月明细</h3>
        <div className="list">
          {rows.map((r) => {
            const rec = S.punches[r.key]
            const info = punchInfo(rec, new Date(r.key), S.profile, S.holidays)
            return (
              <div key={r.key} className="list-item" style={{ cursor: 'pointer' }} onClick={() => setPunchDate(r.key)}>
                <div>
                  <div className="li-main">{r.label}</div>
                  <div className="li-sub">{info ? (info.real ? '在司 ' + fmtDur(info.h) : '默认 ' + fmtDur(info.h)) : rec?.leave ? '请假' : '未打卡'}</div>
                </div>
                <div className="li-right">{info ? <span className="tag up">在司</span> : rec?.leave ? <span className="tag amber">请假</span> : <span className="tag">未打卡</span>}</div>
              </div>
            )
          })}
        </div>
      </div>

      {punchDate && <PunchModal date={punchDate} onClose={() => setPunchDate(null)} />}
    </div>
  )
}

function workdaysSoFar(year: number, today: Date, holidays: Record<string, number>): number {
  if (year !== today.getFullYear()) return 0
  let n = 0
  for (let day = 1; day <= today.getDate(); day++) if (isWorkday(new Date(year, today.getMonth(), day), holidays)) n++
  return n
}
