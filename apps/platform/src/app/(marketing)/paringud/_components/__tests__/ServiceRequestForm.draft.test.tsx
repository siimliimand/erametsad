// @vitest-environment jsdom
import { act, createElement, type ComponentProps, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const trackMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/analytics/track', () => ({
  track: trackMock,
}))

vi.mock('next/link', () => ({
  default: (props: { href: string; children?: ReactNode }) =>
    createElement('a', { href: props.href }, props.children),
}))

import { ServiceRequestForm } from '../ServiceRequestForm'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

const DRAFT_KEY = 'erametsad:request-draft:istutamine-1'
const HOOLDUSRAIE_DRAFT_KEY = 'erametsad:request-draft:hooldusraie-1'

interface Envelope {
  savedAt: number
  value: Record<string, unknown>
}

function readEnvelope(key: string): Envelope {
  const raw = window.localStorage.getItem(key)
  if (raw === null) throw new Error(`missing draft: ${key}`)
  const parsed: unknown = JSON.parse(raw)
  return parsed as Envelope
}

function seedDraft(key: string, envelope: Envelope): void {
  window.localStorage.setItem(key, JSON.stringify(envelope))
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

type FormProps = ComponentProps<typeof ServiceRequestForm>

function istutamineProps(): FormProps {
  return {
    type: 'istutamine',
    formName: 'istutamine-1',
    pageSlug: '/paringud/metsa-istutamine',
  }
}

function hooldusraieProps(): FormProps {
  return {
    type: 'hooldusraie',
    formName: 'hooldusraie-1',
    pageSlug: '/paringud/hooldusraie',
  }
}

async function mount(props: FormProps): Promise<void> {
  await act(async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    root.render(createElement(ServiceRequestForm, props))
    await flush()
  })
}

async function typeInto(selector: string, value: string): Promise<void> {
  const input = container.querySelector<HTMLInputElement>(selector)
  if (input === null) throw new Error(`missing input: ${selector}`)
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(
      input,
      value,
    )
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await flush()
  })
}

async function clickCheckbox(selector: string): Promise<void> {
  const box = container.querySelector<HTMLInputElement>(selector)
  if (box === null) throw new Error(`missing checkbox: ${selector}`)
  await act(async () => {
    box.click()
    await flush()
  })
}

function textContent(): string {
  return container.textContent.replace(/<!--.*?-->/g, '')
}

beforeEach(() => {
  window.localStorage.clear()
  trackMock.mockReset()
})

afterEach(() => {
  act(() => {
    root.unmount()
  })
  container.remove()
  vi.unstubAllGlobals()
})

describe('ServiceRequestForm draft restore', () => {
  it('restores a fresh draft into the fields and leaves the consent unchecked', async () => {
    seedDraft(DRAFT_KEY, {
      savedAt: Date.now() - 60 * 1000,
      value: {
        name: 'Mari Maasikas',
        phone: '+37251234567',
        email: 'mari@naide.ee',
        cadastres: '12345:123:1234',
        county: 'TA',
        provisions: '5, 7',
        services: ['istikud', 'istutamine'],
        paperCopy: false,
        comment: 'Täiendav info',
        // Junk a tampered draft might carry: never restorable state.
        consent: true,
        consentAt: '2026-01-01T00:00:00.000Z',
        file: 'salajane-kava.pdf',
      },
    })

    await mount(istutamineProps())

    const valueOf = (name: string): string =>
      container.querySelector<HTMLInputElement>(`input[name="${name}"]`)?.value ??
      'missing input'
    expect(valueOf('name')).toBe('Mari Maasikas')
    expect(valueOf('phone')).toBe('+37251234567')
    expect(valueOf('email')).toBe('mari@naide.ee')
    expect(valueOf('cadastres')).toBe('12345:123:1234')
    expect(valueOf('provisions')).toBe('5, 7')
    const comment = container.querySelector('textarea')
    expect(comment?.value).toBe('Täiendav info')
    const county = container.querySelector<HTMLSelectElement>('select[name="county"]')
    expect(county?.value).toBe('TA')

    const checked = [...container.querySelectorAll<HTMLInputElement>('input[name="services"]')].map(
      (box) => box.checked,
    )
    expect(checked).toEqual([false, true, true])

    expect(
      container.querySelector<HTMLInputElement>('input[name="consent"]')?.checked,
    ).toBe(false)
  })

  it('never persists consent or file keys when saving the draft', async () => {
    await mount(istutamineProps())

    await typeInto('input[name="name"]', 'Mari Maasikas')
    await clickCheckbox('input[name="consent"]')

    const stored = readEnvelope(DRAFT_KEY)
    expect(stored.value).toEqual({
      name: 'Mari Maasikas',
      phone: '',
      email: '',
      cadastres: '',
      county: '',
      provisions: '',
      services: [],
      paperCopy: false,
      comment: '',
    })
    expect(JSON.stringify(stored)).not.toContain('consent')
    expect(JSON.stringify(stored)).not.toContain('consentAt')
    expect(JSON.stringify(stored)).not.toContain('file')
  })

  it('never stores the selected file for hooldusraie', async () => {
    await mount(hooldusraieProps())

    const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]')
    if (fileInput === null) throw new Error('missing file input')
    const file = new File(['kava sisu'], 'salajane-kava.pdf', { type: 'application/pdf' })
    await act(async () => {
      Object.defineProperty(fileInput, 'files', {
        value: { 0: file, length: 1, item: (i: number) => (i === 0 ? file : null) },
        configurable: true,
      })
      fileInput.dispatchEvent(new Event('change', { bubbles: true }))
      await flush()
    })
    await typeInto('input[name="name"]', 'Mari Maasikas')

    expect(textContent()).toContain('salajane-kava.pdf')
    const stored = readEnvelope(HOOLDUSRAIE_DRAFT_KEY)
    expect(stored.value.file).toBeUndefined()
    expect(JSON.stringify(stored)).not.toContain('salajane-kava.pdf')
    expect(JSON.stringify(stored)).not.toContain('kava sisu')
  })
})

describe('ServiceRequestForm draft lifecycle', () => {
  it('saves the draft on every change after hydration', async () => {
    await mount(istutamineProps())

    await typeInto('input[name="name"]', 'Jüri Mets')

    const stored = readEnvelope(DRAFT_KEY)
    expect(stored.savedAt).toBeGreaterThan(Date.now() - 60 * 1000)
    expect(stored.value.name).toBe('Jüri Mets')
  })

  it('clears the draft after a successful submit', async () => {
    seedDraft(DRAFT_KEY, {
      savedAt: Date.now(),
      value: {
        name: 'Mari Maasikas',
        phone: '+37251234567',
        email: 'mari@naide.ee',
        cadastres: '12345:123:1234',
        county: 'TA',
        provisions: '5, 7',
        services: ['istutamine'],
        paperCopy: false,
        comment: '',
      },
    })
    const fetchMock = vi.fn(() =>
      Promise.resolve(apiResponse(201, { status: 'ok', routedCount: 2 })),
    )
    vi.stubGlobal('fetch', fetchMock)
    await mount(istutamineProps())
    await clickCheckbox('input[name="consent"]')

    await act(async () => {
      container
        .querySelector('form')
        ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
      await flush()
    })

    expect(textContent()).toContain('Päring edastati 2 partnerile')
    expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull()
  })

  it('ignores an expired draft and starts empty', async () => {
    seedDraft(DRAFT_KEY, {
      savedAt: Date.now() - 25 * 60 * 60 * 1000,
      value: { name: 'Vana Mari' },
    })

    await mount(istutamineProps())

    expect(
      container.querySelector<HTMLInputElement>('input[name="name"]')?.value,
    ).toBe('')
    // The hook removed the expired envelope; the form re-saves a fresh one.
    const stored = readEnvelope(DRAFT_KEY)
    expect(stored.savedAt).toBeGreaterThan(Date.now() - 60 * 1000)
    expect(stored.value.name).toBe('')
  })

  it('ignores a corrupt draft and starts empty', async () => {
    window.localStorage.setItem(DRAFT_KEY, 'not-json{')
    await mount(istutamineProps())

    expect(
      container.querySelector<HTMLInputElement>('input[name="name"]')?.value,
    ).toBe('')
    expect(textContent()).not.toContain('Vana Mari')
  })
})
