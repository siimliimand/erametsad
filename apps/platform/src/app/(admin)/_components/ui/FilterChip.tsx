import type { ReactNode } from 'react'

import { ChevronDownIcon } from '../icons'

export interface FilterChipProps {
  label: ReactNode
  // Control slot (select/input per the 02/06/14 demo filter chips).
  children?: ReactNode
  chevron?: boolean
  onRemove?: () => void
  removeLabel?: string
}

const chipClass =
  'inline-flex h-[34px] cursor-pointer items-center gap-1.5 rounded-pill border border-border bg-bgPage px-2.5 transition-colors duration-hover ease-hover focus-within:border-primary'

// Filter bar chip. With a control it renders as a <label> wrapping it
// (02-auctions-list demo); with onRemove it renders as a plain chip whose ×
// button clears the filter (03-auction-editor pick-chip pattern).
export function FilterChip({
  label,
  children,
  chevron,
  onRemove,
  removeLabel = 'Eemalda',
}: FilterChipProps) {
  const content = (
    <>
      <span className="text-label font-medium text-inkMuted">{label}</span>
      {children}
      {chevron ? (
        <ChevronDownIcon className="pointer-events-none h-3.5 w-3.5 shrink-0 text-inkMuted" />
      ) : null}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel}
          className="grid h-[18px] w-[18px] place-items-center rounded-pill text-[13px] leading-none text-inkMuted transition-colors duration-hover ease-hover hover:bg-dangerLight hover:text-danger"
        >
          ×
        </button>
      ) : null}
    </>
  )
  if (onRemove) return <span className={chipClass}>{content}</span>
  return <label className={chipClass}>{content}</label>
}
