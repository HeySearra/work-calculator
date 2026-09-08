// 全局状态：Zustand 镜像后端 S，并提供持久化动作
import { create } from 'zustand'
import type { AppState } from './model'
import { DEFAULT, mergeState, computeNet, upsertTrend } from './model'
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
    // 校准当前月真实净资产快照（覆盖演示假数据，仅保留真实月份）
    merged.trend = upsertTrend(merged.trend, computeNet(merged.accounts))
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
    // 账户变化后，把当前月真实净资产写入趋势（同月覆盖，保留历史真实月份）
    next.trend = upsertTrend(next.trend, computeNet(next.accounts))
    set({ S: next })
    await api.putState(next)
  },
  reset: () => set({ S: structuredClone(DEFAULT) }),
}))

export { mergeState }
