// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'

import { PortalLotCard } from '../PortalLotCard'

import type { AuctionSummary } from '@/lib/auction/queries'

function lot(overrides: Partial<AuctionSummary> = {}): AuctionSummary {
  return {
    id: 'lot-1',
    slug: 'raieoigus-valgemetsas',
    title: 'Kuuse ja männi raieõigus Valgemetsas',
    objectType: 'raieoigus',
    type: 'open',
    isQuickAuction: false,
    status: 'active',
    endYear: null,
    county: { id: 'c1', name: 'Harju', code: 'HAR' },
    parish: { id: 'p1', name: 'Kuusalu' },
    address: null,
    minBid: 18000,
    finalPrice: null,
    area: 12.4,
    volume: 4120,
    species: [],
    startsAt: null,
    endsAt: '2026-09-30T12:00:00.000Z',
    coordinates: null,
    image: null,
    registryNumber: '77901:003:0410',
    ...overrides,
  }
}

let container: HTMLDivElement
let root: Root

function render(auction: AuctionSummary): void {
  act(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    root.render(createElement(PortalLotCard, { lot: auction }))
  })
}

function text(): string {
  return container.textContent
}

afterEach(() => {
  act(() => {
    root.unmount()
  })
  container.remove()
})

describe('PortalLotCard demo anatomy', () => {
  it('renders the full card as a single link to the lot page', () => {
    render(lot())

    const links = container.querySelectorAll('a')
    expect(links).toHaveLength(1)
    expect(links[0]?.getAttribute('href')).toBe('/oksjon/lot-1')
    expect(text()).toContain('Raieõigus')
    expect(text()).toContain('Aktiivne')
    expect(text()).toContain('Kuuse ja männi raieõigus Valgemetsas')
    expect(text()).toContain('77901:003:0410')
    expect(text()).toContain('12,4 ha')
    expect(text()).toContain('4120 m³')
    expect(text()).toContain('Kuusalu vald')
    expect(text()).toContain('Harju')
    expect(text()).toContain('Alghind')
    expect(text()).toContain(`18\u00A0000 €`)
    expect(text()).toContain('Aega jäänud')
  })

  it('shows the Kiiroksjon flag only for quick auctions', () => {
    render(lot({ isQuickAuction: true }))
    expect(text()).toContain('Kiiroksjon')
  })

  it('omits the Kiiroksjon flag for regular auctions', () => {
    render(lot({ isQuickAuction: false, objectType: 'kinnistu' }))
    expect(text()).toContain('Metskinnistu')
    expect(text()).not.toContain('Kiiroksjon')
  })

  it('collapses meta parts the data does not provide', () => {
    render(
      lot({
        area: null,
        volume: null,
        parish: null,
        county: null,
        registryNumber: null,
      }),
    )

    expect(text()).not.toContain('ha')
    expect(text()).not.toContain('m³')
    expect(text()).not.toContain('vald')
    expect(text()).not.toContain('77901:003:0410')
  })

  it('flips the pill to Lõppenud for an ended auction', () => {
    render(lot({ status: 'ended' }))

    expect(text()).toContain('Lõppenud')
    expect(text()).not.toContain('Aktiivne')
  })
})
