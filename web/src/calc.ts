// 计算逻辑层 —— 从原始 vanilla app.js 忠实移植，全部改为纯函数（接收 state/参数）
import type { AppState, Punch, Profile, Payday } from './model'
import { appToday } from './format'

export function parseHM(s: string): number {
  const [h, m] = s.split(':').map(Number)
  return h * 60 + m
}
export function hmStr(mins: number): string {
  const m = Math.max(0, Math.min(24 * 60, Math.round(mins)))
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

// ---------- 工作日 / 计薪天数 ----------
export function isWorkday(d: Date, holidays: Record<string, number>): boolean {
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const flag = holidays[key]
  if (flag === 1) return false
  if (flag === 2) return true
  const w = d.getDay()
  return w !== 0 && w !== 6
}
export function workdaysInMonth(y: number, m: number, holidays: Record<string, number>): number {
  let n = 0
  const d = new Date(y, m, 1)
  while (d.getMonth() === m) {
    if (isWorkday(d, holidays)) n++
    d.setDate(d.getDate() + 1)
  }
  return n
}
export function payDays(d: Date, holidays: Record<string, number>): number {
  return workdaysInMonth(d.getFullYear(), d.getMonth(), holidays)
}
export function workdaysPassed(d: Date, holidays: Record<string, number>): number {
  const y = d.getFullYear(), m = d.getMonth()
  let n = 0
  for (let day = 1; day <= d.getDate(); day++) if (isWorkday(new Date(y, m, day), holidays)) n++
  return n
}
export function monthlyPay(p: Profile): number {
  return p.salary + (p.bonusAmort ? (p.bonus || 0) / 12 : 0)
}
export function dailyPay(p: Profile, d: Date, holidays: Record<string, number>): number {
  return monthlyPay(p) / payDays(d, holidays)
}

// ---------- 节假日文本 ⇄ 对象 ----------
export function holidaysToText(holidays: Record<string, number>): string {
  return Object.keys(holidays).sort().map((k) => (holidays[k] === 2 ? k + '*' : k)).join(',')
}
export function textToHolidays(txt: string): Record<string, number> {
  const out: Record<string, number> = {}
  const y = new Date().getFullYear()
  String(txt || '').split(/[,，\s]+/).forEach((raw) => {
    let s = raw.trim()
    if (!s) return
    let flag = 1
    if (s.endsWith('*')) { flag = 2; s = s.slice(0, -1) }
    let key: string | null = null
    if (/^\d{1,2}-\d{1,2}$/.test(s)) key = `${y}-${s.split('-').map((x) => x.padStart(2, '0')).join('-')}`
    else if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(s)) {
      const [a, b, c] = s.split('-')
      key = `${a}-${b.padStart(2, '0')}-${c.padStart(2, '0')}`
    }
    if (key) out[key] = flag
  })
  return out
}

// ---------- 在司时长 / 打卡 ----------
export function stdMinutes(p: Profile): number {
  return (parseHM(p.workEnd) - parseHM(p.workStart)) - (parseHM(p.lunchEnd) - parseHM(p.lunchStart))
}
export function unpunchedAsOff(d: Date, p: Profile): boolean {
  if (p.unpunchedMode !== 'off') return false
  return d >= appToday()
}
export function punchHours(rec: Punch | undefined, d: Date | undefined, p: Profile, holidays: Record<string, number>): number | null {
  if (rec && rec.leave) return null
  if (!rec || !rec.in || !rec.out) {
    if (!d || !isWorkday(d, holidays)) return null
    if (unpunchedAsOff(d, p)) return null
    return stdMinutes(p) / 60
  }
  const i = parseHM(rec.in), o = parseHM(rec.out)
  if (!(o > i)) return null
  const ls = parseHM(p.lunchStart), le = parseHM(p.lunchEnd)
  const lunch = Math.max(0, Math.min(o, le) - Math.max(i, ls))
  return (o - i - lunch) / 60
}
export interface PunchInfo {
  h: number; std: number; real: boolean; late: number; early: number; ot: number
}
export function punchInfo(rec: Punch | undefined, d: Date | undefined, p: Profile, holidays: Record<string, number>): PunchInfo | null {
  const h = punchHours(rec, d, p, holidays)
  if (h == null) return null
  const std = stdMinutes(p) / 60
  const real = !!(rec && rec.in && rec.out && !rec.leave)
  const lateRaw = real ? parseHM(rec.in) - parseHM(p.workStart) : 0
  const earlyRaw = real ? parseHM(p.workEnd) - parseHM(rec.out) : 0
  return {
    h, std, real,
    late: Math.max(0, lateRaw),
    early: Math.max(0, earlyRaw),
    ot: Math.max(0, h - std),
  }
}
export function fmtDur(h: number): string {
  if (!isFinite(h)) return '—'
  const H = Math.floor(h), M = Math.round((h - H) * 60)
  return (H > 0 ? H + ' 小时 ' : '') + M + ' 分'
}

// ---------- 发薪日 ----------
export interface PaydayResult { next: Date; last: Date; daysLeft: number }
export function computePayday(now: Date, py: Payday): PaydayResult {
  const { type, day, rule } = py
  let y = now.getFullYear(), m = now.getMonth()
  const payMonth = type === 'current_month' ? m : m + 1
  let next = new Date(y, payMonth, Math.min(day, 28), 10, 0, 0)
  if (next <= now) next = new Date(y, payMonth + 1, Math.min(day, 28), 10, 0, 0)
  if (rule === 'advance') {
    while ([0, 6].includes(next.getDay())) next = new Date(next.getTime() - 86400000)
  } else if (rule === 'delay') {
    while ([0, 6].includes(next.getDay())) next = new Date(next.getTime() + 86400000)
  }
  const last = new Date(next.getFullYear(), next.getMonth() - 1, Math.min(day, 28), 10, 0, 0)
  const daysLeft = Math.ceil((next.getTime() - now.getTime()) / 86400000)
  return { next, last, daysLeft }
}

// ---------- 理财能力评级 / 累计 ----------
export interface Rating { name: string; desc: string }
export function computeRating(my: number, bench: number): Rating {
  const diff = my - bench
  if (my === 0) return { name: '数据不足', desc: '至少录入一个月才能评级' }
  if (diff < -1) return { name: '新手', desc: `跑输基准 ${Math.abs(diff).toFixed(1)}%，保持记录` }
  if (diff < 1) return { name: '跟得上大盘', desc: '与基准持平，继续积累数据' }
  if (diff < 3) return { name: '有超额', desc: `跑赢基准 ${diff.toFixed(1)}% · 正在形成能力` }
  return { name: '稳定超额', desc: `跑赢基准 ${diff.toFixed(1)}% · 能力初步成型` }
}

// 月度 / 周度累计收益率计算
export interface InvestCalc {
  cum: (number | null)[]
  bc: (number | null)[]
  monthly: number[] // 周度模式下按月聚合
  n: number          // 截至当前已过去的月份数（保证 0 月份也进图）
  last: number
  bl: number
  ann: number
  exc: number
  amt: number
  // 进阶指标
  bestMonth: number    // 最大单月 %
  worstMonth: number   // 最小单月 %（负）
  winRate: number      // 胜率：正收益月份占比 0-1
  maxDD: number        // 最大回撤 %
  streak: number       // 连续正超额（从末尾往回数）
  excess: number[]     // 每月超额 = monthly - bench
}
export function computeInvest(S: AppState, freq: 'monthly' | 'weekly'): InvestCalc {
  // 当前选中的基准指数（多指数支持），缺位补 0
  const benchSource = S.invest.bench?.[S.invest.benchmark] || S.invest.bench?.csi300 || []
  const bench = Array.from({ length: 12 }, (_, i) => Number(benchSource[i] ?? 0) || 0)
  let monthly: number[]
  if (freq === 'weekly') {
    const arr = S.weekly.length === 52 ? S.weekly : new Array(52).fill(0)
    const monthBuckets = [[0, 4], [4, 8], [8, 13], [13, 17], [17, 22], [22, 26], [26, 30], [30, 35], [35, 39], [39, 43], [43, 47], [47, 52]]
    monthly = monthBuckets.map(([s, e]) => {
      const ws = arr.slice(s, e)
      let c = 1
      ws.forEach((r) => (c *= 1 + r / 100))
      return (c - 1) * 100
    })
  } else {
    // 月度：补齐 12 项，缺失月份按 0 计；避免 n 算法把 undefined 当非零导致 cum 变 NaN
    monthly = Array.from({ length: 12 }, (_, i) => {
      const d = S.monthly[i]
      return d ? d.r : 0
    })
  }
  // 截至当前已过去的月份数：保证 0 月份也进图（不剔除）
  const today = appToday()
  const n = Math.min(12, today.getMonth() + 1)

  const cum: (number | null)[] = []
  const bc: (number | null)[] = []
  let cAll = 1, bAll = 1
  for (let i = 0; i < 12; i++) {
    if (i < n) {
      cAll *= 1 + monthly[i] / 100
      cum.push((cAll - 1) * 100)
      bAll *= 1 + bench[i] / 100
      bc.push((bAll - 1) * 100)
    } else { cum.push(null); bc.push(null) }
  }
  const last = n > 0 ? cum[n - 1]! : 0
  const bl = n > 0 ? bc[n - 1]! : 0
  const ann = n > 0 ? (Math.pow(1 + last / 100, 12 / n) - 1) * 100 : 0
  const exc = last - bl
  const amt = S.invest.base * last / 100

  // 月超额（月收益 − 基准）
  const excess: number[] = []
  for (let i = 0; i < 12; i++) excess.push(i < n ? monthly[i] - bench[i] : 0)

  // 最大/最小单月 + 胜率
  let bestMonth = 0, worstMonth = 0, wins = 0
  for (let i = 0; i < n; i++) {
    if (monthly[i] > bestMonth) bestMonth = monthly[i]
    if (monthly[i] < worstMonth) worstMonth = monthly[i]
    if (monthly[i] > 0) wins++
  }
  const winRate = n > 0 ? wins / n : 0

  // 最大回撤（基于累计收益 cum 序列）
  let peak = -Infinity, maxDD = 0
  for (let i = 0; i < n; i++) {
    const v = cum[i] ?? 0
    if (v > peak) peak = v
    const dd = peak - v
    if (dd > maxDD) maxDD = dd
  }

  // 连续正超额（从末尾往回数）
  let streak = 0
  for (let i = n - 1; i >= 0; i--) {
    if (excess[i] > 0) streak++
    else break
  }

  return { cum, bc, monthly, n, last, bl, ann, exc, amt, bestMonth, worstMonth, winRate, maxDD, streak, excess }
}

// ---------- 发工资周期进度（pay.last → pay.next） ----------
export interface PayPeriod {
  passD: number
  totalD: number
  pct: number
  earned: number
}
// 从上一次发薪日到下一次发薪日的天数进度 + 预计到账
export function payPeriod(now: Date, py: Payday, amount: number): PayPeriod {
  const r = computePayday(now, py)
  const totalD = Math.max(1, Math.round((r.next.getTime() - r.last.getTime()) / 86400000))
  const passD = Math.max(0, Math.round((now.getTime() - r.last.getTime()) / 86400000))
  const pct = Math.max(0, Math.min(1, passD / totalD))
  return { passD, totalD, pct, earned: amount * pct }
}


export function fireProjection(target: number, save: number, rate: number): { months: number; year: number; month: number } {
  const i = rate / 100 / 12
  const net = 0 // 用 net 由调用方传入资产；此处返回相对当前净资产的补足月数
  const need = target
  let months = 0
  if (i > 0) months = Math.ceil(Math.log(1 + (need) * i / save) / Math.log(1 + i))
  else months = Math.ceil(need / save)
  const now = new Date()
  const yr = now.getFullYear() + Math.floor(months / 12)
  const mo = ((now.getMonth() + 1 + (months % 12)) % 12) || 12
  return { months, year: yr, month: mo }
}
