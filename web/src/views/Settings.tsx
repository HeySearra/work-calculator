import { useRef, useState } from 'react'
import { useStore } from '../store'
import { DEFAULT, mergeState } from '../model'
import { fmt, appToday } from '../format'
import { holidaysToText, textToHolidays, dailyPay, payDays } from '../calc'
import { api } from '../api'

type Str = { [k: string]: string }
function useForm(init: () => Str) {
  const [v, setV] = useState<Str>(init)
  const set = (k: string, val: string) => setV((s) => ({ ...s, [k]: val }))
  return [v, set] as const
}

export function Settings() {
  const S = useStore((s) => s.S)
  const commit = useStore((s) => s.commit)
  const loadState = useStore((s) => s.loadState)
  const [msg, setMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const [f, setF] = useForm(() => {
    const p = S.profile, pn = S.pension, fr = S.fire, iv = S.invest, py = S.payday
    return {
      workStart: p.workStart, workEnd: p.workEnd, lunchStart: p.lunchStart, lunchEnd: p.lunchEnd,
      salary: String(p.salary), otW: String(p.otW), otWe: String(p.otWe), hireDate: p.hireDate,
      bonus: String(p.bonus), bonusAmort: p.bonusAmort ? '1' : '0', unpunchedMode: p.unpunchedMode,
      city: S.user.city,
      payType: py.type, payDay: String(py.day), payRule: py.rule, payAmt: String(py.amount),
      pnPaid: String(pn.paid), pnPers: String(pn.personal), pnWage: String(pn.wage),
      pnIdx: String(pn.idx), pnRate: String(pn.rate), pnAge: String(pn.age),
      frTgt: String(fr.target), frSpend: String(fr.spend), frSave: String(fr.save), frRate: String(fr.rate),
      ivTgt: String(iv.target), ivBench: iv.benchmark, ivBenchV: iv.benchMonthly.join(','), ivBase: String(iv.base),
      holidays: holidaysToText(S.holidays),
    }
  })

  function num(k: string) { return Number(f[k]) || 0 }
  const pd = payDays(appToday(), S.holidays)
  const dp = dailyPay(S.profile, appToday(), S.holidays)

  function save() {
    commit((d) => {
      const p = d.profile, pn = d.pension, fr = d.fire, iv = d.invest, py = d.payday
      p.workStart = f.workStart; p.workEnd = f.workEnd; p.lunchStart = f.lunchStart; p.lunchEnd = f.lunchEnd
      p.salary = num('salary'); p.otW = num('otW'); p.otWe = num('otWe'); p.hireDate = f.hireDate
      p.bonus = num('bonus'); p.bonusAmort = f.bonusAmort === '1'; p.unpunchedMode = (f.unpunchedMode as 'standard' | 'off')
      d.user.city = f.city
      py.type = (f.payType as 'current_month' | 'next_month'); py.day = num('payDay'); py.rule = (f.payRule as 'advance' | 'delay' | 'same'); py.amount = num('payAmt')
      pn.paid = num('pnPaid'); pn.personal = num('pnPers'); pn.wage = num('pnWage'); pn.idx = num('pnIdx'); pn.rate = num('pnRate'); pn.age = num('pnAge')
      fr.target = num('frTgt'); fr.spend = num('frSpend'); fr.save = num('frSave'); fr.rate = num('frRate')
      iv.target = num('ivTgt'); iv.benchmark = f.ivBench
      const bm = f.ivBenchV.split(',').map((s) => parseFloat(s.trim())).filter((x) => isFinite(x))
      iv.benchMonthly = bm.length === 12 ? bm : [...DEFAULT.invest.benchMonthly]
      iv.base = num('ivBase')
      d.holidays = textToHolidays(f.holidays)
    }).then(() => setMsg('设置已保存')).catch(() => setMsg('保存失败'))
  }

  function resetDefault() {
    if (!confirm('恢复默认设置？现有收支/盈亏记录保留。')) return
    commit((d) => {
      d.profile = JSON.parse(JSON.stringify(DEFAULT.profile))
      d.payday = JSON.parse(JSON.stringify(DEFAULT.payday))
      d.pension = JSON.parse(JSON.stringify(DEFAULT.pension))
      d.fire = JSON.parse(JSON.stringify(DEFAULT.fire))
      d.invest = JSON.parse(JSON.stringify(DEFAULT.invest))
    }).then(() => setMsg('已恢复默认'))
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
        <input type={type} step={step} value={f[k]} onChange={(e) => setF(k, e.target.value)} />
      </label>
    )
  }

  return (
    <div>
      {msg && <div className="toast-inline">{msg}</div>}
      <div className="grid">
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
            <select value={f.bonusAmort} onChange={(e) => setF('bonusAmort', e.target.value)}>
              <option value="0">不摊</option><option value="1">分摊</option>
            </select>
          </label>
          <div className="fld-row">
            {field('城市', 'city')}
            {field('节假日(例 10-01* 表示补班)', 'holidays')}
          </div>
          <div className="radio-group">
            <label className="radio-card">
              <input type="radio" name="unpunched" value="standard" checked={f.unpunchedMode === 'standard'} onChange={(e) => setF('unpunchedMode', e.target.value)} />
              <span>按默认作息（未打卡的工作日按规定上下班时间计算时长）</span>
            </label>
            <label className="radio-card">
              <input type="radio" name="unpunched" value="off" checked={f.unpunchedMode === 'off'} onChange={(e) => setF('unpunchedMode', e.target.value)} />
              <span>视为当天没上班（未打卡的工作日不计入在司时长）</span>
            </label>
          </div>
          <div className="hint">本月 <b>{pd}</b> 天 · 日薪 <b>{fmt(dp)}</b></div>
        </div>

        <div className="card">
          <h3>发薪日</h3>
          <div className="fld-row">
            {field('类型', 'payType')}
            {field('日期', 'payDay', 'number')}
            {field('规则', 'payRule')}
            {field('金额', 'payAmt', 'number')}
          </div>
          <h3 style={{ marginTop: 12 }}>养老账户</h3>
          <div className="fld-row">
            {field('已缴年数', 'pnPaid', 'number')}
            {field('个人账户', 'pnPers', 'number')}
            {field('缴费工资', 'pnWage', 'number')}
          </div>
          <div className="fld-row">
            {field('计发指数', 'pnIdx', 'number', '0.01')}
            {field('记账利率%', 'pnRate', 'number', '0.1')}
            {field('退休年龄', 'pnAge', 'number')}
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
          <h3 style={{ marginTop: 12 }}>投资</h3>
          <div className="fld-row">
            {field('目标年化%', 'ivTgt', 'number', '0.1')}
            {field('基准', 'ivBench')}
            {field('本金', 'ivBase', 'number')}
          </div>
          <label className="fld">
            <span>基准月度收益%(逗号分隔 12 个)</span>
            <input value={f.ivBenchV} onChange={(e) => setF('ivBenchV', e.target.value)} />
          </label>
        </div>
      </div>

      <div className="row" style={{ marginTop: 14 }}>
        <button className="btn primary" onClick={save}>保存设置</button>
        <button className="btn ghost" onClick={resetDefault}>恢复默认</button>
        <button className="btn ghost" onClick={exportData}>导出数据</button>
        <button className="btn ghost" onClick={() => fileRef.current?.click()}>导入数据</button>
        <input ref={fileRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={onImport} />
      </div>
    </div>
  )
}
