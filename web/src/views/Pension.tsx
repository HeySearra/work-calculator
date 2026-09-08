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

  const age = (now.getTime() - new Date(p.hireDate).getTime()) / 365.25 / 86400000 + 22
  const yearsToRetire = Math.max(0, pn.age - age)

  const monthlyDeposit = p.salary * 0.08

  const accountMonths = RETIRE_MAP[pn.age] || 139
  const indexedWage = pn.wage * pn.idx
  const basePension = ((pn.wage + indexedWage) / 2) * paidYears * 0.01
  const personalPension = pn.personal / accountMonths
  const est = basePension + personalPension

  const [target, setTarget] = useState(8000)
  const needBasic = Math.max(0, target - personalPension)
  const needYears = (needBasic * 2) / (pn.wage * (1 + pn.idx))
  const needPers = Math.max(0, (target - basePension) * accountMonths)
  const remainMonths = Math.max(1, Math.round(yearsToRetire * 12))
  const needMonthly = Math.max(0, (needPers - pn.personal) / remainMonths)

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
        <p className="hint" style={{ marginTop: 6 }}>{pn.paidMonths} 个月 / 最低 {pn.minMonths} 个月</p>
      </div>

      {/* 账户余额 */}
      <div className="card balance-card">
        <div className="card-title"><span className="ico">¥</span>账户余额</div>
        <div className="card-stretch">
          <div className="kv" style={{ padding: 0, border: 'none', gap: 8 }}>
            <div className="kv-cell">
              <p>个人账户</p>
              <h3 className="tnum">{fmt(pn.personal)}</h3>
            </div>
            <div className="kv-cell">
              <p>月缴存</p>
              <h3 className="tnum">{fmt(monthlyDeposit)}</h3>
            </div>
            <div className="kv-cell">
              <p>记账利率</p>
              <h3 className="tnum">{pn.rate}<span className="u">%</span></h3>
            </div>
          </div>
        </div>
        <p className="hint" style={{ marginTop: 'auto', paddingTop: 10 }}>≈ 月缴存 {fmt(monthlyDeposit)}，按工资 8% 估算</p>
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
            <p>个人账户需</p>
            <h3 className="tnum">{fmt(needPers)}</h3>
          </div>
          <div className="kv-cell">
            <p>月缴存需达到</p>
            <h3 className="tnum">{fmt(needMonthly)}</h3>
          </div>
        </div>
      </div>
    </div>
  )
}
