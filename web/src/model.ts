// 全局状态模型 —— 与后端 DAL 存储结构对齐，并兼容原始 vanilla 前端 S

export interface User {
  name: string
}

export interface Profile {
  workStart: string
  workEnd: string
  lunchStart: string
  lunchEnd: string
  otW: number
  otWe: number
  otH: number
  hireDate: string   // 参加工作日期（YYYY-MM-DD；养老页未填出生日期时回退推算年龄用）
  bonus: number
  bonusAmort: boolean
  retireAge: number
  unpunchedMode: 'standard' | 'off'
}

export interface Payday {
  type: 'current_month' | 'next_month' | 'prev_month'
  day: number
  rule: 'advance' | 'delay' | 'same'
  amount: number
}

export interface Pension {
  paid: number        // 已缴年限（展示用，保留兼容）
  paidMonths: number  // 已缴月数（精确输入）
  minMonths: number   // 领退休金最低缴费月数
  personal: number    // 基本养老保险个人账户余额
  wage: number        // 养老金计发基数 / 省社平工资（基础养老金公式用，可自动同步或手动填）
  base: number        // 缴费基数（每月实际缴费按此计算）
  idx: number
  rate: number
  age: number
  annBal: number      // 企业年金 / 职业年金账户余额
  annCompRate: number // 年金单位缴费比例（%）
  annPersRate: number // 年金个人缴费比例（%）
  birthDate: string   // 出生日期（YYYY-MM-DD；空表示未设置，回退到按参加工作日期推算）
  province: string    // 参保省份（用于自动获取养老金计发基数 / 省社平工资）
}

export interface Fire {
  target: number
  spend: number
  save: number
  rate: number
}

export interface Invest {
  target: number
  benchmark: string          // 当前选中的基准指数 key
  bench: Record<string, number[]>  // 多个指数的月度收益率（%），每个长度 12
  base: number
  profitMonthly: (number | null)[]  // 每月盈亏金额（元），用户手动填写；与净资产联动算收益率，长度 12
  profitWeekly: (number | null)[]   // 每周盈亏金额（元），用户手动填写，长度 52
}

// 年度存钱追踪：以每年固定的基线打点日为周期，统计本周期净存了多少、离目标还差多少
export interface SaveTrack {
  target: number           // 年度存钱目标（元）
  baselineMD: string       // 基线打点日月-日，如 "09-01"（每年此日做一次资产统计）
  startNet: number         // 起步基线净资产（手动填的「上一个基线日」当天净资产，如去年9月1日）
  snapshots: Record<string, number>  // 历史基线日净资产快照 { "2025-09-01": 净资产, ... }
}

// 常用基准指数预设
export const BENCH_PRESETS: { key: string; name: string }[] = [
  { key: 'csi300', name: '沪深300' },
  { key: 'csi500', name: '中证500' },
  { key: 'gem', name: '创业板指' },
  { key: 'nasdaq', name: '纳斯达克' },
  { key: 'bond', name: '中证全债' },
]

export interface AccountItem {
  n: string
  b: number
  rate?: number
  month?: number
  remain?: number
}

export interface Accounts {
  deposits: AccountItem[]
  invest: AccountItem[]
  funds: AccountItem[]
  social: AccountItem[]
  debts: AccountItem[]
}

export interface Punch {
  in: string
  out: string
  leave: number
  note: string
}

export interface TrendPoint {
  ym: string
  v: number
  a?: number  // 当月总资产（可选，旧数据可能没有）
  d?: number  // 当月总负债（可选，旧数据可能没有）
}

// 每日净资产快照（与 TrendPoint 同结构，粒度更细）
export interface TrendDayPoint {
  ymd: string  // "YYYY-MM-DD"
  v: number
  a?: number
  d?: number
}

// 净资产分组（资产为正、负债为负），用于计算总净资产
export const ASSET_GROUPS: { key: keyof Accounts; sign: 1 | -1 }[] = [
  { key: 'deposits', sign: 1 },
  { key: 'invest', sign: 1 },
  { key: 'funds', sign: 1 },
  { key: 'social', sign: 1 },
  { key: 'debts', sign: -1 },
]

// 根据账户明细计算当前净资产（资产 - 负债）
export function computeNet(accounts: Accounts): number {
  let net = 0
  for (const g of ASSET_GROUPS) {
    net += (accounts[g.key] || []).reduce((a, b) => a + (b.b || 0), 0) * g.sign
  }
  return net
}

// 当前总资产（存款+投资+公积金+养老账户）
export function computeAssets(accounts: Accounts): number {
  return ASSET_GROUPS.filter((g) => g.sign > 0).reduce((sum, g) => {
    return sum + (accounts[g.key] || []).reduce((a, b) => a + (b.b || 0), 0)
  }, 0)
}

// 当前总负债（取正值）
export function computeDebts(accounts: Accounts): number {
  return (accounts.debts || []).reduce((a, b) => a + (b.b || 0), 0)
}

// 是否已有任何账户数据（用于避免给全新用户写入空的净资产快照）
export function hasAccounts(accounts: Accounts): boolean {
  return ASSET_GROUPS.some((g) => (accounts[g.key] || []).length > 0)
}

// 当前年月（YYYY-MM）
export function ymNow(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// 把当前月真实净资产 upsert 进趋势数组（同月覆盖，保留历史真实月份）
export function upsertTrend(trend: TrendPoint[], v: number, a: number, d: number): TrendPoint[] {
  const ym = ymNow()
  const next = trend.slice()
  const idx = next.findIndex((t) => t.ym === ym)
  const point: TrendPoint = { ym, v: Math.round(v), a: Math.round(a), d: Math.round(d) }
  if (idx >= 0) next[idx] = point
  else next.push(point)
  return next
}

// 当前年月日（YYYY-MM-DD）
export function ymdNow(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// 把今天的真实净资产 upsert 进每日趋势（同日覆盖，保留历史真实日期）
export function upsertTrendDaily(trend: TrendDayPoint[], v: number, a: number, d: number): TrendDayPoint[] {
  const ymd = ymdNow()
  const next = trend.slice()
  const idx = next.findIndex((t) => t.ymd === ymd)
  const point: TrendDayPoint = { ymd, v: Math.round(v), a: Math.round(a), d: Math.round(d) }
  if (idx >= 0) next[idx] = point
  else next.push(point)
  return next
}

export interface AppState {
  user: User
  profile: Profile
  payday: Payday
  pension: Pension
  fire: Fire
  invest: Invest
  saveTrack: SaveTrack
  weekly: number[]
  monthly: { y: string; r: number }[]
  yearly: Record<string, { cum: number } | null>
  punches: Record<string, Punch>
  holidays: Record<string, number>
  accounts: Accounts
  trend: TrendPoint[]
  trendDaily: TrendDayPoint[]
}

export const DEFAULT: AppState = {
  user: { name: 'OO' },
  profile: {
    workStart: '09:00',
    workEnd: '18:00',
    lunchStart: '12:00',
    lunchEnd: '13:00',
    otW: 1.5,
    otWe: 2,
    otH: 3,
    hireDate: '2022-07-01',
    bonus: 50000,
    bonusAmort: false,
    retireAge: 50,
    unpunchedMode: 'standard',
  },
  payday: { type: 'next_month', day: 15, rule: 'advance', amount: 13500 },
  pension: { paid: 8.25, paidMonths: 99, minMonths: 180, personal: 51200, wage: 8321, base: 8321, idx: 1.0, rate: 4, age: 50, annBal: 0, annCompRate: 8, annPersRate: 4, birthDate: '', province: '' },
  fire: { target: 1000000, spend: 40000, save: 6000, rate: 5 },
  saveTrack: { target: 120000, baselineMD: '09-01', startNet: 0, snapshots: {} },
  invest: {
    target: 6,
    benchmark: 'csi300',
    bench: {
      csi300: [],
      csi500: [],
      gem: [],
      nasdaq: [],
      bond: [],
    },
    base: 156000,
    profitMonthly: [],
    profitWeekly: [],
  },
  weekly: [],
  monthly: [],
  yearly: {},
  punches: {},
  holidays: {},
  accounts: {
    deposits: [],
    invest: [],
    funds: [],
    social: [],
    debts: [],
  },
  trend: [],
  trendDaily: [],
}

// 合并后端返回（可能只含部分键）与默认值，避免缺字段导致渲染崩溃
export function mergeState(v: Partial<AppState> | null | undefined): AppState {
  if (!v) return structuredClone(DEFAULT)
  return {
    ...structuredClone(DEFAULT),
    ...v,
    user: { ...DEFAULT.user, ...(v.user || {}) },
    profile: { ...DEFAULT.profile, ...(v.profile || {}) },
    payday: (() => {
      const pay = { ...DEFAULT.payday, ...(v.payday || {}) }
      // 旧数据兼容：原 profile.salary 迁移到 payday.amount
      if (v.profile && typeof (v.profile as any).salary === 'number' && !(v.payday && (v.payday as any).amount > 0)) {
        pay.amount = (v.profile as any).salary
      }
      return pay
    })(),
    pension: (() => {
      const p = { ...DEFAULT.pension, ...(v.pension || {}) }
      if (v.pension && typeof v.pension.paidMonths !== 'number') {
        p.paidMonths = Math.round((p.paid || 0) * 12)
      }
      if (v.pension && typeof v.pension.minMonths !== 'number') {
        p.minMonths = 180
      }
      // 旧数据兼容：没有缴费基数时，沿用缴费工资，保证缴费构成有值
      if (v.pension && typeof v.pension.base !== 'number') {
        p.base = p.wage || DEFAULT.pension.base
      }
      return p
    })(),
    fire: { ...DEFAULT.fire, ...(v.fire || {}) },
    saveTrack: { ...DEFAULT.saveTrack, ...(v.saveTrack || {}) },
    invest: (() => {
      const vInv: any = v.invest || {}
      const merged: any = { ...DEFAULT.invest, ...vInv }
      // 旧数据兼容：如果只有 benchMonthly 数组，迁到 bench.csi300
      if (Array.isArray(vInv.benchMonthly) && vInv.benchMonthly.length > 0 && !vInv.bench) {
        merged.bench = { ...DEFAULT.invest.bench, csi300: vInv.benchMonthly }
      }
      // 旧数据兼容：合并每个 bench 索引，缺位补 0
      if (merged.bench && typeof merged.bench === 'object') {
        const next: Record<string, number[]> = {}
        for (const key of Object.keys(DEFAULT.invest.bench)) {
          const arr = merged.bench[key]
          next[key] = Array.from({ length: 12 }, (_, i) => Number(Array.isArray(arr) ? arr[i] : NaN) || 0)
        }
        // 保留旧数据里独有的指数
        for (const key of Object.keys(merged.bench)) {
          if (!(key in next) && Array.isArray(merged.bench[key])) {
            next[key] = Array.from({ length: 12 }, (_, i) => Number(merged.bench[key][i]) || 0)
          }
        }
        merged.bench = next
      } else {
        merged.bench = { ...DEFAULT.invest.bench }
      }
      // 旧数据兼容：当前 benchmark key 不在新 bench 里，回退到 csi300
      if (!merged.bench[merged.benchmark]) {
        merged.benchmark = 'csi300'
      }
      // 盈亏金额：缺位补 0（用 null 表示「未填」，便于区分 0 利润和未填）
      merged.profitMonthly = Array.from({ length: 12 }, (_, i) => {
        const v = vInv.profitMonthly?.[i]
        return v == null || v === '' || isNaN(Number(v)) ? null : Number(v)
      })
      merged.profitWeekly = Array.from({ length: 52 }, (_, i) => {
        const v = vInv.profitWeekly?.[i]
        return v == null || v === '' || isNaN(Number(v)) ? null : Number(v)
      })
      return merged
    })(),
    accounts: { ...DEFAULT.accounts, ...(v.accounts || {}) },
    weekly: v.weekly || [],
    monthly: v.monthly || [],
    yearly: v.yearly || {},
    punches: v.punches || {},
    holidays: v.holidays || {},
    trend: v.trend && v.trend.length ? v.trend : DEFAULT.trend,
    trendDaily: v.trendDaily && v.trendDaily.length ? v.trendDaily : DEFAULT.trendDaily,
  }
}
