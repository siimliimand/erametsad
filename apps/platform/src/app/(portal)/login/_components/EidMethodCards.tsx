'use client'

import { CreditCard, MessageSquare, Smartphone } from 'lucide-react'
import type { ComponentType, SVGProps } from 'react'

import type { EidMethod } from './eid-client'

export const METHOD_LABELS: Record<EidMethod, string> = {
  smartid: 'Smart-ID',
  mobileid: 'Mobiil-ID',
  idcard: 'ID-kaart',
}

const METHOD_ICONS: Record<EidMethod, ComponentType<SVGProps<SVGSVGElement>>> = {
  smartid: Smartphone,
  mobileid: MessageSquare,
  idcard: CreditCard,
}

// Hints from demo 05-login.html.
const METHOD_HINTS: Record<EidMethod, string> = {
  smartid: 'Kiireim viis — kinnita telefonis PIN1',
  mobileid: 'Kinnituskood saadetakse SMS-iga',
  idcard: 'Kaardilugejaga, kinnita arvutis PIN1',
}

interface EidMethodCardsProps {
  selected: EidMethod | null
  disabled: boolean
  onSelect: (method: EidMethod) => void
}

// Demo 05 eid-btn rows: Smart-ID as the filled primary method, the rest as
// outline rows. Selection adds a ring on top of the fixed demo styles.
export function EidMethodCards({ selected, disabled, onSelect }: EidMethodCardsProps) {
  const methods = Object.keys(METHOD_LABELS) as EidMethod[]

  return (
    <div role="group" aria-label="eID autentimisviisid" className="grid gap-2.5">
      {methods.map((method) => {
        const Icon = METHOD_ICONS[method]
        const isSelected = selected === method
        const isPrimary = method === 'smartid'
        return (
          <button
            key={method}
            type="button"
            aria-pressed={isSelected}
            disabled={disabled}
            onClick={() => {
              onSelect(method)
            }}
            className={`flex min-h-[58px] items-center gap-3.5 rounded-button border px-4 py-2.5 text-left transition-colors duration-hover ease-hover motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-60 ${
              isPrimary
                ? 'border-transparent bg-primary text-ink-inverse hover:bg-primary-hover'
                : 'border-border bg-bgPage text-ink hover:border-primary hover:bg-primaryLight hover:text-primary'
            } ${
              isSelected ? 'ring-2 ring-primary ring-offset-2 ring-offset-bgPage' : ''
            }`}
          >
            <Icon className="h-[22px] w-[22px] shrink-0" aria-hidden="true" />
            <span className="flex flex-col">
              <span className="font-body text-body font-bold leading-[1.3]">
                {METHOD_LABELS[method]}
              </span>
              <span className="font-body text-[13px] font-medium leading-[1.4] opacity-85">
                {METHOD_HINTS[method]}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
