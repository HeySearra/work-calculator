import { useState } from 'react'
import { useStore } from '../store'
import { fmt, fmtN } from '../format'
import { computeInvest, computeRating } from '../calc'
import { LineChart } from '../components/Charts'

export function Invest() {
  const S = useStore((s) => s.S)
  const commit = useStore((s) => s.commit)
  const [freq, setFreq] = useState<'monthly' | 'weekly'>('monthly')

  const calc = computeInvest(S, freq)
  const rating = computeRating(calc.last, calc.bl)
  const all = [...calc.cum.filter((x): x is number => x != null), ...calc.bc.filter((x): x is number => x != null), 0]
  const yMin = Math.min(...all) * (Math.min(...all) < 0 ? 1.1 : 0.95)
  const yMax = Math.max(...all) * 1.1
  const cumPts = calc.cum.map((v, i) => [i, v] as [number, number]).filter((p) => p[1] != null)
  const bcPts = calc.bc.map((v, i) => [i, v] as [number, number]).filter((p) => p[1] != null)
  const xTicks = [0, 3, 6, 9, 11].map((i) => ({ x: i, text: freq === 'monthly' ? (S.monthly[i]?.y.slice(5) || `${i + 1}`) : `${i + 1}月` }))

  function setMonthly(i: number, r: number) {
    commit((d) => {
      if (!d.monthly[i]) d.monthly[i] = { y: `${new Date().getFullYear()}-${String(i + 1).padStart(2, '0')}`, r }
      else d.monthly[i].r = r
    })
  }
  function setWeekly(i: number, r: number) {
    commit((d) => {
      const w = Array.from({ length: 52 }, (_, k) => d.weekly[k] ?? 0)
      w[i] = r
      d.weekly = w
    })
  }
  function setBench(i: number, r: number) {
    commit((d) => { d.invest.benchMonthly[i] = r })
  }

  return (
    <div>
      <div className="row" style={{ marginBottom: 14 }}>
        <button className={`btn ${freq === 'monthly' ? 'primary' : 'ghost'}`} onClick={() => setFreq('monthly')}>按月</button>
        <button className={`btn ${freq === 'weekly' ? 'primary' : 'ghost'}`} onClick={() => setFreq('weekly')}>按周</button>
      </div>

      <div className="summary" style={{ marginBottom: 14 }}>
        <div className="lbl">我的累计收益（{freq === 'monthly' ? '月度' : '周度聚合'}）</div>
        <div className="big tnum" style={{ color: calc.last >= 0 ? 'var(--up)' : 'var(--down)' }}>{calc.last >= 0 ? '+' : ''}{calc.last.toFixed(2)}%</div>
        <div className="sub">基准 {calc.bl.toFixed(2)}% · 超额 <b className={calc.exc >= 0 ? 'num up' : 'num down'}>{calc.exc >= 0 ? '+' : ''}{calc.exc.toFixed(2)}%</b> · 金额变动 {fmt(calc.amt)}</div>
      </div>

      <div className="grid" style={{ marginBottom: 14 }}>
        <div className="card">
          <div className="lbl" style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 8 }}>年化（按已记录 {calc.n} 个月）</div>
          <div className="big tnum" style={{ fontSize: 22 }}>{calc.ann.toFixed(2)}%</div>
        </div>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div className="lbl" style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 6 }}>理财能力</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--brand-2)' }}>{rating.name}</div>
            <div className="hint">{rating.desc}</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <h3>累计收益曲线</h3>
        <LineChart
          width={560} height={220}
          x0={0} x1={11}
          yMin={yMin} yMax={yMax}
          series={[
            { points: bcPts, color: 'var(--text-3)', dash: '5 4' },
            { points: cumPts, color: calc.last >= 0 ? 'var(--up)' : 'var(--down)', fill: true },
          ]}
          xTicks={xTicks}
          yFormat={(n) => n.toFixed(0) + '%'}
        />
        <div className="inv-bars" style={{ marginTop: 10 }}>
          {calc.monthly.map((r, i) => (
            <div key={i} className="bar" title={`${i + 1}月 ${r >= 0 ? '+' : ''}${r.toFixed(1)}%`}
              style={{ height: `${Math.min(100, Math.abs(r) * 4)}%`, background: r >= 0 ? 'var(--up)' : 'var(--down)', opacity: i < calc.n ? 1 : 0.25 }}>
              <span>{r >= 0 ? '+' : ''}{r.toFixed(0)}</span>
            </div>
          ))}
        </div>
        <div className="hint">灰虚线=基准 · 柱=各月收益率（仅已记录月份实色）</div>
      </div>

      <div className="grid">
        <div className="card">
          <h3>我的收益记录（{freq === 'monthly' ? '月度' : '周度'}）</h3>
          {freq === 'monthly' ? (
            <table className="inv-table">
              <thead><tr><th>月份</th><th>收益率%</th></tr></thead>
              <tbody>
                {Array.from({ length: 12 }).map((_, i) => (
                  <tr key={i}>
                    <td>{S.monthly[i]?.y || `${new Date().getFullYear()}-${String(i + 1).padStart(2, '0')}`}</td>
                    <td><input type="number" step="0.1" value={S.monthly[i]?.r ?? 0} onChange={(e) => setMonthly(i, Number(e.target.value))} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(13, 1fr)', gap: 4 }}>
              {Array.from({ length: 52 }).map((_, i) => (
                <input key={i} type="number" step="0.1" value={S.weekly[i] ?? 0} onChange={(e) => setWeekly(i, Number(e.target.value))}
                  style={{ width: '100%', padding: '4px 2px', textAlign: 'center', fontSize: 11 }} title={`第 ${i + 1} 周`} />
              ))}
            </div>
          )}
        </div>
        <div className="card">
          <h3>基准（沪深300 月度）</h3>
          <table className="inv-table">
            <thead><tr><th>月</th><th>%</th></tr></thead>
            <tbody>
              {S.invest.benchMonthly.map((r, i) => (
                <tr key={i}><td>{i + 1}</td><td><input type="number" step="0.1" value={r} onChange={(e) => setBench(i, Number(e.target.value))} /></td></tr>
              ))}
            </tbody>
          </table>
          <div className="hint" style={{ marginTop: 8 }}>投资本金基数 {fmt(S.invest.base)}</div>
        </div>
      </div>
    </div>
  )
}
