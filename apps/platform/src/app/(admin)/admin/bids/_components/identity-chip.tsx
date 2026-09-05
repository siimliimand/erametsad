'use client'

import { useState, useTransition } from 'react'

import {
  revealBidderIdentityAction,
  type BidderIdentityView,
} from '../../../_actions/auctions'

type RevealState =
  | { ok: true; identity: BidderIdentityView }
  | { ok: false; error: string }

/**
 * The audited reveal chip: the only client path from an anonymized label to
 * a real identity. The server action writes the `user.identity_view` audit
 * entry before the identity value ever reaches this component, and enforces
 * the per-role rules (seller: alapakkumine rows on its own lots only).
 */
export function IdentityRevealChip({ bidId }: { bidId: string }) {
  const [state, setState] = useState<RevealState | null>(null)
  const [pending, startTransition] = useTransition()

  if (state !== null) {
    if (!state.ok) {
      return <span className="text-label font-semibold text-danger">{state.error}</span>
    }
    return (
      <span className="text-label font-semibold text-ink">
        {state.identity.name ?? state.identity.email}
        {state.identity.name !== null ? (
          <span className="ml-1 font-normal text-ink-muted">({state.identity.email})</span>
        ) : null}
      </span>
    )
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const reveal = await revealBidderIdentityAction(bidId)
          setState(reveal)
        })
      }}
      className="inline-flex h-6 items-center rounded-pill border border-border px-2 text-label font-semibold text-ink-muted transition-colors duration-hover ease-hover hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? 'Avan…' : 'Näita identiteeti'}
    </button>
  )
}
