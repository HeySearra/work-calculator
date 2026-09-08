import { useState } from 'react'
import { useStore } from '../store'
import { fmt } from '../format'
import { computeInvest, computeRating } from '../calc'
import { LineChart } from '../components/Charts'
import { BENCH_PRESETS } from '../model'

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

  // 当前选中的指数
  const benchKey = S.invest.benchmark
  const benchPreset = BENCH_PRESETS.find((p) => p.key === benchKey)
  const benchName = benchPreset?.name || benchKey
  const benchArr = S.invest.bench?.[benchKey] || Array(12).fill(0)

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
  function setBenchIndex(key: string) {
    commit((d) => { d.invest.benchmark = key })
  }
  function setBenchValue(i: number, v: number) {
    commit((d) => {
      const k = d.invest.benchmark
      if (!d.invest.bench[k]) d.invest.bench[k] = Array.from({ length: 12 }, () => 0)
      d.invest.bench[k][i] = v
    })
  }

  return (
    <div>
      <div className="row" style={{ marginBottom: 14 }}>
        <button className={`btn ${freq === 'monthly' ? 'primary' : 'ghost'}`} onClick={() => setFreq('monthly')}>按月</button>
        <button className={`btn ${freq === 'weekly' ? 'primary' : 'ghost'}`} onClick={() => setFreq('weekly')}>按周</button>
      </div>

      <div className="summary" style={{ marginBottom: 14 }}>
        <div className="lbl">我的累计收益（{freq === 'monthly' ? '月度' : '周度聚合'}，基准 {benchName}）</div>
        <div className="big tnum" style={{ color: calc.last >= 0 ? 'var(--up)' : 'var(--down)' }}>{calc.last >= 0 ? '+' : ''}{calc.last.toFixed(2)}%</div>
        <div className="sub">基准 {calc.bl.toFixed(2)}% · 超额 <b className={calc.exc >= 0 ? 'num up' : 'num down'}>{calc.exc >= 0 ? '+' : ''}{calc.exc.toFixed(2)}%</b> · 金额变动 {fmt(calc.amt)}</div>
      </div>

      <div className="grid" style={{ marginBottom: 14 }}>
        <div className="card">
          <div className="lbl" style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 8 }}>年化（按已过去 {calc.n} 个月）</div>
          <div className="big tnum" style={{ fontSize: 22, color: calc.ann >= 0 ? 'var(--up)' : 'var(--down)' }}>{calc.ann >= 0 ? '+' : ''}{calc.ann.toFixed(2)}%</div>
          <div className="hint">截至当月的累计年化</div>
        </div>
        <div className="card">
          <div className="lbl" style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 8 }}>胜率</div>
          <div className="big tnum" style={{ fontSize: 22 }}>{(calc.winRate * 100).toFixed(0)}%</div>
          <div className="hint">正收益月份占比</div>
        </div>
        <div className="card">
          <div className="lbl" style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 8 }}>最大回撤</div>
          <div className="big tnum" style={{ fontSize: 22, color: calc.maxDD > 0.5 ? 'var(--up)' : 'var(--text)' }}>{calc.maxDD.toFixed(2)}%</div>
          <div className="hint">累计收益最大回撤幅度</div>
        </div>
        <div className="card">
          <div className="lbl" style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 8 }}>最大单月</div>
          <div className="big tnum" style={{ fontSize: 22, color: calc.bestMonth >= 0 ? 'var(--up)' : 'var(--down)' }}>{calc.bestMonth >= 0 ? '+' : ''}{calc.bestMonth.toFixed(2)}%</div>
          <div className="hint">最差 {calc.worstMonth >= 0 ? '+' : ''}{calc.worstMonth.toFixed(2)}%</div>
        </div>
        <div className="card">
          <div className="lbl" style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 8 }}>连续正超额</div>
          <div className="big tnum" style={{ fontSize: 22, color: calc.streak > 0 ? 'var(--brand-2)' : 'var(--text)' }}>{calc.streak} 个月</div>
          <div className="hint">从最近往回数连续跑赢基准</div>
        </div>
        <div className="card">
          <div className="lbl" style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 6 }}>理财能力</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--brand-2)' }}>{rating.name}</div>
          <div className="hint">{rating.desc}</div>
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
        <div className="hint">灰虚线={benchName} · 柱=各月收益率（仅已记录月份实色）</div>
      </div>

      <div className="inv-grid">
        <div className="card">
          <h3>我的收益记录（{freq === 'monthly' ? '月度' : '周度'}）</h3>
          {freq === 'monthly' ? (
            <table className="inv-table inv-table-wide">
              <thead>
                <tr>
                  <th>月份</th>
                  <th>点数%</th>
                  <th>{benchName}%</th>
                  <th>超额%</th>
                  <th>累计%</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 12 }).map((_, i) => {
                  const r = S.monthly[i]?.r ?? 0
                  const b = benchArr[i] ?? 0
                  const past = i < calc.n
                  const exc = past ? calc.excess[i] : null
                  const c = past ? calc.cum[i] : null
                  return (
                    <tr key={i}>
                      <td className="muted">{S.monthly[i]?.y || `${new Date().getFullYear()}-${String(i + 1).padStart(2, '0')}`}</td>
                      <td>
                        <input
                          type="number" step="0.1"
                          value={r}
                          onChange={(e) => setMonthly(i, Number(e.target.value))}
                          className={r > 0 ? 'num up' : r < 0 ? 'num down' : ''}
                        />
                      </td>
                      <td className={!past ? 'muted' : b > 0 ? 'num up' : b < 0 ? 'num down' : ''}>
                        {past ? `${b >= 0 ? '+' : ''}${b.toFixed(2)}` : '—'}
                      </td>
                      <td className={exc == null ? 'muted' : exc > 0 ? 'num up' : exc < 0 ? 'num down' : ''}>
                        {exc == null ? '—' : `${exc >= 0 ? '+' : ''}${exc.toFixed(2)}`}
                      </td>
                      <td className={c == null ? 'muted' : c > 0 ? 'num up' : c < 0 ? 'num down' : ''}>
                        {c == null ? '—' : `${c >= 0 ? '+' : ''}${c.toFixed(2)}`}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(13, minmax(0, 1fr))', gap: 4 }}>
              {Array.from({ length: 52 }).map((_, i) => (
                <input key={i} type="number" step="0.1" value={S.weekly[i] ?? 0} onChange={(e) => setWeekly(i, Number(e.target.value))}
                  style={{ width: '100%', padding: '4px 2px', textAlign: 'center', fontSize: 11 }} title={`第 ${i + 1} 周`} />
              ))}
            </div>
          )}
        </div>
        <div className="card">
          <h3>基准指数（可编辑）</h3>
          <label className="fld" style={{ marginBottom: 10 }}>
            <span>当前使用</span>
            <select value={benchKey} onChange={(e) => setBenchIndex(e.target.value)}>
              {BENCH_PRESETS.map((p) => (
                <option key={p.key} value={p.key}>{p.name}</option>
              ))}
            </select>
          </label>
          <table className="inv-table">
            <thead><tr><th>月</th><th>%</th></tr></thead>
            <tbody>
              {benchArr.map((r, i) => {
                const isFuture = i >= calc.n
                return (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td>
                      <input
                        type="number" step="0.1"
                        value={isFuture ? '' : r}
                        placeholder={isFuture ? '未来月份' : ''}
                        onChange={(e) => setBenchValue(i, e.target.value === '' ? 0 : Number(e.target.value))}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="hint" style={{ marginTop: 8 }}>本金基数 {fmt(S.invest.base)}</div>
        </div>
      </div>
    </div>
  )
}
