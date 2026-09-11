import { createElement, type ReactElement, type ReactNode } from 'react'
import { prerender } from 'react-dom/static'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/link', () => ({
  default: (props: { href: string; children?: ReactNode }) =>
    createElement('a', { href: props.href }, props.children),
}))

vi.mock('@/lib/data/runtime', () => ({
  getRepositories: vi.fn(() => Promise.resolve({})),
}))

// The chip contract is asserted against the query call instead of a seeded
// database: repositories are being reworked by a parallel wave and the
// query layer itself is covered by lib/auction tests.
vi.mock('@/lib/auction/queries', () => ({
  archivedStatsByObjectType: vi.fn(),
  listArchivedAuctions: vi.fn(),
}))

import AjaluguPage from '../page'

import {
  archivedStatsByObjectType,
  listArchivedAuctions,
  type ArchivedAuctionTypeStats,
  type AuctionListResult,
  type AuctionSummary,
} from '@/lib/auction/queries'
import type { AuctionObjectType } from '@/lib/data/schema'

const statsMock = vi.mocked(archivedStatsByObjectType)
const listMock = vi.mocked(listArchivedAuctions)

const EMPTY_PAGE: AuctionListResult = {
  auctions: [],
  total: 0,
  page: 1,
  limit: 24,
  totalPages: 1,
}

function zeroStats(): Record<AuctionObjectType, ArchivedAuctionTypeStats> {
  const empty = { count: 0, areaHa: 0, volumeM3: 0, finalPriceEur: 0, endYears: [] }
  return {
    raieoigus: { ...empty },
    kinnistu: { ...empty },
    kiire: { ...empty },
    pakett: { ...empty },
    pollumaa: { ...empty },
  }
}

function pollumaaRow(): AuctionSummary {
  return {
    id: 'pollumaa-1',
    slug: 'pollumaa-1',
    title: 'Põllumaa Saaremaal',
    objectType: 'pollumaa',
    type: 'open',
    isQuickAuction: false,
    status: 'completed',
    endYear: 2026,
    county: { id: 'county-saare', name: 'Saare maakond', code: 'SA' },
    parish: null,
    address: null,
    minBid: 54_000,
    finalPrice: 96_000,
    area: 3.9,
    volume: null,
    species: [],
    startsAt: '2026-05-01T00:00:00.000Z',
    endsAt: '2026-06-19T12:00:00.000Z',
    coordinates: null,
    image: null,
    registryNumber: '34801:001:0217',
  }
}

// React SSR separates adjacent text nodes with <!-- --> comments; strip
// them so text assertions read like the page copy.
function plain(html: string): string {
  return html.replace(/<!--.*?-->/g, '')
}

async function renderPage(search: Record<string, string>): Promise<string> {
  const tree = (await AjaluguPage({
    searchParams: Promise.resolve(search),
  })) as ReactElement
  const { prelude } = await prerender(tree)
  return plain(await new Response(prelude).text())
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('archive Põllumaa chip (portal-parity-gap-closure 3.2)', () => {
  it('filters pollumaa when selected and lists the rows', async () => {
    const stats = zeroStats()
    stats.pollumaa = {
      count: 1,
      areaHa: 3.9,
      volumeM3: 0,
      finalPriceEur: 96_000,
      endYears: [2026],
    }
    statsMock.mockResolvedValue(stats)
    listMock.mockResolvedValue({ ...EMPTY_PAGE, auctions: [pollumaaRow()], total: 1 })

    const html = await renderPage({ tab: 'koik', type: 'pollumaa' })

    expect(listMock).toHaveBeenCalledTimes(1)
    const search = listMock.mock.calls[0]?.[1]
    expect(search).toBeInstanceOf(URLSearchParams)
    expect(search?.get('objectType')).toBe('pollumaa')

    expect(html).toContain('Põllumaa Saaremaal')
    expect(html).toContain('1 oksjon')
    // URL state: the filter form hidden input and the chip hrefs carry it.
    expect(html).toContain('name="type" value="pollumaa"')
    expect(html).toContain('type=pollumaa')
  })

  it('renders the demo empty state with count 0 when no pollumaa is archived', async () => {
    statsMock.mockResolvedValue(zeroStats())
    listMock.mockResolvedValue(EMPTY_PAGE)

    const html = await renderPage({ tab: 'koik', type: 'pollumaa' })

    expect(listMock.mock.calls[0]?.[1]?.get('objectType')).toBe('pollumaa')
    expect(html).toContain('Filtritele ei vasta ükski lõppenud oksjon')
    expect(html).toContain('0 oksjonit')
    expect(html).not.toContain('Ülepakkumine')
  })

  it('keeps the empty result when Põllumaa is picked on a tab without pollumaa', async () => {
    statsMock.mockResolvedValue(zeroStats())

    const html = await renderPage({ tab: 'raieoigused', type: 'pollumaa' })

    expect(listMock).not.toHaveBeenCalled()
    expect(html).toContain('Filtritele ei vasta ükski lõppenud oksjon')
  })
})
