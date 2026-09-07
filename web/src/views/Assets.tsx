import { useStore } from '../store'
import { fmt, fmtN } from '../format'
import { LineChart, Ring } from '../components/Charts'
import type { AccountItem } from '../model'

const GROUPS: { key: keyof ReturnType<typeof groups>; label: string; sign: 1 | -1 }[] = [
  { key: 'deposits', label: '存款类', sign: 1 },
  { key: 'invest', label: '投资类', sign: 1 },
  { key: 'funds', label: '公积金', sign: 1 },
  { key: 'social', label: '养老账户', sign: 1 },
  { key: 'debts', label: '负债', sign: -1 },
]

function groups(S: ReturnType<typeof useStore.getState>['S']) {
  return S.accounts
}

export function Assets() {
  const S = useStore((s) => s.S)
  const commit = useStore((s) => s.commit)

  let net = 0
  const sums: Record<string, number> = {}
  GROUPS.forEach((g) => {
    sums[g.key] = S.accounts[g.key].reduce((a, b) => a + b.b, 0) * g.sign
    net += sums[g.key]
  })

  const posTotal = GROUPS.filter((g) => g.sign > 0).reduce((a, g) => a + sums[g.key], 0)

  // 趋势图
  const ys = S.trend.map((t) => t.v)
  const yMin = Math.min(...ys, net) * 0.95
  const yMax = Math.max(...ys, net) * 1.05
  const pts = S.trend.map((t, i) => [i, t.v] as [number, number])
  const xTicks = S.trend.map((t, i) => ({ x: i, text: i % 2 === 0 ? t.ym.slice(5) : '' }))

  function setItem(group: keyof ReturnType<typeof groups>, idx: number, patch: Partial<AccountItem>) {
    commit((d) => {
      const arr = d.accounts[group]
      arr[idx] = { ...arr[idx], ...patch }
    })
  }
  function addItem(group: keyof ReturnType<typeof groups>) {
    commit((d) => {
      d.accounts[group] = [...d.accounts[group], { n: '新账户', b: 0, rate: group === 'debts' ? 0 : undefined }]
    })
  }
  function removeItem(group: keyof ReturnType<typeof groups>, idx: number) {
    commit((d) => {
      d.accounts[group] = d.accounts[group].filter((_, i) => i !== idx)
    })
  }

  return (
    <div>
      <div className="summary" style={{ marginBottom: 14 }}>
        <div className="lbl">净资产</div>
        <div className="big tnum">{fmt(net)}</div>
        <div className="sub">资产 {fmt(posTotal)} · 负债 {fmt(sums.debts)}</div>
      </div>

      <div className="grid" style={{ marginBottom: 14 }}>
        <div className="card">
          <h3>资产趋势（近 12 个月）</h3>
          <LineChart
            width={520} height={200}
            x0={0} x1={S.trend.length - 1}
            yMin={yMin} yMax={yMax}
            series={[{ points: pts, color: 'var(--brand)', fill: true }]}
            xTicks={xTicks}
            yFormat={(n) => fmtN(n / 10000, 1) + 'w'}
          />
        </div>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <Ring value={posTotal - sums.debts} max={posTotal} color="var(--brand-2)" label={fmtN((posTotal - sums.debts) / 10000, 1) + 'w'} sub="净资产/总资产" />
          <div className="hint" style={{ marginTop: 8 }}>资产即负债的蓄水池</div>
        </div>
      </div>

      <div className="grid">
        {GROUPS.map((g) => (
          <div className="card" key={g.key}>
            <h3 style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{g.label} <span className="badge">{fmt(sums[g.key])}</span></span>
              <button className="icon-btn" onClick={() => addItem(g.key)} title="新增">＋</button>
            </h3>
            <div className="list">
              {S.accounts[g.key].map((a, idx) => (
                <div className="list-item" key={idx} style={{ flexWrap: 'wrap', gap: 6 }}>
                  <input
                    value={a.n}
                    onChange={(e) => setItem(g.key, idx, { n: e.target.value })}
                    style={{ flex: '1 1 90px', minWidth: 90, width: 'auto' }}
                  />
                  <input
                    type="number"
                    value={a.b}
                    onChange={(e) => setItem(g.key, idx, { b: Number(e.target.value) })}
                    style={{ flex: '0 0 110px', width: 'auto', textAlign: 'right' }}
                  />
                  {a.rate != null && (
                    <input
                      type="number" step="0.1"
                      value={a.rate}
                      onChange={(e) => setItem(g.key, idx, { rate: Number(e.target.value) })}
                      title="年利率%"
                      style={{ flex: '0 0 64px', width: 'auto', textAlign: 'center' }}
                    />
                  )}
                  {g.key === 'debts' && (
                    <input
                      type="number"
                      value={a.month ?? 0}
                      onChange={(e) => setItem(g.key, idx, { month: Number(e.target.value) })}
                      title="月供"
                      style={{ flex: '0 0 64px', width: 'auto', textAlign: 'center' }}
                    />
                  )}
                  <button className="icon-btn" onClick={() => removeItem(g.key, idx)} title="删除">×</button>
                </div>
              ))}
              {S.accounts[g.key].length === 0 && <div className="hint" style={{ padding: '6px 0' }}>暂无，点 ＋ 添加</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
