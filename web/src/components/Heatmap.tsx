// 通用 GitHub 风格日历热力图（周一起列）。历史收入与考勤时长共用此组件。
import { appToday } from '../format'

function weekStart(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return x
}
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export interface CellInfo {
  cls?: string // 额外 class，如 l1..l5 / leave / past-empty / default
  title?: string
  future?: boolean
}

export function Heatmap({
  year,
  cell,
  onPick,
}: {
  year: number
  cell: (d: Date, key: string) => CellInfo
  onPick?: (d: Date, key: string) => void
}) {
  const start = weekStart(new Date(year, 0, 1))
  const yEnd = new Date(year, 11, 31)
  yEnd.setHours(0, 0, 0, 0)
  const totalCells = Math.floor((yEnd.getTime() - start.getTime()) / 86400000) + 1
  const cols = Math.max(1, Math.ceil(totalCells / 7))
  const today = appToday()

  // 月份分隔列
  const monthCols = new Set<number>()
  for (let m = 0; m < 12; m++) {
    const md = new Date(year, m, 1)
    const col = Math.floor((md.getTime() - start.getTime()) / 86400000 / 7)
    if (col >= 0 && col < cols) monthCols.add(col)
  }
  const monthStartAdded = new Set<number>()
  const cells = []
  for (let i = 0; i < cols * 7; i++) {
    const d = new Date(start.getTime() + i * 86400000)
    const col = Math.floor(i / 7)
    const key = ymd(d)
    const info = cell(d, key)
    const cls = ['d']
    if (info.future || d.getFullYear() !== year || d > today) cls.push('future')
    else {
      if (monthCols.has(col) && !monthStartAdded.has(col)) { cls.push('month-start'); monthStartAdded.add(col) }
      if (info.cls) cls.push(info.cls)
    }
    cells.push(
      <div
        key={key}
        className={cls.join(' ')}
        title={info.title || (d.getFullYear() === year ? key : '')}
        onClick={() => onPick && d <= today && d.getFullYear() === year && onPick(d, key)}
      />,
    )
  }
  // 月份标签
  const months = Array.from(monthCols).sort().map((col) => {
    const md = new Date(year, 0, 1)
    md.setDate(md.getDate() + col * 7)
    return { col, label: `${md.getMonth() + 1}月` }
  })

  return (
    <div>
      <div className="heat-months" style={{ gridTemplateColumns: `repeat(${cols}, 12px)` }}>
        {months.map((m) => (
          <span key={m.col} style={{ gridColumn: m.col + 1 }}>{m.label}</span>
        ))}
      </div>
      <div className="heat" style={{ gridTemplateColumns: `repeat(${cols}, 12px)` }}>
        {cells}
      </div>
    </div>
  )
}
