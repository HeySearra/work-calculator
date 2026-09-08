// 轻量 SVG 图表组件（无第三方依赖）：折线/面积图 + 进度环
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
            <circle key={'m' + j} cx={sx(p[0])} cy={sy(p[1])} r={3.5} fill="var(--surface)" stroke={s.color} strokeWidth={2} />
          ))}
        </g>
      ))}
      {target != null && (
        <g>
          <line x1={padL} y1={sy(target)} x2={W - padR} y2={sy(target)} stroke="var(--brand-2)" strokeWidth={1.5} strokeDasharray="5 4" />
          <text x={W - padR} y={sy(target) - 4} textAnchor="end" className="axis target">{yFormat(target)}</text>
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
