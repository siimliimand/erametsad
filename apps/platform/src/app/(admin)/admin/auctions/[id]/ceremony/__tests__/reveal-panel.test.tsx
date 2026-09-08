// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ToastProvider } from '../../../../../_components/ui/Toast'
import { RevealPanel } from '../_components/reveal-panel'

const navMocks = vi.hoisted(() => ({
  refresh: vi.fn(),
}))

const actionMocks = vi.hoisted(() => ({
  revealSealedBidsAction: vi.fn(),
}))

vi.mock('next/navigation', () => {
  const router = { refresh: navMocks.refresh }
  return { useRouter: () => router }
})

vi.mock('../../../../../_actions/auctions', () => ({
  revealSealedBidsAction: actionMocks.revealSealedBidsAction,
}))

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

type PanelProps = Parameters<typeof RevealPanel>[0]

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

const pastRevealAllowedAt = (): string => new Date(Date.now() - 5000).toISOString()

const futureRevealAllowedAt = (): string => new Date(Date.now() + 30000).toISOString()

const baseProps: PanelProps = {
  auctionId: 'auction-1',
  revealAllowedAt: pastRevealAllowedAt(),
  signaturesExpired: false,
}

let container: HTMLDivElement
let root: Root

async function mountPanel(props: PanelProps): Promise<void> {
  await act(async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    root.render(
      createElement(ToastProvider, null, createElement(RevealPanel, props)),
    )
    await Promise.resolve()
  })
}

async function unmountPanel(): Promise<void> {
  await act(async () => {
    root.unmount()
    await Promise.resolve()
  })
  container.remove()
}

afterEach(async () => {
  await unmountPanel()
  vi.clearAllMocks()
})

function bodyText(): string {
  return container.textContent
}

function revealTrigger(): HTMLButtonElement {
  const button = [...container.querySelectorAll('button')].find(
    (candidate) => candidate.textContent === 'Paljasta pakkumised',
  )
  if (button === undefined) throw new Error('reveal trigger not found')
  return button
}

function revealTable(): HTMLTableElement {
  const table = container.querySelector('table')
  if (table === null) throw new Error('reveal table not found')
  return table
}

function placeholderRows(): HTMLTableRowElement[] {
  return [...container.querySelectorAll<HTMLTableRowElement>('tbody tr')]
}

function revealVeil(): HTMLElement | null {
  const veil = [...container.querySelectorAll<HTMLElement>('div')].find((candidate) =>
    candidate.className.includes('absolute inset-0'),
  )
  return veil ?? null
}

function revealDialog(): HTMLElement {
  const dialog = container.querySelector<HTMLElement>('[role="dialog"]')
  if (dialog === null) throw new Error('reveal dialog not found')
  return dialog
}

function dialogButton(label: string): HTMLButtonElement {
  const button = [...revealDialog().querySelectorAll('button')].find(
    (candidate) => candidate.textContent === label,
  )
  if (button === undefined) throw new Error(`dialog button ${label} not found`)
  return button
}

function toastRegion(): HTMLElement {
  const status = container.querySelector<HTMLElement>('[role="status"]')
  if (status === null) throw new Error('toast region not found')
  return status
}

async function click(element: HTMLElement): Promise<void> {
  await act(async () => {
    element.click()
    await Promise.resolve()
  })
}

async function submitDialogForm(): Promise<void> {
  const form = revealDialog().querySelector('form')
  if (form === null) throw new Error('reveal form not found')
  await act(async () => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await sleep(20)
  })
}

describe('RevealPanel pre-reveal presentation', () => {
  it('blurs the masked placeholder table under the veil before the reveal', async () => {
    await mountPanel(baseProps)

    const table = revealTable()
    expect(table.getAttribute('aria-hidden')).toBe('true')
    expect(table.className).toContain('blur-[6px]')
    expect(table.className).toContain('pointer-events-none')
    expect(table.className).toContain('select-none')
    expect(table.className).toContain('motion-reduce:blur-none')

    const veil = revealVeil()
    if (veil === null) throw new Error('pre-reveal veil not found')
    expect(veil.textContent).toContain('Kõik pakkumised on krüpteeritud')
  })

  it('hides placeholder rows and staggers their reveal delays', async () => {
    await mountPanel(baseProps)

    const rows = placeholderRows()
    expect(rows).toHaveLength(4)
    expect(rows.map((row) => row.style.transitionDelay)).toEqual([
      '0s',
      '0.18s',
      '0.36s',
      '0.54s',
    ])
    for (const row of rows) {
      expect(row.className).toContain('opacity-0')
      expect(row.className).toContain('translate-y-[6px]')
      // Reduced-motion fallback is class-level: the motion-reduce media
      // query in CSS disables the blur, the shift and the stagger when
      // matchMedia reports reduce.
      expect(row.className).toContain('motion-reduce:opacity-100')
      expect(row.className).toContain('motion-reduce:transition-none')
      expect(row.className).toContain('motion-reduce:[transition-delay:0s]')
    }
  })
})

describe('RevealPanel reveal event', () => {
  it('lifts the veil, reveals the staggered rows and toasts on success', async () => {
    actionMocks.revealSealedBidsAction.mockResolvedValue({
      ok: true,
      phase: 'revealed',
      error: null,
    })
    await mountPanel(baseProps)

    await click(revealTrigger())
    await submitDialogForm()

    expect(container.querySelector('[role="dialog"]')).toBeNull()

    const table = revealTable()
    expect(table.className).not.toContain('blur-[6px]')
    expect(table.className).not.toContain('pointer-events-none')
    expect(revealVeil()).toBeNull()

    const rows = placeholderRows()
    for (const row of rows) {
      expect(row.className).toContain('opacity-100')
      expect(row.className).not.toContain('opacity-0')
    }
    expect(rows.map((row) => row.style.transitionDelay)).toEqual([
      '0s',
      '0.18s',
      '0.36s',
      '0.54s',
    ])

    expect(toastRegion().textContent).toContain(
      'Pakkumised dekrüpteeritud ja paljastatud.',
    )
    expect(navMocks.refresh).toHaveBeenCalledTimes(1)
    expect(actionMocks.revealSealedBidsAction).toHaveBeenCalledTimes(1)
  })

  it('keeps the dialog open and shows an error toast on failure', async () => {
    actionMocks.revealSealedBidsAction.mockResolvedValue({
      ok: false,
      phase: 'awaiting-approval',
      error: 'Dekrüpteerimine ebaõnnestus.',
    })
    await mountPanel(baseProps)

    await click(revealTrigger())
    await submitDialogForm()

    expect(container.querySelector('[role="dialog"]')).not.toBeNull()
    expect(toastRegion().textContent).toContain('Paljastamine ebaõnnestus')
    expect(toastRegion().textContent).toContain('Dekrüpteerimine ebaõnnestus.')
  })
})

describe('RevealPanel unlock gating', () => {
  it('locks the trigger during the 60-second grace and shows the countdown', async () => {
    await mountPanel({ ...baseProps, revealAllowedAt: futureRevealAllowedAt() })

    expect(revealTrigger().disabled).toBe(true)
    expect(bodyText()).toMatch(
      /Paljastus avaneb 60 sekundit pärast oksjoni lõppu \(0:(29|30)\)\./,
    )
  })

  it('unlocks the trigger once revealAllowedAt has passed', async () => {
    await mountPanel(baseProps)

    expect(revealTrigger().disabled).toBe(false)
  })

  it('stays locked without a reveal time', async () => {
    await mountPanel({ ...baseProps, revealAllowedAt: null })

    expect(revealTrigger().disabled).toBe(true)
    expect(bodyText()).toContain('Paljastus avaneb 60 sekundit pärast oksjoni lõppu.')
    expect(bodyText()).not.toContain('(0:')
  })

  it('keeps the reveal locked when signatures have expired', async () => {
    await mountPanel({ ...baseProps, signaturesExpired: true })

    expect(revealTrigger().disabled).toBe(true)
    expect(bodyText()).toContain('Allkirjad on aegunud')
  })
})

describe('RevealPanel confirm dialog', () => {
  it('warns about irreversibility with the dark danger confirm and supports cancel', async () => {
    await mountPanel(baseProps)

    await click(revealTrigger())
    expect(revealDialog().getAttribute('aria-label')).toBe('Paljasta pakkumised')
    expect(revealDialog().textContent).toContain('HOIATUS')
    expect(revealDialog().textContent).toContain('tagasivõtmatu')
    expect(revealDialog().querySelector('input[name="auctionId"]')).not.toBeNull()

    const confirm = dialogButton('Jah, paljasta lõplikult')
    expect(confirm.className).toContain('bg-danger')

    await click(dialogButton('Katkesta'))
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })
})
