// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { EventSourceStub } from './ceremony-fixtures'
import type { SealedCeremonyChecklist } from '../../../../../_actions/auctions'
import {
  CeremonyChecklist,
  ceremonyChecklistPass,
} from '../_components/ceremony-checklist'

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

const passingChecklist: SealedCeremonyChecklist = {
  endingWorker: { done: true, key: 'end-key-1', endedAt: '2026-09-01T10:00:00Z' },
  pendingAlapakkumised: 0,
  template: {
    active: true,
    name: 'Raielepingu mall',
    version: 'v3',
    changedWithin24h: false,
  },
}

let container: HTMLDivElement
let root: Root | null = null

async function mountChecklist(checklist: SealedCeremonyChecklist): Promise<void> {
  await act(async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    root.render(createElement(CeremonyChecklist, { checklist }))
    await Promise.resolve()
  })
}

async function unmountChecklist(): Promise<void> {
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
  EventSourceStub.instances = []
  vi.stubGlobal('EventSource', EventSourceStub)
  auditMocks.fetchSealedCeremonyAuditAction.mockResolvedValue({ ok: true, lines: [] })
})

afterEach(async () => {
  await unmountChecklist()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('ceremonyChecklistPass', () => {
  it('passes only when every hard precondition holds', () => {
    expect(ceremonyChecklistPass(passingChecklist)).toBe(true)
  })

  it('fails while the ending worker has not confirmed the end time', () => {
    const checklist = {
      ...passingChecklist,
      endingWorker: { done: false, key: null, endedAt: null },
    }
    expect(ceremonyChecklistPass(checklist)).toBe(false)
  })

  it('fails while reserve bids are pending', () => {
    const checklist = { ...passingChecklist, pendingAlapakkumised: 2 }
    expect(ceremonyChecklistPass(checklist)).toBe(false)
  })

  it('fails without an active contract template', () => {
    const checklist = {
      ...passingChecklist,
      template: { ...passingChecklist.template, active: false },
    }
    expect(ceremonyChecklistPass(checklist)).toBe(false)
  })
})

describe('CeremonyChecklist rendering', () => {
  it('renders passing preconditions with check marks and details', async () => {
    await mountChecklist(passingChecklist)

    expect(container.querySelectorAll('li')).toHaveLength(3)
    const text = container.textContent
    expect(text).toContain('✓')
    expect(text).not.toContain('✗')
    expect(text).toContain('Lõppaeg on kinnitatud')
    expect(text).toContain('Lõpetustöötlus tehtud (idempotentsusvõti: end-key-1)')
    expect(text).toContain('Ootel alapakkumised')
    expect(text).toContain('Puuduvad')
    expect(text).toContain('Aktiivne lepingu mall')
    expect(text).toContain('Raielepingu mall (v3)')
    expect(text).not.toContain('Malli on muudetud')
  })

  it('marks failing preconditions with the cross and decision guidance', async () => {
    await mountChecklist({ ...passingChecklist, pendingAlapakkumised: 2 })

    const text = container.textContent
    expect(text).toContain('✗')
    expect(text).toContain('Ootel: 2 — otsusta alapakkumised enne avamist')
  })

  it('warns when the contract template changed within 24 hours', async () => {
    await mountChecklist({
      ...passingChecklist,
      template: { ...passingChecklist.template, changedWithin24h: true },
    })

    expect(container.textContent).toContain(
      'Malli on muudetud 24 tunni jooksul oksjoni alguse ümber — kontrolli versiooni enne allkirja.',
    )
  })

  it('embeds the live audit strip for the ceremony', async () => {
    await mountChecklist(passingChecklist)

    const strip = container.querySelector('section[aria-label="Reaalajas auditlogi"]')
    if (strip === null) throw new Error('live audit strip not found')
    expect(container.textContent).toContain(
      'Pitseeritud avamise auditikirjeid veel ei ole.',
    )
    expect(EventSourceStub.instances).toHaveLength(1)
    expect(EventSourceStub.instances[0]?.url).toBe(
      '/api/v1/auctions/stream?auction=auction-1',
    )
  })
})
