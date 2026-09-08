import { describe, expect, it } from 'vitest'

import { visibleWizardSteps, wizardSteps } from '../steps'
import { wizardDefectLabel, wizardRailSteps } from '../wizard-model'
import type {
  AuctionWizardInitial,
  AuctionWizardOptions,
  AuctionWizardState,
} from '../wizard-model'
import { baseWizardState, createWizardInitial } from './fixtures'

const options: Pick<
  AuctionWizardOptions,
  'canFeeOverride' | 'canReassignSpecialist'
> = {
  canFeeOverride: true,
  canReassignSpecialist: true,
}

function hiddenStepIds(state: AuctionWizardState): string[] {
  const visible = visibleWizardSteps(state.objectType)
  return wizardSteps
    .filter((entry) => !visible.includes(entry))
    .map((entry) => entry.id)
}

function railFor(
  state: AuctionWizardState,
  currentStep: number,
  initial: AuctionWizardInitial = createWizardInitial,
): ReturnType<typeof wizardRailSteps> {
  return wizardRailSteps(
    wizardSteps,
    hiddenStepIds(state),
    initial,
    state,
    options,
    currentStep,
  )
}

function marksByStepId(state: AuctionWizardState, currentStep: number) {
  return Object.fromEntries(
    railFor(state, currentStep).map((entry) => [entry.id, entry]),
  )
}

describe('wizardRailSteps', () => {
  it('marks a fully valid draft as done with the current step on top', () => {
    const rail = railFor(baseWizardState, 1)
    expect(rail.map((entry) => entry.step)).toEqual([1, 2, 3, 4, 5, 6, 7])

    const marks = marksByStepId(baseWizardState, 1)
    expect(marks.type).toMatchObject({ mark: 'current', defects: 0 })
    for (const id of ['location', 'land', 'pricing', 'content', 'review']) {
      expect(marks[id]).toMatchObject({ mark: 'done', defects: 0 })
    }
    // The Pakett row stays disabled for a non-package lot and never counts.
    expect(marks.package).toMatchObject({ mark: 'disabled', defects: 0 })
  })

  it('marks a step with blocking defects as todo and counts them', () => {
    // antiSnipeEnabled is on, so empty minutes is one blocking defect on step 1.
    const state: AuctionWizardState = { ...baseWizardState, antiSnipeMinutes: '' }
    const marks = marksByStepId(state, 3)

    // A visited-but-invalid step is todo; the current step is unaffected.
    expect(marks.type).toMatchObject({ mark: 'todo', defects: 1 })
    expect(marks.land).toMatchObject({ mark: 'current', defects: 0 })
    // Valid steps stay done regardless of visit order.
    expect(marks.pricing).toMatchObject({ mark: 'done', defects: 0 })
  })

  it('lets the current mark override a defect on the active step', () => {
    const state: AuctionWizardState = { ...baseWizardState, antiSnipeMinutes: '' }
    const marks = marksByStepId(state, 1)
    expect(marks.type).toMatchObject({ mark: 'current', defects: 1 })
  })

  it('shows all seven steps without a disabled row for a package lot', () => {
    const packageState: AuctionWizardState = {
      ...baseWizardState,
      objectType: 'pakett',
      auctionType: 'sealed',
      bidStepEur: '',
      propertyCount: 2,
      packageHeader: 'Kaks katastrit',
      packageRows: [
        {
          cadastre: '34801:001:0217',
          registryNumber: '150934',
          county: 'Harjumaa',
          areaHa: '5,5',
          minBidEur: '1500',
        },
        {
          cadastre: '34801:001:0218',
          registryNumber: '',
          county: '',
          areaHa: '6,9',
          minBidEur: '',
        },
      ],
      volumeM3: '',
    }
    const rail = railFor(packageState, 7)
    expect(rail).toHaveLength(7)
    expect(rail.some((entry) => entry.mark === 'disabled')).toBe(false)
    const marks = Object.fromEntries(rail.map((entry) => [entry.id, entry]))
    expect(marks.package).toMatchObject({ mark: 'done', defects: 0 })
    expect(marks.review).toMatchObject({ mark: 'current', defects: 0 })
  })
})

describe('wizardDefectLabel', () => {
  it('uses the singular for one defect and the partitive otherwise', () => {
    expect(wizardDefectLabel(1)).toBe('1 puudus')
    expect(wizardDefectLabel(2)).toBe('2 puudust')
    expect(wizardDefectLabel(0)).toBe('0 puudust')
  })
})
