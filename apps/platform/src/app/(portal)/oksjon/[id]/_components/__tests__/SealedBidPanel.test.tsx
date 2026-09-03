// @vitest-environment jsdom
import { act, createElement, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

const nav = vi.hoisted(() => ({
  refresh: vi.fn(),
  push: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => nav,
}))

vi.mock('next/link', () => ({
  default: (props: { href: string; className?: string; children: ReactNode }) =>
    createElement('a', { href: props.href, className: props.className }, props.children),
}))

import {
  SealedBidPanel,
  type SealedBidPanelProps,
  type SealedViewerSnapshot,
} from '../sealed/SealedBidPanel'

// jsdom does not implement crypto.randomUUID; the submit path mints an
// idempotency key with it.
if (typeof globalThis.crypto.randomUUID !== 'function') {
  Object.defineProperty(globalThis.crypto, 'randomUUID', {
    value: () => 'test-idempotency-key',
    configurable: true,
  })
}

const VALID_ISIKUKOOD = '37102240015'

function baseViewer(
  overrides: Partial<SealedViewerSnapshot> = {},
): SealedViewerSnapshot {
  return {
    profileType: 'private',
    displayName: 'Mari Maasikas',
    isikukood: VALID_ISIKUKOOD,
    registrikood: null,
    address: 'Metsa tee 1, Tartu',
    email: 'mari@naide.ee',
    phone: '+372 5555 0100',
    revisionCap: 2,
    ownBidCount: 0,
    latestSubmittedAt: null,
    outcome: null,
    ...overrides,
  }
}

function baseProps(
  overrides: Partial<SealedBidPanelProps> = {},
): SealedBidPanelProps {
  return {
    auctionId: 'a1',
    status: 'active',
    startsAt: '2026-09-01T09:00:00.000Z',
    endsAt: '2026-09-30T12:00:00.000Z',
    minBid: 1000,
    bidCount: 3,
    finalPrice: null,
    viewer: null,
    ...overrides,
  }
}

// Mirrors SealedBidPanel's own formatters so expectations match the et-EE
// rendering regardless of ICU data on the machine.
function plain(value: string): string {
  return value.replace(/<!--.*?-->/g, '').replace(/[\u00a0\u202f]/g, ' ')
}

function eur(value: number): string {
  return value.toLocaleString('et-EE', { style: 'currency', currency: 'EUR' })
}

function inputAmount(value: number): string {
  return value.toLocaleString('et-EE', { maximumFractionDigits: 2 })
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('et-EE', { dateStyle: 'long', timeStyle: 'short' })
}

function apiResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response
}

async function flush(): Promise<void> {
  for (let i = 0; i < 10; i += 1) {
    await Promise.resolve()
  }
}

let container: HTMLDivElement
let root: Root

async function mount(props: SealedBidPanelProps): Promise<void> {
  await act(async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    root.render(createElement(SealedBidPanel, props))
    await Promise.resolve()
  })
}

async function typeInto(selector: string, value: string): Promise<void> {
  const input = container.querySelector<HTMLInputElement>(selector)
  if (input === null) throw new Error(`missing input: ${selector}`)
  await Promise.resolve()
  act(() => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )?.set?.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

async function submitForm(): Promise<void> {
  const form = container.querySelector('form')
  if (form === null) throw new Error('missing form')
  await act(async () => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await Promise.resolve()
  })
}

function modalButton(label: string): HTMLButtonElement {
  const buttons = [...document.body.querySelectorAll('button')].filter(
    (button) => button.closest('[role="dialog"]') !== null,
  )
  const found = buttons.find((button) => button.textContent.includes(label))
  if (found === undefined) {
    throw new Error(`modal button not found: ${label}`)
  }
  return found
}

async function confirmModal(): Promise<void> {
  await act(async () => {
    modalButton('Esita pakkumine').click()
    await flush()
  })
}

function text(): string {
  return plain(container.textContent)
}

async function clickButton(label: string): Promise<void> {
  const buttons = [...container.querySelectorAll('button')]
  const found = buttons.find((button) => button.textContent.includes(label))
  if (found === undefined) throw new Error(`button not found: ${label}`)
  await act(async () => {
    found.click()
    await Promise.resolve()
  })
}

afterEach(() => {
  act(() => {
    root.unmount()
  })
  container.remove()
  nav.refresh.mockReset()
  nav.push.mockReset()
  vi.unstubAllGlobals()
})

describe('SealedBidPanel guest rendering', () => {
  it('shows the count, the login hint, and no form for guests while active', async () => {
    await mount(baseProps())
    expect(text()).toContain('Suletud pakkumine')
    expect(text()).toContain('Pakkumisi: 3')
    expect(text()).toContain('Logi sisse pakkumise tegemiseks.')
    expect(container.querySelector('a[href="/login?next=%2Foksjon%2Fa1"]')).not.toBeNull()
    expect(container.querySelector('form')).toBeNull()
    expect(container.querySelector('input')).toBeNull()
    expect(text()).not.toContain('€')
  })

  it('shows the final price to guests on an ended auction', async () => {
    await mount(baseProps({ status: 'ended', bidCount: null, finalPrice: 4000 }))
    expect(text()).toContain('Oksjon on lõppenud')
    expect(text()).toContain(`Lõpphind: ${plain(eur(4000))}`)
    expect(container.querySelector('form')).toBeNull()
  })

  it('shows the unsold notice to guests without a final price', async () => {
    await mount(baseProps({ status: 'unsold', bidCount: null, finalPrice: null }))
    expect(text()).toContain('Oksjon jäi müümata')
    expect(text()).not.toContain('Lõpphind')
  })
})

describe('SealedBidPanel count-only states', () => {
  it('renders the scheduled panel count and start time without a form', async () => {
    await mount(
      baseProps({ status: 'scheduled', bidCount: 7, viewer: baseViewer() }),
    )
    expect(text()).toContain('Suletud pakkumine')
    expect(text()).toContain('Pakkumisi: 7')
    expect(text()).toContain('Oksjon pole veel alanud.')
    expect(text()).toContain(`Oksjon algab: ${plain(fmtDateTime('2026-09-01T09:00:00.000Z'))}`)
    expect(container.querySelector('form')).toBeNull()
    expect(container.querySelector('input')).toBeNull()
  })

  it('renders the active form with the start price and prefilled identity', async () => {
    await mount(baseProps({ viewer: baseViewer() }))
    expect(text()).toContain('Pakkumisi: 3')
    expect(text()).toContain(`Alghind`)
    expect(text()).toContain(plain(eur(1000)))
    expect(text()).toContain(`Vähim lubatud pakkumine: ${inputAmount(1000)} €`)
    const submit = [...container.querySelectorAll('button')].find((button) =>
      button.textContent.includes('Esita pakkumine'),
    )
    expect(submit).toBeDefined()
    expect(text()).not.toContain('Esita täienduspakkumine')
    const code = container.querySelector<HTMLInputElement>('#sealed-identity-code')
    expect(code?.value).toBe(VALID_ISIKUKOOD)
    const name = container.querySelector<HTMLInputElement>('#sealed-identity-name')
    expect(name?.value).toBe('Mari Maasikas')
  })
})

describe('SealedBidPanel locked card after submission', () => {
  it('submits a revision through the confirm modal and swaps to the locked card', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(apiResponse(201, { id: 'b2' })))
    vi.stubGlobal('fetch', fetchMock)
    await mount(
      baseProps({
        viewer: baseViewer({
          ownBidCount: 1,
          latestSubmittedAt: '2026-09-20T10:00:00.000Z',
        }),
      }),
    )
    expect(text()).toContain('Pakkumine on esitatud')

    await clickButton('Muuda pakkumist')
    expect(text()).toContain('Esita täienduspakkumine')

    await typeInto('#sealed-bid-amount', '1800')
    await submitForm()

    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull()
    expect(plain(document.body.textContent)).toContain('Kinnita siduv pakkumine')
    expect(plain(document.body.textContent)).toContain(plain(eur(1800)))
    expect(plain(document.body.textContent)).toContain(
      'Uus pakkumine asendab sinu eelmise pakkumise.',
    )
    expect(fetchMock).not.toHaveBeenCalled()

    await confirmModal()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/v1/bids/create')
    expect(init.method).toBe('POST')
    const body = JSON.parse(init.body as string) as Record<string, unknown>
    expect(body.type).toBe('sealed')
    expect(body.amount).toBe(1800)

    expect(text()).toContain('Pakkumine on esitatud')
    expect(text()).toContain(plain(eur(1800)))
    expect(
      container.querySelector('[aria-label="Summa on peidetud kuni pakkumiste avamiseni"]'),
    ).not.toBeNull()
    expect(text()).toMatch(/Esitatud: /)
    // Remaining revisions derive from the server snapshot (cap 2 + 1 - 1 bid).
    expect(text()).toContain('Täienduspakkumisi jäänud: 2')
    expect(text()).toContain('Muuda pakkumist')
    expect(container.querySelector('form')).toBeNull()
    expect(nav.refresh).toHaveBeenCalledTimes(1)
  })

  it('leaves the form open after a first bid succeeds (ownBidCount snapshot is still 0)', async () => {
    // Documents current behavior: with ownBidCount 0 the locked card gate
    // (participant) does not engage until router.refresh() delivers a new
    // viewer snapshot; see production-bug note in the task summary.
    const fetchMock = vi.fn(() => Promise.resolve(apiResponse(201, { id: 'b1' })))
    vi.stubGlobal('fetch', fetchMock)
    await mount(baseProps({ viewer: baseViewer() }))

    await typeInto('#sealed-bid-amount', '1500')
    await submitForm()
    await confirmModal()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    const body = JSON.parse(init.body as string) as Record<string, unknown>
    expect(body.type).toBe('sealed')
    expect(body.amount).toBe(1500)
    expect(nav.refresh).toHaveBeenCalledTimes(1)
    expect(text()).not.toContain('Pakkumine on esitatud')
    expect(container.querySelector('form')).not.toBeNull()
  })

  it('shows the reloaded locked card with a masked amount', async () => {
    await mount(
      baseProps({
        viewer: baseViewer({
          ownBidCount: 1,
          latestSubmittedAt: '2026-09-20T10:00:00.000Z',
        }),
      }),
    )
    expect(text()).toContain('Pakkumine on esitatud')
    expect(text()).toContain('•••• €')
    expect(text()).not.toContain('1500')
    expect(text()).toContain(
      `Esitatud: ${plain(fmtDateTime('2026-09-20T10:00:00.000Z'))}`,
    )
    expect(text()).toContain('Täienduspakkumisi jäänud: 2')
    expect(text()).toContain('Muuda pakkumist')
    expect(container.querySelector('form')).toBeNull()
  })

  it('keeps the locked card without a revise button once revisions are exhausted', async () => {
    await mount(
      baseProps({
        viewer: baseViewer({
          ownBidCount: 3,
          revisionCap: 2,
          latestSubmittedAt: '2026-09-20T10:00:00.000Z',
        }),
      }),
    )
    expect(text()).toContain('Pakkumine on esitatud')
    expect(text()).toContain('Täienduspakkumiste limiit on täis.')
    expect(text()).not.toContain('Muuda pakkumist')
    expect(container.querySelector('form')).toBeNull()
  })

  it('locks the form permanently after the API answers revision_cap_exceeded', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        apiResponse(400, {
          error: 'Täienduspakkumiste limiit on täis.',
          code: 'revision_cap_exceeded',
        }),
      ),
    )
    vi.stubGlobal('fetch', fetchMock)
    await mount(
      baseProps({
        viewer: baseViewer({
          ownBidCount: 1,
          latestSubmittedAt: '2026-09-20T10:00:00.000Z',
        }),
      }),
    )

    await clickButton('Muuda pakkumist')
    expect(text()).toContain('Esita täienduspakkumine')
    expect(text()).toContain('Katkesta muutmine')

    await typeInto('#sealed-bid-amount', '1800')
    await submitForm()
    await confirmModal()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(text()).toContain(
      'Täienduspakkumiste limiit on täis. Rohkem muudatusi ei ole võimalik teha.',
    )
    const alert = container.querySelector('[role="alert"]')
    expect(alert).not.toBeNull()
    const amount = container.querySelector<HTMLInputElement>('#sealed-bid-amount')
    expect(amount?.disabled).toBe(true)
    const submit = [...container.querySelectorAll('button')].find((button) =>
      button.textContent.includes('Esita täienduspakkumine'),
    )
    expect(submit?.disabled).toBe(true)
    expect(text()).not.toContain('Katkesta muutmine')
    expect(nav.refresh).not.toHaveBeenCalled()
  })
})

describe('SealedBidPanel post-opening states', () => {
  it('shows the winner card with the final price and the contract link', async () => {
    await mount(
      baseProps({
        status: 'contract',
        bidCount: null,
        finalPrice: 5000,
        viewer: baseViewer({ ownBidCount: 1, outcome: 'won' }),
      }),
    )
    expect(text()).toContain('Palju õnne! Sinu pakkumine osutus edukaimaks.')
    expect(text()).toContain(`Lõpphind: ${plain(eur(5000))}`)
    expect(
      container.querySelector('a[href="/lepingud/oksjonileping/a1"]'),
    ).not.toBeNull()
    expect(container.querySelector('form')).toBeNull()
  })

  it('shows the loser card without a contract link', async () => {
    await mount(
      baseProps({
        status: 'ended',
        bidCount: null,
        viewer: baseViewer({ ownBidCount: 1, outcome: 'lost' }),
      }),
    )
    expect(text()).toContain('Sinu pakkumine ei olnud edukaim')
    expect(text()).not.toContain('Palju õnne')
    expect(text()).not.toContain('oksjonileping')
    expect(text()).not.toContain('Lõpphind')
  })

  it('shows the ended-not-opened notice for a participant before the ceremony', async () => {
    await mount(
      baseProps({
        status: 'ended',
        bidCount: null,
        viewer: baseViewer({ ownBidCount: 1, outcome: null }),
      }),
    )
    expect(text()).toContain('Oksjon on lõppenud')
    expect(text()).toContain('Pakkumised avatakse üheaegselt. Teavitame sind tulemusest.')
    expect(text()).not.toContain('Lõpphind')
  })

  it('shows the unsold card for a participant', async () => {
    await mount(
      baseProps({
        status: 'unsold',
        bidCount: null,
        viewer: baseViewer({ ownBidCount: 1 }),
      }),
    )
    expect(text()).toContain('Oksjon jäi müümata')
    expect(text()).toContain('Müüja ei kinnitanud müüki.')
    expect(container.querySelector('form')).toBeNull()
  })
})
