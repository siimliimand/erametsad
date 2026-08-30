import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(''),
}))

import { ListingMap, type ListingMapLot } from '../ListingMap'

function lot(coordinates: ListingMapLot['coordinates']): ListingMapLot {
  return {
    id: 'lot-1',
    title: 'Metsamaa Võrumaal',
    area: 12.4,
    minBid: 5000,
    finalPrice: null,
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
