import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import {
  ChartSeriesLegend,
  MonthlyBarsChart,
  TrendChart,
  TypeDonutChart,
  type MonthlyBarsData,
  type TrendData,
  type TypeDonutData,
} from '../../_components/Charts'

const TREND_POINTS = 30

const monthlyData: MonthlyBarsData = {
  months: ['Aug', 'Sept'],
  series: [
    { name: 'Alghind', color: 'primary', values: [123, 0] },
    { name: 'Lõpphind', color: 'accent', values: [235, 101] },
  ],
}

const donutData: TypeDonutData = {
  segments: [
    { label: 'Raieõigus', value: 3, color: 'primary' },
    { label: 'Kinnistu', value: 1, color: 'accent' },
  ],
}

const trendData: TrendData = {
  labels: Array.from(
    { length: TREND_POINTS },
    (_, i) => `${String(i + 1).padStart(2, '0')}.08`,
  ),
  values: Array.from({ length: TREND_POINTS }, (_, i) => i),
}

describe('MonthlyBarsChart', () => {
  it('renders one bar per series per month with the series names', () => {
    const html = renderToString(createElement(MonthlyBarsChart, { data: monthlyData }))
    expect(html.match(/<rect/g)).toHaveLength(4)
    expect(html).toContain('Alghind')
    expect(html).toContain('Lõpphind')
    expect(html).toContain('Sept')
  })

  it('renders the empty state when there are no months', () => {
    const html = renderToString(
      createElement(MonthlyBarsChart, { data: { months: [], series: [] } }),
    )
    expect(html).toContain('Andmed puuduvad')
    expect(html).not.toContain('<rect')
  })
})

describe('TypeDonutChart', () => {
  it('renders segments whose arc lengths sum to the full circle', () => {
    const html = renderToString(createElement(TypeDonutChart, { data: donutData }))
    expect(html.match(/<circle/g)).toHaveLength(2)
    const lengths = [...html.matchAll(/stroke-dasharray="([\d.]+) /g)].map((match) =>
      Number(match[1]),
    )
    expect(lengths).toHaveLength(2)
    const sum = lengths.reduce((total, length) => total + length, 0)
    expect(sum).toBeCloseTo(2 * Math.PI * 64, 6)
    expect(html).toContain('75.0%')
    expect(html).toContain('25.0%')
    expect(html).toContain('>4</text>')
    expect(html).toContain('oksjonit')
  })

  it('renders the empty state when the donut has no segments', () => {
    const html = renderToString(createElement(TypeDonutChart, { data: { segments: [] } }))
    expect(html).toContain('Andmed puuduvad')
  })
})

describe('TrendChart', () => {
  it('renders one point per day with the first and last date labels', () => {
    const html = renderToString(createElement(TrendChart, { data: trendData }))
    expect(html.match(/<circle/g)).toHaveLength(TREND_POINTS)
    expect(html).toContain('01.08')
    expect(html).toContain('30.08')
  })

  it('renders the empty state for an empty trend', () => {
    const html = renderToString(
      createElement(TrendChart, { data: { labels: [], values: [] } }),
    )
    expect(html).toContain('Andmed puuduvad')
  })
})

describe('ChartSeriesLegend', () => {
  it('renders a legend item per series and nothing for an empty series', () => {
    const html = renderToString(createElement(ChartSeriesLegend, { series: monthlyData.series }))
    expect(html).toContain('Alghind')
    expect(html).toContain('Lõpphind')
    expect(renderToString(createElement(ChartSeriesLegend, { series: [] }))).toBe('')
  })
})
