// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ObjectWizard } from '../ObjectWizard'
import type { ObjectWizardData, ObjectWizardProps } from '../types'

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
})

afterEach(() => {
  act(() => {
    root.unmount()
  })
  container.remove()
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
