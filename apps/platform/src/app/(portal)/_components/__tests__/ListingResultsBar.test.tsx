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

// No DOM runner in this suite, so the select's change handler is captured
// through the JSX runtime (dev and prod variants) and invoked directly,
// still asserting the real wiring: handler -> serializeListingFilters ->
// router.replace.
interface ChangeEvent { target: { value: string } }
let selectChanges: ((event: ChangeEvent) => void)[] = []

function captureSelect(
  type: unknown,
  props: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (props === null || props === undefined) return null
  if (type === 'select' && typeof props.onChange === 'function') {
    const original = props.onChange as (event: ChangeEvent) => void
    selectChanges.push(original)
    return { ...props, onChange: (event: ChangeEvent) => { original(event); } }
  }
  return props
}

vi.mock('react/jsx-runtime', async (importOriginal) => {
  const actual = await importOriginal<typeof JsxRuntime>()
  const wrap = (jsx: typeof actual.jsx): typeof actual.jsx =>
    (type, props, key) => jsx(type, captureSelect(type, props as Record<string, unknown>), key)
  return { ...actual, jsx: wrap(actual.jsx), jsxs: wrap(actual.jsxs) }
})

vi.mock('react/jsx-dev-runtime', async (importOriginal) => {
  const actual = await importOriginal<typeof JsxDevRuntime>()
  const wrap = (jsxDEV: typeof actual.jsxDEV): typeof actual.jsxDEV =>
    (type, props, key, isStatic, source, self) =>
      jsxDEV(
        type,
        captureSelect(type, props as Record<string, unknown>),
        key,
        isStatic,
        source,
        self,
      )
  return { ...actual, jsxDEV: wrap(actual.jsxDEV) }
})

import { ListingResultsBar, SORT_OPTIONS } from '../ListingResultsBar'

function render(total: number): string {
  return renderToString(createElement(ListingResultsBar, { tab: 'koik', total }))
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

function lastUrl(): string {
  const call = replace.mock.calls.at(-1)?.[0]
  if (typeof call !== 'string') throw new Error('router.replace was not called')
  return call
}

beforeEach(() => {
  currentParams = new URLSearchParams('')
  selectChanges = []
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
  it('selects the default option and touches the router only on change', () => {
    const html = render(3)
    expect(replace).not.toHaveBeenCalled()
    expect(selectedOption(html)).toBe('endTime:asc')
    for (const option of SORT_OPTIONS) {
      expect(text(html)).toContain(option.label)
    }
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

  it('mounts with the Alghind: kõrgem enne option for sort=startPrice&order=desc', () => {
    currentParams = new URLSearchParams('sort=startPrice&order=desc')
    const html = text(render(3))
    expect(selectedOption(html)).toBe('startPrice:desc')
    expect(html).toContain('Alghind: kõrgem enne')
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
})
