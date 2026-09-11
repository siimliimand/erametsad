import { statusChipLabels } from '../_lib/labels'

import type { AuctionStatus } from '@/lib/data/schema'

/**
 * The one admin status variant set (spec admin-ui "Unified status pill"),
 * mapped from the demo prototypes in docs/design/demo/admin. Bare names are
 * the auction lifecycle triads; absorbed domains use `domain:state` keys
 * because draft/active/contract collide across domains.
 */
export type StatusChipVariant =
  | AuctionStatus
  | 'ending'
  | 'user:active'
  | 'user:suspended'
  | 'user:deleted'
  | 'user:banned'
  | 'contract:prepared'
  | 'contract:sent'
  | 'contract:signed'
  | 'contract:voided'
  | 'lead:new'
  | 'lead:contacted'
  | 'lead:qualified'
  | 'lead:contract'
  | 'lead:disqualified'
  | 'content:draft'
  | 'content:published'
  | 'company:pending'
  | 'company:approved'
  | 'company:rejected'
  | 'company:held'

const variantChipClass: Record<StatusChipVariant, string> = {
  draft: 'bg-[var(--st-draft-bg)] text-[color:var(--st-draft-text)]',
  scheduled:
    'bg-[var(--st-scheduled-bg)] text-[color:var(--st-scheduled-text)]',
  active: 'bg-[var(--st-active-bg)] text-[color:var(--st-active-text)]',
  ending: 'bg-[var(--st-ending-bg)] text-[color:var(--st-ending-text)]',
  ended: 'bg-[var(--st-ended-bg)] text-[color:var(--st-ended-text)]',
  // No demo triad exists for appraised; archived grey is the nearest neutral match.
  appraised: 'bg-[var(--st-archived-bg)] text-[color:var(--st-archived-text)]',
  unsold:
    'border border-[var(--st-unsold)] bg-transparent text-[color:var(--st-unsold)]',
  contract: 'bg-[var(--st-contract-bg)] text-[color:var(--st-contract-text)]',
  // No demo triad exists for completed; contract green is the nearest semantic match.
  completed: 'bg-[var(--st-contract-bg)] text-[color:var(--st-contract-text)]',
  archived: 'bg-[var(--st-archived-bg)] text-[color:var(--st-archived-text)]',
  // Demo 06-users: Peatatud wears the ended amber triad, Keelatud danger red.
  'user:active': 'bg-[var(--st-active-bg)] text-[color:var(--st-active-text)]',
  'user:suspended': 'bg-[var(--st-ended-bg)] text-[color:var(--st-ended-text)]',
  // No demo triad exists for a self-deleted account; archived grey is the
  // nearest neutral match, matching the appraised treatment above.
  'user:deleted': 'bg-[var(--st-archived-bg)] text-[color:var(--st-archived-text)]',
  'user:banned': 'bg-danger-light text-danger',
  // Demo 08-contracts glyph states; spec admin-commerce-ops pins the sent
  // state to the blue (info) triad.
  'contract:prepared':
    'bg-[var(--st-draft-bg)] text-[color:var(--st-draft-text)]',
  'contract:sent': 'bg-info-light text-info',
  'contract:signed':
    'bg-[var(--st-contract-bg)] text-[color:var(--st-contract-text)]',
  'contract:voided': 'bg-danger-light text-danger',
  // Demo 09-leads-crm stage colors.
  'lead:new': 'bg-info-light text-info',
  'lead:contacted': 'bg-[var(--st-ended-bg)] text-[color:var(--st-ended-text)]',
  'lead:qualified':
    'bg-[var(--st-active-bg)] text-[color:var(--st-active-text)]',
  'lead:contract':
    'bg-[var(--st-contract-bg)] text-[color:var(--st-contract-text)]',
  'lead:disqualified': 'bg-danger-light text-danger',
  // Demo 11-cms-content: Mustand / Avaldatud.
  'content:draft': 'bg-[var(--st-draft-bg)] text-[color:var(--st-draft-text)]',
  'content:published':
    'bg-[var(--st-active-bg)] text-[color:var(--st-active-text)]',
  // Demo 07-company-approvals shows approved/rejected; pending/held follow
  // the established info/neutral mapping.
  'company:pending':
    'bg-[var(--st-scheduled-bg)] text-[color:var(--st-scheduled-text)]',
  'company:approved':
    'bg-[var(--st-active-bg)] text-[color:var(--st-active-text)]',
  'company:rejected': 'bg-danger-light text-danger',
  'company:held':
    'bg-[var(--st-archived-bg)] text-[color:var(--st-archived-text)]',
}

const variantDotClass: Record<StatusChipVariant, string | null> = {
  draft: 'bg-[var(--st-draft-dot)]',
  scheduled: 'bg-[var(--st-scheduled-dot)]',
  active: 'bg-[var(--st-active-dot)]',
  ending: 'bg-[var(--st-ending-dot)]',
  ended: 'bg-[var(--st-ended-dot)]',
  appraised: 'bg-[var(--st-archived-dot)]',
  unsold: 'bg-[var(--st-unsold)]',
  contract: 'bg-[var(--st-contract-dot)]',
  completed: 'bg-[var(--st-contract-dot)]',
  archived: 'bg-[var(--st-archived-dot)]',
  'user:active': 'bg-[var(--st-active-dot)]',
  'user:suspended': 'bg-[var(--st-ended-dot)]',
  'user:deleted': 'bg-[var(--st-archived-dot)]',
  'user:banned': 'bg-danger',
  'contract:prepared': null,
  'contract:sent': null,
  'contract:signed': null,
  'contract:voided': null,
  'lead:new': 'bg-info',
  'lead:contacted': 'bg-[var(--st-ended-dot)]',
  'lead:qualified': 'bg-[var(--st-active-dot)]',
  'lead:contract': 'bg-[var(--st-contract-dot)]',
  'lead:disqualified': 'bg-danger',
  'content:draft': 'bg-[var(--st-draft-dot)]',
  'content:published': 'bg-[var(--st-active-dot)]',
  'company:pending': 'bg-[var(--st-scheduled-dot)]',
  'company:approved': 'bg-[var(--st-active-dot)]',
  'company:rejected': 'bg-danger',
  'company:held': 'bg-[var(--st-archived-dot)]',
}

/** Contract lifecycle states render demo glyphs instead of a dot. */
const variantGlyph: Partial<Record<StatusChipVariant, string>> = {
  'contract:prepared': '◻',
  'contract:sent': '▣',
  'contract:signed': '✓',
  'contract:voided': '✕',
}

export function StatusChip({ status }: { status: StatusChipVariant }) {
  const glyph = variantGlyph[status]
  const dotClass = variantDotClass[status]
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-pill px-2 py-0.5 text-label font-medium ${variantChipClass[status]}`}
    >
      {glyph ? (
        <span aria-hidden="true">{glyph}</span>
      ) : dotClass ? (
        <span
          aria-hidden="true"
          className={`h-1.5 w-1.5 rounded-pill ${dotClass}`}
        />
      ) : null}
      {statusChipLabels[status]}
    </span>
  )
}
