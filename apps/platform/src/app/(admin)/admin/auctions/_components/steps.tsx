'use client'

import type { ReactNode } from 'react'

import { StepLandForest } from './StepLandForest'
import { StepLocation } from './StepLocation'
import { StepPricing } from './StepPricing'
import { StepTypeMechanics } from './StepTypeMechanics'
import type { WizardStepContext } from './wizard-model'

/**
 * The wizard's step registry — the extension point for task 2.5 (Sisu,
 * Pakett, Ülevaade): add real renderers in place of the placeholders and
 * extend AuctionWizardState with the fields those steps own.
 */
export interface WizardStepDefinition {
  id: string
  label: string
  render: (context: WizardStepContext) => ReactNode
}

function StepPlaceholder({ label }: { label: string }) {
  return (
    <p className="rounded-card border border-dashed border-border bg-bgMist p-md text-bodySm text-inkMuted">
      Samm “{label}” on veel arendamisel (ülesanne 2.5). Andmed siit sammust ei lähe praegu
      salvestusse.
    </p>
  )
}

export const wizardSteps: readonly WizardStepDefinition[] = [
  { id: 'type', label: 'Tüüp ja mehaanika', render: (context) => <StepTypeMechanics {...context} /> },
  { id: 'location', label: 'Asukoht', render: (context) => <StepLocation {...context} /> },
  { id: 'land', label: 'Maa ja mets', render: (context) => <StepLandForest {...context} /> },
  { id: 'pricing', label: 'Hind', render: (context) => <StepPricing {...context} /> },
  { id: 'content', label: 'Sisu', render: () => <StepPlaceholder label="Sisu" /> },
  { id: 'package', label: 'Pakett', render: () => <StepPlaceholder label="Pakett" /> },
  { id: 'review', label: 'Ülevaade', render: () => <StepPlaceholder label="Ülevaade" /> },
]
