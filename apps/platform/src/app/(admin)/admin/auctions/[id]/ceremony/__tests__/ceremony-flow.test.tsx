// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { SealedCeremonyContext } from '../../../../../_actions/auctions'
import { CeremonyFlow } from '../ceremony-flow'

const panelMocks = vi.hoisted(() => ({
  signing: vi.fn((_props?: Record<string, unknown>) => null),
  reveal: vi.fn((_props?: Record<string, unknown>) => null),
  void: vi.fn((_props?: Record<string, unknown>) => null),
  winner: vi.fn((_props?: Record<string, unknown>) => null),
  record: vi.fn((_props?: Record<string, unknown>) => null),
  shortcut: vi.fn((_props?: Record<string, unknown>) => null),
}))

vi.mock('../_components/signing-panel', () => ({
  SigningPanel: (props?: Record<string, unknown>) => panelMocks.signing(props),
}))

vi.mock('../_components/reveal-panel', () => ({
  RevealPanel: (props?: Record<string, unknown>) => panelMocks.reveal(props),
}))

vi.mock('../_components/void-panel', () => ({
  VoidPanel: (props?: Record<string, unknown>) => panelMocks.void(props),
}))

vi.mock('../_components/winner-confirm', () => ({
  WinnerConfirm: (props?: Record<string, unknown>) => panelMocks.winner(props),
}))

vi.mock('../_components/ceremony-record', () => ({
  CeremonyRecord: (props?: Record<string, unknown>) => panelMocks.record(props),
}))

vi.mock('../_components/ceremony-checklist', () => ({
  CeremonyUnsoldShortcut: (props?: Record<string, unknown>) => panelMocks.shortcut(props),
}))

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

type FlowProps = Parameters<typeof CeremonyFlow>[0]

const baseContext: SealedCeremonyContext = {
  auctionId: 'auction-1',
  status: 'ended',
  endedAt: '2026-09-01T10:00:00Z',
  revealAllowedAt: '2026-09-01T10:01:00Z',
  checklist: {
    endingWorker: { done: true, key: 'worker-1', endedAt: '2026-09-01T10:00:00Z' },
    pendingAlapakkumised: 0,
    template: { active: true, name: 'Müügleping', version: '2', changedWithin24h: false },
  },
  opener: null,
  approver: null,
  signaturesExpired: false,
  revealed: false,
  revealedAt: null,
  bids: [],
  topMeetsReserve: null,
  feeEstimate: null,
  winnerProfileHold: false,
  viewerIsParticipant: true,
  openingInProgress: false,
  winnerConfirmed: false,
  voided: false,
  error: null,
}

const baseProps: FlowProps = {
  auctionId: 'auction-1',
  initialContext: baseContext,
  session: { userId: 'opener-1', role: 'admin' },
  kiiroksjon: false,
  sealedBidCount: 3,
}

let container: HTMLDivElement
let root: Root | null = null

async function mountFlow(props: FlowProps): Promise<void> {
  await act(async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    root.render(createElement(CeremonyFlow, props))
    await Promise.resolve()
  })
}

async function unmountFlow(): Promise<void> {
  const mounted = root
  if (mounted === null) return
  await act(async () => {
    mounted.unmount()
    await Promise.resolve()
  })
  container.remove()
  root = null
}

beforeEach(() => {
  for (const mock of Object.values(panelMocks)) {
    mock.mockClear()
  }
})

afterEach(async () => {
  await unmountFlow()
})

describe('CeremonyFlow "Avamine on pooleli" read-only state', () => {
  it('shows the banner and no action panels to an admin outside the ceremony', async () => {
    await mountFlow({
      ...baseProps,
      session: { userId: 'bystander-1', role: 'admin' },
      initialContext: {
        ...baseContext,
        opener: { userId: 'opener-1', signedAt: '2026-09-01T10:05:00Z' },
        openingInProgress: true,
        viewerIsParticipant: false,
      },
    })

    expect(container.textContent).toContain('Avamine on pooleli')
    expect(container.textContent).toContain('ainult loetav')
    expect(panelMocks.signing).not.toHaveBeenCalled()
    expect(panelMocks.winner).not.toHaveBeenCalled()
    expect(panelMocks.void).not.toHaveBeenCalled()
    expect(container.textContent).toContain('Tagasi detailvaatesse')
  })

  it('shows the read-only revealed record too, but never the winner confirm', async () => {
    await mountFlow({
      ...baseProps,
      session: { userId: 'bystander-1', role: 'admin' },
      initialContext: {
        ...baseContext,
        opener: { userId: 'opener-1', signedAt: '2026-09-01T10:05:00Z' },
        approver: { userId: 'approver-1', signedAt: '2026-09-01T10:06:00Z' },
        revealed: true,
        revealedAt: '2026-09-01T10:07:00Z',
        openingInProgress: true,
        viewerIsParticipant: false,
      },
    })

    expect(container.textContent).toContain('Avamine on pooleli')
    expect(panelMocks.record).toHaveBeenCalledTimes(1)
    expect(panelMocks.winner).not.toHaveBeenCalled()
  })

  it('keeps the signing flow visible to a participant', async () => {
    await mountFlow({
      ...baseProps,
      initialContext: {
        ...baseContext,
        opener: { userId: 'opener-1', signedAt: '2026-09-01T10:05:00Z' },
        openingInProgress: true,
        viewerIsParticipant: true,
      },
    })

    expect(container.textContent).not.toContain('Avamine on pooleli')
    expect(panelMocks.signing).toHaveBeenCalledTimes(1)
  })
})

describe('CeremonyFlow winner confirm and shortcut wiring', () => {
  it('passes the fee estimate and the profile hold flag to the winner confirm', async () => {
    const feeEstimate = { feeCents: 549_000, feePercent: 3, vatPercent: 22 }
    await mountFlow({
      ...baseProps,
      initialContext: {
        ...baseContext,
        opener: { userId: 'opener-1', signedAt: '2026-09-01T10:05:00Z' },
        revealed: true,
        revealedAt: '2026-09-01T10:07:00Z',
        bids: [
          {
            id: 'bid-1',
            amount: 150_000,
            createdAt: '2026-09-01T09:30:00Z',
            valid: true,
            invalidReason: null,
            rank: 1,
            tie: false,
            marginToNext: null,
          },
        ],
        topMeetsReserve: true,
        feeEstimate,
        winnerProfileHold: true,
      },
    })

    expect(panelMocks.winner).toHaveBeenCalledTimes(1)
    expect(panelMocks.winner.mock.calls[0]?.[0]).toMatchObject({
      auctionId: 'auction-1',
      feeEstimate,
      winnerProfileHold: true,
      isOpener: true,
    })
  })

  it('offers the müümata shortcut from the checklist stage only for an empty lot', async () => {
    await mountFlow({ ...baseProps, sealedBidCount: 0 })
    expect(panelMocks.shortcut).toHaveBeenCalledTimes(1)

    await mountFlow({ ...baseProps, sealedBidCount: 3 })
    expect(panelMocks.shortcut).toHaveBeenCalledTimes(1)
  })

  it('hides the shortcut once the ceremony has moved past the checklist', async () => {
    await mountFlow({
      ...baseProps,
      sealedBidCount: 0,
      initialContext: { ...baseContext, revealed: true, revealedAt: '2026-09-01T10:07:00Z' },
    })

    expect(panelMocks.shortcut).not.toHaveBeenCalled()
  })
})
