// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'

import type { RevealedBidView } from '../../../../../_actions/auctions'
import { RevealRecord } from '../_components/reveal-record'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

const baseView: RevealedBidView = {
  id: 'bid-1',
  amount: 150_000,
  createdAt: '2026-09-09T10:00:00.000Z',
  valid: true,
  invalidReason: null,
  rank: 1,
  tie: false,
}

const view = (overrides: Partial<RevealedBidView>): RevealedBidView => ({
  ...baseView,
  ...overrides,
})

let container: HTMLDivElement
let root: Root

async function mountRecord(
  bids: RevealedBidView[],
  topMeetsReserve: boolean | null = true,
): Promise<void> {
  await act(async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    root.render(createElement(RevealRecord, { bids, topMeetsReserve }))
    await Promise.resolve()
  })
}

afterEach(async () => {
  await act(async () => {
    root.unmount()
    await Promise.resolve()
  })
  container.remove()
})

function headerLabels(): string[] {
  return [...container.querySelectorAll<HTMLTableCellElement>('thead th')].map(
    (th) => th.textContent,
  )
}

function rowCells(rowIndex: number): string[] {
  const row = container.querySelectorAll<HTMLTableRowElement>('tbody tr')[rowIndex]
  if (row === undefined) throw new Error(`row ${String(rowIndex)} not found`)
  return [...row.querySelectorAll('td')].map((cell) => cell.textContent)}

/** Collapses NBSP variants from et-EE number formatting. */
function normalized(text: string | undefined): string {
  return (text ?? '').replace(/[\s\u00A0\u202F]/g, ' ')
}

describe('RevealRecord Pakkuja column', () => {
  it('renders the Pakkuja header between Summa and Marginaal', async () => {
    await mountRecord([view({})])
    expect(headerLabels()).toEqual([
      'Koht',
      'Summa',
      'Pakkuja',
      'Marginaal',
      'Esitatud',
      'Kehtivus',
    ])
  })

  it('shows identity, the last-4 masked code and the user detail link', async () => {
    await mountRecord([
      view({
        bidder: {
          name: 'Kalle Tamm',
          email: 'kalle.tamm@iid.ee',
          maskedCode: '••••••0516',
          isCompany: false,
          userId: 'user-a',
          userHref: '/admin/users/user-a',
        },
      }),
    ])
    const cells = rowCells(0)
    expect(normalized(cells[2])).toContain('Kalle Tamm')
    expect(cells[2]).toContain('••••••0516')
    const link = container.querySelector<HTMLAnchorElement>('tbody a')
    expect(link?.getAttribute('href')).toBe('/admin/users/user-a')
    expect(link?.textContent).toBe('Kalle Tamm')
  })

  it('renders the company chip without masking away the company name', async () => {
    await mountRecord([
      view({
        bidder: {
          name: 'Mets OÜ',
          email: 'info@metsou.ee',
          maskedCode: '••••••5678',
          isCompany: true,
          userId: 'user-b',
          userHref: null,
        },
      }),
    ])
    const pakkujaCell = container.querySelectorAll('tbody td')[2]
    if (pakkujaCell === undefined) throw new Error('pakkuja cell not found')
    expect(pakkujaCell.textContent).toContain('Ettevõte')
    expect(pakkujaCell.textContent).toContain('Mets OÜ')
    expect(pakkujaCell.textContent).toContain('••••••5678')
    // No users:read → identity stays plain text, never a link.
    expect(container.querySelector('tbody a')).toBeNull()
  })

  it('degrades to an em dash without identity (pre-reveal or broken snapshot)', async () => {
    await mountRecord([view({}), view({ id: 'bid-bad', valid: false, rank: null })])
    expect(rowCells(0)[2]).toBe('—')
    expect(rowCells(1)[2]).toBe('—')
  })
})

describe('RevealRecord Marginaal column', () => {
  it('shows the positive gap to the next ranked bid', async () => {
    await mountRecord([
      view({ marginToNext: 30_000 }),
      view({ id: 'bid-2', amount: 120_000, rank: 2, marginToNext: 20_000 }),
      view({ id: 'bid-3', amount: 100_000, rank: 3, marginToNext: null }),
    ])
    expect(normalized(rowCells(0)[3])).toBe('+ 30 000,00 €')
    expect(normalized(rowCells(1)[3])).toBe('+ 20 000,00 €')
    // Tail row has no next bid.
    expect(rowCells(2)[3]).toBe('—')
  })

  it('keeps the marginaal empty for invalid rows and legacy views', async () => {
    await mountRecord([
      view({ id: 'bid-bad', valid: false, rank: null, marginToNext: null }),
      view({ id: 'bid-old' }),
    ])
    expect(rowCells(0)[3]).toBe('—')
    expect(rowCells(1)[3]).toBe('—')
  })
})
