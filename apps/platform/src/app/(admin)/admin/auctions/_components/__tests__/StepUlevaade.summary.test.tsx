// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { StepUlevaade } from '../StepUlevaade'
import type { AuctionWizardInitial, AuctionWizardOptions } from '../wizard-model'
import { baseWizardState, createWizardInitial } from './fixtures'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

const wizardOptions: AuctionWizardOptions = {
  counties: [{ id: 'c1', name: 'Harjumaa' }],
  parishes: [{ id: 'p1', name: 'Kuusalu vald', countyId: 'c1' }],
  specialists: [{ id: 'spec-1', name: 'Mari Maasikas' }],
  antiSnipeDefaultMinutes: 5,
  defaultFeePercent: 3,
  canFeeOverride: true,
  canReassignSpecialist: true,
}

let container: HTMLDivElement
let root: Root

async function mountStep(initial: AuctionWizardInitial, state = initial.state): Promise<void> {
  await act(async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    root.render(
      createElement(StepUlevaade, {
        state,
        patch: vi.fn(),
        errors: {},
        initial,
        options: wizardOptions,
        goToStep: vi.fn(),
      }),
    )
    await Promise.resolve()
  })
}

async function unmountStep(): Promise<void> {
  await act(async () => {
    root.unmount()
    await Promise.resolve()
  })
  container.remove()
}

afterEach(async () => {
  await unmountStep()
})

function section(title: string): HTMLElement {
  const heading = [...container.querySelectorAll('h3')].find(
    (candidate) => candidate.textContent === title,
  )
  if (heading === undefined) throw new Error(`section ${title} not found`)
  const section = heading.closest('section')
  if (section === null) throw new Error(`section element ${title} not found`)
  return section
}

describe('StepUlevaade read-only summary (task 5.6)', () => {
  it('renders the field summary without a diff for an unpublished lot', async () => {
    await mountStep(createWizardInitial)
    const summary = section('Väljade kokkuvõte')
    expect(summary.textContent).toContain('Harjumaa raieõigus')
    expect(summary.textContent).toContain('Harjumaa, Kuusalu vald, Metsa tänav 1')
    expect(summary.textContent).toContain('Mari Maasikas')
    expect(container.textContent).not.toContain('Muudatused võrreldes salvestatud olekuga')
  })

  it('masks a stored reserve in the summary', async () => {
    await mountStep({ ...createWizardInitial, hasReserve: true })
    expect(section('Väljade kokkuvõte').textContent).toContain('määratud (varjatud)')
  })
})

describe('StepUlevaade two-column diff (task 5.6)', () => {
  const publishedInitial: AuctionWizardInitial = {
    ...createWizardInitial,
    auctionId: 'a1b2c3d4-0000-0000-0000-000000000001',
    mechanicsLocked: true,
  }

  it('shows saved vs current columns for changed fields on a published lot', async () => {
    await mountStep(publishedInitial, {
      ...baseWizardState,
      title: 'Uus pealkiri',
      minBidEur: '2500',
    })

    const diff = section('Muudatused võrreldes salvestatud olekuga')
    const headers = [...diff.querySelectorAll('thead th')].map((th) => th.textContent)
    expect(headers).toEqual(['Väli', 'Salvestatud', 'Praegune'])

    const rows = [...diff.querySelectorAll('tbody tr')].map((tr) =>
      [...tr.querySelectorAll('td')].map((td) => td.textContent),
    )
    expect(rows).toEqual([
      ['Nimi', 'Harjumaa raieõigus', 'Uus pealkiri'],
      ['Alghind', '3000 €', '2500 €'],
    ])
  })

  it('renders a reserve change as masked in both columns', async () => {
    await mountStep(
      { ...publishedInitial, hasReserve: true },
      { ...baseWizardState, reserveEur: '1000' },
    )

    const diff = section('Muudatused võrreldes salvestatud olekuga')
    const reserveRow = [...diff.querySelectorAll('tbody tr')].find((tr) =>
      tr.textContent.includes('Piirhind'),
    )
    if (reserveRow === undefined) throw new Error('reserve diff row not found')
    const cells = [...reserveRow.querySelectorAll('td')].map((td) => td.textContent)
    expect(cells).toEqual(['Piirhind', 'muudetud (varjatud)', 'muudetud (varjatud)'])
  })

  it('keeps unchanged lots free of a diff table', async () => {
    await mountStep(publishedInitial)
    expect(container.textContent).not.toContain('Muudatused võrreldes salvestatud olekuga')
  })
})
