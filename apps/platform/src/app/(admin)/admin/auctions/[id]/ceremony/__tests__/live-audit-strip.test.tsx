// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { EventSourceStub, sleep } from './ceremony-fixtures'
import { LiveAuditStrip } from '../_lib/live-audit-strip'
import type { SealedAuditLineView } from '../_lib/sealed-audit-view'

const auditMocks = vi.hoisted(() => ({
  fetchSealedCeremonyAuditAction: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'auction-1' }),
}))

vi.mock('../_lib/fetch-sealed-audit', () => ({
  fetchSealedCeremonyAuditAction: auditMocks.fetchSealedCeremonyAuditAction,
}))

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

function auditLine(
  id: string,
  action: string,
  createdAt: string,
  actorLabel: string | null = null,
): SealedAuditLineView {
  return { id, createdAt, action, actorLabel }
}

const olderLine = auditLine('audit-1', 'sealed.sign_opener', '2026-09-01T12:00:00Z')
const newerLine = auditLine(
  'audit-2',
  'sealed.reveal',
  '2026-09-01T12:05:00Z',
  'Marit Vain (Administraator)',
)

let container: HTMLDivElement
let root: Root

async function mountStrip(): Promise<void> {
  await act(async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    root.render(createElement(LiveAuditStrip))
    await Promise.resolve()
  })
}

async function unmountStrip(): Promise<void> {
  await act(async () => {
    root.unmount()
    await Promise.resolve()
  })
  container.remove()
}

beforeEach(() => {
  EventSourceStub.instances = []
  vi.stubGlobal('EventSource', EventSourceStub)
  auditMocks.fetchSealedCeremonyAuditAction.mockResolvedValue({ ok: true, lines: [] })
})

afterEach(async () => {
  await unmountStrip()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

function instanceAt(index: number): EventSourceStub {
  const instance = EventSourceStub.instances[index]
  if (instance === undefined) {
    throw new Error(`event source ${String(index)} not created`)
  }
  return instance
}

async function open(instance: EventSourceStub): Promise<void> {
  await act(async () => {
    instance.open()
    await Promise.resolve()
  })
}

async function fail(instance: EventSourceStub): Promise<void> {
  await act(async () => {
    instance.fail()
    await Promise.resolve()
  })
}

function auditLines(): HTMLLIElement[] {
  return [...container.querySelectorAll<HTMLLIElement>('ol[role="log"] > li')]
}

function stateDot(): HTMLElement {
  const dot = container.querySelector<HTMLElement>('section h2 span')
  if (dot === null) throw new Error('stream state dot not found')
  return dot
}

function srOnly(): HTMLElement | null {
  return container.querySelector<HTMLElement>('.sr-only')
}

describe('LiveAuditStrip rendering', () => {
  it('renders sealed audit lines with action and actor labels', async () => {
    auditMocks.fetchSealedCeremonyAuditAction.mockResolvedValue({
      ok: true,
      lines: [newerLine, olderLine],
    })
    await mountStrip()
    await open(instanceAt(0))

    expect(instanceAt(0).url).toBe('/api/v1/auctions/stream?auction=auction-1')
    expect(container.querySelector('section')?.getAttribute('aria-label')).toBe(
      'Reaalajas auditlogi',
    )
    const log = container.querySelector('ol[role="log"]')
    if (log === null) throw new Error('audit log list not found')
    expect(log.getAttribute('aria-live')).toBe('polite')

    const lines = auditLines()
    expect(lines).toHaveLength(2)
    expect(lines[0]?.textContent).toContain(
      'Pakkumised paljastatud — Marit Vain (Administraator)',
    )
    expect(lines[1]?.textContent).toContain('Avaja allkiri')
    expect(lines[1]?.textContent).not.toContain(' — ')

    const times = [...log.querySelectorAll('time')].map((time) =>
      time.getAttribute('datetime'),
    )
    expect(times).toEqual(['2026-09-01T12:05:00Z', '2026-09-01T12:00:00Z'])
  })

  it('shows the empty state before any sealed audit entries exist', async () => {
    await mountStrip()
    await open(instanceAt(0))

    expect(container.textContent).toContain(
      'Pitseeritud avamise auditikirjeid veel ei ole.',
    )
    expect(container.querySelector('ol[role="log"]')).toBeNull()
  })

  it('renders nothing when the audit log is not permitted', async () => {
    auditMocks.fetchSealedCeremonyAuditAction.mockResolvedValue({
      ok: false,
      error: 'Auditlogi on nähtav ainult administraatorile ja peakasutajale.',
    })
    await mountStrip()

    expect(container.textContent).toBe('')
    expect(container.querySelector('section')).toBeNull()
  })
})

describe('LiveAuditStrip stream health', () => {
  it('marks the feed connecting, live and offline, then reconnects', async () => {
    await mountStrip()

    expect(stateDot().className).toContain('bg-info')
    expect(srOnly()?.textContent).toBe('')

    await open(instanceAt(0))
    expect(stateDot().className).toContain('bg-primary')
    expect(stateDot().className).toContain('animate-pulse')
    expect(srOnly()?.textContent).toBe(' (otseülekanne)')

    await fail(instanceAt(0))
    expect(instanceAt(0).closed).toBe(true)
    expect(stateDot().className).toContain('bg-danger')
    expect(srOnly()?.textContent).toBe(' (taasühendab)')

    await act(async () => {
      await sleep(1100)
    })
    expect(EventSourceStub.instances).toHaveLength(2)
  })

  it('backfills lines missed while offline after reconnecting', async () => {
    auditMocks.fetchSealedCeremonyAuditAction.mockResolvedValue({
      ok: true,
      lines: [olderLine],
    })
    await mountStrip()
    const first = instanceAt(0)
    await open(first)
    expect(auditLines()).toHaveLength(1)
    expect(auditMocks.fetchSealedCeremonyAuditAction).toHaveBeenCalledTimes(1)

    await fail(first)
    auditMocks.fetchSealedCeremonyAuditAction.mockResolvedValue({
      ok: true,
      lines: [newerLine, olderLine],
    })
    await act(async () => {
      await sleep(1100)
    })
    await open(instanceAt(1))

    expect(auditMocks.fetchSealedCeremonyAuditAction).toHaveBeenCalledTimes(2)
    expect(auditLines()).toHaveLength(2)
    expect(auditLines()[0]?.textContent).toContain('Pakkumised paljastatud')
  })
})

describe('LiveAuditStrip sealed-event refresh', () => {
  it('refetches on a sealed-relevant event for this auction', async () => {
    auditMocks.fetchSealedCeremonyAuditAction.mockResolvedValue({
      ok: true,
      lines: [olderLine],
    })
    await mountStrip()
    await open(instanceAt(0))
    expect(auditLines()).toHaveLength(1)

    auditMocks.fetchSealedCeremonyAuditAction.mockResolvedValue({
      ok: true,
      lines: [newerLine, olderLine],
    })
    await act(async () => {
      instanceAt(0).emit('bid:created', JSON.stringify({ auctionId: 'auction-1' }))
      await sleep(450)
    })

    expect(auditMocks.fetchSealedCeremonyAuditAction).toHaveBeenCalledTimes(2)
    expect(auditMocks.fetchSealedCeremonyAuditAction).toHaveBeenNthCalledWith(
      1,
      'auction-1',
    )
    expect(auditMocks.fetchSealedCeremonyAuditAction).toHaveBeenNthCalledWith(
      2,
      'auction-1',
    )
    expect(auditLines()).toHaveLength(2)
    expect(auditLines()[0]?.textContent).toContain('Pakkumised paljastatud')
  })

  it('ignores foreign-auction events and malformed frames', async () => {
    await mountStrip()
    await open(instanceAt(0))

    instanceAt(0).emit('bid:created', JSON.stringify({ auctionId: 'other-auction' }))
    instanceAt(0).emit('auction:ended', '{not json')
    await act(async () => {
      await sleep(450)
    })

    expect(auditMocks.fetchSealedCeremonyAuditAction).toHaveBeenCalledTimes(1)
  })
})
