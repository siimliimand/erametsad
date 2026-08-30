'use client'

import type { ComponentType, SVGProps } from 'react'

import type { EidMethod } from './eid-client'
import { CreditCardIcon, MessageSquareIcon, SmartphoneIcon } from './icons'

export const METHOD_LABELS: Record<EidMethod, string> = {
  smartid: 'Smart-ID',
  mobileid: 'Mobiil-ID',
  idcard: 'ID-kaart',
}

const METHOD_ICONS: Record<EidMethod, ComponentType<SVGProps<SVGSVGElement>>> = {
  smartid: SmartphoneIcon,
  mobileid: MessageSquareIcon,
  idcard: CreditCardIcon,
}

const METHOD_HINTS: Record<EidMethod, string> = {
  smartid: 'Kinnita nutiseadmes või arvutis',
  mobileid: 'Kinnita SIM-kaardi PIN-iga',
  idcard: 'Kasuta kaarti ja kaardilugejat',
}

interface EidMethodCardsProps {
  selected: EidMethod | null
  disabled: boolean
  onSelect: (method: EidMethod) => void
}

export function EidMethodCards({ selected, disabled, onSelect }: EidMethodCardsProps) {
  const methods = Object.keys(METHOD_LABELS) as EidMethod[]

  return (
    <div role="group" aria-label="eID autentimisviisid" className="grid gap-sm sm:grid-cols-3">
      {methods.map((method) => {
        const Icon = METHOD_ICONS[method]
        const isSelected = selected === method
        return (
          <button
            key={method}
            type="button"
            aria-pressed={isSelected}
            disabled={disabled}
            onClick={() => {
              onSelect(method)
            }}
            className={`flex flex-col items-start gap-2xs rounded-card border p-sm text-left transition-all duration-hover ease-hover motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-60 ${
              isSelected
                ? 'border-primary bg-primaryLight ring-1 ring-primary'
                : 'border-border bg-bgPage hover:border-primary'
            }`}
          >
            <Icon
              className={`h-6 w-6 ${isSelected ? 'text-primary' : 'text-inkMuted'}`}
              aria-hidden="true"
            />
            <span className="font-label font-semibold text-ink">{METHOD_LABELS[method]}</span>
            <span className="font-body text-bodySm text-inkMuted">{METHOD_HINTS[method]}</span>
          </button>
        )
      })}
    </div>
  )
}
