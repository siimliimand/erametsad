'use client'

import type { ReactNode } from 'react'

import { StepLandForest } from './StepLandForest'
import { StepLocation } from './StepLocation'
import { StepPakett } from './StepPakett'
import { StepPricing } from './StepPricing'
import { StepSisu } from './StepSisu'
import { StepTypeMechanics } from './StepTypeMechanics'
import { StepUlevaade } from './StepUlevaade'
import type { WizardStepContext } from './wizard-model'

import type { AuctionObjectType } from '@/lib/data/schema'

/**
 * The wizard's step registry (docs/design/admin/03, seven steps). Step
 * numbers are canonical and stable; the Pakett entry stays out of the
 * visible list for non-package lots (see `visibleWizardSteps`).
 */
export interface WizardStepDefinition {
  id: string
  label: string
  render: (context: WizardStepContext) => ReactNode
}

export const wizardSteps: readonly WizardStepDefinition[] = [
  { id: 'type', label: 'Tüüp ja mehaanika', render: (context) => <StepTypeMechanics {...context} /> },
  { id: 'location', label: 'Asukoht', render: (context) => <StepLocation {...context} /> },
  { id: 'land', label: 'Maa ja mets', render: (context) => <StepLandForest {...context} /> },
  { id: 'pricing', label: 'Hind', render: (context) => <StepPricing {...context} /> },
  { id: 'content', label: 'Sisu', render: (context) => <StepSisu {...context} /> },
  { id: 'package', label: 'Pakett', render: (context) => <StepPakett {...context} /> },
  { id: 'review', label: 'Ülevaade', render: (context) => <StepUlevaade {...context} /> },
]

/** Step 6 renders only for package lots (docs 03: "Step 6 hidden unless objectType=package"). */
export function visibleWizardSteps(objectType: AuctionObjectType): readonly WizardStepDefinition[] {
  return objectType === 'pakett' ? wizardSteps : wizardSteps.filter((step) => step.id !== 'package')
}
