// 全局状态模型 —— 与后端 DAL 存储结构对齐，并兼容原始 vanilla 前端 S

export interface User {
  name: string
  city: string
}

export interface Profile {
  workStart: string
  workEnd: string
  lunchStart: string
  lunchEnd: string
  salary: number
  otW: number
  otWe: number
  hireDate: string
  bonus: number
  bonusAmort: boolean
  retireAge: number
  unpunchedMode: 'standard' | 'off'
}

export interface Payday {
  type: 'current_month' | 'next_month'
  day: number
  rule: 'advance' | 'delay' | 'same'
  amount: number
}

export interface Pension {
  paid: number        // 已缴年限（展示用，保留兼容）
  paidMonths: number  // 已缴月数（精确输入）
  minMonths: number   // 领退休金最低缴费月数
  personal: number    // 基本养老保险个人账户余额
  wage: number        // 缴费工资（退休金估算参考，=省社平与本人指数化缴费工资的代理）
  base: number        // 缴费基数（每月实际缴费按此计算）
  idx: number
  rate: number
  age: number
  annBal: number      // 企业年金 / 职业年金账户余额
  annCompRate: number // 年金单位缴费比例（%）
  annPersRate: number // 年金个人缴费比例（%）
  birthDate: string   // 出生日期（YYYY-MM-DD；空表示未设置，回退到按入职日期推算）
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

// 当前年月（YYYY-MM）
export function ymNow(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// 把当前月真实净资产 upsert 进趋势数组（同月覆盖，保留历史真实月份）
export function upsertTrend(trend: TrendPoint[], v: number): TrendPoint[] {
  const ym = ymNow()
  const next = trend.slice()
  const idx = next.findIndex((t) => t.ym === ym)
  const point = { ym, v: Math.round(v) }
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
  weekly: number[]
  monthly: { y: string; r: number }[]
  yearly: Record<string, { cum: number } | null>
  punches: Record<string, Punch>
  holidays: Record<string, number>
  accounts: Accounts
  trend: TrendPoint[]
}

export const DEFAULT: AppState = {
  user: { name: 'OO', city: '成都' },
  profile: {
    workStart: '09:00',
    workEnd: '18:00',
    lunchStart: '12:00',
    lunchEnd: '13:00',
    salary: 13500,
    otW: 1.5,
    otWe: 2,
    hireDate: '2022-07-01',
    bonus: 50000,
    bonusAmort: false,
    retireAge: 50,
    unpunchedMode: 'standard',
  },
  payday: { type: 'next_month', day: 15, rule: 'advance', amount: 13500 },
  pension: { paid: 8.25, paidMonths: 99, minMonths: 180, personal: 51200, wage: 8321, base: 8321, idx: 1.0, rate: 4, age: 50, annBal: 0, annCompRate: 8, annPersRate: 4, birthDate: '' },
  fire: { target: 1000000, spend: 40000, save: 6000, rate: 5 },
  invest: {
    target: 6,
    benchmark: 'csi300',
    bench: {
      csi300: [-2.1, 2.3, 0.5, -1.0, 1.4, 0.9, -1.8, 2.0, 1.1, -0.4, 1.6, 0.7],
      csi500: [-1.5, 2.8, 0.3, -1.2, 1.6, 1.1, -2.0, 2.3, 1.3, -0.6, 1.8, 0.9],
      gem: [-3.0, 3.5, 0.0, -1.5, 2.0, 1.5, -2.5, 2.8, 1.5, -0.8, 2.2, 1.0],
      nasdaq: [3.0, 4.2, -1.0, 2.5, 1.8, 3.5, 2.0, 4.0, 1.5, 0.5, 5.0, 2.0],
      bond: [0.5, 0.3, 0.6, 0.4, 0.5, 0.4, 0.6, 0.5, 0.4, 0.5, 0.4, 0.5],
    },
    base: 156000,
    profitMonthly: [],
    profitWeekly: [],
  },
  weekly: [],
  monthly: [
    { y: '2026-01', r: -1.2 }, { y: '2026-02', r: 3.4 }, { y: '2026-03', r: 0.8 },
    { y: '2026-04', r: -0.6 }, { y: '2026-05', r: 2.1 }, { y: '2026-06', r: 1.5 },
    { y: '2026-07', r: -2.3 }, { y: '2026-08', r: 3.0 }, { y: '2026-09', r: 2.14 },
  ],
  yearly: { '2025': { cum: 4.8 }, '2026': null },
  punches: {},
  holidays: {},
  accounts: {
    deposits: [
      { n: '招商银行活期', b: 42300, rate: 1.5 },
      { n: '货币基金', b: 80000, rate: 1.8 },
    ],
    invest: [{ n: '股票/基金组合', b: 156000 }],
    funds: [{ n: '公积金账户', b: 68400 }],
    social: [{ n: '养老个人账户', b: 51200 }],
    debts: [{ n: '房贷', b: 25420, rate: 3.1, month: 4200, remain: 168 }],
  },
  trend: [],
}

// 合并后端返回（可能只含部分键）与默认值，避免缺字段导致渲染崩溃
export function mergeState(v: Partial<AppState> | null | undefined): AppState {
  if (!v) return structuredClone(DEFAULT)
  return {
    ...structuredClone(DEFAULT),
    ...v,
    user: { ...DEFAULT.user, ...(v.user || {}) },
    profile: { ...DEFAULT.profile, ...(v.profile || {}) },
    payday: { ...DEFAULT.payday, ...(v.payday || {}) },
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
  }
}
