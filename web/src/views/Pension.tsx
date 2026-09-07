import { useStore } from '../store'
import { appToday, fmt, fmtN } from '../format'
import { LineChart, Ring } from '../components/Charts'

const WORK_START_AGE = 22 // 估算：开始工作年龄

export function Pension() {
  const S = useStore((s) => s.S)
  const commit = useStore((s) => s.commit)
  const p = S.pension

  const now = appToday()
  const hire = new Date(S.profile.hireDate)
  const months = Math.max(0, (now.getFullYear() - hire.getFullYear()) * 12 + (now.getMonth() - hire.getMonth()))
  const yearsPaid = months / 12
  const cumPaid = (p.paid / 100) * p.wage * months

  const wageAvg = p.wage
  const monthlyNow = ((1 + p.idx) / 2) * wageAvg * yearsPaid * 0.01
  const monthlyAfter = wageAvg * yearsPaid * 0.01
  const replaceRate = monthlyNow / S.profile.salary

  const ages = [50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65]
  const before = ages.map((a) => [a, ((1 + p.idx) / 2) * wageAvg * (a - WORK_START_AGE) * 0.01] as [number, number])
  const after = ages.map((a) => [a, wageAvg * (a - WORK_START_AGE) * 0.01] as [number, number])

  return (
    <div>
      <div className="summary" style={{ marginBottom: 14 }}>
        <div className="lbl">当前预计月领养老金（改革前口径）</div>
        <div className="big tnum">{fmt(monthlyNow)}</div>
        <div className="sub">已缴费 {yearsPaid.toFixed(1)} 年 · 替代率 {(replaceRate * 100).toFixed(1)}%</div>
      </div>

      <div className="grid" style={{ marginBottom: 14 }}>
        <div className="card">
          <div className="lbl" style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 8 }}>累计缴费</div>
          <div className="big tnum" style={{ fontSize: 22 }}>{fmt(cumPaid)}</div>
          <div className="hint">比例 {p.paid}% × 缴费基数 {fmt(wageAvg)} × {months} 个月</div>
        </div>
        <div className="card">
          <div className="lbl" style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 8 }}>改革前后月领差</div>
          <div className="big tnum" style={{ fontSize: 22, color: 'var(--up)' }}>{fmt(monthlyNow - monthlyAfter)}</div>
          <div className="hint">改革后约 {fmt(monthlyAfter)}/月</div>
        </div>
        <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Ring value={Math.min(1, replaceRate) * 100} max={100} color="var(--brand)" label={(replaceRate * 100).toFixed(0) + '%'} sub="替代率" />
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <h3>领取金额 vs 退休年龄（估算）</h3>
        <LineChart
          width={560} height={220}
          x0={50} x1={65}
          yMin={0}
          yMax={Math.max(...before.map((b) => b[1])) * 1.1}
          series={[
            { points: before, color: 'var(--brand)', dash: '5 4' },
            { points: after, color: 'var(--brand-2)' },
          ]}
          xTicks={[50, 55, 60, 65].map((a) => ({ x: a, text: a + '岁' }))}
          yFormat={(n) => fmtN(n / 1000, 1) + 'k'}
        />
        <div className="hint">虚线=改革前 · 实线=改革后（按 {WORK_START_AGE} 岁起缴估算）</div>
      </div>

      <div className="card">
        <h3>退休年龄</h3>
        <div className="kv"><span className="k">目标退休年龄</span><span className="v">{S.profile.retireAge} 岁</span></div>
        <input
          type="range" min={50} max={65} value={S.profile.retireAge}
          onChange={(e) => commit((d) => { d.profile.retireAge = Number(e.target.value) })}
          style={{ width: '100%', margin: '10px 0' }}
        />
        <div className="hint">退休年龄越大，缴费年限越长，月领越高（与 FIRE 目标需权衡）。</div>
      </div>
    </div>
  )
}
