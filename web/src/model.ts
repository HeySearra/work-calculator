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
  personal: number
  wage: number
  idx: number
  rate: number
  age: number
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

function buildDemoTrend(): TrendPoint[] {
  const arr: TrendPoint[] = []
  let v = 290000
  const now = new Date()
  for (let i = 11; i >= 0; i--) {
    v += 4000 + Math.sin(i) * 3000 + Math.random() * 2000
    const m = (now.getMonth() - i + 12) % 12
    arr.push({ ym: `2026-${String(m + 1).padStart(2, '0')}`, v: Math.round(v) })
  }
  return arr
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
  pension: { paid: 8.25, paidMonths: 99, minMonths: 180, personal: 51200, wage: 8321, idx: 1.0, rate: 4, age: 50 },
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
  trend: buildDemoTrend(),
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
