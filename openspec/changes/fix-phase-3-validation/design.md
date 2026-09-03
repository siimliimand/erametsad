# Design: fix-phase-3-validation

## Context

The Phase 3 audit (this session) verified every `docs/tasks.md` claim against
code. Bid admission, sealed encryption, password policy, and rate limits are
server-enforced. Four defects need design decisions before coding:

1. Contract prepare/complete bind no owner. `prepareContract`
   (`lib/contracts/service.ts`) checks only template + auction existence;
   `signContract` records `signerId` without comparing it to anything; the
   `prepared`/`sent` lookup in `contract-state.ts` filters by template + lot but
   not by user, so `/lepingud/raamleping` can serve another user's rendered HTML.
   The winner gate for auction contracts lives only in the page component.
2. The public stream broadcasts `amount` in `bid:created`
   (`do/auction.ts`), and `realtime-sse` currently mandates it. The REST bids
   API is already guest-safe; the stream is the only leak.
3. Alapakkumine approval unconditionally promotes the under-start bid and
   demotes a higher regular leader (`alapakkumine.ts:105-118`). The page spec
   (`design/portal/10-user-objects.md`) says this case returns 409. The user
   ruled: spec wins.
4. Guard inconsistencies: several `my/*` routes check only
   `verifyAccessToken`, so a revoked session token keeps working until JWT
   expiry.

Constraints: no schema migration wanted (prototype), `maxConcurrent: 5`
subagent waves, D1 via repository layer, DO is the bid-admission authority.

## Goals / Non-Goals

**Goals:**

- Close the contract ownership hole end to end (prepare, sign, state lookup,
  list page).
- Make the public SSE stream guest-safe without regressing authed UX.
- Implement the 409 approval semantics and surface it in the seller drawer.
- Align the portal with the design specs where the audit found drift.
- Back every behavior change with a test that would have caught the defect.

**Non-Goals:**

- Signed media URLs (open Phase 2 `[S]` deferral), CSV export, view-count
  backend, stats mini-chart, GDPR jobs, digest scheduling (documented
  deferrals).
- AuctionDO-level serialization for alapakkumine decisions (the comment in
  `alapakkumine.ts` tracks this separately); the status-guarded UPDATE remains
  the guard, strengthened by the higher-bid condition.
- EN/RU copy, new features beyond the audit remediation.

## Decisions

### D1: Contract binding reuses the `signedBy` column (no migration)

`prepareContract(auctionId, type, userId)` writes `signedBy = userId` at
prepare time. The column then means "owner of the signing session":
`signContract` compares the authenticated user to the stored `signedBy` before
stamping `signedAt`. `contract-state.ts` adds
`{ signedBy: { equals: userId } }` to the `prepared`/`sent` lookup (the
`signed` lookup already has it).

- Alternative considered: a new `preparedBy` column. Rejected: needs a D1
  migration for no behavioral gain; no requirement distinguishes preparer from
  signer in the prototype.
- Consequence: `signedBy` is non-null from prepare onward. The signed-status
  lookup is unaffected (status filter). Existing rows created before this
  change have `signedBy` only after signing; in-flight prepared rows from the
  demo seed get re-created by `seed:reset`.

### D2: Winner gate lives in the prepare route, enforced server-side

`POST /api/v1/bids/contract/prepare` resolves the session user and rejects
with 403 unless the user holds a `won` bid on the auction (query via the
repository layer; the auction outcome is already recorded on the bid row).
Framework-contract prepare stays available to any authed user (it is the
prerequisite for bidding, not a consequence).

- Alternative considered: moving the gate into `prepareContract` for both
  types. Rejected: framework contracts must be preparable by non-winners by
  design; a type-conditional branch inside the service would hide the rule
  from the route layer where the other authz checks live.

### D3: Public `bid:created` frames drop `amount`

`do/auction.ts` broadcasts `{ auctionId, placedAt }` only. Authed viewers
already trigger a quiet refetch on `bid:created` (`BidList.tsx`), so leading
amounts stay live; the optimistic prepend switches to the refetched state.
`/api/v1/my/stream` (`bid`, `outbid`) keeps full payloads for the owner.
Sealed auctions are unaffected (they never broadcast amounts).

- Alternative considered: per-subscriber payload shaping in the SSE route.
  Rejected: the hub fans out one frame to all subscribers; per-viewer shaping
  adds a join per connection for one field. The refetch path already exists.

### D4: Alapakkumine 409 semantics

In the approve decision (`alapakkumine.ts`), before promoting: if the
auction's current leading bid is a regular bid with `amount >
underStartAmount`, return the coded result `higher_bid_exists`; the approve
route maps it to 409. The drawer conflict panel binds to this code (its copy
exists today but is unreachable). Ties and lower leaders still promote and
demote as before.

- Alternative considered: rejecting at admission time (new under-start bid
  when a higher leader exists). Rejected: the pending bid may have been placed
  before the higher bid; the conflict only materializes at approval, which is
  where the spec puts it.

### D5: Pending chip from a server-backed viewer flag

`oksjon/[id]/page.tsx` computes `hasPendingUnderStart` (own
`pending_approval` bid on this auction) into the viewer snapshot it already
builds. `BidPanel` renders the pending chip when
`serverFlag || sessionPending`, so reload restores state and the in-session
flow stays instant.

### D6: Revocation check via the existing session resolver

Routes that currently call `verifyAccessToken` only (`my/notifications*`,
`my/stream`, underbids approve/reject) switch to the same
`resolveAccessTokenSession` helper used by `my-auctions` and `my/sessions`
(JWT valid AND session row live). One regression test locks the behavior.

### D7: docs/tasks.md corrections are documentation, not code

Lines 277/307/310 are reworded to state view counts, fee display, and signed
URLs as known gaps with pointers to the deferring decisions. No checkbox
status changes: the delivered scope stays checked, the gap is written down
next to the claim.

## Risks / Trade-offs

- [`signedBy` reuse misreads as "signed"] → The signed-status queries filter
  on `status`, not column nullness. Contract list shows status pills, so UI
  meaning stays clear. Noted in D1.
- [Authed bid list loses the instant optimistic prepend] → Refetch latency
  (single user-scoped query) replaces it; the `bid:created` event still
  arrives first, so the refetch is warm. Acceptable for prototype traffic.
- [409 semantics surprise the seller mid-approval] → The drawer conflict panel
  explains and refreshes; the spec wording matches the response code.
- [Prepared pre-change contracts fail the owner check] → Only seed/demo data;
  `seed:reset` regenerates. Production does not exist yet.
- [Species map growth touches a shared component] → Names come from the
  existing 24-code taxonomy in `packages/types` (single source; no
  duplication per project guardrails).

## Migration Plan

No schema migration. Deploy order is irrelevant (single app); the contract
route change (D2) and the state lookup (D1) land in the same change so no
window exposes cross-user rows. Rollback: revert the change; no data
transforms to undo.

## Open Questions

None. The alapakkumine semantics conflict was resolved by the user (spec's
409 wins) before this proposal.
