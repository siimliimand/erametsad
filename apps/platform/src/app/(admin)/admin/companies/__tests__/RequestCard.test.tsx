// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { makeRequestCardData, makeSnapshot } from './fixtures'
import { RequestCard, type RequestCardData } from '../_components/RequestCard'

const actions = vi.hoisted(() => ({
  approve: vi.fn((_formData: FormData): Promise<void> => Promise.resolve()),
  reject: vi.fn((_formData: FormData): Promise<void> => Promise.resolve()),
  hold: vi.fn((_formData: FormData): Promise<void> => Promise.resolve()),
}))

vi.mock('@/app/(admin)/_actions/ops', () => ({
  approveCompanyAccessRequestAction: actions.approve,
  rejectCompanyAccessRequestAction: actions.reject,
  holdCompanyAccessRequestAction: actions.hold,
}))

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root

async function mountCard(data: RequestCardData, canWrite = true): Promise<void> {
  await act(async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    root.render(createElement(RequestCard, { data, canWrite }))
    await Promise.resolve()
  })
}

afterEach(() => {
  act(() => {
    root.unmount()
  })
  container.remove()
  // OverlayPortal renders into document.body, so portal residue needs a sweep.
  document.body.textContent = ''
  document.body.style.overflow = ''
  actions.approve.mockClear()
  actions.reject.mockClear()
  actions.hold.mockClear()
})

function dialog(): HTMLElement {
  const el = document.body.querySelector<HTMLElement>('[role="dialog"]')
  if (el === null) throw new Error('dialog not found')
  return el
}

function dialogCount(): number {
  return document.body.querySelectorAll('[role="dialog"]').length
}

function buttonByLabel(label: string, scope: ParentNode = document.body): HTMLButtonElement {
  const el = [...scope.querySelectorAll<HTMLButtonElement>('button')].find(
    (button) => button.textContent.trim() === label,
  )
  if (el === undefined) throw new Error(`button not found: ${label}`)
  return el
}

async function click(element: HTMLElement): Promise<void> {
  await act(async () => {
    element.click()
    await Promise.resolve()
  })
}

async function typeDialogTextarea(value: string): Promise<void> {
  const el = document.body.querySelector<HTMLTextAreaElement>('[role="dialog"] textarea')
  if (el === null) throw new Error('dialog textarea not found')
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(
      el,
      value,
    )
    el.dispatchEvent(new Event('input', { bubbles: true }))
    await Promise.resolve()
  })
}

/** Form actions resolve inside a transition; give the mock call a macrotask to land. */
async function flushActions(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

function postedFormData(mock: typeof actions.approve): FormData {
  const formData = mock.mock.calls[0]?.[0]
  if (!(formData instanceof FormData)) throw new Error('action did not receive FormData')
  return formData
}

function rightsInputValues(): string[] {
  return [
    ...document.body.querySelectorAll<HTMLInputElement>('[role="dialog"] input[name="rights"]'),
  ].map((input) => input.value)
}

async function toggleSwitch(label: string): Promise<void> {
  const box = [
    ...document.body.querySelectorAll<HTMLInputElement>('[role="dialog"] input[role="switch"]'),
  ].find((input) => input.getAttribute('aria-label') === label)
  if (box === undefined) throw new Error(`rights switch not found: ${label}`)
  await click(box)
}

describe('RequestCard decision flow', () => {
  it('renders no decision footer or dialogs without the write role', async () => {
    await mountCard(makeRequestCardData(), false)
    expect(container.querySelector('footer')).toBeNull()
    expect(container.textContent).not.toContain('Keeldu põhjusega')
    expect(dialogCount()).toBe(0)
  })

  it('submits the approve action with the request id from the rights modal', async () => {
    const data = makeRequestCardData()
    await mountCard(data)
    await click(buttonByLabel('Nõustu — Aktiveeri profiil'))
    expect(dialog().querySelector('h2')?.textContent).toBe('Nõustu — aktiveeri profiil')
    await click(buttonByLabel('Kinnita ja aktiveeri', dialog()))
    await flushActions()
    expect(actions.approve).toHaveBeenCalledTimes(1)
    expect(postedFormData(actions.approve).get('id')).toBe(data.request.id)
  })

  it('hides the approve path for a KUSTUTATUD company and keeps reject and hold', async () => {
    await mountCard(
      makeRequestCardData({ snapshot: makeSnapshot({ status: 'KUSTUTATUD' }) }),
    )
    expect(container.textContent).not.toContain('Nõustu — Aktiveeri profiil')
    expect(container.textContent).toContain('Ainult keeldumine on lubatud.')
    expect(container.textContent).toContain('Keeldu põhjusega')
    expect(container.textContent).toContain('Jäta ootele')
    expect(dialogCount()).toBe(0)
  })

  it('sends the reject reason through the confirmation dialog form', async () => {
    const data = makeRequestCardData()
    await mountCard(data)
    await click(buttonByLabel('Keeldu põhjusega'))
    await typeDialogTextarea('Taotlus ei vasta nõuetele')
    await click(buttonByLabel('Kinnita keeldumine', dialog()))
    await flushActions()
    expect(actions.reject).toHaveBeenCalledTimes(1)
    const formData = postedFormData(actions.reject)
    expect(formData.get('id')).toBe(data.request.id)
    expect(formData.get('reason')).toBe('Taotlus ei vasta nõuetele')
  })

  it('keeps the reject confirm disabled and the action uncalled while the reason is too short', async () => {
    await mountCard(makeRequestCardData())
    await click(buttonByLabel('Keeldu põhjusega'))
    await typeDialogTextarea('ei')
    const confirm = buttonByLabel('Kinnita keeldumine', dialog())
    expect(confirm.disabled).toBe(true)
    await click(confirm)
    await flushActions()
    expect(actions.reject).not.toHaveBeenCalled()
  })

  it('sends the required internal note with the hold action', async () => {
    const data = makeRequestCardData()
    await mountCard(data)
    await click(buttonByLabel('Jäta ootele'))
    await typeDialogTextarea('Ootab volikirja saatmist')
    await click(buttonByLabel('Jäta ootele', dialog()))
    await flushActions()
    expect(actions.hold).toHaveBeenCalledTimes(1)
    const formData = postedFormData(actions.hold)
    expect(formData.get('id')).toBe(data.request.id)
    expect(formData.get('note')).toBe('Ootab volikirja saatmist')
  })
})

describe('RequestCard wait badge', () => {
  it('labels a one-day wait in the singular', async () => {
    await mountCard(makeRequestCardData({ waitingDays: 1 }))
    expect(container.textContent).toContain('Oodanud 1 päev')
    expect(container.textContent).not.toContain('Oodanud 1 päeva')
  })

  it('labels a same-day wait with the plural form', async () => {
    await mountCard(makeRequestCardData({ waitingDays: 0 }))
    expect(container.textContent).toContain('Oodanud 0 päeva')
  })

  it('labels a long wait with the day count', async () => {
    await mountCard(makeRequestCardData({ waitingDays: 45 }))
    expect(container.textContent).toContain('Oodanud 45 päeva')
  })
})

describe('RequestCard rights modal capture', () => {
  it('defaults the rights selection to raieoigus and kinnistu', async () => {
    await mountCard(makeRequestCardData())
    await click(buttonByLabel('Nõustu — Aktiveeri profiil'))
    expect(rightsInputValues()).toEqual(['raieoigus', 'kinnistu'])
  })

  it('posts exactly the switched-on rights with the approve action', async () => {
    const data = makeRequestCardData()
    await mountCard(data)
    await click(buttonByLabel('Nõustu — Aktiveeri profiil'))
    await toggleSwitch('Kiire oksjon')
    await toggleSwitch('Raieõigus')
    await click(buttonByLabel('Kinnita ja aktiveeri', dialog()))
    await flushActions()
    expect(actions.approve).toHaveBeenCalledTimes(1)
    const formData = postedFormData(actions.approve)
    expect(formData.getAll('rights')).toEqual(['kinnistu', 'kiire'])
    expect(formData.get('id')).toBe(data.request.id)
    expect(formData.get('checkedRegistry')).toBe('on')
  })

  it('posts no rights when every switch is cleared', async () => {
    await mountCard(makeRequestCardData())
    await click(buttonByLabel('Nõustu — Aktiveeri profiil'))
    await toggleSwitch('Raieõigus')
    await toggleSwitch('Kinnistu')
    expect(rightsInputValues()).toEqual([])
    await click(buttonByLabel('Kinnita ja aktiveeri', dialog()))
    await flushActions()
    expect(postedFormData(actions.approve).getAll('rights')).toEqual([])
  })

  it('restores the default rights selection when the modal is reopened', async () => {
    await mountCard(makeRequestCardData())
    await click(buttonByLabel('Nõustu — Aktiveeri profiil'))
    await toggleSwitch('Raieõigus')
    await click(buttonByLabel('Tühista', dialog()))
    expect(dialogCount()).toBe(0)
    await click(buttonByLabel('Nõustu — Aktiveeri profiil'))
    expect(rightsInputValues()).toEqual(['raieoigus', 'kinnistu'])
  })

  it('omits the registry confirmation field while the checkbox is left unchecked', async () => {
    await mountCard(
      makeRequestCardData({
        snapshot: makeSnapshot({ verified: false }),
        boardCheck: { level: 'none', matchedName: null },
      }),
    )
    await click(buttonByLabel('Nõustu — Aktiveeri profiil'))
    const checkbox = dialog().querySelector<HTMLInputElement>('input[name="checkedRegistry"]')
    expect(checkbox?.checked).toBe(false)
    await click(buttonByLabel('Kinnita ja aktiveeri', dialog()))
    await flushActions()
    expect(postedFormData(actions.approve).get('checkedRegistry')).toBeNull()
  })
})
