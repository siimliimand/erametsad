// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AuctionWizard } from '../AuctionWizard'
import { emptyPackageRow, serializeWizardDraft, wizardDraftKey } from '../wizard-model'
import type { AuctionWizardInitial, AuctionWizardOptions } from '../wizard-model'
import { baseWizardState, createWizardInitial } from './fixtures'

const { autosaveActionMock } = vi.hoisted(() => ({
  autosaveActionMock: vi.fn(),
}))

vi.mock('../../../../_actions/auctions', () => ({
  autosaveAuctionDraftAction: autosaveActionMock,
}))

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

const wizardOptions: AuctionWizardOptions = {
  counties: [],
  parishes: [],
  specialists: [],
  antiSnipeDefaultMinutes: 5,
  defaultFeePercent: 3,
  canFeeOverride: true,
  canReassignSpecialist: true,
}

const submitAction = vi.fn((): Promise<void> => Promise.resolve())

let container: HTMLDivElement
let root: Root

async function mountWizard(
  initial: AuctionWizardInitial = createWizardInitial,
): Promise<void> {
  await act(async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    root.render(
      createElement(AuctionWizard, {
        action: submitAction,
        submitLabel: 'Salvesta',
        cancelHref: '/admin/auctions',
        options: wizardOptions,
        initial,
      }),
    )
    await Promise.resolve()
  })
}

async function unmountWizard(): Promise<void> {
  await act(async () => {
    root.unmount()
    await Promise.resolve()
  })
  container.remove()
}

beforeEach(() => {
  window.localStorage.clear()
  submitAction.mockClear()
  autosaveActionMock.mockReset()
})

afterEach(async () => {
  await unmountWizard()
  vi.useRealTimers()
})

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

function statusText(): string {
  const status = container.querySelector<HTMLElement>('[role="status"]')
  if (status === null) throw new Error('autosave status not found')
  return status.textContent
}

function draftRaw(): string | null {
  return window.localStorage.getItem(wizardDraftKey(null))
}

function seededDraftRaw(): string {
  return serializeWizardDraft(
    { ...baseWizardState, title: 'Mustandi pealkiri' },
    new Date('2026-09-01T09:30:00Z'),
  )
}

async function setMinutesInput(value: string): Promise<void> {
  const input = document.getElementById(
    'wizard-antisnipe-minutes',
  ) as HTMLInputElement | null
  if (input === null) throw new Error('anti-snipe minutes input not found')
  await act(async () => {
    // The native prototype setter bypasses React's value tracker so the
    // controlled input sees the change.
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(
      input,
      value,
    )
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await Promise.resolve()
  })
}

function fireBeforeUnload(): boolean {
  const event = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(event)
  return event.defaultPrevented
}

function wizardDialog(): HTMLElement | null {
  return document.body.querySelector<HTMLElement>('[role="dialog"]')
}

async function clickDialogButton(label: string): Promise<void> {
  const dialog = wizardDialog()
  if (dialog === null) throw new Error('restore dialog not found')
  const button = [...dialog.querySelectorAll<HTMLButtonElement>('button')].find(
    (candidate) => candidate.textContent.includes(label),
  )
  if (button === undefined) throw new Error(`dialog button ${label} not found`)
  await act(async () => {
    button.click()
    await Promise.resolve()
  })
}

async function clickElement(element: HTMLElement): Promise<void> {
  await act(async () => {
    element.click()
    await Promise.resolve()
  })
}

function railStepButton(label: string): HTMLButtonElement {
  const nav = container.querySelector<HTMLElement>('nav[aria-label="Koostamise sammud"]')
  if (nav === null) throw new Error('wizard rail not found')
  const row = [...nav.querySelectorAll<HTMLButtonElement>('button')].find(
    (candidate) => candidate.textContent.includes(label),
  )
  if (row === undefined) throw new Error(`rail step ${label} not found`)
  return row
}

async function typeEditorHtml(label: string, html: string): Promise<void> {
  const editor = container.querySelector<HTMLElement>(
    `[role="textbox"][aria-label="${label}"]`,
  )
  if (editor === null) throw new Error(`editor ${label} not found`)
  await act(async () => {
    editor.innerHTML = html
    editor.dispatchEvent(new Event('input', { bubbles: true }))
    await Promise.resolve()
  })
}

function storedDraftState(): Record<string, unknown> {
  const raw = draftRaw()
  if (raw === null) throw new Error('draft was not written')
  return (JSON.parse(raw) as { state: Record<string, unknown> }).state
}

describe('AuctionWizard draft autosave', () => {
  it('starts idle and writes nothing to storage on mount', async () => {
    await mountWizard()
    expect(statusText()).toContain('Pole veel salvestatud')
    expect(draftRaw()).toBeNull()
  })

  it('writes the debounced draft on change and reports saved', async () => {
    await mountWizard()
    await setMinutesInput('9')

    expect(statusText()).toContain('Salvestan')

    await act(async () => {
      await sleep(950)
    })

    const raw = draftRaw()
    if (raw === null) throw new Error('draft was not written')
    const draft = JSON.parse(raw) as {
      version: number
      state: { antiSnipeMinutes: string; title: string }
      savedAt: string
    }
    expect(draft.version).toBe(1)
    expect(draft.state.antiSnipeMinutes).toBe('9')
    expect(draft.state.title).toBe('Harjumaa raieõigus')
    expect(Number.isNaN(Date.parse(draft.savedAt))).toBe(false)
    expect(statusText()).toContain('Salvestatud')
  })
})

describe('AuctionWizard unload guard', () => {
  it('prevents unload only while the draft is dirty', async () => {
    await mountWizard()
    expect(fireBeforeUnload()).toBe(false)

    await setMinutesInput('9')
    expect(fireBeforeUnload()).toBe(true)

    await act(async () => {
      await sleep(950)
    })
    expect(fireBeforeUnload()).toBe(false)
  })
})

describe('AuctionWizard restore prompt', () => {
  it('offers a differing stored draft and deletes it on discard', async () => {
    window.localStorage.setItem(wizardDraftKey(null), seededDraftRaw())
    await mountWizard()

    expect(wizardDialog()?.textContent).toContain('Taasta mustand?')

    await clickDialogButton('Kustuta mustand')
    expect(draftRaw()).toBeNull()
    expect(wizardDialog()).toBeNull()
  })

  it('applies the draft state on restore', async () => {
    window.localStorage.setItem(wizardDraftKey(null), seededDraftRaw())
    await mountWizard()

    await clickDialogButton('Taasta')
    expect(wizardDialog()).toBeNull()
    expect(container.querySelector('header h2')?.textContent).toContain(
      'Mustandi pealkiri',
    )
  })

  it('stays silent when the stored draft matches the server state', async () => {
    const identical = serializeWizardDraft(baseWizardState, new Date())
    window.localStorage.setItem(wizardDraftKey(null), identical)
    await mountWizard()

    expect(wizardDialog()).toBeNull()
    expect(statusText()).toContain('Pole veel salvestatud')
    expect(draftRaw()).toBe(identical)
  })
})

describe('AuctionWizard rich text adoption', () => {
  it('edits the Sisu copy blocks in the rich text editor and autosaves sanitized HTML', async () => {
    await mountWizard()

    await clickElement(railStepButton('Sisu'))
    const publicEditor = container.querySelector<HTMLElement>(
      '[role="textbox"][aria-label="Avalik info"]',
    )
    if (publicEditor === null) throw new Error('Avalik info editor not found')
    expect(publicEditor.textContent).toContain('Avalik info')

    await typeEditorHtml(
      'Avalik info',
      '<p>Rikas <strong>sisu</strong></p><script>alert(1)</script>',
    )
    await act(async () => {
      await sleep(950)
    })

    const state = storedDraftState()
    expect(state.descriptionPublic).toBe('<p>Rikas <strong>sisu</strong></p>')
    expect(state.descriptionSecondary).toBe('Täiendav info')
  })

  it('edits the pakett description in the rich text editor for package lots', async () => {
    await mountWizard({
      ...createWizardInitial,
      state: {
        ...baseWizardState,
        objectType: 'pakett',
        propertyCount: 2,
        packageRows: [{ ...emptyPackageRow(), cadastre: '34801:001:0217' }],
      },
    })

    await clickElement(railStepButton('Pakett'))
    const headerEditor = container.querySelector<HTMLElement>(
      '[role="textbox"][aria-label="Paketi kirjeldus"]',
    )
    if (headerEditor === null) throw new Error('Paketi kirjeldus editor not found')

    await typeEditorHtml('Paketi kirjeldus', '<p>Paketi info</p>')
    await act(async () => {
      await sleep(950)
    })

    expect(storedDraftState().packageHeader).toBe('<p>Paketi info</p>')
  })
})

// ── Server autosave (task 5.6) ──────────────────────────────────────────────

const existingLotInitial: AuctionWizardInitial = {
  ...createWizardInitial,
  auctionId: 'a1b2c3d4-0000-0000-0000-000000000001',
  updatedAt: '2026-09-01T08:00:00.000Z',
}

function autosaveArgs(): [string, string, string | null] {
  const call = autosaveActionMock.mock.calls[0]
  if (call === undefined) throw new Error('autosave was not called')
  return call as [string, string, string | null]
}

async function advanceTimers(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

async function fireBlur(input: HTMLInputElement): Promise<void> {
  await act(async () => {
    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    await Promise.resolve()
  })
}

describe('AuctionWizard server autosave', () => {
  it('saves to the server after 10 s idle and reports Salvestatud HH:MM', async () => {
    vi.useFakeTimers()
    autosaveActionMock.mockResolvedValue({
      ok: true,
      conflict: false,
      savedAt: '2026-09-09T10:00:00.000Z',
      updatedAt: '2026-09-09T09:59:00.000Z',
      error: null,
    })
    await mountWizard(existingLotInitial)
    expect(autosaveActionMock).not.toHaveBeenCalled()

    await setMinutesInput('9')
    await advanceTimers(9_000)
    expect(autosaveActionMock).not.toHaveBeenCalled()

    await advanceTimers(1_000)
    expect(autosaveActionMock).toHaveBeenCalledTimes(1)
    const [id, payloadJson, baseUpdatedAt] = autosaveArgs()
    expect(id).toBe('a1b2c3d4-0000-0000-0000-000000000001')
    const payload = JSON.parse(payloadJson) as {
      title: string
      deadlines: { antiSnipeMinutes?: number }
    }
    expect(payload.title).toBe('Harjumaa raieõigus')
    expect(payload.deadlines.antiSnipeMinutes).toBe(9)
    expect(baseUpdatedAt).toBe('2026-09-01T08:00:00.000Z')
    expect(statusText()).toContain('Salvestatud')
    expect(statusText()).toContain('13:00')
  })

  it('flushes a pending save on blur', async () => {
    vi.useFakeTimers()
    autosaveActionMock.mockResolvedValue({
      ok: true,
      conflict: false,
      savedAt: '2026-09-09T10:00:00.000Z',
      updatedAt: '2026-09-09T09:59:00.000Z',
      error: null,
    })
    await mountWizard(existingLotInitial)
    await setMinutesInput('9')

    const input = document.getElementById(
      'wizard-antisnipe-minutes',
    ) as HTMLInputElement | null
    if (input === null) throw new Error('anti-snipe minutes input not found')
    await fireBlur(input)
    expect(autosaveActionMock).toHaveBeenCalledTimes(1)
  })

  it('flushes a pending save on step change', async () => {
    vi.useFakeTimers()
    autosaveActionMock.mockResolvedValue({
      ok: true,
      conflict: false,
      savedAt: '2026-09-09T10:00:00.000Z',
      updatedAt: '2026-09-09T09:59:00.000Z',
      error: null,
    })
    await mountWizard(existingLotInitial)
    await setMinutesInput('9')

    await clickElement(railStepButton('Sisu'))
    expect(autosaveActionMock).toHaveBeenCalledTimes(1)

    await advanceTimers(10_000)
    expect(autosaveActionMock).toHaveBeenCalledTimes(1)
  })

  it('adopts the server updatedAt when no base is known, then sends it as base', async () => {
    vi.useFakeTimers()
    autosaveActionMock
      .mockResolvedValueOnce({
        ok: true,
        conflict: false,
        savedAt: '2026-09-09T10:00:00.000Z',
        updatedAt: '2026-09-09T09:59:00.000Z',
        error: null,
      })
      .mockResolvedValueOnce({
        ok: true,
        conflict: false,
        savedAt: '2026-09-09T10:05:00.000Z',
        updatedAt: '2026-09-09T10:04:00.000Z',
        error: null,
      })
    // No known base: the lot's initial carries no updatedAt at all.
    const { updatedAt: _omitted, ...withoutBase } = existingLotInitial
    await mountWizard(withoutBase)
    await setMinutesInput('9')
    await advanceTimers(10_000)
    expect(autosaveArgs()[2]).toBeNull()

    await setMinutesInput('11')
    await advanceTimers(10_000)
    const secondCall = autosaveActionMock.mock.calls[1]
    if (secondCall === undefined) throw new Error('second autosave was not called')
    expect(secondCall[2]).toBe('2026-09-09T09:59:00.000Z')
  })
})

describe('AuctionWizard conflict banner', () => {
  function stubReload(): { reload: ReturnType<typeof vi.fn> } {
    const reload = vi.fn()
    Object.defineProperty(window, 'location', {
      value: { href: 'http://localhost/admin/auctions/x/edit', reload },
      configurable: true,
      writable: true,
    })
    return { reload }
  }

  function conflictBanner(): HTMLElement | null {
    return container.querySelector<HTMLElement>('[role="alert"]')
  }

  it('shows the banner on a conflict and pauses autosave until takeover', async () => {
    vi.useFakeTimers()
    const location = stubReload()
    autosaveActionMock.mockResolvedValue({
      ok: false,
      conflict: true,
      savedAt: null,
      updatedAt: '2026-09-09T09:59:00.000Z',
      error: 'Mustand on vahepeal serveris uuendatud.',
    })
    await mountWizard(existingLotInitial)
    await setMinutesInput('9')
    await advanceTimers(10_000)

    const banner = conflictBanner()
    if (banner === null) throw new Error('conflict banner not found')
    expect(banner.textContent).toContain('serverisse salvestanud')

    // Editing continues locally, but the server save stays paused.
    await setMinutesInput('11')
    await advanceTimers(10_000)
    expect(autosaveActionMock).toHaveBeenCalledTimes(1)

    const takeOver = [...banner.querySelectorAll<HTMLButtonElement>('button')].find(
      (candidate) => candidate.textContent === 'Võta üle',
    )
    if (takeOver === undefined) throw new Error('take-over button not found')
    await clickElement(takeOver)
    expect(location.reload).toHaveBeenCalledTimes(1)
  })
})
