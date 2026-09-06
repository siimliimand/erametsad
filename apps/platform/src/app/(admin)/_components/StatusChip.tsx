import { auctionStatusLabels } from '../_lib/labels'

import type { AuctionStatus } from '@/lib/data/schema'

const statusChipClass: Record<AuctionStatus, string> = {
  draft: 'bg-[var(--st-draft-bg)] text-[color:var(--st-draft-text)]',
  scheduled: 'bg-[var(--st-scheduled-bg)] text-[color:var(--st-scheduled-text)]',
  active: 'bg-[var(--st-active-bg)] text-[color:var(--st-active-text)]',
  ended: 'bg-[var(--st-ended-bg)] text-[color:var(--st-ended-text)]',
  // No demo triad exists for appraised; archived grey is the nearest neutral match.
  appraised: 'bg-[var(--st-archived-bg)] text-[color:var(--st-archived-text)]',
  unsold: 'border border-[var(--st-unsold)] bg-transparent text-[color:var(--st-unsold)]',
  contract: 'bg-[var(--st-contract-bg)] text-[color:var(--st-contract-text)]',
  // No demo triad exists for completed; contract green is the nearest semantic match.
  completed: 'bg-[var(--st-contract-bg)] text-[color:var(--st-contract-text)]',
  archived: 'bg-[var(--st-archived-bg)] text-[color:var(--st-archived-text)]',
}

const statusDotClass: Record<AuctionStatus, string | null> = {
  draft: 'bg-[var(--st-draft-dot)]',
  scheduled: 'bg-[var(--st-scheduled-dot)]',
  active: 'bg-[var(--st-active-dot)]',
  ended: 'bg-[var(--st-ended-dot)]',
  appraised: 'bg-[var(--st-archived-dot)]',
  // Outline style: no dot for unsold.
  unsold: null,
  contract: 'bg-[var(--st-contract-dot)]',
  completed: 'bg-[var(--st-contract-dot)]',
  archived: 'bg-[var(--st-archived-dot)]',
}

export function StatusChip({ status }: { status: AuctionStatus }) {
  const dotClass = statusDotClass[status]
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-pill px-2 py-0.5 text-label font-medium ${statusChipClass[status]}`}
    >
      {dotClass ? <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-pill ${dotClass}`} /> : null}
      {auctionStatusLabels[status]}
    </span>
  )
}
