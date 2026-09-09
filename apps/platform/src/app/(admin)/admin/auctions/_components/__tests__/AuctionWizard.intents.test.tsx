// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AuctionWizard } from '../AuctionWizard'
import type { AuctionWizardInitial, AuctionWizardOptions } from '../wizard-model'
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

const submitAction = vi.fn((_formData: FormData): Promise<void> => Promise.resolve())

let container: HTMLDivElement
let root: Root

async function mountWizard(initial: AuctionWizardInitial = createWizardInitial): Promise<void> {
  await act(async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    root.render(
      createElement(AuctionWizard, {
        action: submitAction,
        submitLabel: 'Salvesta muudatused',
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
})

afterEach(async () => {
  await unmountWizard()
})

function intentButton(intent: string): HTMLButtonElement {
  const button = container.querySelector<HTMLButtonElement>(
    `button[type="submit"][data-intent="${intent}"]`,
  )
  if (button === null) throw new Error(`intent button ${intent} not found`)
  return button
}

async function clickSubmit(button: HTMLButtonElement): Promise<void> {
  await act(async () => {
    button.click()
    await Promise.resolve()
  })
}

function submittedIntent(): string | null {
  const value = submitAction.mock.calls[0]?.[0].get('intent')
  return typeof value === 'string' ? value : null
}

describe('AuctionWizard intent buttons', () => {
  it('renders the three split actions (task 5.5)', async () => {
    await mountWizard()
    expect(intentButton('draft').textContent).toBe('Salvesta mustandina')
    expect(intentButton('schedule').textContent).toBe('Ajasta')
    expect(intentButton('publish').textContent).toBe('Avalda kohe')
  })

  it('submits the draft intent without publish-readiness gates', async () => {
    await mountWizard({
      ...createWizardInitial,
      state: { ...baseWizardState, specialistId: '' },
    })
    await clickSubmit(intentButton('draft'))
    expect(submitAction).toHaveBeenCalledTimes(1)
    expect(submittedIntent()).toBe('draft')
  })

  it('Ajasta submits when the start is far enough in the future', async () => {
    await mountWizard({
      ...createWizardInitial,
      state: { ...baseWizardState, specialistId: '' },
    })
    await clickSubmit(intentButton('schedule'))
    expect(submitAction).toHaveBeenCalledTimes(1)
    expect(submittedIntent()).toBe('schedule')
  })

  it('Avalda kohe is blocked client-side without a specialist', async () => {
    await mountWizard({
      ...createWizardInitial,
      state: { ...baseWizardState, specialistId: '' },
    })
    await clickSubmit(intentButton('publish'))
    expect(submitAction).not.toHaveBeenCalled()
    // The readiness error surfaces as a field alert (step 5, Sisu).
    const alerts = [...container.querySelectorAll('[role="alert"]')].map((entry) => entry.textContent)
    expect(alerts.some((text) => text.includes('Määra vastutav spetsialist'))).toBe(true)
  })

  it('Avalda kohe submits when the readiness gates pass', async () => {
    await mountWizard()
    await clickSubmit(intentButton('publish'))
    expect(submitAction).toHaveBeenCalledTimes(1)
    expect(submittedIntent()).toBe('publish')
  })
})
