# Proposal: fix-phase-3-validation

## Why

A code-level validation of Phase 3 (auction portal) against `docs/tasks.md` and
`docs/design/portal/` confirmed the phase is mostly implemented, but found one
authorization hole (contract ownership), one guest privacy leak sanctioned by the
current SSE spec (amounts in public `bid:created` frames), two false completion
claims in `docs/tasks.md`, and a contradiction between `bidding-engine` (approval
always wins the lead) and `design/portal/10-user-objects.md` (approval returns 409
when a higher regular bid arrived). The user approved full remediation (P0-P3),
the spec's 409 behavior, and copy alignment with the design specs.

## What Changes

- **Contract ownership binding**: `prepareContract` stores the preparing user at
  prepare time (reuses the `signedBy` column; no migration). `signContract`
  rejects a signer that does not match the stored owner. The auction-type prepare
  route requires the caller to hold the winning bid (server-side, replacing the
  page-only winner gate). The `prepared`/`sent` contract-state lookup filters by
  `signedBy`, closing a cross-user `renderedHtml` leak on `/lepingud/raamleping`.
- **Public SSE privacy**: `bid:created` frames on `/api/v1/auctions/stream` no
  longer carry `amount` (guest amount leak via network inspection). Authed
  viewers keep live amounts through the existing quiet refetch; `/api/v1/my/stream`
  is unchanged.
- **Alapakkumine approval conflict**: seller approval returns coded
  `higher_bid_exists` (HTTP 409) when the current leading regular bid exceeds the
  under-start amount, per `design/portal/10-user-objects.md`. The drawer's dead
  409 copy is wired to this code. Clean approvals still promote and demote.
- **Pending-alapakkumine persistence**: the lot-detail viewer snapshot gains
  `hasPendingUnderStart` so the pending chip survives a page reload.
- **Listing completeness**: grid/map view toggle (`Kaardivaade` / `Loendivaade`,
  `?view=` URL param) per `design/portal/01-listing.md`; the shell header `q`
  parameter is wired into the listing query as title/cadastre free-text filter.
- **Contracts list**: shows the user's `prepared`/`sent` contracts with status
  pills and a resume action, not only signed contracts.
- **Copy alignment**: fee notice uses the spec phrase "Teenustasu rakendub vaid
  oksjoni võitmise korral"; the no-rights message points to `info@erametsad.ee`;
  species tooltips cover all 24 codes and appear on the dossier row.
- **Token revocation**: `my/notifications` routes, `my/stream`, and underbids
  approve/reject verify the session is not revoked (not just JWT validity).
- **Documentation truth**: `docs/tasks.md` lines 277/307/310 corrected (view
  counts and fee display stated as gaps; signed-URL claim reworded to the Phase 2
  `[S]` deferral).
- **Tests**: contract service + routes, login and reset-password routes,
  `SealedBidPanel`, `BidList`, `LiveListing`, plus a revocation regression test.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `notifications-contracts`: prepare binds the contract to the preparing user;
  signing verifies the owner; auction-type prepare requires the winner; the
  in-progress contract lookup is user-scoped.
- `realtime-sse`: public `bid:created` frames carry `auctionId` and `placedAt`
  only, no `amount` (MODIFIED: the current requirement mandates amounts to all
  subscribers).
- `bidding-engine`: alapakkumine approval is rejected with 409
  (`higher_bid_exists`) when a leading regular bid exceeds the under-start
  amount (MODIFIED: the current requirement mandates unconditional promotion).
- `portal-lot-detail`: pending-alapakkumine chip state is server-backed;
  spec-aligned fee/no-rights copy; full species tooltip coverage.
- `portal-listing`: grid/map view toggle requirement; `q` free-text filter
  requirement.
- `portal-customer-area`: contracts list includes the user's in-progress
  contracts with status and resume action.
- `portal-api`: `my/*` routes reject revoked sessions, not only invalid JWTs.

## Impact

- Code: `apps/platform/src/lib/contracts/`, `lib/bidding/alapakkumine.ts`,
  `lib/auction/queries.ts`, `lib/realtime/`, `src/do/auction.ts`,
  `api/v1/bids/{contract,framework-contract}/**`, `api/v1/my/**`,
  `api/v1/my-auctions/**/underbids/**`, `api/v1/auth/{login,reset-password}`,
  portal route groups `(portal)/` (page.tsx, oksjon/[id], user/objects,
  lepingud, _components).
- Specs: seven modified capability specs under `openspec/specs/`.
- Docs: `docs/tasks.md` Phase 3 claim corrections.
- No schema migration (contract binding reuses `signedBy`). No dependency
  changes. No breaking API changes; `bid:created` payload narrowing is
  client-compatible (guests already ignore `amount`).
