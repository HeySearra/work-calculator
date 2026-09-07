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
  paid: number
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
  benchmark: string
  benchMonthly: number[]
  base: number
}

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
  pension: { paid: 8.25, personal: 51200, wage: 8321, idx: 1.0, rate: 4, age: 50 },
  fire: { target: 1000000, spend: 40000, save: 6000, rate: 5 },
  invest: {
    target: 6,
    benchmark: 'csi300',
    benchMonthly: [-2.1, 2.3, 0.5, -1.0, 1.4, 0.9, -1.8, 2.0, 1.1, -0.4, 1.6, 0.7],
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
    pension: { ...DEFAULT.pension, ...(v.pension || {}) },
    fire: { ...DEFAULT.fire, ...(v.fire || {}) },
    invest: { ...DEFAULT.invest, ...(v.invest || {}) },
    accounts: { ...DEFAULT.accounts, ...(v.accounts || {}) },
    weekly: v.weekly || [],
    monthly: v.monthly || [],
    yearly: v.yearly || {},
    punches: v.punches || {},
    holidays: v.holidays || {},
    trend: v.trend && v.trend.length ? v.trend : DEFAULT.trend,
  }
}
