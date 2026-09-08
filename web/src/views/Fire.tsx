import { useStore } from '../store'
import { fmt, fmtN } from '../format'
import { LineChart, Ring } from '../components/Charts'

export function Fire() {
  const S = useStore((s) => s.S)
  const commit = useStore((s) => s.commit)
  const F = S.fire

  let net = 0
  ;(['deposits', 'invest', 'funds', 'social'] as const).forEach((g) => S.accounts[g].forEach((a) => (net += a.b)))
  S.accounts.debts.forEach((a) => (net -= a.b))

  const target = F.target
  const need = Math.max(0, target - net)
  const i = F.rate / 100 / 12
  const months = i > 0 ? Math.ceil(Math.log(1 + (need * i) / F.save) / Math.log(1 + i)) : Math.ceil(need / F.save)
  const reach = new Date()
  reach.setMonth(reach.getMonth() + months)

  const progress = Math.min(1, net / target)
  const annualSave = F.save * 12
  const saveRate = annualSave / (F.spend + annualSave)

  // FireCurve：净资产增长（按年打点，避免太密）
  const capMonths = Math.min(months, 600)
  const capYears = Math.ceil(capMonths / 12)
  const pts: [number, number][] = []
  let v = net
  for (let y = 0; y <= capYears; y++) {
    pts.push([y, v])
    // 每年末 = 前一年末复利 12 次 + 12 次月储蓄
    for (let m = 0; m < 12; m++) {
      v = v * (1 + i) + F.save
    }
  }

  return (
    <div>
      <div className="summary" style={{ marginBottom: 14 }}>
        <div className="lbl">距离 FIRE 还差</div>
        <div className="big tnum" style={{ color: need > 0 ? 'var(--up)' : 'var(--brand-2)' }}>{fmt(need)}</div>
        <div className="sub">当前净资产 {fmt(net)} · 目标 {fmt(target)} · 约 {months} 个月后（{reach.getFullYear()}-{String(reach.getMonth() + 1).padStart(2, '0')}）</div>
      </div>

      <div className="grid" style={{ marginBottom: 14 }}>
        <div className="card" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div className="lbl" style={{ color: 'var(--text-2)', fontSize: 13 }}>年支出</div>
          <div className="big tnum" style={{ fontSize: 26, margin: '6px 0 4px' }}>{fmt(F.spend)}</div>
          <div className="sub" style={{ color: 'var(--text-3)' }}>4% 法则需本金 {fmt(F.spend / 0.04)}</div>
        </div>
        <div className="card" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div className="lbl" style={{ color: 'var(--text-2)', fontSize: 13 }}>月储蓄</div>
          <div className="big tnum" style={{ fontSize: 26, margin: '6px 0 4px' }}>{fmt(F.save)}</div>
          <div className="sub" style={{ color: 'var(--text-3)' }}>储蓄率 {(saveRate * 100).toFixed(0)}%</div>
        </div>
        <div className="card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Ring value={progress * 100} max={100} color="var(--brand-2)" label={(progress * 100).toFixed(0) + '%'} sub="进度" />
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <h3>净资产增长曲线（月储蓄 {fmt(F.save)} · 年化 {F.rate}%）</h3>
        <LineChart
          width={1100} height={240}
          x0={0} x1={capYears}
          yMin={0}
          yMax={Math.max(target, v) * 1.05}
          series={[{ points: pts, color: 'var(--brand-2)', fill: true }]}
          target={target}
          xTicks={[0, Math.round(capYears / 3), Math.round((2 * capYears) / 3), capYears].map((y) => ({ x: y, text: y + '年' }))}
          yFormat={(n) => fmtN(n / 10000, 1) + 'w'}
          tooltip={(x, y) => {
            const prev = x > 0 ? pts[x - 1][1] : null
            const lines = [`${x}年后`, `净资产 ${fmt(y)}`]
            if (prev != null) {
              const d = y - prev
              lines.push(`较上年 ${d >= 0 ? '+' : '−'}${fmt(Math.abs(d))}`)
            } else {
              lines.push('起点')
            }
            return lines.join('\n')
          }}
        />
      </div>

      <div className="grid">
        <div className="card">
          <h3>FIRE 目标</h3>
          <div className="field"><label>目标本金（¥）</label><input type="number" value={F.target} onChange={(e) => commit((d) => { d.fire.target = Number(e.target.value) })} /></div>
        </div>
        <div className="card">
          <h3>年支出</h3>
          <div className="field"><label>年生活支出（¥）</label><input type="number" value={F.spend} onChange={(e) => commit((d) => { d.fire.spend = Number(e.target.value) })} /></div>
        </div>
        <div className="card">
          <h3>月储蓄</h3>
          <div className="field"><label>每月储蓄（¥）</label><input type="number" value={F.save} onChange={(e) => commit((d) => { d.fire.save = Number(e.target.value) })} /></div>
        </div>
        <div className="card">
          <h3>投资年化</h3>
          <div className="field"><label>预期年化（%）</label><input type="number" step="0.5" value={F.rate} onChange={(e) => commit((d) => { d.fire.rate = Number(e.target.value) })} /></div>
        </div>
      </div>
    </div>
  )
}
