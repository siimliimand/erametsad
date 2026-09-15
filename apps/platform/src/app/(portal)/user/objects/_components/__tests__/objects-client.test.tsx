import { createElement, type ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
}))

vi.mock('next/link', () => ({
  default: (props: { href: string; children: ReactNode }) =>
    createElement('a', { href: props.href }, props.children),
}))

import { ObjectsClient } from '../objects-client'
import type { PendingBannerGroup, SellerAuctionRow, StatusTab } from '../seller-data'

function makeRow(overrides: Partial<SellerAuctionRow>): SellerAuctionRow {
  return {
    id: 'auction-1',
    title: 'Lepsi raieõigus',
    slug: 'lepsi-raieoigus',
    objectType: 'raieoigus',
    type: 'open',
    status: 'active',
    startPrice: 5000,
    finalPrice: null,
    leadingPrice: 7750,
    bidCount: 14,
    pendingApprovalCount: 0,
    views: null,
    countyName: 'Tartu maakond',
    areaHa: 12,
    startsAt: null,
    endsAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    createdAt: '2026-08-01T10:00:00Z',
    updatedAt: '2026-08-01T10:00:00Z',
    pending: [],
    bidLog: [],
    ...overrides,
  }
}

function render(
  rows: SellerAuctionRow[],
  props?: Partial<{ status: StatusTab; pendingGroups: PendingBannerGroup[] }>,
): string {
  return renderToString(
    createElement(ObjectsClient, {
      status: props?.status ?? 'all',
      rows,
      pendingGroups: props?.pendingGroups ?? [],
    }),
  )
}

describe('ObjectsClient', () => {
  it('renders the demo chips and the Paku oma objekti CTA', () => {
    const html = render([makeRow({})])
    expect(html).toContain('Kõik')
    expect(html).toContain('Käimasolevad')
    expect(html).toContain('Lõppenud')
    expect(html).toContain('Mustandid')
    expect(html).toContain('Paku oma objekti')
    expect(html).toContain('href="/user/objects/paku"')
    expect(html).not.toContain('teenused/raieoiguse-muuk')
    expect(html).toContain('aria-pressed="true"')
  })

  it('marks the Käimasolevad chip active for legacy scheduled/active statuses', () => {
    const html = render([makeRow({})], { status: 'scheduled' })
    const chip = /aria-pressed="(true|false)"[^>]*>Käimasolevad</.exec(html)
    expect(chip?.[1]).toBe('true')
  })

  it('renders an active card with demo stats and actions', () => {
    const html = render([
      makeRow({ status: 'active', leadingPrice: 7750, bidCount: 14 }),
    ])
    expect(html).toContain('Hetke hind')
    expect(html).toContain('Pakkumisi')
    expect(html).toContain('Aktiivne')
    expect(html).toContain('Vaata oksjonit')
    expect(html).toContain('Tartu maakond · 12 ha · Raieõigus')
    expect(html).toContain('Aega jäänud')
  })

  it('renders a signed card with the Lõpphind stat and the contract action', () => {
    const html = render([
      makeRow({
        id: 'sold',
        status: 'completed',
        type: 'sealed',
        finalPrice: 88000,
        leadingPrice: null,
        endsAt: '2026-07-25T10:00:00Z',
      }),
    ])
    expect(html).toContain('Lõpphind')
    expect(html).toContain('88\u00a0000 €')
    expect(html).toContain('Leping allkirjastatud')
    expect(html).toContain('Leping ja PDF')
    expect(html).toContain('Ostja andmed nähtavad ainult lepingus.')
  })

  it('renders unsold and draft cards dimmed with their demo notes', () => {
    const html = render([
      makeRow({ id: 'lost', status: 'unsold', finalPrice: null, leadingPrice: null }),
      makeRow({ id: 'plan', status: 'draft', leadingPrice: null, bidCount: 0 }),
    ])
    expect(html).toContain('Müümata')
    expect(html).toContain('Oksjon jäi tulemuseta.')
    expect(html).toContain('Proovi uuesti')
    expect(html).toContain('Mustand')
    expect(html).toContain(
      'Muudatused tehakse koos metsaspetsialistiga — enne avaldamist vaatab ta objekti üle.',
    )
    expect(html).toContain('Eelvaade')
    expect(html).toContain('Saada spetsialistile')
    expect(html.match(/opacity-70/g)).toHaveLength(2)
  })

  it('collapses stats the data layer does not provide', () => {
    const html = render([makeRow({ views: null })])
    expect(html).not.toContain('Vaatamisi')
    expect(html).not.toContain('Jälgijaid')
  })

  it('flags pending alapakkumised on the bid stat and in the banner', () => {
    const html = render(
      [makeRow({ pendingApprovalCount: 2 })],
      {
        pendingGroups: [
          { auctionId: 'auction-1', title: 'Lepsi raieõigus', count: 2 },
        ],
      },
    )
    const clean = html.replace(/<!-- -->/g, '')
    expect(clean).toContain('2 ootel')
    expect(clean).toContain('alapakkumist')
    expect(clean).toContain('Vaata pakkumisi')
  })

  it('shows the demo empty state with Tühjenda filtrid', () => {
    const html = render([])
    expect(html).toContain('Filtritele ei vasta ükski objekt')
    expect(html).toContain('Tühjenda filtrid')
  })
})
