// 格式化与基础时间工具
export function fmt(n: number, d = 2): string {
  if (!isFinite(n)) return '—'
  return '¥' + Math.round(n).toLocaleString('zh-CN', { minimumFractionDigits: d, maximumFractionDigits: d })
}
export function fmtN(n: number, d = 0): string {
  if (!isFinite(n)) return '—'
  return n.toLocaleString('zh-CN', { minimumFractionDigits: d, maximumFractionDigits: d })
}
export function pad(n: number, w = 2): string {
  return String(n).padStart(w, '0')
}
export function todayKey(d?: Date): string {
  const x = d || new Date()
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`
}
// 应用的「今天」：重构后改用真实服务器时间（不再硬编码演示日期）
export function appToday(): Date {
  return new Date()
}
