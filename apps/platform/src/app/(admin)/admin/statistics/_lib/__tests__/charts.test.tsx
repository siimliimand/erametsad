import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import {
  ChartSeriesLegend,
  MonthlyStackedChart,
  TrendChart,
  TypeDonutChart,
  type MonthlyStackedData,
  type TrendData,
  type TypeDonutData,
} from '../../_components/Charts'

const TREND_POINTS = 30

const monthlyData: MonthlyStackedData = {
  months: ['Aug', 'Sept'],
  series: [
    { name: 'Müüdud', color: 'primary', values: [3, 0] },
    { name: 'Müümata', color: 'accent', values: [1, 2] },
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

function rectGeometry(html: string): { y: number; height: number }[] {
  return [...html.matchAll(/y="([\d.]+)" width="[\d.]+" height="([\d.]+)"/g)].map((match) => ({
    y: Number(match[1]),
    height: Number(match[2]),
  }))
}

describe('MonthlyStackedChart', () => {
  it('stacks one segment per non-zero series value per month', () => {
    const html = renderToString(createElement(MonthlyStackedChart, { data: monthlyData }))
    const rects = html.match(/<rect/g)
    expect(rects).toHaveLength(3)
    expect(html).toContain('Müüdud')
    expect(html).toContain('Müümata')
    expect(html).toContain('Sept')
    expect(html).toContain('>oksjonit</text>')
  })

  it('stacks the second series directly on top of the first', () => {
    const html = renderToString(createElement(MonthlyStackedChart, { data: monthlyData }))
    const geometry = rectGeometry(html)
    expect(geometry).toHaveLength(3)
    const augSold = geometry[0]
    const augUnsold = geometry[1]
    if (!augSold || !augUnsold) throw new Error('expected two stacked Aug segments')
    // The upper segment's bottom edge meets the lower segment's top edge.
    expect(augUnsold.y + augUnsold.height).toBeCloseTo(augSold.y, 6)
    expect(augSold.height).toBeGreaterThan(augUnsold.height)
  })

  it('renders the empty state when there are no months or no outcomes', () => {
    const emptyMonths = renderToString(
      createElement(MonthlyStackedChart, { data: { months: [], series: [] } }),
    )
    expect(emptyMonths).toContain('Andmed puuduvad')
    expect(emptyMonths).not.toContain('<rect')

    const allZero = renderToString(
      createElement(MonthlyStackedChart, {
        data: {
          months: ['Aug'],
          series: [{ name: 'Müüdud', color: 'primary', values: [0] }],
        },
      }),
    )
    expect(allZero).toContain('Andmed puuduvad')
    expect(allZero).not.toContain('<rect')
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
    const html = renderToString(
      createElement(TypeDonutChart, { data: { segments: [] } }),
    )
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
    expect(html).toContain('Müüdud')
    expect(html).toContain('Müümata')
    expect(renderToString(createElement(ChartSeriesLegend, { series: [] }))).toBe('')
  })
})
