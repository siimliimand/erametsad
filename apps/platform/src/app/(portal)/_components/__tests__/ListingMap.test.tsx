import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(''),
}))

import { buildPopupHtml, ListingMap, type ListingMapLot } from '../ListingMap'

function lot(coordinates: ListingMapLot['coordinates']): ListingMapLot {
  return {
    id: 'lot-1',
    title: 'Metsamaa Võrumaal',
    area: 12.4,
    minBid: 5000,
    endsAt: null,
    coordinates,
  }
}

function render(lots: ListingMapLot[]): string {
  return renderToString(createElement(ListingMap, { lots }))
}

describe('ListingMap empty state', () => {
  it('renders the empty state when no lot has coordinates', () => {
    const html = render([])
    expect(html).toContain('Kaardivaade ei ole saadaval')
    expect(html).toContain('Ükski oksjon ei sisalda kaardi asukohta.')
    expect(html).not.toContain('map-estonia')
  })

  it('renders the map wrapper when a lot has coordinates', () => {
    const html = render([lot({ lat: 58.6, lng: 25.0 })])
    expect(html).not.toContain('Kaardivaade ei ole saadaval')
    expect(html).toContain('map-estonia')
    // The component owns its responsive slot height.
    expect(html).toContain('h-60')
    expect(html).toContain('lg:h-[400px]')
  })

  it('filters out lots without coordinates', () => {
    const withoutCoordinates = render([lot(null)])
    expect(withoutCoordinates).toContain('Kaardivaade ei ole saadaval')

    const mixed = render([lot(null), lot({ lat: 58.4, lng: 26.7 })])
    expect(mixed).not.toContain('Kaardivaade ei ole saadaval')
    expect(mixed).toContain('map-estonia')
  })
})

describe('ListingMap demo popup card', () => {
  const popupLot: ListingMapLot = {
    id: 'auction-9',
    title: 'Kuuse ja männi raieõigus Valgemetsas',
    area: 12.4,
    minBid: 18000,
    endsAt: '2026-09-12T10:00:00.000Z',
    coordinates: { lat: 58.6, lng: 25.0 },
    registryNumber: '77901:003:0410',
  }

  it('renders the demo rows with exact Estonian labels', () => {
    const html = buildPopupHtml(popupLot)
    expect(html).toContain('>Pindala</dt>')
    expect(html).toContain('>Alghind</dt>')
    expect(html).toContain('>Katastritunnus</dt>')
    expect(html).toContain('>Aega jäänud</dt>')
  })

  it('shows the area, the amber mono starting price and the mono cadastre', () => {
    const html = buildPopupHtml(popupLot)
    expect(html).toContain('12,4 ha')
    expect(html).toMatch(/text-ctaHover">18\s+000 €/u)
    expect(html).toContain('77901:003:0410')
  })

  it('links Vaata to the lot page for client-side navigation', () => {
    const html = buildPopupHtml(popupLot)
    expect(html).toContain('href="/oksjon/auction-9"')
    expect(html).toContain('data-lm-link')
    expect(html).toContain('>Vaata</a>')
  })

  it('binds the ticking countdown to the deadline and offers a Lõpeb varsti badge', () => {
    const html = buildPopupHtml(popupLot)
    expect(html).toContain('data-lm-countdown')
    expect(html).toContain('data-ends-at="2026-09-12T10:00:00.000Z"')
    expect(html).toContain('Lõpeb varsti')
  })

  it('collapses missing area and cadastre rows and drops the ticking deadline', () => {
    const html = buildPopupHtml({ ...popupLot, area: null, registryNumber: null, endsAt: null })
    expect(html).not.toContain('>Pindala</dt>')
    expect(html).not.toContain('>Katastritunnus</dt>')
    expect(html).not.toContain('data-lm-countdown')
    expect(html).toContain('—')
  })

  it('escapes lot title and cadastre values', () => {
    const hostile = buildPopupHtml({
      ...popupLot,
      title: '<script>alert(1)</script>',
      registryNumber: '<img src=x>',
    })
    expect(hostile).not.toContain('<script>')
    expect(hostile).not.toContain('<img src=x>')
    expect(hostile).toContain('&lt;script&gt;')
  })
})
