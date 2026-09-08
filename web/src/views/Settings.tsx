import { useRef, useState } from 'react'
import { useStore } from '../store'
import { DEFAULT, mergeState, BENCH_PRESETS, type AppState } from '../model'
import { fmt, appToday } from '../format'
import { holidaysToText, textToHolidays, dailyPay, payDays } from '../calc'
import { api } from '../api'

type Str = { [k: string]: string }

// 把表单值写回 AppState（纯函数，供即时保存复用）
function applyForm(d: AppState, f: Str) {
  const num = (k: string) => Number(f[k]) || 0
  const p = d.profile, pn = d.pension, fr = d.fire, iv = d.invest, py = d.payday
  p.workStart = f.workStart; p.workEnd = f.workEnd; p.lunchStart = f.lunchStart; p.lunchEnd = f.lunchEnd
  p.salary = num('salary'); p.otW = num('otW'); p.otWe = num('otWe'); p.hireDate = f.hireDate
  p.bonus = num('bonus'); p.bonusAmort = f.bonusAmort === '1'; p.unpunchedMode = (f.unpunchedMode as 'standard' | 'off')
  d.user.city = f.city
  py.type = (f.payType as 'current_month' | 'next_month'); py.day = num('payDay'); py.rule = (f.payRule as 'advance' | 'delay' | 'same'); py.amount = num('payAmt')
  pn.paidMonths = num('pnPaidMonths'); pn.minMonths = num('pnMinMonths'); pn.paid = pn.paidMonths / 12
  pn.personal = num('pnPers'); pn.wage = num('pnWage'); pn.base = num('pnBase'); pn.idx = num('pnIdx'); pn.rate = num('pnRate'); pn.age = num('pnAge'); pn.birthDate = f.pnBirth
  pn.annBal = num('pnAnnBal'); pn.annCompRate = num('pnAnnComp'); pn.annPersRate = num('pnAnnPers')
  fr.target = num('frTgt'); fr.spend = num('frSpend'); fr.save = num('frSave'); fr.rate = num('frRate')
  iv.target = num('ivTgt')
  iv.benchmark = f.ivBench
  iv.base = num('ivBase')
  d.holidays = textToHolidays(f.holidays)
}

export function Settings() {
  const S = useStore((s) => s.S)
  const commit = useStore((s) => s.commit)
  const loadState = useStore((s) => s.loadState)
  const [msg, setMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const saveTimer = useRef<number | null>(null)
  const msgTimer = useRef<number | null>(null)

  const initForm = (): Str => {
    const p = S.profile, pn = S.pension, fr = S.fire, iv = S.invest, py = S.payday
    return {
      workStart: p.workStart, workEnd: p.workEnd, lunchStart: p.lunchStart, lunchEnd: p.lunchEnd,
      salary: String(p.salary), otW: String(p.otW), otWe: String(p.otWe), hireDate: p.hireDate,
      bonus: String(p.bonus), bonusAmort: p.bonusAmort ? '1' : '0', unpunchedMode: p.unpunchedMode,
      city: S.user.city,
      payType: py.type, payDay: String(py.day), payRule: py.rule, payAmt: String(py.amount),
      pnPaidMonths: String(pn.paidMonths), pnMinMonths: String(pn.minMonths),
      pnPers: String(pn.personal), pnWage: String(pn.wage), pnBase: String(pn.base),
      pnIdx: String(pn.idx), pnRate: String(pn.rate), pnAge: String(pn.age), pnBirth: pn.birthDate,
      pnAnnBal: String(pn.annBal), pnAnnComp: String(pn.annCompRate), pnAnnPers: String(pn.annPersRate),
      frTgt: String(fr.target), frSpend: String(fr.spend), frSave: String(fr.save), frRate: String(fr.rate),
      ivTgt: String(iv.target), ivBench: iv.benchmark, ivBase: String(iv.base),
      holidays: holidaysToText(S.holidays),
    }
  }

  const [f, setV] = useState<Str>(initForm)
  const fRef = useRef<Str>(f)

  // 表单与 store 重新同步（导入 / 恢复默认后调用）
  function resetForm() {
    const next = initForm()
    fRef.current = next
    setV(next)
  }

  function flash(text: string) {
    setMsg(text)
    if (msgTimer.current) clearTimeout(msgTimer.current)
    msgTimer.current = window.setTimeout(() => setMsg(''), 1600)
  }

  // 即时保存：防抖 350ms，避免逐字输入时频繁请求
  function scheduleSave(next: Str) {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      commit((d) => applyForm(d, next))
        .then(() => flash('已保存'))
        .catch(() => flash('保存失败'))
    }, 350)
  }

  // 改动即保存
  function setField(k: string, val: string) {
    const next = { ...fRef.current, [k]: val }
    fRef.current = next
    setV(next)
    scheduleSave(next)
  }

  function num(k: string) { return Number(f[k]) || 0 }
  const pd = payDays(appToday(), S.holidays)
  const dp = dailyPay(S.profile, appToday(), S.holidays)

  function resetDefault() {
    if (!confirm('恢复默认设置？现有收支/盈亏记录保留。')) return
    commit((d) => {
      d.profile = JSON.parse(JSON.stringify(DEFAULT.profile))
      d.payday = JSON.parse(JSON.stringify(DEFAULT.payday))
      d.pension = JSON.parse(JSON.stringify(DEFAULT.pension))
      d.fire = JSON.parse(JSON.stringify(DEFAULT.fire))
      d.invest = JSON.parse(JSON.stringify(DEFAULT.invest))
    }).then(() => { resetForm(); setMsg('已恢复默认') })
  }

  async function exportData() {
    const blob = await api.exportData()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `dqrd_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    setMsg('已导出')
  }

  async function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const obj = JSON.parse(text)
      await api.importData(mergeState(obj))
      await loadState()
      resetForm()
      setMsg('已导入')
    } catch {
      setMsg('导入失败：JSON 格式错误')
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  function field(label: string, k: string, type = 'text', step?: string) {
    return (
      <label className="fld">
        <span>{label}</span>
        <input type={type} step={step} value={f[k]} onChange={(e) => setField(k, e.target.value)} />
      </label>
    )
  }

  return (
    <div>
      {msg && <div className="toast-inline">{msg}</div>}
      <div className="settings-grid">
        <div className="settings-col">
          <div className="card">
            <h3>作息与薪资</h3>
            <div className="fld-row">
              {field('上班', 'workStart', 'time')}
              {field('下班', 'workEnd', 'time')}
              {field('午休起', 'lunchStart', 'time')}
              {field('午休止', 'lunchEnd', 'time')}
            </div>
            <div className="fld-row">
              {field('月薪', 'salary', 'number')}
              {field('周末加班倍数', 'otWe', 'number', '0.1')}
              {field('工作日加班倍数', 'otW', 'number', '0.1')}
            </div>
            <div className="fld-row">
              {field('入职日期', 'hireDate', 'date')}
              {field('年终奖', 'bonus', 'number')}
            </div>
            <label className="fld">
              <span>年终奖分摊到月薪</span>
              <select value={f.bonusAmort} onChange={(e) => setField('bonusAmort', e.target.value)}>
                <option value="0">不摊</option><option value="1">分摊</option>
              </select>
            </label>
            <div className="fld-row">
              {field('城市', 'city')}
              {field('节假日(例 10-01* 表示补班)', 'holidays')}
            </div>
            <div className="radio-group">
              <label className="radio-card">
                <input type="radio" name="unpunched" value="standard" checked={f.unpunchedMode === 'standard'} onChange={(e) => setField('unpunchedMode', e.target.value)} />
                <span>按默认作息（未打卡的工作日按规定上下班时间计算时长）</span>
              </label>
              <label className="radio-card">
                <input type="radio" name="unpunched" value="off" checked={f.unpunchedMode === 'off'} onChange={(e) => setField('unpunchedMode', e.target.value)} />
                <span>视为当天没上班（未打卡的工作日不计入在司时长）</span>
              </label>
            </div>
            <div className="hint">本月 <b>{pd}</b> 天 · 日薪 <b>{fmt(dp)}</b></div>
          </div>
        </div>

        <div className="settings-col">
          <div className="card">
            <h3>发薪日</h3>
            <div className="fld-row">
              {field('类型', 'payType')}
              {field('日期', 'payDay', 'number')}
              {field('规则', 'payRule')}
              {field('金额', 'payAmt', 'number')}
            </div>
          </div>
          <div className="card">
            <h3>FIRE</h3>
            <div className="fld-row">
              {field('目标', 'frTgt', 'number')}
              {field('年支出', 'frSpend', 'number')}
              {field('月储蓄', 'frSave', 'number')}
              {field('年化%', 'frRate', 'number', '0.1')}
            </div>
          </div>
        </div>

        <div className="settings-col">
          <div className="card">
            <h3>养老账户</h3>
            <div className="fld-row">
              {field('缴费基数', 'pnBase', 'number')}
              {field('个人账户', 'pnPers', 'number')}
              {field('已缴费月数', 'pnPaidMonths', 'number')}
              {field('最低缴费月数', 'pnMinMonths', 'number')}
            </div>
            <div className="fld-row">
              {field('出生日期', 'pnBirth', 'date')}
              {field('缴费工资(估算参考)', 'pnWage', 'number')}
              {field('计发指数', 'pnIdx', 'number', '0.01')}
              {field('记账利率%', 'pnRate', 'number', '0.1')}
              {field('退休年龄', 'pnAge', 'number')}
            </div>
            <div className="hint" style={{ margin: '8px 0 2px' }}>企业年金 / 职业年金（补充养老，单位与个人共同缴费）</div>
            <div className="fld-row">
              {field('年金账户余额', 'pnAnnBal', 'number')}
              {field('单位缴费%', 'pnAnnComp', 'number', '0.1')}
              {field('个人缴费%', 'pnAnnPers', 'number', '0.1')}
            </div>
          </div>
          <div className="card">
            <h3>投资</h3>
            <div className="fld-row">
              {field('目标年化%', 'ivTgt', 'number', '0.1')}
              {field('本金', 'ivBase', 'number')}
            </div>
            <label className="fld">
              <span>基准指数</span>
              <select value={f.ivBench} onChange={(e) => setField('ivBench', e.target.value)}>
                {BENCH_PRESETS.map((p) => (
                  <option key={p.key} value={p.key}>{p.name}</option>
                ))}
              </select>
            </label>
            <p className="hint">各指数的月度收益率请到「投资」页编辑（一次录入多指数，按需切换）</p>
          </div>
        </div>
      </div>

      <div className="row" style={{ marginTop: 14 }}>
        <button className="btn ghost" onClick={resetDefault}>恢复默认</button>
        <button className="btn ghost" onClick={exportData}>导出数据</button>
        <button className="btn ghost" onClick={() => fileRef.current?.click()}>导入数据</button>
        <input ref={fileRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={onImport} />
      </div>
    </div>
  )
}
