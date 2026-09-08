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
      const item: AccountItem = { n: '新账户', b: 0 }
      if (group === 'deposits' || group === 'debts') item.rate = 0
      if (group === 'debts') {
        item.month = 0
        item.remain = 0
      }
      d.accounts[group] = [...d.accounts[group], item]
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
                <div
                  className="list-item"
                  key={idx}
                  style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10, padding: '12px 4px' }}
                >
                  {/* 第一行：账户名称 + 删除 */}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                    <label className="fld" style={{ flex: 1 }}>
                      <span>账户名称</span>
                      <input
                        value={a.n}
                        onChange={(e) => setItem(g.key, idx, { n: e.target.value })}
                        placeholder="例如：招商银行活期"
                      />
                    </label>
                    <button className="icon-btn" onClick={() => removeItem(g.key, idx)} title="删除">×</button>
                  </div>

                  {/* 第二行：金额 / 利率 / 月供 / 剩余月数 */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                    <label className="fld" style={{ flex: '1 1 110px' }}>
                      <span>金额</span>
                      <input
                        type="number"
                        value={a.b}
                        onChange={(e) => setItem(g.key, idx, { b: Number(e.target.value) })}
                        placeholder="0"
                        style={{ textAlign: 'right' }}
                      />
                    </label>

                    {a.rate != null && (
                      <label className="fld" style={{ flex: '0 0 78px' }}>
                        <span>年利率%</span>
                        <input
                          type="number" step="0.1"
                          value={a.rate}
                          onChange={(e) => setItem(g.key, idx, { rate: Number(e.target.value) })}
                          placeholder="0"
                          style={{ textAlign: 'center' }}
                        />
                      </label>
                    )}

                    {g.key === 'debts' && (
                      <>
                        <label className="fld" style={{ flex: '0 0 78px' }}>
                          <span>月供</span>
                          <input
                            type="number"
                            value={a.month ?? 0}
                            onChange={(e) => setItem(g.key, idx, { month: Number(e.target.value) })}
                            placeholder="0"
                            style={{ textAlign: 'right' }}
                          />
                        </label>
                        <label className="fld" style={{ flex: '0 0 78px' }}>
                          <span>剩余月数</span>
                          <input
                            type="number"
                            value={a.remain ?? 0}
                            onChange={(e) => setItem(g.key, idx, { remain: Number(e.target.value) })}
                            placeholder="0"
                            style={{ textAlign: 'right' }}
                          />
                        </label>
                      </>
                    )}
                  </div>
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
