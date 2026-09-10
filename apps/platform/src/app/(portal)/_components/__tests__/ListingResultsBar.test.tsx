import { createElement } from 'react'
import type * as JsxDevRuntime from 'react/jsx-dev-runtime'
import type * as JsxRuntime from 'react/jsx-runtime'
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

let currentParams = new URLSearchParams('')
const replace = vi.fn((_url: string, _options?: { scroll: boolean }) => undefined)

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => undefined, replace, refresh: () => undefined }),
  usePathname: () => '/',
  useSearchParams: () => currentParams,
}))

// No DOM runner in this suite, so interactive handlers are captured through
// the JSX runtime (dev and prod variants) and invoked directly, still
// asserting the real wiring: handler -> URLSearchParams/serializeListingFilters
// -> router.replace.
interface ChangeEvent { target: { value: string } }
let selectChanges: ((event: ChangeEvent) => void)[] = []

interface CapturedButton {
  props: Record<string, unknown>
  click: () => void
}
let buttonCaptures: CapturedButton[] = []

function captureElement(
  type: unknown,
  props: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (props === null || props === undefined) return null
  if (type === 'select' && typeof props.onChange === 'function') {
    const original = props.onChange as (event: ChangeEvent) => void
    selectChanges.push(original)
    return { ...props, onChange: (event: ChangeEvent) => { original(event); } }
  }
  if (type === 'button' && typeof props.onClick === 'function') {
    const original = props.onClick as (event: ChangeEvent) => void
    buttonCaptures.push({
      props,
      click: () => { original({ target: { value: '' } }); },
    })
  }
  return props
}

vi.mock('react/jsx-runtime', async (importOriginal) => {
  const actual = await importOriginal<typeof JsxRuntime>()
  const wrap = (jsx: typeof actual.jsx): typeof actual.jsx =>
    (type, props, key) => jsx(type, captureElement(type, props as Record<string, unknown>), key)
  return { ...actual, jsx: wrap(actual.jsx), jsxs: wrap(actual.jsxs) }
})

vi.mock('react/jsx-dev-runtime', async (importOriginal) => {
  const actual = await importOriginal<typeof JsxDevRuntime>()
  const wrap = (jsxDEV: typeof actual.jsxDEV): typeof actual.jsxDEV =>
    (type, props, key, isStatic, source, self) =>
      jsxDEV(
        type,
        captureElement(type, props as Record<string, unknown>),
        key,
        isStatic,
        source,
        self,
      )
  return { ...actual, jsxDEV: wrap(actual.jsxDEV) }
})

import { ListingResultsBar, SORT_OPTIONS, isMapView } from '../ListingResultsBar'

function render(total: number, extra: Record<string, unknown> = {}): string {
  return renderToString(
    createElement(
      ListingResultsBar,
      {
        tab: 'koik',
        total,
        mapView: false,
        filtersSlot: null,
        mapSlot: createElement('div', null, 'kaart-slot'),
        children: createElement('div', null, 'loend-slot'),
        ...extra,
      },
    ),
  )
}

// React SSR separates interpolated text with comment nodes and marks the
// selected option with `selected` (the select carries no value attribute).
function text(html: string): string {
  return html.replaceAll(/<!-- -->/g, '')
}

function selectedOption(html: string): string {
  const value = /<option value="([^"]+)" selected/.exec(html)?.[1]
  if (value === undefined) throw new Error('no selected option rendered')
  return value
}

function change(value: string): void {
  const handler = selectChanges.at(-1)
  if (handler === undefined) throw new Error('select onChange was never rendered')
  handler({ target: { value } })
}

function button(marker: Record<string, unknown>): CapturedButton {
  const found = buttonCaptures.find((capture) =>
    Object.entries(marker).every(([key, value]) => capture.props[key] === value),
  )
  if (found === undefined) throw new Error(`no button captured for ${JSON.stringify(marker)}`)
  return found
}

function lastUrl(): string {
  const call = replace.mock.calls.at(-1)?.[0]
  if (typeof call !== 'string') throw new Error('router.replace was not called')
  return call
}

// The (n) badge is a span inside the disclosure button, so match its markup.
function hasFilterBadge(html: string, count: number): boolean {
  return new RegExp(`Filtrid <span[^>]*>\\(${String(count)}\\)</span>`).test(html)
}

beforeEach(() => {
  currentParams = new URLSearchParams('')
  selectChanges = []
  buttonCaptures = []
  replace.mockClear()
})

describe('ListingResultsBar count text', () => {
  it('uses the singular for one auction', () => {
    const html = text(render(1))
    expect(html).toContain('Leitud 1 oksjon')
    expect(html).not.toContain('oksjonit')
  })

  it('uses the partitive plural with space-grouped thousands', () => {
    expect(text(render(12))).toContain('Leitud 12 oksjonit')
    expect(text(render(12345))).toContain('Leitud 12 345 oksjonit')
  })
})

describe('ListingResultsBar sort round-trip', () => {
  it('selects the demo default option and touches the router only on change', () => {
    const html = render(3)
    expect(replace).not.toHaveBeenCalled()
    expect(selectedOption(html)).toBe('endTime:asc')
    expect(text(html)).toContain('Varem lõppevad eespool')
    for (const option of SORT_OPTIONS) {
      expect(text(html)).toContain(option.label)
    }
  })

  it('keeps the demo labels in demo order', () => {
    expect(SORT_OPTIONS.map((option) => option.label)).toEqual([
      'Varem lõppevad eespool',
      'Hiljem lõppevad eespool',
      'Alghind kasvavalt',
      'Alghind kahanevalt',
    ])
  })

  it('routes a startPrice:desc choice to sort=startPrice&order=desc', () => {
    render(3)
    change('startPrice:desc')
    expect(replace).toHaveBeenCalledTimes(1)
    expect(replace.mock.calls[0]?.[1]).toEqual({ scroll: false })
    const url = lastUrl()
    expect(url).toContain('tab=koik')
    expect(url).toContain('sort=startPrice')
    expect(url).toContain('order=desc')
  })

  it('drops both params when the choice returns to the default', () => {
    currentParams = new URLSearchParams('sort=startPrice&order=desc')
    render(3)
    change('endTime:asc')
    const url = lastUrl()
    expect(url).not.toContain('sort=')
    expect(url).not.toContain('order=')
    expect(url).toContain('tab=koik')
  })

  it('reflects the URL sort state through the select on mount', () => {
    currentParams = new URLSearchParams('sort=startPrice&order=desc')
    expect(selectedOption(render(3))).toBe('startPrice:desc')
  })

  it('mounts with the Alghind kahanevalt option for sort=startPrice&order=desc', () => {
    currentParams = new URLSearchParams('sort=startPrice&order=desc')
    const html = text(render(3))
    expect(selectedOption(html)).toBe('startPrice:desc')
    expect(html).toContain('Alghind kahanevalt')
  })

  it('keeps other filter params across a sort change', () => {
    currentParams = new URLSearchParams('county=Harjumaa&species=m')
    render(3)
    change('startPrice:desc')
    const url = lastUrl()
    expect(url).toContain('county=Harjumaa')
    expect(url).toContain('species=m')
    expect(url).toContain('sort=startPrice')
  })

  it('keeps the map view across a sort change', () => {
    currentParams = new URLSearchParams('view=kaart&county=Harjumaa')
    render(3, { mapView: true })
    change('endTime:desc')
    const url = lastUrl()
    expect(url).toContain('view=kaart')
    expect(url).toContain('county=Harjumaa')
    expect(url).toContain('sort=endTime')
    expect(url).toContain('order=desc')
  })
})

describe('ListingResultsBar view toggle', () => {
  it('renders the demo aria-pressed state for the default list view', () => {
    const html = render(3)
    expect(text(html)).toContain('Kaardivaade')
    expect(text(html)).toContain('Loendivaade')
    expect(button({ 'aria-pressed': false }).props).toMatchObject({ 'aria-pressed': false })
    expect(button({ 'aria-pressed': true })).toBeDefined()
  })

  it('inverts aria-pressed on the map view', () => {
    currentParams = new URLSearchParams('view=kaart')
    const html = render(3, { mapView: true })
    expect(html).toContain('kaart-slot')
    expect(html).not.toContain('loend-slot')
    expect(button({ 'aria-pressed': true })).toBeDefined()
    expect(button({ 'aria-pressed': false })).toBeDefined()
  })

  it('writes view=kaart and keeps every other param when Kaardivaade is pressed', () => {
    currentParams = new URLSearchParams('tab=raieoigused&page=2&county=Harjumaa')
    render(3)
    button({ 'aria-pressed': false }).click()
    expect(replace).toHaveBeenCalledTimes(1)
    expect(replace.mock.calls[0]?.[1]).toEqual({ scroll: false })
    const url = lastUrl()
    expect(url).toContain('view=kaart')
    expect(url).toContain('tab=raieoigused')
    expect(url).toContain('page=2')
    expect(url).toContain('county=Harjumaa')
  })

  it('drops the view param when Loendivaade is pressed on the map view', () => {
    currentParams = new URLSearchParams('view=kaart&county=Harjumaa')
    render(3, { mapView: true })
    button({ 'aria-pressed': false }).click()
    const url = lastUrl()
    expect(url).not.toContain('view=')
    expect(url).toContain('county=Harjumaa')
  })

  it('does not touch the router when the active view is pressed again', () => {
    render(3)
    button({ 'aria-pressed': true }).click()
    expect(replace).not.toHaveBeenCalled()
  })
})

describe('ListingResultsBar mobile filter disclosure', () => {
  it('renders a collapsed aria-controlled disclosure and a hidden aside', () => {
    const html = render(3)
    const disclosure = button({ 'aria-controls': 'filters' })
    expect(disclosure.props['aria-expanded']).toBe(false)
    expect(String(disclosure.props.className)).toContain('lg:hidden')
    expect(hasFilterBadge(html, 0))
    expect(html).toMatch(/id="filters"[^>]*class="[^"]*\bhidden\b[^"]*\blg:block\b/)
  })

  it('counts the active filters from the URL params', () => {
    expect(hasFilterBadge(render(3), 0))
    currentParams = new URLSearchParams('county=Harjumaa&species=m')
    expect(hasFilterBadge(render(3), 2))
  })
})

describe('isMapView', () => {
  it('accepts the canonical and legacy map values', () => {
    expect(isMapView('kaart')).toBe(true)
    expect(isMapView('kart')).toBe(true)
    expect(isMapView(['kart'])).toBe(true)
  })

  it('treats everything else as the list default', () => {
    expect(isMapView('loend')).toBe(false)
    expect(isMapView('')).toBe(false)
    expect(isMapView(undefined)).toBe(false)
  })
})
