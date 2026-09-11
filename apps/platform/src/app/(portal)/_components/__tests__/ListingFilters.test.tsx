import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

// Mutable so individual tests can point the panel at a URL with filters.
const mocks = vi.hoisted(() => ({ searchParams: new URLSearchParams('') }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined }),
  usePathname: () => '/',
  useSearchParams: () => mocks.searchParams,
}))

import {
  countActiveFilters,
  DEFAULT_LISTING_FILTERS,
  parseListingFilters,
  serializeListingFilters,
} from '../../_lib/filter-params'
import { ListingFilters } from '../ListingFilters'

function render(tab: string, cutDeadlineYears: number[] = []): string {
  return renderToString(
    createElement(ListingFilters, { tab, cutDeadlineYears }),
  )
}

function renderWithQuery(tab: string, query: string): string {
  mocks.searchParams = new URLSearchParams(query)
  return render(tab)
}

describe('ListingFilters demo structure', () => {
  it('renders the demo filter set without a Maht range or sort select', () => {
    const html = render('mets')
    expect(html).toContain('Filtrid')
    expect(html).toContain('Maakond')
    expect(html).toContain('Puuliigid')
    expect(html).toContain('Raieliigid')
    expect(html).toContain('Pindala (ha)')
    expect(html).toContain('Hind (€)')
    expect(html).toContain('Raietähtaeg (aasta)')
    // Maht (m³) is dropped and sorting lives in the results bar.
    expect(html).not.toContain('Maht')
    expect(html).not.toContain('Sorteeri')
  })

  it('renders the Vald cascade disabled with the demo hint', () => {
    const html = render('mets')
    expect(html).toContain('Vali kõigepealt maakond.')
    expect(html).toMatch(/<select[^>]*name="parish"[^>]*disabled/)
  })

  it('renders the demo species chip codes MA KU KS HB LM SA', () => {
    const html = render('mets')
    for (const code of ['MA', 'KU', 'KS', 'HB', 'LM', 'SA']) {
      expect(html).toContain(`>${code}</button>`)
    }
    // Accessible names read "CODE Name" per the listing spec.
    expect(html).toContain('aria-label="MA Mänd"')
    expect(html).toContain('aria-label="HB Haab"')
    expect(html).toContain('title="Lehis"')
  })

  it('renders the demo cut chip codes VR HR SR LR RD', () => {
    const html = render('mets')
    for (const code of ['VR', 'HR', 'SR', 'LR', 'RD']) {
      expect(html).toContain(`>${code}</button>`)
    }
    expect(html).toContain('title="Harvendusraie"')
    expect(html).toContain('title="Rekonstruktsiooniraie"')
  })

  it('renders the cut-deadline year select over the current-year window', () => {
    const html = render('mets')
    const year = new Date().getFullYear()
    expect(html).toContain(`>${String(year)}</option>`)
    expect(html).toContain(`>${String(year + 2)}</option>`)
  })

  it('offers Kõik plus the stored years of the active set, ascending', () => {
    const html = render('mets', [2028, 2026, 2028])
    const yearSelect = html.split('name="cutDeadlineYear"')[1] ?? ''
    const options = [...yearSelect.matchAll(/<option[^>]*>([^<]*)<\/option>/g)].map(
      (match) => match[1],
    )
    expect(options).toEqual(['Kõik', '2026', '2028'])
  })

  it('falls back to the current-year window when the active set holds no years', () => {
    const html = render('mets', [])
    const year = new Date().getFullYear()
    expect(html).toContain(`>${String(year)}</option>`)
    expect(html).toContain(`>Kõik</option>`)
  })

  it('keeps the count badge out of the URL-free render', () => {
    const html = render('mets')
    expect(html).not.toMatch(/rounded-pill bg-primary[^>]*>\d+</)
  })
})

describe('ListingFilters Telli teavitus entry', () => {
  it('offers the demo action and the collapsed inline guest sub-form', () => {
    const html = render('mets')
    expect(html).toContain('Telli teavitus')
    expect(html).toContain('aria-controls="subForm"')
    // The sub-form mounts hidden; the dialog stays closed.
    expect(html).toMatch(/id="subForm"[^>]*hidden/)
    expect(html).not.toContain('Salvestame teie aktiivsed filtrid')
  })

  it('renders the demo guest sub-form fields', () => {
    const html = render('mets')
    expect(html).toContain('E-post')
    expect(html).toContain('sinu@email.ee')
    expect(html).toContain(
      'Nõustun, et Erametsad töötleb mu isikuandmeid sobivate oksjonite teavitamiseks.',
    )
    expect(html).toContain('type="checkbox"')
  })
})

describe('ListingFilters quick search (q)', () => {
  it('counts the q term in the active badge', () => {
    const html = renderWithQuery('mets', 'q=metskits')
    expect(html).toMatch(/rounded-pill bg-primary[^>]*>1</)
  })

  it('always offers Tühjenda and hides the badge without filters', () => {
    const html = renderWithQuery('mets', '')
    // Demo renders both actions unconditionally.
    expect(html).toContain('Tühjenda')
    expect(html).not.toMatch(/rounded-pill bg-primary[^>]*>\d+</)
  })

  it('parses, counts and serializes the q term', () => {
    const state = parseListingFilters(new URLSearchParams('q=metskits'))
    expect(state.q).toBe('metskits')
    expect(countActiveFilters(state)).toBe(1)
    expect(serializeListingFilters(state, 'mets')).toContain('q=metskits')
  })

  it('drops q when the state clears back to defaults', () => {
    expect(serializeListingFilters({ ...DEFAULT_LISTING_FILTERS }, 'mets')).not.toContain('q=')
    expect(countActiveFilters({ ...DEFAULT_LISTING_FILTERS })).toBe(0)
  })
})

describe('ListingFilters legacy URL state', () => {
  it('keeps legacy volume bounds out of the badge but in the round-trip', () => {
    const state = parseListingFilters(new URLSearchParams('volumeMin=100&volumeMax=500'))
    expect(countActiveFilters(state)).toBe(0)
    const query = serializeListingFilters(state, 'mets')
    expect(query).toContain('volumeMin=100')
    expect(query).toContain('volumeMax=500')
  })
})
