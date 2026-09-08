import { useState } from 'react'
import { useStore } from '../store'
import { fmt } from '../format'
import { api } from '../api'
import { computeInvest, computeRating, getNetAssetRange } from '../calc'
import { LineChart } from '../components/Charts'
import { BENCH_PRESETS } from '../model'

export function Invest() {
  const S = useStore((s) => s.S)
  const commit = useStore((s) => s.commit)
  const [freq, setFreq] = useState<'monthly' | 'weekly'>('monthly')
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')

  const calc = computeInvest(S, freq)
  const rating = computeRating(calc.last, calc.bl)
  const all = [...calc.cum.filter((x): x is number => x != null), ...calc.bc.filter((x): x is number => x != null), 0]
  const yMin = Math.min(...all) * (Math.min(...all) < 0 ? 1.1 : 0.95)
  const yMax = Math.max(...all) * 1.1
  const cumPts = calc.cum.map((v, i) => [i, v] as [number, number]).filter((p) => p[1] != null)
  const bcPts = calc.bc.map((v, i) => [i, v] as [number, number]).filter((p) => p[1] != null)
  const xTicks = [0, 2, 4, 6, 8, 10, 11].map((i) => ({ x: i, text: String(i + 1).padStart(2, '0') }))

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
  function setProfitMonthly(i: number, v: number | null) {
    commit((d) => {
      if (!Array.isArray(d.invest.profitMonthly) || d.invest.profitMonthly.length !== 12) {
        d.invest.profitMonthly = new Array(12).fill(null)
      }
      d.invest.profitMonthly[i] = v
    })
  }
  function setProfitWeekly(i: number, v: number | null) {
    commit((d) => {
      if (!Array.isArray(d.invest.profitWeekly) || d.invest.profitWeekly.length !== 52) {
        d.invest.profitWeekly = new Array(52).fill(null)
      }
      d.invest.profitWeekly[i] = v
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
  // 一键同步基准指数月度收益率（东方财富行情，回填已过去的完整月，不覆盖当前/未来月）
  async function syncBench() {
    setSyncing(true)
    setSyncMsg('')
    try {
      const res = await api.syncBenchmarks()
      const year = new Date().getFullYear()
      const curMonth = new Date().getMonth() + 1  // 1-12
      commit((d) => {
        if (!d.invest.bench) d.invest.bench = {}
        for (const p of BENCH_PRESETS) {
          const rates = res.data[p.key] || {}
          const existing = d.invest.bench[p.key]
          const target: number[] = existing && existing.length === 12 ? existing : (d.invest.bench[p.key] = new Array(12).fill(0))
          for (let m = 1; m < curMonth; m++) {
            const key = `${year}-${String(m).padStart(2, '0')}`
            if (key in rates) target[m - 1] = rates[key]
          }
        }
      })
      setSyncMsg(`已更新 ${Object.keys(res.data).length} 个指数，截至 ${res.updated}（当前月与未来月留空）`)
    } catch (e: any) {
      setSyncMsg('同步失败：' + (e?.message || e))
    } finally {
      setSyncing(false)
    }
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
          width={1100} height={240}
          x0={0} x1={11}
          yMin={yMin} yMax={yMax}
          series={[
            { points: bcPts, color: 'var(--text-3)', dash: '5 4' },
            { points: cumPts, color: calc.last >= 0 ? 'var(--up)' : 'var(--down)', fill: true },
          ]}
          xTicks={xTicks}
          yFormat={(n) => n.toFixed(0) + '%'}
        />
        <div className="inv-bars" style={{ marginTop: 4 }}>
          {calc.monthly.map((r, i) => (
            <div key={i} className="bar" title={`${i + 1}月 ${r >= 0 ? '+' : ''}${r.toFixed(1)}%`}
              style={{ height: `${Math.min(100, Math.abs(r) * 4)}%`, background: r >= 0 ? 'var(--up)' : 'var(--down)', opacity: i < calc.n ? 1 : 0.25 }} />
          ))}
        </div>
        <div className="hint" style={{ marginTop: 4 }}>灰虚线={benchName} · 柱=各月收益率（仅已记录月份实色）</div>
      </div>

      <div className="inv-grid">
        <div className="card">
          <h3>我的收益记录（{freq === 'monthly' ? '月度' : '周度'}）</h3>
          {freq === 'monthly' ? (
            <table className="inv-table inv-table-wide">
              <thead>
                <tr>
                  <th>月份</th>
                  <th>期初净资产</th>
                  <th>期末净资产</th>
                  <th>盈亏金额</th>
                  <th>收益率%</th>
                  <th>{benchName}%</th>
                  <th>超额%</th>
                  <th>累计%</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 12 }).map((_, i) => {
                  const ym = S.monthly[i]?.y || `${new Date().getFullYear()}-${String(i + 1).padStart(2, '0')}`
                  const net = calc.netByMonth[i]
                  const profit = S.invest.profitMonthly?.[i] ?? null
                  const r = calc.monthly[i]
                  const b = benchArr[i] ?? 0
                  const past = i < calc.n
                  const exc = past ? calc.excess[i] : null
                  const c = past ? calc.cum[i] : null
                  const hasNet = net.start != null && net.start > 0
                  const manualR = S.monthly[i]?.r
                  return (
                    <tr key={i}>
                      <td className="muted">{ym}</td>
                      <td className="muted tnum">{net.start != null ? fmt(net.start) : '—'}</td>
                      <td className="muted tnum">{net.end != null ? fmt(net.end) : '—'}</td>
                      <td>
                        <input
                          type="number" step="0.01"
                          value={profit == null ? '' : profit}
                          onChange={(e) => setProfitMonthly(i, e.target.value === '' ? null : Number(e.target.value))}
                          className={profit != null && profit > 0 ? 'num up' : profit != null && profit < 0 ? 'num down' : ''}
                          placeholder={hasNet ? '填金额' : '需净资产'}
                        />
                      </td>
                      <td className={`tnum ${!past ? 'muted' : r > 0 ? 'num up' : r < 0 ? 'num down' : ''}`}>
                        {past ? `${r >= 0 ? '+' : ''}${r.toFixed(2)}` : '—'}
                        {past && profit != null && hasNet && manualR != null && Math.abs(profit / net.start! * 100 - manualR) > 0.05 && (
                          <div className="hint" style={{ fontSize: 10, marginTop: 1 }}>手动 {manualR >= 0 ? '+' : ''}{manualR.toFixed(2)}</div>
                        )}
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
            <div>
              <div className="hint" style={{ marginBottom: 8 }}>填写每周盈亏金额（元），收益率 = 周盈亏 ÷（当月期初净资产 ÷ 当月周数）。下方为各月净资产参考。</div>
              <table className="inv-table inv-table-wide" style={{ marginBottom: 10 }}>
                <thead>
                  <tr>
                    <th>月</th>
                    <th>期初净资产</th>
                    <th>期末净资产</th>
                    <th>月收益率%</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 12 }).map((_, i) => {
                    const ym = S.monthly[i]?.y || `${new Date().getFullYear()}-${String(i + 1).padStart(2, '0')}`
                    const net = calc.netByMonth[i]
                    const r = calc.monthly[i]
                    const past = i < calc.n
                    return (
                      <tr key={i}>
                        <td className="muted">{ym}</td>
                        <td className="muted tnum">{net.start != null ? fmt(net.start) : '—'}</td>
                        <td className="muted tnum">{net.end != null ? fmt(net.end) : '—'}</td>
                        <td className={`tnum ${!past ? 'muted' : r > 0 ? 'num up' : r < 0 ? 'num down' : ''}`}>
                          {past ? `${r >= 0 ? '+' : ''}${r.toFixed(2)}` : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(13, minmax(0, 1fr))', gap: 4 }}>
                {(() => {
                  const monthBuckets: [number, number][] = [[0, 4], [4, 8], [8, 13], [13, 17], [17, 22], [22, 26], [26, 30], [30, 35], [35, 39], [39, 43], [43, 47], [47, 52]]
                  const monthLabels = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
                  return Array.from({ length: 12 }).map((_, m) => {
                    const [s, e] = monthBuckets[m]
                    const profitSum: number = (S.invest.profitWeekly || []).slice(s, e).reduce((a: number, b) => a + (b || 0), 0)
                    const ym = S.monthly[m]?.y || `${new Date().getFullYear()}-${String(m + 1).padStart(2, '0')}`
                    const start = getNetAssetRange(S.trend, ym).start
                    return (
                      <div key={m} className="muted" style={{ fontSize: 10, textAlign: 'center', padding: '4px 2px', borderRadius: 4, background: 'var(--surface-2)' }}>
                        <div style={{ fontWeight: 600 }}>{monthLabels[m]}</div>
                        <div style={{ fontSize: 9 }}>{start != null ? `期初${(start / 10000).toFixed(1)}w` : '—'}</div>
                        <div className={profitSum > 0 ? 'num up' : profitSum < 0 ? 'num down' : ''}>{profitSum > 0 ? '+' : ''}{profitSum.toFixed(0)}</div>
                      </div>
                    )
                  })
                })()}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(13, minmax(0, 1fr))', gap: 4, marginTop: 4 }}>
                {Array.from({ length: 13 }).map((_, c) => (
                  <div key={'hdr' + c} className="muted" style={{ fontSize: 9, textAlign: 'center', fontWeight: 600 }}>
                    {c === 0 ? '' : `W${c}`}
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(13, minmax(0, 1fr))', gap: 4, marginTop: 2 }}>
                {Array.from({ length: 52 }).map((_, i) => {
                  const profit = S.invest.profitWeekly?.[i] ?? null
                  return (
                    <input
                      key={i}
                      type="number" step="0.01"
                      value={profit == null ? '' : profit}
                      onChange={(e) => setProfitWeekly(i, e.target.value === '' ? null : Number(e.target.value))}
                      className={profit != null && profit > 0 ? 'num up' : profit != null && profit < 0 ? 'num down' : ''}
                      style={{ width: '100%', padding: '4px 2px', textAlign: 'center', fontSize: 11 }}
                      title={`第 ${i + 1} 周`}
                      placeholder="0"
                    />
                  )
                })}
              </div>
            </div>
          )}
        </div>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h3 style={{ margin: 0 }}>基准指数</h3>
            <button className="btn ghost" onClick={syncBench} disabled={syncing} style={{ fontSize: 12, padding: '6px 10px' }}>
              {syncing ? '同步中…' : '同步基准指数'}
            </button>
          </div>
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
          {syncMsg && <div className="hint" style={{ marginTop: 6, color: 'var(--brand-2)' }}>{syncMsg}</div>}
        </div>
      </div>
    </div>
  )
}
