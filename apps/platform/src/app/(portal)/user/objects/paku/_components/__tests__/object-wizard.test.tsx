// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ObjectWizard } from '../ObjectWizard'
import { ObjectWizardSubmitter } from '../ObjectWizardSubmitter'
import {
  SALE_FILES_URL,
  SALE_SUBMISSION_URL,
  SERVICE_REQUESTS_URL,
  SUBMIT_REDIRECT_URL,
  submitWizard,
} from '../submit'
import type { ObjectWizardData, ObjectWizardProps } from '../types'

const pushMock = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}))

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

type WizardProps = ObjectWizardProps

const PREFILL = { name: 'Metsanaine Mari', email: 'mari@naane.ee', phone: '+37251234567' }

function baseProps(): WizardProps {
  return {
    contactPrefill: PREFILL,
    onSubmit: vi.fn(),
  }
}

async function flush(): Promise<void> {
  for (let i = 0; i < 10; i += 1) {
    await Promise.resolve()
  }
}

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  pushMock.mockReset()
})

afterEach(() => {
  act(() => {
    root.unmount()
  })
  container.remove()
  vi.unstubAllGlobals()
})

async function mount(props: WizardProps): Promise<void> {
  await act(async () => {
    root = createRoot(container)
    root.render(createElement(ObjectWizard, props))
    await flush()
  })
}

async function typeInto(selector: string, value: string): Promise<void> {
  const element = container.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)
  if (element === null) throw new Error(`missing input: ${selector}`)
  await act(async () => {
    if (element instanceof HTMLTextAreaElement) {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(
        element,
        value,
      )
    } else {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(
        element,
        value,
      )
    }
    element.dispatchEvent(new Event('input', { bubbles: true }))
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

async function clickElement(element: Element): Promise<void> {
  await act(async () => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    await flush()
  })
}

async function clickButton(label: string): Promise<void> {
  const button = [...container.querySelectorAll('button')].find(
    (candidate) => candidate.textContent === label,
  )
  if (button === undefined) throw new Error(`missing button: ${label}`)
  await clickElement(button)
}

async function toggleCheckbox(name: string, index = 0): Promise<void> {
  const boxes = container.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`)
  const box = boxes[index]
  if (box === undefined) throw new Error(`missing checkbox: ${name}`)
  await act(async () => {
    box.click()
    await flush()
  })
}

function currentStep(): string {
  return container.querySelector('[aria-current="step"]')?.textContent ?? ''
}

function onSubmitMock(props: WizardProps): ReturnType<typeof vi.fn> {
  return props.onSubmit as unknown as ReturnType<typeof vi.fn>
}

function html(): string {
  return container.innerHTML
}

describe('ObjectWizard', () => {
  it('renders step 1 with the five services', async () => {
    await mount(baseProps())
    expect(currentStep()).toContain('1. Teenus')
    expect(html()).toContain('Raieõiguse müük')
    expect(html()).toContain('Kinnistu müük')
    expect(html()).toContain('Metsamajanduskava')
    expect(html()).toContain('Hooldusraie')
    expect(html()).toContain('Metsa istutamine')
  })

  it('blocks advancing while no service is selected', async () => {
    await mount(baseProps())
    await clickButton('Edasi')
    expect(currentStep()).toContain('1. Teenus')
    expect(html()).toContain('Vali teenus, et jätkata.')
  })

  it('shows the sale steps after a sale service is selected', async () => {
    await mount(baseProps())
    const saleCard = [...container.querySelectorAll('button')].find((button) =>
      button.textContent.includes('Raieõiguse müük'),
    )
    if (saleCard === undefined) throw new Error('missing sale card')
    await clickElement(saleCard)
    await clickButton('Edasi')
    expect(currentStep()).toContain('2. Asukoht')
    expect(container.querySelector('input[name="cadastres"]')).not.toBeNull()
  })

  it('shows the kava service steps without county or provisions', async () => {
    await mount(baseProps())
    const kavaCard = [...container.querySelectorAll('button')].find((button) =>
      button.textContent.includes('Metsamajanduskava'),
    )
    if (kavaCard === undefined) throw new Error('missing kava card')
    await clickElement(kavaCard)
    await clickButton('Edasi')
    expect(currentStep()).toContain('2. Päringu andmed')
    expect(container.querySelector('input[name="paper_copy"]')).not.toBeNull()
    expect(container.querySelector('select[name="service-county"]')).toBeNull()
    expect(container.querySelector('input[name="service-provisions"]')).toBeNull()
  })

  it('shows hooldusraie fields for the hooldusraie branch', async () => {
    await mount(baseProps())
    const card = [...container.querySelectorAll('button')].find((button) =>
      button.textContent.includes('Hooldusraie'),
    )
    if (card === undefined) throw new Error('missing hooldusraie card')
    await clickElement(card)
    await clickButton('Edasi')
    expect(container.querySelector('select[name="service-county"]')).not.toBeNull()
    expect(container.querySelector('input[name="service-provisions"]')).not.toBeNull()
    expect(container.querySelectorAll('input[name="service-services"]').length).toBe(2)
    expect(container.querySelector('input[name="service-file"]')).not.toBeNull()
  })

  it('an invalid cadastre blocks advancing', async () => {
    await mount(baseProps())
    const saleCard = [...container.querySelectorAll('button')].find((button) =>
      button.textContent.includes('Raieõiguse müük'),
    )
    if (saleCard === undefined) throw new Error('missing sale card')
    await clickElement(saleCard)
    await clickButton('Edasi')
    await typeInto('input[name="cadastres"]', 'not-a-cadastre')
    await clickButton('Edasi')
    expect(currentStep()).toContain('2. Asukoht')
    expect(html()).toContain('Katastritunnuse vorming')
  })

  it('a valid cadastre derives the county but keeps it editable', async () => {
    await mount(baseProps())
    const saleCard = [...container.querySelectorAll('button')].find((button) =>
      button.textContent.includes('Raieõiguse müük'),
    )
    if (saleCard === undefined) throw new Error('missing sale card')
    await clickElement(saleCard)
    await clickButton('Edasi')
    await typeInto('input[name="cadastres"]', '78402:003:0210')
    const county = container.querySelector<HTMLSelectElement>('select[name="county"]')
    expect(county?.value).toBe('HH')
    await selectInto('select[name="county"]', 'TA')
    expect(
      container.querySelector<HTMLSelectElement>('select[name="county"]')?.value,
    ).toBe('TA')
  })

  it('prefills the contact step from the profile and submits the collected data', async () => {
    const props = baseProps()
    await mount(props)
    const saleCard = [...container.querySelectorAll('button')].find((button) =>
      button.textContent.includes('Raieõiguse müük'),
    )
    if (saleCard === undefined) throw new Error('missing sale card')
    await clickElement(saleCard)
    await clickButton('Edasi')
    await typeInto('input[name="cadastres"]', '78402:003:0210')
    await clickButton('Edasi')
    await typeInto('input[name="areaHa"]', '12')
    await toggleCheckbox('species')
    await toggleCheckbox('loggingTypes')
    await clickButton('Edasi')
    await clickButton('Edasi') // files are optional
    await typeInto('textarea[name="description"]', 'Soovin müüa raieõigust.')
    await clickButton('Edasi')
    expect(currentStep()).toContain('6. Kontaktandmed')
    expect(
      (container.querySelector<HTMLInputElement>('input[name="contact-name"]')?.value) ?? '',
    ).toBe(PREFILL.name)
    expect(
      (container.querySelector<HTMLInputElement>('input[name="contact-email"]')?.value) ?? '',
    ).toBe(PREFILL.email)
    expect(
      (container.querySelector<HTMLInputElement>('input[name="contact-phone"]')?.value) ?? '',
    ).toBe(PREFILL.phone)
    await clickButton('Edasi')
    expect(currentStep()).toContain('7. Kokkuvõte')
    expect(html()).toContain('78402:003:0210')
    await clickButton('Saada')
    const onSubmit = onSubmitMock(props)
    expect(onSubmit).toHaveBeenCalledTimes(1)
    const submitted = onSubmit.mock.calls[0]?.[0] as ObjectWizardData | undefined
    expect(submitted?.branch).toBe('sale')
    expect(submitted?.sale.cadastreInput).toBe('78402:003:0210')
    expect(submitted?.sale.areaHa).toBe('12')
    expect(submitted?.sale.description).toBe('Soovin müüa raieõigust.')
    expect(submitted?.contact).toEqual(PREFILL)
  })

  it('requires consent before a service submission can be sent', async () => {
    const props = baseProps()
    await mount(props)
    const kavaCard = [...container.querySelectorAll('button')].find((button) =>
      button.textContent.includes('Metsamajanduskava'),
    )
    if (kavaCard === undefined) throw new Error('missing kava card')
    await clickElement(kavaCard)
    await clickButton('Edasi')
    await typeInto('input[name="service-cadastres"]', '78402:003:0210')
    await clickButton('Edasi')
    await clickButton('Edasi') // contact prefilled and valid
    expect(currentStep()).toContain('4. Kokkuvõte')
    await clickButton('Saada')
    expect(html()).toContain('Nõusolek on kohustuslik')
    expect(onSubmitMock(props)).not.toHaveBeenCalled()
    await toggleCheckbox('consent')
    await clickButton('Saada')
    expect(onSubmitMock(props)).toHaveBeenCalledTimes(1)
    const submitted = onSubmitMock(props).mock.calls[0]?.[0] as ObjectWizardData | undefined
    expect(submitted?.branch).toBe('service')
    expect(submitted?.consentAt).not.toBeNull()
  })
})

describe('submitWizard', () => {
  const CONSENT_AT = '2026-09-15T10:00:00.000Z'

  function apiResponse(status: number, body: unknown): Response {
    return {
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    } as unknown as Response
  }

  function saleData(files: File[] = []): ObjectWizardData {
    return {
      branch: 'sale',
      sale: {
        objectType: 'raieoigus',
        cadastreInput: '78402:003:0210',
        county: 'HH',
        address: '',
        areaHa: '12',
        species: ['MA', 'KU'],
        loggingTypes: ['LR', 'HL'],
        volumeM3: '',
        files,
        description: 'Soovin müüa raieõigust.',
      },
      service: {
        serviceType: null,
        cadastreInput: '',
        county: '',
        provisions: '',
        services: [],
        paperCopy: false,
        comment: '',
        file: null,
      },
      contact: PREFILL,
      consentAt: null,
    }
  }

  function serviceData(
    overrides: Partial<ObjectWizardData['service']> = {},
  ): ObjectWizardData {
    return {
      branch: 'service',
      sale: {
        objectType: null,
        cadastreInput: '',
        county: '',
        address: '',
        areaHa: '',
        species: [],
        loggingTypes: [],
        volumeM3: '',
        files: [],
        description: '',
      },
      service: {
        serviceType: 'kava',
        cadastreInput: '78402:003:0210',
        county: '',
        provisions: '',
        services: [],
        paperCopy: true,
        comment: '',
        file: null,
        ...overrides,
      },
      contact: PREFILL,
      consentAt: CONSENT_AT,
    }
  }

  function deps(
    fetchMock: ReturnType<typeof vi.fn>,
    redirect: ReturnType<typeof vi.fn>,
  ): { fetchImpl: typeof fetch; redirect: (href: string) => void } {
    return { fetchImpl: fetchMock, redirect }
  }

  it('sale: uploads files first, submits the returned keys, and redirects', async () => {
    const files = [
      new File(['pdf'], 'puuraided.pdf', { type: 'application/pdf' }),
      new File(['png'], 'kaart.png', { type: 'image/png' }),
    ]
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(apiResponse(201, { keys: ['uploads/k1', 'uploads/k2'] }))
      .mockResolvedValueOnce(
        apiResponse(201, {
          status: 'ok',
          auction: { id: 'a1', slug: 'raieoigus-78402', status: 'draft' },
          lead: { id: 'l1' },
          assignedSpecialistId: null,
        }),
      )
    const redirect = vi.fn()

    await submitWizard(saleData(files), deps(fetchMock, redirect))

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const [uploadUrl, uploadInit] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ]
    expect(uploadUrl).toBe(SALE_FILES_URL)
    const uploadForm = uploadInit.body as FormData
    const uploaded = uploadForm.getAll('files')
    expect(uploaded).toHaveLength(2)
    expect(uploaded[0]).toBe(files[0])
    expect(uploaded[1]).toBe(files[1])

    const [submitUrl, submitInit] = fetchMock.mock.calls[1] as unknown as [
      string,
      RequestInit,
    ]
    expect(submitUrl).toBe(SALE_SUBMISSION_URL)
    const body = JSON.parse(submitInit.body as string) as Record<string, unknown>
    expect(body.files).toEqual(['uploads/k1', 'uploads/k2'])
    expect(body.branch).toBe('sale')
    expect(body.objectType).toBe('raieoigus')
    expect(body.cadastres).toEqual(['78402:003:0210'])
    expect(body.contact).toEqual(PREFILL)
    expect(redirect).toHaveBeenCalledTimes(1)
    expect(redirect).toHaveBeenCalledWith(SUBMIT_REDIRECT_URL)
  })

  it('sale: skips the upload endpoint when no files are attached', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(apiResponse(201, { status: 'ok', auction: { id: 'a1' }, lead: { id: 'l1' } }))
    const redirect = vi.fn()

    await submitWizard(saleData(), deps(fetchMock, redirect))

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [submitUrl, submitInit] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ]
    expect(submitUrl).toBe(SALE_SUBMISSION_URL)
    const body = JSON.parse(submitInit.body as string) as Record<string, unknown>
    expect('files' in body).toBe(false)
    expect(redirect).toHaveBeenCalledWith(SUBMIT_REDIRECT_URL)
  })

  it('service: posts JSON with consent and an empty honeypot, then redirects', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        apiResponse(201, { status: 'ok', routedCount: 2, request: { id: 'sr1', status: 'routed' } }),
      )
    const redirect = vi.fn()

    await submitWizard(serviceData(), deps(fetchMock, redirect))

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(SERVICE_REQUESTS_URL)
    expect((init.headers as Record<string, string>)['content-type']).toBe('application/json')
    const body = JSON.parse(init.body as string) as Record<string, unknown>
    expect(body).toEqual({
      type: 'kava',
      contact: { name: PREFILL.name, phone: PREFILL.phone, email: PREFILL.email },
      cadastres: '78402:003:0210',
      paper_copy: true,
      company_website: '',
      consentAt: CONSENT_AT,
      formName: '',
      pageSlug: '/user/objects/paku',
    })
    expect(redirect).toHaveBeenCalledWith(SUBMIT_REDIRECT_URL)
  })

  it('service: posts multipart with the hooldusraie file attached', async () => {
    const file = new File(['pdf'], 'hoolduskava.pdf', { type: 'application/pdf' })
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        apiResponse(201, { status: 'ok', routedCount: 1, request: { id: 'sr2', status: 'routed' } }),
      )
    const redirect = vi.fn()

    await submitWizard(
      serviceData({
        serviceType: 'hooldusraie',
        county: 'HH',
        provisions: '5, 7',
        services: ['hooldamine', 'valgusraie'],
        file,
      }),
      deps(fetchMock, redirect),
    )

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(SERVICE_REQUESTS_URL)
    const form = init.body as FormData
    expect(form.get('type')).toBe('hooldusraie')
    expect(form.get('file')).toBe(file)
    expect(form.get('services')).toBe('hooldamine,valgusraie')
    expect(form.get('county')).toBe('HH')
    expect(form.get('paper_copy')).toBeNull()
    expect(form.get('company_website')).toBe('')
    expect(form.get('consentAt')).toBe(CONSENT_AT)
    expect(redirect).toHaveBeenCalledWith(SUBMIT_REDIRECT_URL)
  })

  it('sale: surfaces the 422 field error and does not redirect', async () => {
    const files = [new File(['pdf'], 'puuraided.pdf', { type: 'application/pdf' })]
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(apiResponse(201, { keys: ['uploads/k1'] }))
      .mockResolvedValueOnce(apiResponse(422, { errors: { areaHa: 'Sisesta pindala numbrina.' } }))
    const redirect = vi.fn()

    await expect(
      submitWizard(saleData(files), deps(fetchMock, redirect)),
    ).rejects.toThrow('Sisesta pindala numbrina.')
    expect(redirect).not.toHaveBeenCalled()
  })

  it('service: surfaces the 409 duplicate error and does not redirect', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(apiResponse(409, { error: 'Päring on juba saadetud' }))
    const redirect = vi.fn()

    await expect(
      submitWizard(serviceData(), deps(fetchMock, redirect)),
    ).rejects.toThrow('Päring on juba saadetud')
    expect(redirect).not.toHaveBeenCalled()
  })
})

describe('ObjectWizardSubmitter', () => {
  function apiResponse(status: number, body: unknown): Response {
    return {
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    } as unknown as Response
  }

  async function mountSubmitter(): Promise<void> {
    await act(async () => {
      root = createRoot(container)
      root.render(createElement(ObjectWizardSubmitter, { contactPrefill: PREFILL }))
      await flush()
    })
  }

  async function selectCard(label: string): Promise<void> {
    const card = [...container.querySelectorAll('button')].find((button) =>
      button.textContent.includes(label),
    )
    if (card === undefined) throw new Error(`missing card: ${label}`)
    await clickElement(card)
  }

  async function walkToServiceSummary(): Promise<void> {
    await selectCard('Metsamajanduskava')
    await clickButton('Edasi')
    await typeInto('input[name="service-cadastres"]', '78402:003:0210')
    await toggleCheckbox('paper_copy')
    await clickButton('Edasi')
    await clickButton('Edasi') // contact prefilled and valid
    await toggleCheckbox('consent')
  }

  async function walkToSaleSummary(): Promise<void> {
    await selectCard('Raieõiguse müük')
    await clickButton('Edasi')
    await typeInto('input[name="cadastres"]', '78402:003:0210')
    await clickButton('Edasi')
    await typeInto('input[name="areaHa"]', '12')
    await toggleCheckbox('species')
    await toggleCheckbox('loggingTypes')
    await clickButton('Edasi')
    await clickButton('Edasi') // files are optional
    await typeInto('textarea[name="description"]', 'Soovin müüa raieõigust.')
    await clickButton('Edasi')
    await clickButton('Edasi') // contact prefilled and valid
  }

  it('posts the kava request and redirects to the object list', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        apiResponse(201, { status: 'ok', routedCount: 1, request: { id: 'sr1', status: 'routed' } }),
      )
    vi.stubGlobal('fetch', fetchMock)
    await mountSubmitter()

    await walkToServiceSummary()
    await clickButton('Saada')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe(SERVICE_REQUESTS_URL)
    expect(pushMock).toHaveBeenCalledTimes(1)
    expect(pushMock).toHaveBeenCalledWith('/user/objects')
  })

  it('keeps the wizard on the summary with the server error on 409', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(apiResponse(409, { error: 'Päring on juba saadetud' })),
    )
    await mountSubmitter()

    await walkToServiceSummary()
    await clickButton('Saada')

    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'Päring on juba saadetud',
    )
    expect(currentStep()).toContain('4. Kokkuvõte')
    expect(pushMock).not.toHaveBeenCalled()
  })

  it('keeps the sale wizard on the summary with the field error on 422', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(apiResponse(422, { errors: { areaHa: 'Sisesta pindala numbrina.' } })),
    )
    await mountSubmitter()

    await walkToSaleSummary()
    await clickButton('Saada')

    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'Sisesta pindala numbrina.',
    )
    expect(currentStep()).toContain('7. Kokkuvõte')
    expect(pushMock).not.toHaveBeenCalled()
  })
})
