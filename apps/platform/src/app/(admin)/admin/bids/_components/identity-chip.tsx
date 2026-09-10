'use client'

import { useState, useTransition } from 'react'

import {
  revealBidderIdentityAction,
  type BidderIdentityView,
} from '../../../_actions/auctions'
import { AdminLink } from '../../../_components/AdminLink'

type RevealState =
  | { ok: true; identity: BidderIdentityView }
  | { ok: false; error: string }

/**
 * The audited reveal chip: the only client path from an anonymized label to
 * a real identity. The server action writes the `user.identity_view` audit
 * entry before the identity value ever reaches this component, and enforces
 * the per-role rules (seller: alapakkumine rows on its own lots only).
 * With `users:read` (admin roles) the revealed name links into the bidder's
 * Kasutajad detail view; other roles keep the plain revealed text, since
 * their user-detail access is denied anyway.
 */
export function IdentityRevealChip({
  bidId,
  bidderId = null,
  canViewUsers = false,
}: {
  bidId: string
  bidderId?: string | null
  canViewUsers?: boolean
}) {
  const [state, setState] = useState<RevealState | null>(null)
  const [pending, startTransition] = useTransition()

  if (state !== null) {
    if (!state.ok) {
      return <span className="text-label font-semibold text-danger">{state.error}</span>
    }
    const name = (
      <>
        {state.identity.name ?? state.identity.email}
        {state.identity.name !== null ? (
          <span className="ml-1 font-normal text-ink-muted">({state.identity.email})</span>
        ) : null}
      </>
    )
    return (
      <span className="text-label font-semibold text-ink">
        {canViewUsers && bidderId !== null && bidderId !== '' ? (
          <AdminLink
            href={`/users/${encodeURIComponent(bidderId)}`}
            className="underline-offset-2 transition-colors duration-hover ease-hover hover:text-primary hover:underline"
          >
            {name}
          </AdminLink>
        ) : (
          name
        )}
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
