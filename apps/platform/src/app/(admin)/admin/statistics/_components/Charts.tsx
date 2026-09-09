/**
 * Server-rendered SVG charts for the statistics dashboard, mirroring the
 * demo prototype (docs/design/demo/admin/12-statistics.html). No client
 * runtime, no hooks, no chart dependency: every chart is plain SVG driven
 * by typed props that _lib/statistics.ts aggregations feed. Colors resolve
 * through the shared CSS variables that tailwind.config.ts maps to the
 * primary/accent/cta/info tokens, so charts follow the (admin) token scope.
 */

export type ChartColor = 'primary' | 'accent' | 'cta' | 'info' | 'danger'

/** Same variables the Tailwind color tokens resolve to (tailwind.config.ts). */
const CHART_COLORS: Record<ChartColor, string> = {
  primary: 'var(--color-primary)',
  accent: 'var(--color-accent)',
  cta: 'var(--color-cta)',
  info: 'var(--color-info)',
  danger: 'var(--color-danger)',
}

/** Demo axis text: 500 10px mono, muted, tabular. */
const AXIS_TEXT_CLASS =
  'fill-inkMuted font-mono text-[10px] font-medium tabular-nums'

/** Demo axis title: 500 10px body, muted. */
const AXIS_TITLE_CLASS = 'fill-inkMuted font-body text-[10px] font-medium'

/** Demo legend item: 500 12px body, muted, with mono value. */
const LEGEND_ITEM_CLASS =
  'flex items-center gap-[7px] text-label font-medium text-inkMuted'

export interface MonthlyStackedSeries {
  /** Legend and tooltip name, e.g. "Müüdud". */
  name: string
  color: ChartColor
  /** One value per month, stacked bottom-up (month i ↔ months[i]). */
  values: readonly number[]
}

export interface MonthlyStackedData {
  /** Estonian short month labels, one per bar, e.g. "Jaan". */
  months: readonly string[]
  /** Stacking order bottom → top; every month stacks all series. */
  series: readonly MonthlyStackedSeries[]
}

export interface TypeDonutSegment {
  /** Auction type label, e.g. "Raieõigus". */
  label: string
  /** Auction count for this type. */
  value: number
  color: ChartColor
}

export interface TypeDonutData {
  segments: readonly TypeDonutSegment[]
  /** Caption under the center total, e.g. "oksjonit". */
  centerCaption?: string
  /** Partitive noun for segment tooltips, e.g. "tükki". */
  unitNoun?: string
}

export interface TrendData {
  /** Short date labels, one per value, e.g. "03.08". */
  labels: readonly string[]
  /** One value per day (day i ↔ labels[i]). */
  values: readonly number[]
  /** Y-axis title, e.g. "pakkumisi / päev". */
  axisLabel?: string
  /** Partitive noun for point tooltips, e.g. "pakkumist". */
  pointNoun?: string
}

/** Estonian thousands separator (demo: "184 000 €"). */
function formatNumber(value: number): string {
  return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

/**
 * Picks a 1/2/5×10^k step giving at most 8 gridlines and rounds the max up
 * to a step multiple. Reproduces the demo scales: bars 301 500 € →
 * step 50 000, max 350 000; trend max 124 → step 20, max 140.
 */
function niceScale(maxValue: number): { max: number; step: number } {
  if (maxValue <= 0) return { max: 1, step: 1 }
  const base = 10 ** Math.floor(Math.log10(maxValue / 4))
  let step = base * 10
  for (const multiplier of [1, 2, 5, 10]) {
    if (maxValue / (multiplier * base) <= 8) {
      step = multiplier * base
      break
    }
  }
  return { max: Math.ceil(maxValue / step) * step, step }
}

/** Demo y-axis: labels switch to thousands once the scale reaches 100k. */
function axisTickLabel(value: number, scaleMax: number): string {
  return scaleMax >= 100000 ? String(value / 1000) : String(value)
}

function ChartEmptyState({ minHeight }: { minHeight: number }) {
  return (
    <div
      className="flex w-full items-center justify-center text-label text-inkMuted"
      style={{ minHeight }}
    >
      Andmed puuduvad
    </div>
  )
}

/** Gridlines, y tick labels and the rotated axis title shared by bar and trend charts. */
function YAxis({
  left,
  right,
  top,
  plotHeight,
  scale,
  title,
}: {
  left: number
  right: number
  top: number
  plotHeight: number
  scale: { max: number; step: number }
  title: string
}) {
  const lines: React.ReactNode[] = []
  for (let value = 0; value <= scale.max; value += scale.step) {
    const y = top + plotHeight * (1 - value / scale.max)
    lines.push(
      <g key={value}>
        <line
          x1={left}
          x2={right}
          y1={y}
          y2={y}
          className="stroke-border"
          strokeWidth={1}
        />
        <text
          x={left - 8}
          y={y + 3}
          textAnchor="end"
          className={AXIS_TEXT_CLASS}
        >
          {axisTickLabel(value, scale.max)}
        </text>
      </g>,
    )
  }
  return (
    <g>
      {lines}
      <text
        className={AXIS_TITLE_CLASS}
        textAnchor="middle"
        transform={`translate(12 ${String(top + plotHeight / 2)}) rotate(-90)`}
      >
        {title}
      </text>
    </g>
  )
}

const BAR_WIDTH = 17

/**
 * Stacked monthly bars (statistikalehe "Oksjonite tulemused kuupõhiselt"):
 * one bar per month, one stacked segment per series (müüdud / müümata /
 * tühistatud counts), y-axis in plain counts.
 */
export function MonthlyStackedChart({
  data,
  ariaLabel = 'Tulpdiagramm: oksjonite tulemused kuude lõikes (müüdud, müümata, tühistatud)',
}: {
  data: MonthlyStackedData
  ariaLabel?: string
}) {
  const width = 720
  const height = 300
  const left = 48
  const right = 10
  const top = 14
  const bottom = 30
  const plotWidth = width - left - right
  const plotHeight = height - top - bottom

  const monthTotals = data.months.map((_, monthIndex) =>
    data.series.reduce((total, series) => total + (series.values[monthIndex] ?? 0), 0),
  )
  const hasData = data.months.length > 0 && monthTotals.some((total) => total > 0)
  if (!hasData) {
    return <ChartEmptyState minHeight={220} />
  }

  const scale = niceScale(Math.max(...monthTotals))
  const groupWidth = plotWidth / data.months.length

  return (
    <svg
      viewBox={`0 0 ${String(width)} ${String(height)}`}
      className="h-auto w-full"
      role="img"
      aria-label={ariaLabel}
    >
      <title>{ariaLabel}</title>
      <YAxis
        left={left}
        right={width - right}
        top={top}
        plotHeight={plotHeight}
        scale={scale}
        title="oksjonit"
      />
      <g>
        {data.months.map((month, monthIndex) => {
          const barX = left + monthIndex * groupWidth + (groupWidth - BAR_WIDTH) / 2
          let stackBase = 0
          return (
            <g key={month}>
              {data.series.map((series) => {
                const value = series.values[monthIndex] ?? 0
                if (value <= 0) return null
                const segmentHeight = plotHeight * (value / scale.max)
                const yTop = top + plotHeight - stackBase - segmentHeight
                stackBase += segmentHeight
                return (
                  <rect
                    key={series.name}
                    x={barX}
                    y={yTop}
                    width={BAR_WIDTH}
                    height={segmentHeight}
                    rx={2}
                    fill={CHART_COLORS[series.color]}
                  >
                    <title>
                      {`${month} · ${series.name} ${formatNumber(value)}`}
                    </title>
                  </rect>
                )
              })}
              <text
                x={barX + BAR_WIDTH / 2}
                y={height - 10}
                textAnchor="middle"
                className={AXIS_TEXT_CLASS}
              >
                {month}
              </text>
            </g>
          )
        })}
      </g>
    </svg>
  )
}

/**
 * Legend for the stacked bars card head (demo: swatch + series name). Rendered
 * from the same series data so header colors can never drift from bar colors.
 */
export function ChartSeriesLegend({
  series,
}: {
  series: readonly MonthlyStackedSeries[]
}) {
  if (series.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-4">
      {series.map((item) => (
        <span key={item.name} className={LEGEND_ITEM_CLASS}>
          <span
            className="h-3 w-3 shrink-0 rounded-[3px]"
            style={{ background: CHART_COLORS[item.color] }}
          />
          {item.name}
        </span>
      ))}
    </div>
  )
}

/**
 * Type-share donut (demo "Oksjonite tüüpjaotus"): SVG circle segments via
 * stroke-dasharray, rotated to start at 12 o'clock, with center total and
 * legend list. Total is computed from segments so center and arcs always
 * agree.
 */
export function TypeDonutChart({
  data,
  ariaLabel = 'Sõõrdiagramm: oksjonite tüüpjaotus',
}: {
  data: TypeDonutData
  ariaLabel?: string
}) {
  const size = 180
  const center = 90
  const radius = 64
  const strokeWidth = 24
  const circumference = 2 * Math.PI * radius

  const total = data.segments.reduce((sum, segment) => sum + segment.value, 0)
  if (data.segments.length === 0 || total <= 0) {
    return <ChartEmptyState minHeight={180} />
  }

  const centerCaption = data.centerCaption ?? 'oksjonit'
  const unitNoun = data.unitNoun ?? 'tükki'

  let accumulated = 0

  return (
    <div className="flex flex-wrap items-center gap-6 px-5 py-4">
      <svg
        viewBox={`0 0 ${String(size)} ${String(size)}`}
        className="h-[180px] w-[180px] shrink-0"
        role="img"
        aria-label={ariaLabel}
      >
        <title>{ariaLabel}</title>
        {data.segments.map((segment) => {
          const length = (circumference * segment.value) / total
          const offset = accumulated
          accumulated += length
          const share = ((100 * segment.value) / total).toFixed(1)
          return (
            <circle
              key={segment.label}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={CHART_COLORS[segment.color]}
              strokeWidth={strokeWidth}
              strokeDasharray={`${String(length)} ${String(circumference - length)}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${String(center)} ${String(center)})`}
            >
              <title>
                {`${segment.label} — ${String(segment.value)} ${unitNoun} (${share}%)`}
              </title>
            </circle>
          )
        })}
        <text
          x={center}
          y={88}
          textAnchor="middle"
          className="fill-ink font-mono text-[26px] font-bold tabular-nums"
        >
          {formatNumber(total)}
        </text>
        <text
          x={center}
          y={108}
          textAnchor="middle"
          className="fill-inkMuted font-body text-[12px] font-medium"
        >
          {centerCaption}
        </text>
      </svg>
      <ul className="flex min-w-[190px] flex-1 flex-col gap-2.5">
        {data.segments.map((segment) => {
          const share = ((100 * segment.value) / total).toFixed(1)
          return (
            <li key={segment.label} className={LEGEND_ITEM_CLASS}>
              <span
                className="h-3 w-3 shrink-0 rounded-[3px]"
                style={{ background: CHART_COLORS[segment.color] }}
              />
              {segment.label}
              <span className="font-mono tabular-nums text-ink">
                {`${String(segment.value)} · ${share}%`}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/**
 * Daily line/area trend (demo "Pakkumiste arv"): smooth polyline over an
 * accent-tinted area, a tooltip dot per day, sparse x tick labels.
 */
export function TrendChart({
  data,
  ariaLabel = 'Joondiagramm: pakkumiste arv päevaste andmepunktidega viimased 30 päeva',
}: {
  data: TrendData
  ariaLabel?: string
}) {
  const width = 720
  const height = 220
  const left = 48
  const right = 12
  const top = 14
  const bottom = 26
  const plotWidth = width - left - right
  const plotHeight = height - top - bottom

  if (data.values.length === 0) {
    return <ChartEmptyState minHeight={180} />
  }

  const scale = niceScale(Math.max(...data.values))
  const axisLabel = data.axisLabel ?? 'pakkumisi / päev'
  const pointNoun = data.pointNoun ?? 'pakkumist'
  const count = data.values.length

  const x = (index: number) =>
    count > 1 ? left + (plotWidth * index) / (count - 1) : left + plotWidth / 2
  const y = (value: number) => top + plotHeight * (1 - value / scale.max)

  const points = data.values.map((value, index) => ({
    x: x(index).toFixed(1),
    y: y(value).toFixed(1),
  }))
  const linePath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ')
  const areaPath =
    count > 1
      ? `${linePath} L ${x(count - 1).toFixed(1)} ${String(top + plotHeight)} L ${x(0).toFixed(1)} ${String(top + plotHeight)} Z`
      : ''
  const tickIndices = Array.from(new Set([0, 7, 14, 21, count - 1])).filter(
    (index) => index >= 0 && index < count,
  )

  return (
    <svg
      viewBox={`0 0 ${String(width)} ${String(height)}`}
      className="h-auto w-full"
      role="img"
      aria-label={ariaLabel}
    >
      <title>{ariaLabel}</title>
      <YAxis
        left={left}
        right={width - right}
        top={top}
        plotHeight={plotHeight}
        scale={scale}
        title={axisLabel}
      />
      <g>
        {count > 1 && (
          <>
            <path d={areaPath} className="fill-[var(--accent-soft)]" />
            <path
              d={linePath}
              fill="none"
              stroke={CHART_COLORS.primary}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        )}
        {points.map((point, index) => (
          <circle
            key={index}
            cx={point.x}
            cy={point.y}
            r={2.5}
            fill={CHART_COLORS.primary}
          >
            <title>{`${data.labels[index] ?? ''} · ${formatNumber(data.values[index] ?? 0)} ${pointNoun}`}</title>
          </circle>
        ))}
        {tickIndices.map((index) => (
          <text
            key={index}
            x={x(index).toFixed(1)}
            y={height - 8}
            textAnchor={index === count - 1 ? 'end' : 'middle'}
            className={AXIS_TEXT_CLASS}
          >
            {data.labels[index]}
          </text>
        ))}
      </g>
    </svg>
  )
}
