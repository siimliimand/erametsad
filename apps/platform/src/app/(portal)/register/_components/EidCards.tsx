'use client'

import { METHOD_LABELS } from '../../login/_components/EidMethodCards'
import type { EidMethod } from '../../login/_components/eid-client'
import {
  CreditCardIcon,
  MessageSquareIcon,
  SmartphoneIcon,
} from '../../login/_components/icons'

// Hints use the demo copy (06-register.html .eid-grid); Smart-ID carries the
// "Soovitatav" marker with the highlighted eid-primary style.
const METHOD_HINTS: Record<EidMethod, string> = {
  smartid: 'Soovitatav — kinnitus telefoni või arvuti kaudu',
  mobileid: 'Kinnitus SIM-kaardi kaudu',
  idcard: 'Loe kaart kaardilugejaga',
}

const METHOD_ICONS: Record<EidMethod, typeof SmartphoneIcon> = {
  smartid: SmartphoneIcon,
  mobileid: MessageSquareIcon,
  idcard: CreditCardIcon,
}

interface EidCardsProps {
  selected: EidMethod | null
  onSelect: (method: EidMethod) => void
}

export function EidCards({ selected, onSelect }: EidCardsProps) {
  const methods = Object.keys(METHOD_LABELS) as EidMethod[]

  return (
    <div role="group" aria-label="eID autentimisviisid" className="grid gap-3">
      {methods.map((method) => {
        const Icon = METHOD_ICONS[method]
        const isSelected = selected === method
        const isRecommended = method === 'smartid'
        return (
          <button
            key={method}
            type="button"
            aria-pressed={isSelected}
            onClick={() => {
              onSelect(method)
            }}
            className={`flex min-h-[60px] w-full items-center gap-3.5 rounded-button border-[1.5px] px-[18px] py-3 text-left transition-colors duration-hover ease-hover motion-reduce:transition-none ${
              isRecommended
                ? 'border-primary bg-primaryLight'
                : isSelected
                  ? 'border-primary bg-bgPage'
                  : 'border-border bg-bgPage hover:border-primary'
            }`}
          >
            <Icon
              className="h-[22px] w-[22px] flex-none text-primary"
              aria-hidden="true"
            />
            <span className="font-semibold text-body text-ink">
              {METHOD_LABELS[method]}
              <small className="block font-normal leading-snug text-label text-inkMuted">
                {METHOD_HINTS[method]}
              </small>
            </span>
          </button>
        )
      })}
    </div>
  )
}
