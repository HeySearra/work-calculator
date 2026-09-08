import { useState } from 'react'
import { useStore } from '../store'
import { appToday, fmt, fmtN } from '../format'

const RETIRE_MAP: Record<number, number> = { 50: 195, 55: 170, 60: 139, 65: 101, 63: 117 }
const RETIRE_OPTIONS = [50, 55, 60, 63, 65]

export function Pension() {
  const S = useStore((s) => s.S)
  const commit = useStore((s) => s.commit)
  const pn = S.pension
  const p = S.profile

  const now = appToday()
  const paidYears = pn.paidMonths / 12
  const minYears = pn.minMonths / 12
  const remainMinYears = Math.max(0, (pn.minMonths - pn.paidMonths) / 12)

  const age = pn.birthDate
    ? (now.getTime() - new Date(pn.birthDate).getTime()) / 365.25 / 86400000
    : (now.getTime() - new Date(p.hireDate).getTime()) / 365.25 / 86400000 + 22
  const yearsToRetire = Math.max(0, pn.age - age)

  // 缴费构成（按缴费基数）
  const base = pn.base
  const pooled = base * 0.16           // 统筹账户：基数的 16%，单位缴纳
  const personalMonthly = base * 0.08  // 个人账户：基数的 8%，本人工资扣除
  const annCompMonthly = base * pn.annCompRate / 100  // 企业年金单位缴费
  const annPersMonthly = base * pn.annPersRate / 100  // 企业年金个人缴费（工资扣除）
  const annMonthly = annCompMonthly + annPersMonthly

  const accountMonths = RETIRE_MAP[pn.age] || 139
  const indexedWage = pn.wage * pn.idx
  const basePension = ((pn.wage + indexedWage) / 2) * paidYears * 0.01
  const personalPension = pn.personal / accountMonths
  const est = basePension + personalPension

  const [target, setTarget] = useState(8000)

  // 反推：同时考虑基础养老金和个人账户一起增长（含记账利率复利）
  // 基础养老金每年增长 = ((工资 + 指数化工资)/2) × 1%
  const basePensionPerYear = ((pn.wage + indexedWage) / 2) * 0.01
  const r = pn.rate / 100
  // 再缴 n 年后的预估月退休金
  const projectedTotal = (n: number): number => {
    if (n <= 0) return est
    const basePart = basePensionPerYear * (paidYears + n)
    let fv = 0
    if (r <= 0) {
      fv = personalMonthly * 12 * n
    } else {
      fv = personalMonthly * 12 * (Math.pow(1 + r, n) - 1) / r
    }
    const personalPart = (pn.personal + fv) / accountMonths
    return basePart + personalPart
  }
  // 二分搜索还需缴多少年才能达到目标
  let needYears = 0
  if (target > est) {
    let lo = 0
    let hi = 100
    for (let i = 0; i < 80; i++) {
      const mid = (lo + hi) / 2
      if (projectedTotal(mid) < target) lo = mid
      else hi = mid
    }
    needYears = lo
  }
  // 达到目标时个人账户预计余额
  const needPers = Math.max(0, target > est
    ? pn.personal + personalMonthly * 12 * (r <= 0 ? needYears : (Math.pow(1 + r, needYears) - 1) / r)
    : 0)
  // 多缴 = 提高缴费基数。提高基数会三处联动：
  //  1) 个人账户 8% 增加 → 个人账户养老金↑
  //  2) 统筹 16% 同步增加（成本，但基础养老金不按统筹存入额计发）
  //  3) 缴费指数 = 基数/社平 上升 → 基础养老金↑（只影响未来年限，历史指数已固定）
  // 设 k = 新基数/当前基数，退休时月养老金 = 基础(k) + 个人账户(k)，两者均随 k 线性增长，反解 k。
  const totalYears = paidYears + yearsToRetire
  const annF = r > 0 ? (Math.pow(1 + r, yearsToRetire) - 1) / r : yearsToRetire // 年复利因子（与「需缴费至」一致）
  const baseConst = (pn.wage / 2) * 0.01 * totalYears                // 基础养老金中「社平一半」的固定项
  const baseCoef = (pn.wage * pn.idx / 2) * 0.01 * yearsToRetire     // 基础养老金随基数（指数）增长的系数
  const persConst = pn.personal / accountMonths                       // 当前个人账户余额对应养老金
  const persCoef = (personalMonthly * 12 * annF) / accountMonths      // 个人账户随基数增长的系数
  const k = (target - baseConst - persConst) / Math.max(1e-9, baseCoef + persCoef)
  const needBase = Math.max(0, base * k)          // 需达到的缴费基数
  const extraBase = Math.max(0, base * (k - 1))   // 需提高的缴费基数金额
  const extraPers = extraBase * 0.08              // 其中个人账户每月多缴
  const extraPool = extraBase * 0.16              // 其中统筹账户每月同步多缴

  const progress = Math.min(100, (pn.paidMonths / pn.minMonths) * 100)

  return (
    <div className="pension-grid">
      {/* 缴费进度 */}
      <div className="card">
        <div className="card-title"><span className="ico">◯</span>缴费进度</div>
        <div className="kv" style={{ padding: 0, border: 'none' }}>
          <div className="kv-cell">
            <p>已缴</p>
            <h3 className="tnum">{paidYears.toFixed(2)}<span className="u">年</span></h3>
          </div>
          <div className="kv-cell">
            <p>距 {minYears.toFixed(0)} 年还差</p>
            <h3 className="tnum">{remainMinYears.toFixed(2)}<span className="u">年</span></h3>
          </div>
          <div className="kv-cell">
            <p>距退休还差</p>
            <h3 className="tnum">{yearsToRetire.toFixed(1)}<span className="u">年</span></h3>
          </div>
        </div>
        <div className="progress" style={{ marginTop: 14 }}>
          <div className="fill" style={{ width: `${progress}%` }} />
        </div>
        <p className="hint" style={{ marginTop: 6 }}>{pn.paidMonths} 个月 / 最低 {pn.minMonths} 个月 · 当前 {age.toFixed(1)} 岁 · {pn.age} 岁退休</p>
      </div>

      {/* 每月缴费构成 */}
      <div className="card">
        <div className="card-title"><span className="ico">⤓</span>每月缴费构成</div>
        <div className="metric" style={{ marginBottom: 10 }}>
          <div className="lbl">缴费基数</div>
          <div className="val tnum">{fmt(base)}</div>
        </div>
        <div className="contrib">
          <div className="crow">
            <span className="ctag company">统筹账户 16%</span>
            <span className="cval tnum">{fmt(pooled)}<i>/月 · 单位缴纳，不进个人账户</i></span>
          </div>
          <div className="crow">
            <span className="ctag me">个人账户 8%</span>
            <span className="cval tnum">{fmt(personalMonthly)}<i>/月 · 从本人工资扣除</i></span>
          </div>
          <div className="crow">
            <span className="ctag ann">企业年金/职业年金</span>
            <span className="cval tnum">单位{fmt(annCompMonthly)} + 个人{fmt(annPersMonthly)}<i>/月 · 个人部分从工资扣除</i></span>
          </div>
        </div>
        <p className="hint" style={{ marginTop: 'auto', paddingTop: 10 }}>比例可在设置中调整（默认统筹16%、个人8%、年金单位8%+个人4%）</p>
      </div>

      {/* 账户余额 */}
      <div className="card balance-card">
        <div className="card-title"><span className="ico">¥</span>账户余额</div>
        <div className="kv balance-kv" style={{ padding: 0, border: 'none', gap: 8 }}>
          <div className="kv-cell">
            <p>养老个人账户</p>
            <h3 className="tnum">{fmt(pn.personal)}</h3>
          </div>
          <div className="kv-cell">
            <p>月缴存</p>
            <h3 className="tnum">{fmt(personalMonthly)}</h3>
          </div>
          <div className="kv-cell">
            <p>记账利率</p>
            <h3 className="tnum">{pn.rate}<span className="u">%</span></h3>
          </div>
          <div className="kv-cell">
            <p>企业年金/职业年金</p>
            <h3 className="tnum">{fmt(pn.annBal)}</h3>
          </div>
          <div className="kv-cell">
            <p>月缴存</p>
            <h3 className="tnum">{fmt(annMonthly)}</h3>
          </div>
          <div className="kv-cell">
            <p>单位 / 个人</p>
            <h3 className="tnum">{fmt(annCompMonthly)}<span className="u"> / </span>{fmt(annPersMonthly)}</h3>
          </div>
        </div>
        <p className="hint" style={{ marginTop: 'auto', paddingTop: 10 }}>个人账户≈月缴存 {fmt(personalMonthly)}，按缴费基数 8% 估算；年金为补充养老</p>
      </div>

      {/* 退休金预估 */}
      <div className="card full-col">
        <div className="card-title">
          <span className="ico">★</span>退休金预估
          <span className="badge" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
            按
            <select
              value={pn.age}
              onChange={(e) => commit((d) => { d.pension.age = Number(e.target.value) })}
              style={{ fontSize: 11, padding: '2px 4px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)' }}
            >
              {RETIRE_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            岁退休
          </span>
        </div>
        <div className="metric brand" style={{ marginBottom: 12 }}>
          <div className="lbl">预估月退休金</div>
          <div className="val tnum">{fmt(est)}</div>
          <div className="sub">基础养老金 {fmt(basePension)} + 个人账户 {fmt(personalPension)}</div>
        </div>
        <p className="hint" style={{ lineHeight: 1.6 }}>
          公式：基础养老金 =（省社平工资 + 本人指数化月均缴费工资）÷2 × 缴费年限 × 1%；
          个人账户 = 个人账户储存额 ÷ 计发月数（{pn.age}岁 {accountMonths}）。
          参数可在设置中调整。本结果为基于现行政策的估算，以社保经办机构实际核定为准。
        </p>
      </div>

      {/* 目标反推 */}
      <div className="card full-col">
        <div className="card-title"><span className="ico">⇄</span>目标反推<span className="badge" style={{ marginLeft: 'auto' }}>想月领多少？</span></div>
        <div className="slider-row">
          <label>期望月领</label>
          <input
            type="range" min={3000} max={20000} step={500} value={target}
            onChange={(e) => setTarget(Number(e.target.value))}
          />
          <div className="v tnum">{fmt(target)}</div>
        </div>
        <div className="kv" style={{ padding: 0, border: 'none', marginTop: 8, gap: 8 }}>
          <div className="kv-cell">
            <p>需缴费至</p>
            <h3 className="tnum">{needYears.toFixed(1)}<span className="u">年</span></h3>
          </div>
          <div className="kv-cell">
            <p>养老个人账户需</p>
            <h3 className="tnum">{fmt(needPers)}</h3>
          </div>
          <div className="kv-cell">
            <p>缴费基数需提高</p>
            <h3 className="tnum">{fmt(extraBase)}</h3>
          </div>
        </div>
        <p className="hint" style={{ marginTop: 8, lineHeight: 1.6 }}>
          {extraBase <= 0
            ? `当前缴费基数 ${fmt(base)} 已足够，按现有缴存退休前即可达标（约需 ${needYears.toFixed(1)} 年）`
            : `在现有基数 ${fmt(base)} 上每月多缴 ${fmt(extraBase)}（提高到 ${fmt(needBase)}）：个人账户 +${fmt(extraPers)}、统筹 +${fmt(extraPool)}，缴费指数同步上升、基础养老金也随之增加`}
        </p>
      </div>
    </div>
  )
}
