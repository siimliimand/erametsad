// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { EventSourceStub } from './ceremony-fixtures'
import type {
  SealedCeremonyActionState,
  SealedCeremonyChecklist,
} from '../../../../../_actions/auctions'
import { ToastProvider } from '../../../../../_components/ui/Toast'
import {
  CeremonyChecklist,
  CeremonyUnsoldShortcut,
  ceremonyChecklistPass,
} from '../_components/ceremony-checklist'

const auditMocks = vi.hoisted(() => ({
  fetchSealedCeremonyAuditAction: vi.fn(),
}))

const shortcutMocks = vi.hoisted(() => ({
  markSealedUnsoldShortcutAction: vi.fn(),
  refresh: vi.fn(),
}))

vi.mock('next/navigation', () => {
  const router = { refresh: shortcutMocks.refresh }
  return {
    useParams: () => ({ id: 'auction-1' }),
    useRouter: () => router,
  }
})

vi.mock('../_lib/fetch-sealed-audit', () => ({
  fetchSealedCeremonyAuditAction: auditMocks.fetchSealedCeremonyAuditAction,
}))

vi.mock('../../../../../_actions/auctions', () => ({
  markSealedUnsoldShortcutAction: shortcutMocks.markSealedUnsoldShortcutAction,
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

describe('CeremonyUnsoldShortcut (empty-lot müümata)', () => {
  const shortcutState = (overrides: Partial<SealedCeremonyActionState> = {}): SealedCeremonyActionState => ({
    ok: false,
    phase: 'checklist',
    error: null,
    ...overrides,
  })

  async function typeReason(text: string): Promise<void> {
    const textarea = container.querySelector<HTMLTextAreaElement>('textarea[name="reason"]')
    if (textarea === null) throw new Error('reason textarea not found')
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(textarea, text)
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
      await Promise.resolve()
    })
  }

  async function submitShortcutForm(): Promise<void> {
    const form = container.querySelector('[role="dialog"] form')
    if (form === null) throw new Error('shortcut form not found')
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
      await Promise.resolve()
    })
  }

  async function mountShortcut(): Promise<void> {
    await act(async () => {
      container = document.createElement('div')
      document.body.appendChild(container)
      root = createRoot(container)
      root.render(
        createElement(ToastProvider, null, createElement(CeremonyUnsoldShortcut, { auctionId: 'auction-1' })),
      )
      await Promise.resolve()
    })
  }

  it('explains the shortcut and opens the confirm dialog', async () => {
    await mountShortcut()

    expect(container.textContent).toContain('Müümata otsetee')
    expect(container.textContent).toContain('ei ole ühtki kehtivat pakkumist')

    const trigger = [...container.querySelectorAll('button')].find(
      (candidate) => candidate.textContent === 'Märgi müümata',
    )
    if (trigger === undefined) throw new Error('shortcut trigger not found')
    await clickShortcutTrigger(trigger)

    const dialog = container.querySelector('[role="dialog"]')
    expect(dialog).not.toBeNull()
    expect(dialog?.textContent).toContain('HOIATUS')
  })

  it('keeps the submit locked until the reason reaches 5 characters', async () => {
    await mountShortcut()
    await clickShortcutTrigger(findTrigger())

    const submitBefore = shortcutSubmitButton()
    expect(submitBefore.disabled).toBe(true)

    await typeReason('ei')
    expect(shortcutSubmitButton().disabled).toBe(true)

    await typeReason('pole kehtivaid pakkumisi')
    expect(shortcutSubmitButton().disabled).toBe(false)
  })

  it('submits the reason, toasts success and refreshes', async () => {
    shortcutMocks.markSealedUnsoldShortcutAction.mockResolvedValue(
      shortcutState({ ok: true, phase: 'unsold' }),
    )
    await mountShortcut()
    await clickShortcutTrigger(findTrigger())
    await typeReason('pole kehtivaid pakkumisi')
    await submitShortcutForm()

    expect(shortcutMocks.markSealedUnsoldShortcutAction).toHaveBeenCalledTimes(1)
    const formData = shortcutMocks.markSealedUnsoldShortcutAction.mock.calls[0]?.[1] as FormData
    expect(formData.get('auctionId')).toBe('auction-1')
    expect(formData.get('reason')).toBe('pole kehtivaid pakkumisi')
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      'Oksjon kuulutatud müümata',
    )
    expect(shortcutMocks.refresh).toHaveBeenCalledTimes(1)
  })

  it('toasts the server error and keeps the dialog open', async () => {
    shortcutMocks.markSealedUnsoldShortcutAction.mockResolvedValue(
      shortcutState({ error: 'Oksjonil on kehtivaid pakkumisi — tulemus otsustakse avamistseremoonial.' }),
    )
    await mountShortcut()
    await clickShortcutTrigger(findTrigger())
    await typeReason('pole kehtivaid pakkumisi')
    await submitShortcutForm()

    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      'Müümata märkimine ebaõnnestus',
    )
    expect(container.querySelector('[role="dialog"]')).not.toBeNull()
  })
})

function findTrigger(): HTMLButtonElement {
  const trigger = [...container.querySelectorAll('button')].find(
    (candidate) => candidate.textContent === 'Märgi müümata',
  )
  if (trigger === undefined) throw new Error('shortcut trigger not found')
  return trigger
}

async function clickShortcutTrigger(trigger: HTMLButtonElement): Promise<void> {
  await act(async () => {
    trigger.click()
    await Promise.resolve()
  })
}

function shortcutSubmitButton(): HTMLButtonElement {
  const dialog = container.querySelector('[role="dialog"]')
  if (dialog === null) throw new Error('shortcut dialog not found')
  const button = [...dialog.querySelectorAll('button')].find(
    (candidate) => candidate.textContent === 'Kinnita müümata' || candidate.textContent === 'Kinnitan…',
  )
  if (button === undefined) throw new Error('shortcut submit not found')
  return button
}
