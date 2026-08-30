import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { DEFAULT_LISTING_FILTERS, type ListingFilterState } from '../../_lib/filter-params'
import {
  SubscribeDialogContent,
  activeFilterChips,
  filterJsonFromListingState,
  validateSubscribeForm,
  type SubscribeDialogContentProps,
} from '../SubscribeDialog'

function state(overrides: Partial<ListingFilterState> = {}): ListingFilterState {
  return { ...DEFAULT_LISTING_FILTERS, ...overrides }
}

function baseContent(overrides: Partial<SubscribeDialogContentProps> = {}): SubscribeDialogContentProps {
  return {
    mode: 'guest',
    chips: [],
    channel: 'email',
    frequency: 'immediate',
    email: '',
    busy: false,
    fieldErrors: {},
    error: null,
    onEmailChange: () => undefined,
    onChannelChange: () => undefined,
    onFrequencyChange: () => undefined,
    onConsentChange: () => undefined,
    onSubmit: () => undefined,
    onCancel: () => undefined,
    ...overrides,
  }
}

function renderContent(props: SubscribeDialogContentProps): string {
  return renderToString(createElement(SubscribeDialogContent, props))
}

describe('filterJsonFromListingState', () => {
  it('returns an empty object for default filters', () => {
    expect(filterJsonFromListingState(state())).toEqual({})
  })

  it('maps the shared filter keys and omits sort', () => {
    const filterJson = filterJsonFromListingState(
      state({
        county: ['Lääne-Viru'],
        parish: ['Haljala vald'],
        species: ['ma', 'ku'],
        loggingTypes: ['u'],
        areaMin: 10,
        areaMax: 50,
        volumeMin: 100,
        priceMax: 20000,
        sortField: 'startPrice',
        sortDirection: 'desc',
      }),
    )
    expect(filterJson).toEqual({
      county: ['Lääne-Viru'],
      parish: ['Haljala vald'],
      species: ['ma', 'ku'],
      loggingType: ['u'],
      areaMin: 10,
      areaMax: 50,
      volumeMin: 100,
      priceMax: 20000,
    })
  })
})

describe('activeFilterChips', () => {
  it('is empty for default filters', () => {
    expect(activeFilterChips(state())).toEqual([])
  })

  it('labels token lists with the Estonian option names', () => {
    const chips = activeFilterChips(state({ county: ['Lääne-Viru'], species: ['ma', 'ku'], loggingTypes: ['u'] }))
    expect(chips).toEqual([
      'Maakond: Lääne-Viru',
      'Puuliik: Mänd (MA), Kuusk (KU)',
      'Raieliik: Uuendusraie (U)',
    ])
  })

  it('formats ranges as alates/kuni like the notifications page', () => {
    const chips = activeFilterChips(state({ areaMin: 10, volumeMin: 100, volumeMax: 500, priceMax: 20000 }))
    expect(chips).toEqual([
      'Pindala: alates 10 ha',
      'Maht: 100–500 m³',
      'Hind: kuni 20000 €',
    ])
  })
})

describe('validateSubscribeForm', () => {
  it('requires an email and consent from guests', () => {
    expect(validateSubscribeForm('guest', 'email', '', false)).toEqual({
      email: 'E-post on kohustuslik',
      consent: 'Nõusolek on kohustuslik',
    })
    expect(validateSubscribeForm('guest', 'email', 'not-an-email', true)).toEqual({
      email: 'Palun sisestage kehtiv e-posti aadress.',
    })
  })

  it('requires consent for the authed email channel', () => {
    expect(validateSubscribeForm('authed', 'email', '', false)).toEqual({
      consent: 'Nõusolek on kohustuslik',
    })
  })

  it('does not require consent or email for the authed sms channel', () => {
    expect(validateSubscribeForm('authed', 'sms', '', false)).toEqual({})
  })

  it('accepts a valid guest submission', () => {
    expect(validateSubscribeForm('guest', 'email', 'mari@example.ee', true)).toEqual({})
  })
})

describe('SubscribeDialogContent', () => {
  it('renders guest mode with email and an unchecked required consent checkbox', () => {
    const html = renderContent(baseContent())
    expect(html).toContain('E-post')
    expect(html).toContain('type="email"')
    expect(html).toContain('type="checkbox"')
    expect(html).toContain('required')
    // The checkbox input itself carries no checked attribute (class names may).
    const checkboxTag = /<input[^>]*type="checkbox"[^>]*>/.exec(html)?.[0] ?? ''
    expect(checkboxTag).not.toMatch(/\schecked(="[^"]*")?(?=[\s/>])/)
    expect(html).toContain('Nõustan otsinguteavituste saamisega e-posti teel')
    expect(html).toContain('Looge tellimus')
    expect(html).toContain('Loobu')
    expect(html).not.toContain('Kanal')
  })

  it('renders authed mode with channel and frequency selects and no email input', () => {
    const html = renderContent(baseContent({ mode: 'authed', channel: 'email' }))
    expect(html).toContain('Kanal')
    expect(html).toContain('Sagedus')
    expect(html).toContain('E-post')
    expect(html).toContain('SMS')
    expect(html).toContain('Kohe')
    expect(html).toContain('Kord nädalas')
    expect(html).toContain('type="checkbox"')
    expect(html).not.toContain('type="email"')
  })

  it('hides the consent checkbox for the authed sms channel', () => {
    const html = renderContent(baseContent({ mode: 'authed', channel: 'sms' }))
    expect(html).not.toContain('type="checkbox"')
    expect(html).not.toContain('Nõustan otsinguteavituste saamisega e-posti teel')
  })

  it('shows the active filter chips and the no-filter fallback', () => {
    const withChips = renderContent(
      baseContent({ chips: ['Maakond: Lääne-Viru', 'Pindala: alates 10 ha'] }),
    )
    expect(withChips).toContain('Maakond: Lääne-Viru')
    expect(withChips).toContain('Pindala: alates 10 ha')
    expect(withChips).not.toContain('Filtreid pole valitud')

    const withoutChips = renderContent(baseContent({ chips: [] }))
    expect(withoutChips).toContain('Filtreid pole valitud. Teavitus kehtib kõigi uute oksjonide kohta.')
  })

  it('shows inline field errors and the api error alert', () => {
    const html = renderContent(
      baseContent({
        fieldErrors: { email: 'Palun sisestage kehtiv e-posti aadress.', consent: 'Nõusolek on kohustuslik' },
        error: 'Nõusolek on kohustuslik',
      }),
    )
    expect(html.match(/Nõusolek on kohustuslik/g)?.length).toBeGreaterThanOrEqual(2)
    expect(html.match(/role="alert"/g)?.length).toBeGreaterThanOrEqual(3)
  })
})
