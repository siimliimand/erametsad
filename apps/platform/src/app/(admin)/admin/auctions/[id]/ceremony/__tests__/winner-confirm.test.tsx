// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ToastProvider } from '../../../../../_components/ui/Toast'
import { WinnerConfirm } from '../_components/winner-confirm'

const navMocks = vi.hoisted(() => ({
  refresh: vi.fn(),
}))

const actionMocks = vi.hoisted(() => ({
  confirmSealedCeremonyWinnerAction: vi.fn(),
}))

vi.mock('next/navigation', () => {
  const router = { refresh: navMocks.refresh }
  return { useRouter: () => router }
})

vi.mock('../../../../../_actions/auctions', () => ({
  confirmSealedCeremonyWinnerAction: actionMocks.confirmSealedCeremonyWinnerAction,
}))

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

import type { SealedCeremonyContext } from '../../../../../_actions/auctions'

type WinnerProps = Parameters<typeof WinnerConfirm>[0]

const topBid: SealedCeremonyContext['bids'][number] = {
  id: 'bid-1',
  amount: 150_000,
  createdAt: '2026-09-01T10:00:00Z',
  valid: true,
  invalidReason: null,
  rank: 1,
  tie: false,
  marginToNext: null,
  bidder: {
    name: 'Mets OÜ',
    email: 'info@metsou.ee',
    maskedCode: '••••••5678',
    isCompany: true,
    userId: 'user-a',
    userHref: null,
  },
}

const baseProps: WinnerProps = {
  auctionId: 'auction-1',
  bids: [topBid],
  topMeetsReserve: true,
  feeEstimate: { feeCents: 549_000, feePercent: 3, vatPercent: 22 },
  winnerProfileHold: false,
  isOpener: true,
  isSuperadmin: false,
  kiiroksjon: false,
}

/** et-EE currency strings may carry narrow no-break spaces; normalize for asserts. */
function normalizedText(): string {
  return container.textContent?.replace(/[\u00A0\u202F]/g, ' ') ?? ''
}

let container: HTMLDivElement
let root: Root | null = null

async function mountWinner(props: WinnerProps): Promise<void> {
  await act(async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    root.render(createElement(ToastProvider, null, createElement(WinnerConfirm, props)))
    await Promise.resolve()
  })
}

async function unmountWinner(): Promise<void> {
  const mounted = root
  if (mounted === null) return
  await act(async () => {
    mounted.unmount()
    await Promise.resolve()
  })
  container.remove()
  root = null
}

async function click(element: HTMLElement): Promise<void> {
  await act(async () => {
    element.click()
    await Promise.resolve()
  })
}

async function openDialog(): Promise<void> {
  const trigger = [...container.querySelectorAll('button')].find(
    (candidate) => candidate.textContent === 'Kinnita tulemus',
  )
  if (trigger === undefined) throw new Error('confirm trigger not found')
  await click(trigger)
}

function dialog(): HTMLElement {
  const found = container.querySelector<HTMLElement>('[role="dialog"]')
  if (found === null) throw new Error('winner dialog not found')
  return found
}

function dialogButton(label: string): HTMLButtonElement {
  const button = [...dialog().querySelectorAll('button')].find(
    (candidate) => candidate.textContent === label,
  )
  if (button === undefined) throw new Error(`dialog button ${label} not found`)
  return button
}

afterEach(async () => {
  await unmountWinner()
  vi.clearAllMocks()
})

describe('WinnerConfirm price and fee estimate', () => {
  it('shows the final price and the 3% + VAT fee estimate in the dialog', async () => {
    await mountWinner(baseProps)
    await openDialog()

    const text = normalizedText()
    expect(text).toContain('Lõpphind: 150 000,00 €')
    expect(text).toContain('Vahendustasu hinnang: 5490,00 € (3% + käibemaks 22%)')
  })

  it('hides the fee line when the server sent no estimate', async () => {
    await mountWinner({ ...baseProps, feeEstimate: null })
    await openDialog()

    expect(normalizedText()).toContain('Lõpphind: 150 000,00 €')
    expect(normalizedText()).not.toContain('Vahendustasu hinnang')
  })
})

describe('WinnerConfirm company profile forced choice', () => {
  it('flags the pending company profile outside the dialog', async () => {
    await mountWinner({ ...baseProps, winnerProfileHold: true })

    expect(container.textContent).toContain('ettevõtte profiil on kinnitamata')
  })

  it('hides the forced choice for a regular winner', async () => {
    await mountWinner(baseProps)
    await openDialog()

    expect(normalizedText()).not.toContain('Ettevõtte profiil on ootel')
    expect(dialogButton('Kinnita lõplikult: Müük').disabled).toBe(false)
  })

  it('locks the submit until the operator picks proceed or hold', async () => {
    await mountWinner({ ...baseProps, winnerProfileHold: true })
    await openDialog()

    const text = normalizedText()
    expect(text).toContain('Ettevõtte profiil on ootel')
    expect(text).toContain('Jätka — kuuluta võitja ja koosta leping')
    expect(text).toContain('Hoia ootel — ära kinnita veel')
    expect(dialogButton('Kinnita lõplikult: Müük').disabled).toBe(true)

    const proceed = dialog().querySelector<HTMLInputElement>(
      'input[name="company-profile-choice"][value="proceed"]',
    )
    if (proceed === null) throw new Error('proceed radio not found')
    await click(proceed)

    expect(dialogButton('Kinnita lõplikult: Müük').disabled).toBe(false)
    const hidden = dialog().querySelector<HTMLInputElement>(
      'input[name="companyProfileDecision"]',
    )
    expect(hidden?.value).toBe('proceed')
  })

  it('keeps the hidden choice empty until a radio is picked', async () => {
    await mountWinner({ ...baseProps, winnerProfileHold: true })
    await openDialog()

    const hidden = dialog().querySelector<HTMLInputElement>(
      'input[name="companyProfileDecision"]',
    )
    expect(hidden?.value).toBe('')
  })
})

describe('WinnerConfirm access', () => {
  it('shows the read-only note to admins who are not the opener', async () => {
    await mountWinner({ ...baseProps, isOpener: false })

    expect(container.textContent).toContain('Võitja kinnitab avaja pärast uuesti autentimist.')
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })
})
