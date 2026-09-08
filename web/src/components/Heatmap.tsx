// 网页版年度热力图：12 个月份卡片网格（桌面向），替代原来单排滚动的 GitHub 风格。
// 每个月是一个完整月历，周一到周日为列，自动补齐前后空白。
import { appToday } from '../format'

const DAY_NAMES = ['一', '二', '三', '四', '五', '六', '日']

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export interface CellInfo {
  cls?: string // l1..l5 / holiday / leave / past-empty / default
  title?: string
  future?: boolean
}

interface MonthCardProps {
  year: number
  month: number
  cell: (d: Date, key: string) => CellInfo
  onPick?: (d: Date, key: string) => void
}

function MonthCard({ year, month, cell, onPick }: MonthCardProps) {
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  const startOffset = (first.getDay() + 6) % 7 // 周一为 0
  const total = last.getDate()
  const today = appToday()

  const cells: React.ReactNode[] = []

  // 前导空白
  for (let i = 0; i < startOffset; i++) {
    cells.push(<div key={`b${i}`} className="day-cell blank" />)
  }

  // 当月日期
  for (let day = 1; day <= total; day++) {
    const d = new Date(year, month, day)
    const key = ymd(d)
    const info = cell(d, key)
    const isFuture = d > today || info.future
    const cls = ['day-cell']
    if (isFuture) cls.push('future')
    if (info.cls) cls.push(info.cls)
    cells.push(
      <div
        key={key}
        className={cls.join(' ')}
        title={info.title || key}
        onClick={() => !isFuture && onPick && onPick(d, key)}
      />,
    )
  }

  // 尾部空白，统一 6 行高度（42 格）
  const tail = 42 - startOffset - total
  for (let i = 0; i < tail; i++) {
    cells.push(<div key={`e${i}`} className="day-cell blank" />)
  }

  return (
    <div className="heat-month-card">
      <div className="heat-month-title">{month + 1}月</div>
      <div className="month-head">
        {DAY_NAMES.map((n) => (
          <span key={n}>{n}</span>
        ))}
      </div>
      <div className="month-grid">{cells}</div>
    </div>
  )
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
  return (
    <div className="heat-year">
      {Array.from({ length: 12 }).map((_, m) => (
        <MonthCard key={m} year={year} month={m} cell={cell} onPick={onPick} />
      ))}
    </div>
  )
}
