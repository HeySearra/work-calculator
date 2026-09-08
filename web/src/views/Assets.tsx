import { useStore } from '../store'
import { fmt, fmtN } from '../format'
import { LineChart } from '../components/Charts'
import { computeNet, type AccountItem, type Accounts } from '../model'

const GROUPS: { key: keyof ReturnType<typeof useStore.getState>['S']['accounts']; label: string; sign: 1 | -1 }[] = [
  { key: 'deposits', label: '存款类', sign: 1 },
  { key: 'invest', label: '投资类', sign: 1 },
  { key: 'funds', label: '公积金', sign: 1 },
  { key: 'social', label: '养老账户', sign: 1 },
  { key: 'debts', label: '负债', sign: -1 },
]

export function Assets() {
  const S = useStore((s) => s.S)
  const commit = useStore((s) => s.commit)

  const sums: Record<string, number> = {}
  GROUPS.forEach((g) => {
    sums[g.key] = S.accounts[g.key].reduce((a, b) => a + (b.b || 0), 0) * g.sign
  })

  const net = computeNet(S.accounts)
  const posTotal = GROUPS.filter((g) => g.sign > 0).reduce((a, g) => a + sums[g.key], 0)

  // 趋势图
  const ys = S.trend.map((t) => t.v)
  const yMin = Math.min(...ys, net) * 0.95
  const yMax = Math.max(...ys, net) * 1.05
  const pts = S.trend.map((t, i) => [i, t.v] as [number, number])
  const step = S.trend.length <= 12 ? 2 : S.trend.length <= 24 ? 3 : 6
  const xTicks = S.trend.map((t, i) => ({ x: i, text: i % step === 0 ? t.ym.slice(5) : '' }))

  function setItem(group: keyof Accounts, idx: number, patch: Partial<AccountItem>) {
    commit((d) => {
      const arr = d.accounts[group]
      arr[idx] = { ...arr[idx], ...patch }
    })
  }
  function addItem(group: keyof Accounts) {
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
  function removeItem(group: keyof Accounts, idx: number) {
    commit((d) => {
      d.accounts[group] = d.accounts[group].filter((_, i) => i !== idx)
    })
  }

  // 较上月变化：当前值 - 上月趋势值（趋势最后一条为当前月）
  const prev = S.trend.length >= 2 ? S.trend[S.trend.length - 2] : null
  const debtTotal = Math.abs(sums.debts)
  const changeOf = (cur: number, key: 'v' | 'a' | 'd'): number | null => {
    if (!prev) return null
    const val = prev[key]
    if (val == null) return null
    return cur - val
  }
  const netChange = changeOf(net, 'v')
  const assetChange = changeOf(posTotal, 'a')
  const debtChange = changeOf(debtTotal, 'd')
  const fmtChange = (change: number | null) => {
    if (change === null) return '暂无历史对比'
    const arrow = change >= 0 ? '↑' : '↓'
    const sign = change >= 0 ? '+' : ''
    return `${arrow} 较上月 ${sign}${fmt(change)}`
  }

  return (
    <div>
      <div className="asset-summary">
        <div className="asset-card">
          <div className="asset-lbl">净资产</div>
          <div className="asset-big tnum">{fmt(net)}</div>
          <div className="asset-change">{fmtChange(netChange)}</div>
        </div>
        <div className="asset-card">
          <div className="asset-lbl">总资产</div>
          <div className="asset-big tnum up">{fmt(posTotal)}</div>
          <div className="asset-change">{fmtChange(assetChange)}</div>
        </div>
        <div className="asset-card">
          <div className="asset-lbl">总负债</div>
          <div className="asset-big tnum down">{fmt(debtTotal)}</div>
          <div className="asset-change">{fmtChange(debtChange)}</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <h3>资产趋势（历史所有月份）</h3>
        <LineChart
          width={1100} height={240}
          x0={0} x1={S.trend.length - 1}
          yMin={yMin} yMax={yMax}
          series={[{ points: pts, color: 'var(--brand)', fill: true }]}
          xTicks={xTicks}
          yFormat={(n) => fmtN(n / 10000, 1) + 'w'}
        />
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
