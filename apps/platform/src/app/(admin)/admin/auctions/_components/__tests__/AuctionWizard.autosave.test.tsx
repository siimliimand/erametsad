// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AuctionWizard } from '../AuctionWizard'
import { serializeWizardDraft, wizardDraftKey } from '../wizard-model'
import type { AuctionWizardOptions } from '../wizard-model'
import { baseWizardState, createWizardInitial } from './fixtures'

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

async function mountWizard(): Promise<void> {
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
        initial: createWizardInitial,
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
})

afterEach(async () => {
  await unmountWizard()
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
