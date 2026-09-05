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

type FormProps = ComponentProps<typeof ServiceRequestForm>

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

async function selectInto(selector: string, value: string): Promise<void> {
  const select = container.querySelector<HTMLSelectElement>(selector)
  if (select === null) throw new Error(`missing select: ${selector}`)
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set?.call(
      select,
      value,
    )
    select.dispatchEvent(new Event('change', { bubbles: true }))
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

async function clickService(index: number): Promise<void> {
  const boxes = [
    ...container.querySelectorAll<HTMLInputElement>('input[name="services"]'),
  ]
  const box = boxes[index]
  if (box === undefined) throw new Error(`missing service checkbox: ${String(index)}`)
  await act(async () => {
    box.click()
    await flush()
  })
}

async function attachFile(file: File): Promise<void> {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]')
  if (input === null) throw new Error('missing file input')
  await act(async () => {
    Object.defineProperty(input, 'files', {
      value: { 0: file, length: 1, item: (i: number) => (i === 0 ? file : null) },
      configurable: true,
    })
    input.dispatchEvent(new Event('change', { bubbles: true }))
    await flush()
  })
}

async function submitForm(): Promise<void> {
  const form = container.querySelector('form')
  if (form === null) throw new Error('missing form')
  await act(async () => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await flush()
  })
}

async function fillValidIstutamine(
  options: { services?: boolean; honeypot?: string } = {},
): Promise<void> {
  await typeInto('input[name="name"]', 'Mari Maasikas')
  await typeInto('input[name="phone"]', '+37251234567')
  await typeInto('input[name="email"]', 'mari@naide.ee')
  await typeInto('input[name="cadastres"]', '12345:123:1234')
  await selectInto('select[name="county"]', 'TA')
  await typeInto('input[name="provisions"]', '5, 7')
  if (options.services ?? true) await clickService(0)
  if (options.honeypot !== undefined) {
    await typeInto('input[name="company_website"]', options.honeypot)
  }
  await clickCheckbox('input[name="consent"]')
}

function text(): string {
  return (container.textContent ?? '').replace(/<!--.*?-->/g, '')
}

function submitButton(): HTMLButtonElement {
  const button = [...container.querySelectorAll('button')].find((candidate) =>
    candidate.getAttribute('type') === 'submit',
  )
  if (button === undefined) throw new Error('missing submit button')
  return button
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

describe('ServiceRequestForm checkbox-group validation', () => {
  it('blocks submit and shows the group error when no istutamine service is selected', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await mount(istutamineProps())
    await fillValidIstutamine({ services: false })

    await submitForm()

    expect(fetchMock).not.toHaveBeenCalled()
    const alert = container.querySelector('fieldset [role="alert"]')
    expect(alert?.textContent).toContain('Valige vähemalt üks teenus')
    expect(container.querySelector('form')).not.toBeNull()
    expect(trackMock).toHaveBeenCalledWith(
      'service_request_validation_error',
      expect.objectContaining({ field: 'services', form_name: 'istutamine-1' }),
    )
  })

  it('clears the group error once a service is picked', async () => {
    vi.stubGlobal('fetch', vi.fn())
    await mount(istutamineProps())
    await fillValidIstutamine({ services: false })
    await submitForm()
    expect(container.querySelector('fieldset [role="alert"]')).not.toBeNull()

    await clickService(1)

    expect(container.querySelector('fieldset [role="alert"]')).toBeNull()
  })
})

describe('ServiceRequestForm submit states (JSON transport)', () => {
  it('replaces the form with a success state naming the routed partner count', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(apiResponse(201, { status: 'ok', routedCount: 2 })),
    )
    vi.stubGlobal('fetch', fetchMock)
    await mount(istutamineProps())
    await fillValidIstutamine()

    await submitForm()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/v1/service-requests')
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>)['content-type']).toBe(
      'application/json',
    )
    const body = JSON.parse(init.body as string) as Record<string, unknown>
    expect(body.type).toBe('istutamine')
    expect(body.services).toEqual(['maapinna_ettevalmistus'])
    expect(body.company_website).toBe('')
    expect(typeof body.consentAt).toBe('string')
    expect(body.formName).toBe('istutamine-1')

    expect(container.querySelector('form')).toBeNull()
    expect(text()).toContain('Aitäh! Päring on esitatud.')
    expect(text()).toContain(
      'Päring edastati 2 partnerile. Pakkumised laekuvad tavaliselt 7 päeva jooksul.',
    )
    expect(container.querySelector('a[href="/paringud"]')).not.toBeNull()
    expect(trackMock).toHaveBeenCalledWith(
      'service_request_complete',
      expect.objectContaining({ routed_count: 2, routed_count_bucket: '1-2' }),
    )
  })

  it('shows the zero-partner fallback copy when routedCount is 0', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(apiResponse(201, { status: 'ok', routedCount: 0 })),
    )
    vi.stubGlobal('fetch', fetchMock)
    await mount(istutamineProps())
    await fillValidIstutamine()

    await submitForm()

    expect(container.querySelector('form')).toBeNull()
    expect(text()).toContain('Päring salvestati, võtame ise ühendust.')
    expect(text()).toContain('Päring salvestati.')
    expect(trackMock).toHaveBeenCalledWith(
      'service_request_complete',
      expect.objectContaining({ routed_count: 0, routed_count_bucket: '0' }),
    )
  })

  it('treats a filled honeypot as a neutral success without routing events', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(apiResponse(200, { status: 'ok' })),
    )
    vi.stubGlobal('fetch', fetchMock)
    await mount(istutamineProps())
    await fillValidIstutamine({ honeypot: 'http://spam.example' })

    await submitForm()

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    const body = JSON.parse(init.body as string) as Record<string, unknown>
    expect(body.company_website).toBe('http://spam.example')

    expect(container.querySelector('form')).toBeNull()
    expect(text()).toContain('Aitäh! Päring on esitatud.')
    expect(text()).toContain('Päring on saadetud.')
    expect(
      trackMock.mock.calls.some(([name]) => name === 'service_request_complete'),
    ).toBe(false)
  })

  it('keeps form data and allows a retry after a network failure', async () => {
    const fetchMock = vi
      .fn<() => Promise<Response>>()
      .mockImplementationOnce(() => Promise.reject(new TypeError('Network request failed')))
      .mockImplementationOnce(() =>
        Promise.resolve(apiResponse(201, { status: 'ok', routedCount: 1 })),
      )
    vi.stubGlobal('fetch', fetchMock)
    await mount(istutamineProps())
    await fillValidIstutamine()

    await submitForm()

    expect(text()).toContain(
      'Ei õnnestunud saata. Kontrollige võrguühendust ja proovige uuesti.',
    )
    expect(
      container.querySelector<HTMLInputElement>('input[name="name"]')?.value,
    ).toBe('Mari Maasikas')
    expect(container.querySelector('[role="alert"]')).not.toBeNull()
    expect(submitButton().disabled).toBe(false)

    await submitForm()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(container.querySelector('form')).toBeNull()
    expect(text()).toContain('Päring edastati 1 partnerile')
  })

  it('sends a single request when submit fires twice while in flight', async () => {
    let resolveFetch: ((response: Response) => void) | undefined
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve
        }),
    )
    vi.stubGlobal('fetch', fetchMock)
    await mount(istutamineProps())
    await fillValidIstutamine()

    await submitForm()
    await submitForm()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(submitButton().disabled).toBe(true)

    await act(async () => {
      resolveFetch?.(apiResponse(201, { status: 'ok', routedCount: 1 }))
      await flush()
    })

    expect(container.querySelector('form')).toBeNull()
    expect(text()).toContain('Päring edastati 1 partnerile')
  })
})

describe('ServiceRequestForm multipart transport (hooldusraie)', () => {
  class FakeXhr {
    static sent: FakeXhr[] = []

    status = 0
    responseText = ''
    sent: FormData | null = null
    upload = {
      onprogress: null as
        | ((event: { lengthComputable: boolean; loaded: number; total: number }) => void)
        | null,
    }
    onerror: (() => void) | null = null
    ontimeout: (() => void) | null = null
    onload: (() => void) | null = null

    open(): void {}

    send(data: FormData): void {
      this.sent = data
      FakeXhr.sent.push(this)
    }
  }

  beforeEach(() => {
    FakeXhr.sent = []
  })

  it('sends multipart with progress and swaps to the success state on XHR load', async () => {
    vi.stubGlobal('XMLHttpRequest', FakeXhr)
    await mount(hooldusraieProps())
    await typeInto('input[name="name"]', 'Mari Maasikas')
    await typeInto('input[name="phone"]', '+37251234567')
    await typeInto('input[name="email"]', 'mari@naide.ee')
    await typeInto('input[name="cadastres"]', '12345:123:1234')
    await selectInto('select[name="county"]', 'TA')
    await typeInto('input[name="provisions"]', '5, 7')
    await clickService(0)
    await clickService(1)
    await attachFile(new File(['kava'], 'raiekava.pdf', { type: 'application/pdf' }))
    await clickCheckbox('input[name="consent"]')

    await submitForm()

    const xhr = FakeXhr.sent[0]
    if (xhr === undefined) throw new Error('XHR was not created')
    const data = xhr.sent
    if (data === null) throw new Error('FormData was not sent')
    expect(data.get('type')).toBe('hooldusraie')
    expect(data.get('services')).toBe('hooldamine,valgusraie')
    expect(data.get('file')).toBeInstanceOf(File)
    expect(data.get('company_website')).toBe('')
    expect(data.get('formName')).toBe('hooldusraie-1')
    expect(data.get('pageSlug')).toBe('/paringud/hooldusraie')

    await act(async () => {
      xhr.upload.onprogress?.({ lengthComputable: true, loaded: 50, total: 100 })
      await flush()
    })
    expect(text()).toContain('Saadan… 50%')

    await act(async () => {
      xhr.status = 201
      xhr.responseText = JSON.stringify({ status: 'ok', routedCount: 2 })
      xhr.onload?.()
      await flush()
    })

    expect(container.querySelector('form')).toBeNull()
    expect(text()).toContain('Päring edastati 2 partnerile')
    expect(trackMock).toHaveBeenCalledWith(
      'service_request_complete',
      expect.objectContaining({ routed_count: 2, routed_count_bucket: '1-2' }),
    )
  })

  it('shows the network error and keeps the form when XHR fails', async () => {
    vi.stubGlobal('XMLHttpRequest', FakeXhr)
    await mount(hooldusraieProps())
    await typeInto('input[name="name"]', 'Mari Maasikas')
    await typeInto('input[name="phone"]', '+37251234567')
    await typeInto('input[name="email"]', 'mari@naide.ee')
    await typeInto('input[name="cadastres"]', '12345:123:1234')
    await selectInto('select[name="county"]', 'TA')
    await typeInto('input[name="provisions"]', '5, 7')
    await clickService(0)
    await clickCheckbox('input[name="consent"]')

    await submitForm()

    const xhr = FakeXhr.sent[0]
    if (xhr === undefined) throw new Error('XHR was not created')
    await act(async () => {
      xhr.onerror?.()
      await flush()
    })

    expect(container.querySelector('form')).not.toBeNull()
    expect(text()).toContain(
      'Ei õnnestunud saata. Kontrollige võrguühendust ja proovige uuesti.',
    )
    expect(
      container.querySelector<HTMLInputElement>('input[name="name"]')?.value,
    ).toBe('Mari Maasikas')
    expect(submitButton().disabled).toBe(false)
  })
})
