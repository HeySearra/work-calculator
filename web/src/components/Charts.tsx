// 轻量 SVG 图表组件（无第三方依赖）：折线/面积图 + 进度环
import { useState } from 'react'

export interface Series {
  points: [number, number][]
  color: string
  dash?: string
  fill?: boolean
  width?: number
}

export function LineChart({
  width = 560,
  height = 240,
  x0,
  x1,
  yMin,
  yMax,
  series,
  target,
  xTicks = [],
  yTicks = [],
  yFormat = (n) => String(Math.round(n)),
  tooltip,
  showMarkers = true,
  padL = 46,
  padR = 14,
  padT = 14,
  padB = 26,
}: {
  width?: number
  height?: number
  x0: number
  x1: number
  yMin: number
  yMax: number
  series: Series[]
  target?: number
  xTicks?: { x: number; text: string }[]
  yTicks?: { y: number; text: string }[]
  yFormat?: (n: number) => string
  tooltip?: (x: number, y: number) => string
  showMarkers?: boolean
  padL?: number
  padR?: number
  padT?: number
  padB?: number
}) {
  const W = width, H = height
  const sx = (x: number) => padL + ((x - x0) / (x1 - x0 || 1)) * (W - padL - padR)
  const sy = (y: number) => padT + (1 - (y - yMin) / (yMax - yMin || 1)) * (H - padT - padB)

  const toPath = (pts: [number, number][]) => pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p[0]).toFixed(1)} ${sy(p[1]).toFixed(1)}`).join(' ')
  const hasFill = series.some((s) => s.fill)
  const areaPath = (pts: [number, number][]) => {
    if (!pts.length) return ''
    return `M${sx(pts[0][0]).toFixed(1)} ${sy(yMin).toFixed(1)} ` +
      pts.map((p) => `L${sx(p[0]).toFixed(1)} ${sy(p[1]).toFixed(1)}`).join(' ') +
      ` L${sx(pts[pts.length - 1][0]).toFixed(1)} ${sy(yMin).toFixed(1)} Z`
  }

  // 悬浮提示：记录当前命中哪个 series 的哪个点
  const [hover, setHover] = useState<{ si: number; pi: number } | null>(null)
  let tipBox: { x: number; y: number; w: number; h: number; lines: string[]; color: string } | null = null
  if (hover) {
    const s = series[hover.si]
    const p = s?.points[hover.pi]
    if (p && tooltip) {
      const lines = tooltip(p[0], p[1]).split('\n')
      const lineW = (l: string) => l.split('').reduce((w, ch) => w + (/[一-龥]/.test(ch) ? 12 : 6.6), 0)
      const w = Math.max(...lines.map(lineW)) + 18
      const h = lines.length * 16 + 12
      let bx = sx(p[0]) + 12
      if (bx + w > W - padR) bx = sx(p[0]) - 12 - w
      let by = sy(p[1]) - h - 10
      if (by < padT) by = sy(p[1]) + 10
      tipBox = { x: bx, y: by, w, h, lines, color: s.color }
    }
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="chart" role="img">
      {yTicks.map((t, i) => (
        <g key={'y' + i}>
          <line x1={padL} y1={sy(t.y)} x2={W - padR} y2={sy(t.y)} stroke="var(--border-2)" />
          <text x={padL - 6} y={sy(t.y) + 3} textAnchor="end" className="axis">{yFormat(t.y)}</text>
        </g>
      ))}
      {xTicks.map((t, i) => (
        <text key={'x' + i} x={sx(t.x)} y={H - 8} textAnchor="middle" className="axis">{t.text}</text>
      ))}
      {hasFill && series.filter((s) => s.fill).map((s, i) => (
        <path key={'f' + i} d={areaPath(s.points)} fill={s.color} opacity={0.12} />
      ))}
      {series.map((s, i) => (
        <g key={i}>
          <path
            d={toPath(s.points)}
            fill="none"
            stroke={s.color}
            strokeWidth={s.width || 2}
            strokeDasharray={s.dash}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {showMarkers && s.points.map((p, j) => (
            <g key={'m' + j}>
              {/* 透明大圆扩大命中范围，方便悬浮 */}
              <circle
                cx={sx(p[0])} cy={sy(p[1])} r={11} fill="transparent"
                onMouseEnter={() => setHover({ si: i, pi: j })}
                onMouseLeave={() => setHover(null)}
                style={{ cursor: tooltip ? 'pointer' : 'default' }}
              />
              <circle cx={sx(p[0])} cy={sy(p[1])} r={hover && hover.si === i && hover.pi === j ? 5 : 3.5}
                fill="var(--surface)" stroke={s.color} strokeWidth={2} style={{ pointerEvents: 'none' }} />
            </g>
          ))}
        </g>
      ))}
      {target != null && (
        <g>
          <line x1={padL} y1={sy(target)} x2={W - padR} y2={sy(target)} stroke="var(--brand-2)" strokeWidth={1.5} strokeDasharray="5 4" />
          <text x={W - padR} y={sy(target) - 4} textAnchor="end" className="axis target">{yFormat(target)}</text>
        </g>
      )}
      {tipBox && (
        <g style={{ pointerEvents: 'none' }}>
          <line x1={sx(series[hover!.si].points[hover!.pi][0])} y1={sy(yMin)} x2={sx(series[hover!.si].points[hover!.pi][0])} y2={sy(series[hover!.si].points[hover!.pi][1])} stroke={tipBox.color} strokeWidth={1} strokeDasharray="3 3" opacity={0.5} />
          <rect x={tipBox.x} y={tipBox.y} width={tipBox.w} height={tipBox.h} rx={6} fill="var(--surface)" stroke="var(--border-2)" opacity={0.97} />
          {tipBox.lines.map((l, k) => (
            <text key={k} x={tipBox!.x + 9} y={tipBox!.y + 16 * (k + 1) - 3} className="chart-tip">{l}</text>
          ))}
        </g>
      )}
    </svg>
  )
}

export function Ring({
  value,
  max,
  color,
  label,
  sub,
}: {
  value: number
  max: number
  color: string
  label: string
  sub?: string
}) {
  const pct = Math.max(0, Math.min(1, max > 0 ? value / max : 0))
  const r = 52
  const c = 2 * Math.PI * r
  return (
    <svg width="140" height="140" viewBox="0 0 140 140">
      <circle cx="70" cy="70" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="12" />
      <circle
        cx="70" cy="70" r={r} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - pct)} transform="rotate(-90 70 70)"
      />
      <text x="70" y="67" textAnchor="middle" className="ring-val">{label}</text>
      {sub && <text x="70" y="88" textAnchor="middle" className="ring-sub">{sub}</text>}
    </svg>
  )
}
