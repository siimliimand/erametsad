// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { EndAuctionModal, type EndAuctionModalAuction } from '../EndAuctionModal'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

const NOW = Date.parse('2026-09-09T12:00:00.000Z')
const LEADING_AT = NOW - 2 * 60_000

const noopAction = vi.fn((): Promise<void> => Promise.resolve())

// jsdom does not implement <dialog>.showModal; the modal only needs the
// open flag and a close event for its close handler.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function closeDialog(this: HTMLDialogElement) {
    if (!this.open) return
    this.open = false
    this.dispatchEvent(new Event('close'))
  }
})

type ModalAuction = EndAuctionModalAuction

const baseAuction = (overrides: Partial<ModalAuction> = {}): ModalAuction => ({
  id: 'auction-12345678',
  title: 'Raieõigus Võtmejõel',
  context: 'aktiivne oksjon — 3 pakkumist',
  ...overrides,
})

let container: HTMLDivElement
let root: Root

async function mountModal(auction: ModalAuction | null): Promise<void> {
  await act(async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    root.render(
      createElement(EndAuctionModal, { auction, action: noopAction, onClose: vi.fn() }),
    )
    await Promise.resolve()
  })
}

async function unmountModal(): Promise<void> {
  await act(async () => {
    root.unmount()
    await Promise.resolve()
  })
  container.remove()
}

afterEach(async () => {
  await unmountModal()
  vi.useRealTimers()
  noopAction.mockClear()
})

function bodyText(): string {
  return container.textContent
}

function headerText(): string {
  const header = container.querySelector('div')
  return header?.textContent ?? ''
}

/** Collapses NBSP/narrow-space variants from et-EE number formatting. */
function normalized(text: string): string {
  return text.replace(/[\s\u00A0\u202F]/g, ' ')
}

describe('EndAuctionModal leading-bid header preview', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: NOW })
  })

  it('previews the leading bid amount and relative time in the header', async () => {
    await mountModal(
      baseAuction({ leadingBidCents: 150_000, leadingBidAt: new Date(LEADING_AT).toISOString() }),
    )
    const header = normalized(headerText())
    expect(header).toContain('Juhtiv pakkumus: 1500,00 €')
    expect(header).toContain('2 minutit tagasi')
  })

  it('states that no leading bid exists when the amount is null', async () => {
    await mountModal(baseAuction({ leadingBidCents: null, leadingBidAt: null }))
    expect(bodyText()).toContain('Juhtiv pakkumus puudub.')
  })

  it('keeps the header clean when leading-bid data is not provided', async () => {
    await mountModal(baseAuction())
    expect(bodyText()).not.toContain('Juhtiv pakkumus')
  })

  it('previews amounts only: no bidder name or e-mail can reach the header', async () => {
    await mountModal(
      baseAuction({ leadingBidCents: 150_000, leadingBidAt: new Date(LEADING_AT).toISOString() }),
    )
    expect(headerText()).not.toContain('@')
    expect(bodyText()).not.toContain('Näita identiteeti')
  })
})

describe('EndAuctionModal final-minute anti-snipe re-check line', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: NOW })
  })

  it('shows the server re-check line inside the final minute with the configured window', async () => {
    await mountModal(
      baseAuction({
        endsAt: new Date(NOW + 30_000).toISOString(),
        antiSnipeEnabled: true,
        antiSnipeMinutes: 7,
      }),
    )
    expect(bodyText()).toContain('Viimane minut: enne lõpetamist kontrollib server antissnipe reeglit.')
    expect(bodyText()).toContain('Viimase 7 minuti jooksul tehtud pakkumine pikendab lõpuaega')
  })

  it('falls back to the 5-minute default window', async () => {
    await mountModal(
      baseAuction({ endsAt: new Date(NOW + 30_000).toISOString(), antiSnipeEnabled: true }),
    )
    expect(bodyText()).toContain('Viimase 5 minuti jooksul tehtud pakkumine pikendab lõpuaega')
  })

  it('hides the line while more than a minute remains', async () => {
    await mountModal(
      baseAuction({
        endsAt: new Date(NOW + 10 * 60_000).toISOString(),
        antiSnipeEnabled: true,
      }),
    )
    expect(bodyText()).not.toContain('Viimane minut')
  })

  it('hides the line when anti-snipe is disabled for the auction', async () => {
    await mountModal(
      baseAuction({
        endsAt: new Date(NOW + 30_000).toISOString(),
        antiSnipeEnabled: false,
        antiSnipeMinutes: 7,
      }),
    )
    expect(bodyText()).not.toContain('Viimane minut')
  })

  it('hides the line without an end time', async () => {
    await mountModal(
      baseAuction({ endsAt: null, antiSnipeEnabled: true, antiSnipeMinutes: 7 }),
    )
    expect(bodyText()).not.toContain('Viimane minut')
  })
})
