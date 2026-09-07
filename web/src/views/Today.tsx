import { useState } from 'react'
import { useStore } from '../store'
import { appToday, todayKey, fmt } from '../format'
import { computePayday, payDays, workdaysPassed, monthlyPay, dailyPay, punchInfo, fmtDur } from '../calc'
import { PunchModal } from '../components/PunchModal'

const WK = ['日', '一', '二', '三', '四', '五', '六']

export function Today() {
  const S = useStore((s) => s.S)
  const [punchDate, setPunchDate] = useState<string | null>(null)

  const now = appToday()
  const y = now.getFullYear(), m = now.getMonth()
  const pd = computePayday(now, S.payday)
  const pdDays = payDays(now, S.holidays)
  const wp = workdaysPassed(now, S.holidays)
  const mp = monthlyPay(S.profile)
  const dp = dailyPay(S.profile, now, S.holidays)
  const cumPay = (mp * wp) / pdDays
  const thisPay = dp * wp

  const tInfo = punchInfo(S.punches[todayKey(now)], now, S.profile, S.holidays)

  // 本月累计：加班 / 迟到 / 早退
  let otSum = 0, lateN = 0, lateM = 0, earlyN = 0, earlyM = 0
  for (let day = 1; day <= now.getDate(); day++) {
    const d = new Date(y, m, day)
    const info = punchInfo(S.punches[`${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`], d, S.profile, S.holidays)
    if (!info) continue
    otSum += info.ot
    if (info.late > 0) { lateN++; lateM += info.late }
    if (info.early > 0) { earlyN++; earlyM += info.early }
  }

  // 本月明细（已过去的工作日）
  const rows: { key: string; d: Date; label: string }[] = []
  for (let day = 1; day <= now.getDate(); day++) {
    const d = new Date(y, m, day)
    const key = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    rows.push({ key, d, label: `${m + 1}月${day}日 周${WK[d.getDay()]}` })
  }

  return (
    <div>
      <div className="summary" style={{ marginBottom: 14 }}>
        <div className="lbl">本月累计到手（已挣）</div>
        <div className="big tnum">{fmt(cumPay)}</div>
        <div className="sub">本月已出勤 {wp}/{pdDays} 个计薪工作日 · 基础月薪 {fmt(mp)}</div>
      </div>

      <div className="grid" style={{ marginBottom: 14 }}>
        <div className="card">
          <div className="lbl" style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 8 }}>本次到手</div>
          <div style={{ fontSize: 22, fontWeight: 700 }} className="tnum">{fmt(thisPay)}</div>
          <div className="hint">距今天 {wp} 个工作日 × {fmt(dp)}/天</div>
        </div>
        <div className="card">
          <div className="lbl" style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 8 }}>距下次发薪</div>
          <div style={{ fontSize: 22, fontWeight: 700 }} className="tnum">{pd.daysLeft} 天</div>
          <div className="hint">{pd.next.getMonth() + 1}月{pd.next.getDate()}日（{S.payday.rule === 'advance' ? '节前' : S.payday.rule === 'delay' ? '节后' : '当天'}）</div>
        </div>
        <div className="card">
          <div className="lbl" style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 8 }}>今日在司</div>
          <div style={{ fontSize: 22, fontWeight: 700 }} className="tnum">{tInfo ? fmtDur(tInfo.h) : '—'}</div>
          <div className="hint">{tInfo ? (tInfo.real ? '已打卡' : '按默认作息') : '非工作日 / 未排班'}</div>
        </div>
        <div className="card">
          <div className="lbl" style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 8 }}>本月加班</div>
          <div className="tnum" style={{ fontSize: 22, fontWeight: 700, color: otSum > 0 ? 'var(--amber)' : 'var(--text)' }}>{fmtDur(otSum)}</div>
          <div className="hint">迟到 {lateN} 次 {lateM} 分 · 早退 {earlyN} 次 {earlyM} 分</div>
        </div>
      </div>

      <div className="row" style={{ marginBottom: 14 }}>
        <button className="btn primary" onClick={() => setPunchDate(todayKey(now))}>今日打卡</button>
        <span className="hint">未打卡的工作日按「{S.profile.unpunchedMode === 'off' ? '视为没上班' : '默认作息'}」计算 · 可在设置中调整</span>
      </div>

      <div className="card">
        <h3>本月明细</h3>
        <div className="list">
          {rows.map((r) => {
            const info = punchInfo(S.punches[r.key], r.d, S.profile, S.holidays)
            const rec = S.punches[r.key]
            return (
              <div key={r.key} className="list-item" style={{ cursor: 'pointer' }} onClick={() => setPunchDate(r.key)}>
                <div>
                  <div className="li-main">{r.label}</div>
                  <div className="li-sub">
                    {info ? `${info.real ? '在司 ' + fmtDur(info.h) : '默认 ' + fmtDur(info.h)}${info.ot > 0 ? ' · 加班 ' + fmtDur(info.ot) : ''}${info.late > 0 ? ' · 迟到 ' + info.late + '分' : ''}` : rec?.leave ? '请假' : '未打卡'}
                    {rec?.note ? ' · ' + rec.note : ''}
                  </div>
                </div>
                <div className="li-right">
                  {info ? <span className="tag up">在司</span> : rec?.leave ? <span className="tag amber">请假</span> : <span className="tag">未打卡</span>}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {punchDate && <PunchModal date={punchDate} onClose={() => setPunchDate(null)} />}
    </div>
  )
}
