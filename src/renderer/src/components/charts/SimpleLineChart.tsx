import { useId, useMemo, useState } from 'react'
import type { MouseEvent } from 'react'

interface ChartPoint {
  label?: string | null
  value: number | null
}

interface SimpleLineChartProps {
  title?: string
  unit?: string
  points: ChartPoint[]
  height?: number
  xLabel?: string
  yLabel?: string
}

function formatValue(value: number, decimals = 2): string {
  return value.toFixed(decimals)
}

function SimpleLineChart({
  title,
  unit = '',
  points,
  height = 260,
  xLabel = 'Tiempo',
  yLabel = 'Valor'
}: SimpleLineChartProps) {
  const gradientId = useId().replace(/:/g, '')
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  const validPoints = useMemo(
    () =>
      points.filter(
        (point): point is { label?: string | null; value: number } =>
          point.value !== null && !Number.isNaN(point.value)
      ),
    [points]
  )

  if (validPoints.length < 2) {
    return (
      <div
        className="flex items-center justify-center rounded-2xl border border-dashed border-violet-300/70 bg-white/30 text-slate-400"
        style={{ height }}
      >
        Esperando más mediciones reales
      </div>
    )
  }

  const width = 900
  const paddingLeft = 62
  const paddingRight = 28
  const paddingTop = 34
  const paddingBottom = 56
  const innerWidth = width - paddingLeft - paddingRight
  const innerHeight = height - paddingTop - paddingBottom
  const values = validPoints.map((point) => point.value)
  const rawMin = Math.min(...values)
  const rawMax = Math.max(...values)

  const domainPadding = rawMax === rawMin
    ? Math.max(Math.abs(rawMax) * 0.08, 1)
    : (rawMax - rawMin) * 0.08

  const min = rawMin - domainPadding
  const max = rawMax + domainPadding
  const range = max - min || 1

  const coordinates = validPoints.map((point, index) => {
    const x =
      paddingLeft +
      (index / Math.max(validPoints.length - 1, 1)) * innerWidth
    const y =
      paddingTop +
      innerHeight -
      ((point.value - min) / range) * innerHeight

    return {
      ...point,
      x,
      y
    }
  })

  const polylinePoints = coordinates
    .map((point) => `${point.x},${point.y}`)
    .join(' ')

  const lastValue = validPoints[validPoints.length - 1]?.value
  const firstLabel = validPoints[0]?.label ?? 'Inicio'
  const lastLabel = validPoints[validPoints.length - 1]?.label ?? 'Fin'
  const currentHoverIndex = hoverIndex ?? coordinates.length - 1
  const hoverPoint = coordinates[currentHoverIndex]
  const tooltipX = hoverPoint.x > width - 250 ? hoverPoint.x - 210 : hoverPoint.x + 16
  const tooltipY = hoverPoint.y < 80 ? hoverPoint.y + 18 : hoverPoint.y - 58

  function handleMouseMove(event: MouseEvent<SVGSVGElement>): void {
    const rect = event.currentTarget.getBoundingClientRect()
    const relativeX = event.clientX - rect.left
    const svgX = (relativeX / rect.width) * width
    const ratio = (svgX - paddingLeft) / innerWidth
    const nextIndex = Math.round(ratio * (coordinates.length - 1))
    const safeIndex = Math.min(Math.max(nextIndex, 0), coordinates.length - 1)

    setHoverIndex(safeIndex)
  }

  return (
    <div>
      {(title || lastValue !== undefined) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-4">
          {title && (
            <p className="font-semibold text-slate-700">
              {title}
            </p>
          )}

          <p className="font-mono text-sm font-bold text-violet-700">
            Último: {lastValue.toFixed(2)} {unit}
          </p>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-white/70 bg-white/35 p-3">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-full w-full cursor-crosshair"
          role="img"
          aria-label={title || 'Gráfica de línea'}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIndex(null)}
        >
          <line
            x1={paddingLeft}
            y1={paddingTop}
            x2={paddingLeft}
            y2={height - paddingBottom}
            stroke="rgba(100, 116, 139, 0.35)"
          />
          <line
            x1={paddingLeft}
            y1={height - paddingBottom}
            x2={width - paddingRight}
            y2={height - paddingBottom}
            stroke="rgba(100, 116, 139, 0.35)"
          />

          <text
            x={paddingLeft}
            y={18}
            className="fill-slate-500 text-[12px]"
          >
            {yLabel} {unit ? `(${unit})` : ''}
          </text>

          <text
            x={width / 2}
            y={height - 10}
            textAnchor="middle"
            className="fill-slate-500 text-[12px]"
          >
            {xLabel}
          </text>

          <text
            x={6}
            y={paddingTop + 4}
            className="fill-slate-500 text-[12px]"
          >
            {formatValue(rawMax)} {unit}
          </text>

          <text
            x={6}
            y={height - paddingBottom + 4}
            className="fill-slate-500 text-[12px]"
          >
            {formatValue(rawMin)} {unit}
          </text>

          <text
            x={paddingLeft}
            y={height - 30}
            className="fill-slate-500 text-[11px]"
          >
            {firstLabel}
          </text>

          <text
            x={width - paddingRight}
            y={height - 30}
            textAnchor="end"
            className="fill-slate-500 text-[11px]"
          >
            {lastLabel}
          </text>

          <polyline
            points={polylinePoints}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {coordinates.map((point, index) => (
            <circle
              key={`${point.label ?? 'point'}-${index}`}
              cx={point.x}
              cy={point.y}
              r={index === currentHoverIndex ? 5 : 3}
              fill={index === currentHoverIndex ? '#A998E8' : '#7CCDB0'}
              stroke="white"
              strokeWidth="2"
              opacity={
                index === currentHoverIndex || coordinates.length <= 25
                  ? 1
                  : 0.35
              }
            >
              <title>
                {`${point.label ?? 'Sin fecha'} · ${point.value.toFixed(2)} ${unit}`}
              </title>
            </circle>
          ))}

          {hoverPoint && (
            <g>
              <line
                x1={hoverPoint.x}
                y1={paddingTop}
                x2={hoverPoint.x}
                y2={height - paddingBottom}
                stroke="rgba(88, 71, 143, 0.35)"
                strokeDasharray="5 5"
              />

              <rect
                x={tooltipX}
                y={tooltipY}
                width="190"
                height="48"
                rx="14"
                fill="rgba(255,255,255,0.92)"
                stroke="rgba(169,152,232,0.45)"
              />

              <text
                x={tooltipX + 12}
                y={tooltipY + 20}
                className="fill-slate-500 text-[12px]"
              >
                {hoverPoint.label ?? 'Sin fecha'}
              </text>

              <text
                x={tooltipX + 12}
                y={tooltipY + 38}
                className="fill-violet-700 text-[13px] font-bold"
              >
                {hoverPoint.value.toFixed(2)} {unit}
              </text>
            </g>
          )}

          <defs>
            <linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#7CCDB0" />
              <stop offset="100%" stopColor="#A998E8" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>
  )
}

export default SimpleLineChart
