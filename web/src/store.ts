// 全局状态：Zustand 镜像后端 S，并提供持久化动作
import { create } from 'zustand'
import type { AppState } from './model'
import { DEFAULT, mergeState, computeNet, computeAssets, computeDebts, upsertTrend, upsertTrendDaily, hasAccounts } from './model'
import { api, getToken, getUsername, setToken } from './api'

interface Store {
  token: string
  username: string
  S: AppState
  ready: boolean
  authed: boolean
  setAuth: (token: string, username: string) => void
  logout: () => void
  loadState: () => Promise<void>
  // 以不可变方式更新 S（draft 为克隆副本，可直接修改）
  update: (fn: (draft: AppState) => void) => void
  persist: () => Promise<void>
  // 便捷：更新并立即保存
  commit: (fn: (draft: AppState) => void) => Promise<void>
  reset: () => void
}

export const useStore = create<Store>((set, get) => ({
  token: getToken(),
  username: getUsername(),
  S: structuredClone(DEFAULT),
  ready: false,
  authed: !!getToken(),

  setAuth: (token, username) => {
    setToken(token, username)
    set({ token, username, authed: !!token })
  },
  logout: () => {
    setToken('', '')
    set({ token: '', username: '', authed: false, S: structuredClone(DEFAULT), ready: false })
  },
  loadState: async () => {
    const s = await api.getState()
    const merged = mergeState(s)
    // 用当前真实净资产覆盖当月/当日快照（不生成演示数据，仅写真实值；账户为空时不写，避免给新用户落 0 快照）
    if (hasAccounts(merged.accounts)) {
      merged.trend = upsertTrend(
        merged.trend,
        computeNet(merged.accounts),
        computeAssets(merged.accounts),
        computeDebts(merged.accounts),
      )
      merged.trendDaily = upsertTrendDaily(
        merged.trendDaily,
        computeNet(merged.accounts),
        computeAssets(merged.accounts),
        computeDebts(merged.accounts),
      )
    }
    set({ S: merged, ready: true })
    await api.putState(merged)
  },
  update: (fn) => {
    const next = structuredClone(get().S)
    fn(next)
    set({ S: next })
  },
  persist: async () => {
    await api.putState(get().S)
  },
  commit: async (fn) => {
    const next = structuredClone(get().S)
    fn(next)
    // 账户变化后，把当前月 / 当日真实净资产/总资产/总负债写入趋势（同月/同日覆盖，保留历史真实月份/日期；账户为空则不写）
    if (hasAccounts(next.accounts)) {
      next.trend = upsertTrend(
        next.trend,
        computeNet(next.accounts),
        computeAssets(next.accounts),
        computeDebts(next.accounts),
      )
      next.trendDaily = upsertTrendDaily(
        next.trendDaily,
        computeNet(next.accounts),
        computeAssets(next.accounts),
        computeDebts(next.accounts),
      )
    }
    set({ S: next })
    await api.putState(next)
  },
  reset: () => set({ S: structuredClone(DEFAULT) }),
}))

export { mergeState }
