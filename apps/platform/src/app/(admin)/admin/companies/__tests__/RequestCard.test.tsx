// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { makeRequest, makeRequestCardData, makeSnapshot } from './fixtures'
import { RequestCard, type RequestCardData } from '../_components/RequestCard'

const actions = vi.hoisted(() => ({
  approve: vi.fn((_formData: FormData): Promise<void> => Promise.resolve()),
  reject: vi.fn((_formData: FormData): Promise<void> => Promise.resolve()),
  hold: vi.fn((_formData: FormData): Promise<void> => Promise.resolve()),
  recheck: vi.fn((_formData: FormData): Promise<void> => Promise.resolve()),
}))

vi.mock('@/app/(admin)/_actions/ops', () => ({
  approveCompanyAccessRequestAction: actions.approve,
  rejectCompanyAccessRequestAction: actions.reject,
  holdCompanyAccessRequestAction: actions.hold,
  registryRecheckAction: actions.recheck,
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
  actions.recheck.mockClear()
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

/** jsdom runs constraint validation on programmatic submits; the volikiri
 * file input's internal FileList cannot be seeded, so tests bypass it with a
 * manual submit dispatch (React still receives the event and the FormData). */
async function submitDialogForm(): Promise<void> {
  const form = dialog().querySelector('form')
  if (!form) throw new Error('dialog form not found')
  await act(async () => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

describe('RequestCard SLA chip', () => {
  it('labels the wait with the spec format and stays neutral within 2 days', async () => {
    await mountCard(makeRequestCardData({ waitingDays: 2 }))
    expect(container.textContent).toContain('oodatud 2 p')
    const chip = container.querySelector('[title^="Taotluse ooteaeg"]')
    expect(chip?.className).toContain('bg-bg-mist')
    expect(chip?.className).not.toContain('bg-danger-light')
  })

  it('goes amber after 2 days', async () => {
    await mountCard(makeRequestCardData({ waitingDays: 3 }))
    expect(container.textContent).toContain('oodatud 3 p')
    const amber = container.querySelector('[title^="Taotluse ooteaeg"]')
    expect(amber?.className).toContain('bg-[var(--st-ended-bg)]')
  })

  it('goes red after 5 days', async () => {
    await mountCard(makeRequestCardData({ waitingDays: 6 }))
    const red = container.querySelector('[title^="Taotluse ooteaeg"]')
    expect(red?.className).toContain('bg-danger-light')
  })

  it('labels a one-day wait and a long wait with the day count', async () => {
    await mountCard(makeRequestCardData({ waitingDays: 1 }))
    expect(container.textContent).toContain('oodatud 1 p')

    await mountCard(makeRequestCardData({ waitingDays: 45 }))
    expect(container.textContent).toContain('oodatud 45 p')
  })
})

describe('RequestCard registry panel fields', () => {
  it('shows the asukoht and KMKR nr values from the snapshot', async () => {
    await mountCard(makeRequestCardData())
    expect(container.textContent).toContain('Asukoht')
    expect(container.textContent).toContain('Pärnu mnt 12, Tartu')
    expect(container.textContent).toContain('KMKR nr')
    expect(container.textContent).toContain('EE101234567')
  })

  it('renders a dash for both fields when the snapshot carries none', async () => {
    await mountCard(
      makeRequestCardData({ snapshot: makeSnapshot({ address: null, kmkrNr: null }) }),
    )
    const dl = container.querySelector('dl')
    expect(dl?.textContent).toContain('Asukoht')
    expect(dl?.textContent).toContain('KMKR nr')
    const rows = [...(dl?.querySelectorAll('div') ?? [])]
    const addressRow = rows.find((row) => row.textContent.startsWith('Asukoht'))
    const kmkrRow = rows.find((row) => row.textContent.startsWith('KMKR nr'))
    expect(addressRow?.textContent).toContain('—')
    expect(kmkrRow?.textContent).toContain('—')
  })
})

describe('RequestCard name discrepancy block', () => {
  it('shows an amber side-by-side comparison when the names differ', async () => {
    await mountCard(
      makeRequestCardData({
        snapshot: makeSnapshot({ legalName: 'Metsatark OÜ' }),
      }),
    )
    expect(container.textContent).toContain('Nime erinevus')
    expect(container.textContent).toContain('Taotleja sisestus')
    expect(container.textContent).toContain('Äriregister')
    expect(container.textContent).toContain('Mari Mets OÜ')
    expect(container.textContent).toContain('Metsatark OÜ')
  })

  it('shows no discrepancy block when the names match', async () => {
    await mountCard(makeRequestCardData())
    expect(container.textContent).not.toContain('Nime erinevus')
  })

  it('shows no discrepancy block for an unverified lookup', async () => {
    await mountCard(
      makeRequestCardData({
        snapshot: makeSnapshot({ legalName: 'Metsatark OÜ', verified: false }),
      }),
    )
    expect(container.textContent).not.toContain('Nime erinevus')
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
    const justification = dialog().querySelector<HTMLTextAreaElement>('textarea[name="justification"]')
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(
        justification,
        'Taotleja on volitatud juhatuse poolt',
      )
      justification?.dispatchEvent(new Event('input', { bubbles: true }))
      await Promise.resolve()
    })
    const fileInput = dialog().querySelector<HTMLInputElement>('input[name="volikiri"]')
    await act(async () => {
      Object.defineProperty(fileInput, 'files', { value: [new File(['x'], 'volikiri.pdf')] })
      fileInput?.dispatchEvent(new Event('change', { bubbles: true }))
      await Promise.resolve()
    })
    const checkbox = dialog().querySelector<HTMLInputElement>('input[name="checkedRegistry"]')
    expect(checkbox?.checked).toBe(false)
    await submitDialogForm()
    expect(postedFormData(actions.approve).get('checkedRegistry')).toBeNull()
  })

  it('uses the rights defaults passed from Seaded via the page', async () => {
    await mountCard(makeRequestCardData({ defaultRights: ['kiire', 'pakett'] }))
    await click(buttonByLabel('Nõustu — Aktiveeri profiil'))
    expect(rightsInputValues()).toEqual(['kiire', 'pakett'])
  })
})

describe('RequestCard volikiri enforcement', () => {
  const failedBoard = { level: 'none' as const, matchedName: null }

  function makeVolikiriFile(): File {
    return new File(['volikiri'], 'volikiri.pdf', { type: 'application/pdf' })
  }

  it('shows the volikiri warning and requires justification plus upload on a failed board check', async () => {
    await mountCard(makeRequestCardData({ boardCheck: failedBoard }))
    expect(container.textContent).toContain('Ainult keeldumine või nõustumine põhjenduse ja volikirjaga.')
    await click(buttonByLabel('Nõustu — Aktiveeri profiil'))
    const form = dialog().querySelector('form')
    expect(dialog().textContent).toContain('Taotleja ei ole juhatuse liige')
    expect(form?.querySelector<HTMLTextAreaElement>('textarea[name="justification"]')).not.toBeNull()
    expect(form?.querySelector<HTMLInputElement>('input[name="volikiri"]')).not.toBeNull()
  })

  it('keeps the confirm disabled until the justification and the file are provided', async () => {
    await mountCard(makeRequestCardData({ boardCheck: failedBoard }))
    await click(buttonByLabel('Nõustu — Aktiveeri profiil'))
    const confirm = buttonByLabel('Kinnita ja aktiveeri', dialog())
    expect(confirm.disabled).toBe(true)

    const justification = dialog().querySelector<HTMLTextAreaElement>('textarea[name="justification"]')
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(
        justification,
        'Taotleja on volitatud juhatuse poolt',
      )
      justification?.dispatchEvent(new Event('input', { bubbles: true }))
      await Promise.resolve()
    })
    expect(confirm.disabled).toBe(true)

    const fileInput = dialog().querySelector<HTMLInputElement>('input[name="volikiri"]')
    const file = makeVolikiriFile()
    await act(async () => {
      Object.defineProperty(fileInput, 'files', { value: [file] })
      fileInput?.dispatchEvent(new Event('change', { bubbles: true }))
      await Promise.resolve()
    })
    expect(confirm.disabled).toBe(false)
  })

  it('sends the justification and the volikiri file with the approve action', async () => {
    await mountCard(makeRequestCardData({ boardCheck: failedBoard }))
    await click(buttonByLabel('Nõustu — Aktiveeri profiil'))
    const justification = dialog().querySelector<HTMLTextAreaElement>('textarea[name="justification"]')
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(
        justification,
        'Taotleja on volitatud juhatuse poolt',
      )
      justification?.dispatchEvent(new Event('input', { bubbles: true }))
      await Promise.resolve()
    })
    const fileInput = dialog().querySelector<HTMLInputElement>('input[name="volikiri"]')
    await act(async () => {
      Object.defineProperty(fileInput, 'files', { value: [makeVolikiriFile()] })
      fileInput?.dispatchEvent(new Event('change', { bubbles: true }))
      await Promise.resolve()
    })
    await submitDialogForm()
    expect(actions.approve).toHaveBeenCalledTimes(1)
    const formData = postedFormData(actions.approve)
    expect(formData.get('justification')).toBe('Taotleja on volitatud juhatuse poolt')
    expect(formData.get('volikiri') instanceof File).toBe(true)
  })

  it('requires no volikiri fields when the board check passes', async () => {
    await mountCard(makeRequestCardData({ boardCheck: { level: 'weak', matchedName: 'Mari Maasikas' } }))
    await click(buttonByLabel('Nõustu — Aktiveeri profiil'))
    expect(dialog().querySelector('textarea[name="justification"]')).toBeNull()
    expect(dialog().querySelector('input[name="volikiri"]')).toBeNull()
    const confirm = buttonByLabel('Kinnita ja aktiveeri', dialog())
    expect(confirm.disabled).toBe(false)
  })
})

describe('RequestCard applicant context panel', () => {
  it('lists existing profiles on the same registry code with their status', async () => {
    await mountCard(
      makeRequestCardData({
        existingProfiles: [
          { profileId: 'p1', ownerName: 'Jaan Mets', approvalStatus: 'approved' },
          { profileId: 'p2', ownerName: 'Eve Tamm', approvalStatus: 'pending' },
        ],
      }),
    )
    expect(container.textContent).toContain('Olemasolevad profiilid')
    expect(container.textContent).toContain('Jaan Mets')
    expect(container.textContent).toContain('kinnitatud')
    expect(container.textContent).toContain('Eve Tamm')
    expect(container.textContent).toContain('ootel')
  })

  it('summarizes the bidding history with bids, auctions and the last bid date', async () => {
    await mountCard(
      makeRequestCardData({
        biddingHistory: { bidCount: 4, auctionCount: 2, lastBidAt: '2026-07-20T10:00:00.000Z' },
      }),
    )
    expect(container.textContent).toContain('Pakkumiste ajalugu')
    expect(container.textContent).toContain('4 pakkumist')
    expect(container.textContent).toContain('2 oksjonit')
    expect(container.textContent).toContain('viimane')
  })

  it('renders dashes when the applicant has no portal account', async () => {
    await mountCard(
      makeRequestCardData({
        applicant: null,
        biddingHistory: null,
        frameworkContract: { state: 'unknown', signedAt: null },
      }),
    )
    const dls = [...container.querySelectorAll('dl')]
    const contextDl = dls.find((candidate) => candidate.textContent.includes('Pakkumiste ajalugu'))
    expect(contextDl).toBeDefined()
    const rows = [...(contextDl?.querySelectorAll('div') ?? [])]
    const historyRow = rows.find((row) => row.textContent.startsWith('Pakkumiste ajalugu'))
    expect(historyRow?.textContent).toContain('—')
  })

  it('shows the framework contract as signed with the date', async () => {
    await mountCard(
      makeRequestCardData({
        frameworkContract: { state: 'signed', signedAt: '2026-05-01T12:00:00.000Z' },
      }),
    )
    expect(container.textContent).toContain('Allkirjastatud')
  })

  it('shows the framework contract as unsigned', async () => {
    await mountCard(
      makeRequestCardData({ frameworkContract: { state: 'unsigned', signedAt: null } }),
    )
    expect(container.textContent).toContain('Allkirjastamata')
  })
})

describe('RequestCard registry re-check', () => {
  it('offers the audited re-check for operators with the write role', async () => {
    await mountCard(makeRequestCardData())
    const button = [...container.querySelectorAll<HTMLButtonElement>('button')].find(
      (candidate) => candidate.textContent.trim() === 'Kontrolli uuesti',
    )
    expect(button).toBeDefined()
    const form = button?.closest('form')
    expect(form?.querySelector<HTMLInputElement>('input[name="id"]')?.value).toBe(
      makeRequest().id,
    )
    expect(form?.querySelector<HTMLInputElement>('input[name="redirectTo"]')?.value).toBe(
      '/admin/companies',
    )
  })

  it('hides the re-check without the write role', async () => {
    await mountCard(makeRequestCardData(), false)
    expect(container.textContent).not.toContain('Kontrolli uuesti')
  })
})
