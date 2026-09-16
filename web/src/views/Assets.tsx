import { useStore } from '../store'
import { fmt, fmtN, appToday } from '../format'
import { LineChart } from '../components/Charts'
import { computeNet, type AccountItem, type Accounts } from '../model'
import { computeSaveTrack } from '../calc'

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
  // 以今日净资产作为「年度存钱」对比起点（上一个基线日）
  function markToday() {
    commit((d) => { d.saveTrack.startNet = computeNet(d.accounts) })
  }
  // 金额为 0 时显示空（避免 number 输入框出现前缀 0）；其他值正常显示
  const showNum = (n?: number) => (n ? n : '')

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

  // 年度存钱追踪
  const sv = S.saveTrack
  const svCalc = computeSaveTrack(sv.target, sv.baselineMD, sv.startNet, sv.snapshots, net, appToday())
  const fmtMD = (d: Date) => `${d.getMonth() + 1}月${d.getDate()}日`

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

      {/* 年度存钱区块 */}
      <div className="card" style={{ marginBottom: 14 }}>
        <h3 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <span>年度存钱</span>
          <span className="badge" style={{ fontSize: 12, fontWeight: 500 }}>
            周期 {fmtMD(svCalc.prevBaseline)} → {fmtMD(svCalc.nextBaseline)}
          </span>
        </h3>

        <div className="asset-summary" style={{ marginBottom: 12 }}>
          <div className="asset-card">
            <div className="asset-lbl">本周期已存</div>
            <div className="asset-big tnum">{fmt(svCalc.saved)}</div>
            <div className="asset-change">起点 {fmt(svCalc.startNet)}</div>
          </div>
          <div className="asset-card">
            <div className="asset-lbl">目标完成度</div>
            <div className="asset-big tnum" style={{ color: svCalc.pct >= 1 ? 'var(--up)' : 'var(--text)' }}>
              {(svCalc.pct * 100).toFixed(1)}%
            </div>
            <div className="asset-change">目标 {fmt(svCalc.target)}</div>
          </div>
          <div className="asset-card">
            <div className="asset-lbl">还差多少</div>
            <div className="asset-big tnum">{fmt(svCalc.remainMoney)}</div>
            <div className="asset-change">距下一基线日 {svCalc.remainDays} 天</div>
          </div>
        </div>

        {/* 双进度条：时间进度 vs 存钱进度 */}
        <div style={{ marginBottom: 12 }}>
          <div className="sv-row">
            <span className="sv-row-lbl">时间进度</span>
            <div className="progress"><div className="fill" style={{ width: `${svCalc.timePct * 100}%`, background: 'var(--text-3)' }} /></div>
            <span className="sv-row-val tnum">{(svCalc.timePct * 100).toFixed(0)}%</span>
          </div>
          <div className="sv-row">
            <span className="sv-row-lbl">存钱进度</span>
            <div className="progress"><div className="fill" style={{ width: `${Math.min(100, svCalc.pct * 100)}%`, background: svCalc.pct >= 1 ? 'var(--up)' : 'var(--brand)' }} /></div>
            <span className="sv-row-val tnum">{(svCalc.pct * 100).toFixed(1)}%</span>
          </div>
        </div>

        <div className="hint" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span>
            为达目标，剩余每月需净存 <b className="tnum">{fmt(svCalc.monthlyNeed)}</b>
            （还剩 {svCalc.remainMonths.toFixed(1)} 个月）
          </span>
          <button className="btn ghost" style={{ padding: '6px 12px', fontSize: 12 }} onClick={markToday}>
            以今日为起点打点
          </button>
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
          <div className="card acct-card" key={g.key}>
            <h3 style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{g.label} <span className="badge">{fmt(sums[g.key])}</span></span>
              <button className="icon-btn" onClick={() => addItem(g.key)} title="新增">＋</button>
            </h3>
            <div className="list">
              {S.accounts[g.key].map((a, idx) => (
                <div className="acct-item" key={idx}>
                  <div className="acct-name-row">
                    <label className="fld">
                      <span>账户名称</span>
                      <input
                        value={a.n}
                        onChange={(e) => setItem(g.key, idx, { n: e.target.value })}
                        placeholder="例如：招商银行活期"
                      />
                    </label>
                    <button className="icon-btn acct-del" onClick={() => removeItem(g.key, idx)} title="删除">×</button>
                  </div>
                  <div className="fld-row">
                    <label className="fld">
                      <span>金额</span>
                      <input
                        type="number"
                        value={showNum(a.b)}
                        onChange={(e) => setItem(g.key, idx, { b: Number(e.target.value) })}
                        placeholder="0"
                      />
                    </label>
                    {a.rate != null && (
                      <label className="fld">
                        <span>年利率%</span>
                        <input
                          type="number" step="0.1"
                          value={showNum(a.rate)}
                          onChange={(e) => setItem(g.key, idx, { rate: Number(e.target.value) })}
                          placeholder="0"
                        />
                      </label>
                    )}
                    {g.key === 'debts' && (
                      <>
                        <label className="fld">
                          <span>月供</span>
                          <input
                            type="number"
                            value={showNum(a.month)}
                            onChange={(e) => setItem(g.key, idx, { month: Number(e.target.value) })}
                            placeholder="0"
                          />
                        </label>
                        <label className="fld">
                          <span>剩余月数</span>
                          <input
                            type="number"
                            value={showNum(a.remain)}
                            onChange={(e) => setItem(g.key, idx, { remain: Number(e.target.value) })}
                            placeholder="0"
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
