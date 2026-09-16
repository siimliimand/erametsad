# Design: fix-scheduled-start-and-seller-visibility

## Context

Publishing an auction with a future start time stores status `scheduled`
(`publishAuctionRow`, `apps/platform/src/app/(admin)/_actions/auctions.ts`).
The 10-minute lead gate (`auction-schema.ts`) guarantees `startsAt` is in
the future at publish, so every admin-publish lands in `scheduled` first.

No runtime path promotes `scheduled → active`:

- `AuctionDO.hydrateState` arms the alarm only when `status === 'active'`,
  at `endsAt` (`src/do/auction.ts`).
- `runAlarmTick` returns immediately unless the hot state is `active`.
- The cron sweep (`src/lib/workers/auction-ending.ts`) selects only
  `status = 'active' AND ends_at <= now`.
- `AuctionState` (DO hot state) carries no `startsAt`.

Independently, the auctions read guard
(`src/lib/data/guards.ts`, `published` rule with
`ownField: 'specialist'`) filters non-admin reads to `status = 'active'`
rows, so owners cannot read their own `scheduled` or `draft` lots through
`/user/objects`, which uses guarded repositories via
`requirePortalSession`.

Staging evidence: auction `4541ef20-6e17-4d4a-9ae8-50208f070659` published
2026-09-15T20:02Z, `starts_at` 20:18Z, still `scheduled` the next day.

## Goals / Non-Goals

**Goals:**

- Scheduled auctions become `active` at `startsAt`, server-authoritatively
  (DO alarm primary, cron sweep safety net).
- Sellers see their own lots in every status under `/user/objects`, with
  the correct status pill and a start-time note for scheduled lots.
- The stuck staging auction self-heals on deploy.

**Non-Goals:**

- No change to bid admission, anti-sniping, or the end transition.
- No change to publish gates or the 10-minute lead rule.
- No seller write access: owners still cannot update, publish, or delete.
- No new SSE event type: activation reuses `auction:published`.
- No schema or migration changes.

## Decisions

### D1: Promotion runs inside the DO, off the existing alarm

Reuse the single DO alarm instead of introducing a second timer or a
read-path upgrade.

- `hydrateState` arms the alarm at `startsAt` while `scheduled` (same
  "first touch owns the time" rule as the end alarm).
- `runAlarmTick` branches on status. For `scheduled` it re-reads the D1
  row: if `startsAt` is still ahead, re-arm at `startsAt`; otherwise
  promote.

Why re-read: the hot state has no `startsAt`, and the row is the source of
truth after an admin moves the start time (mirrors the existing "the D1
row decides" comment in `endAuction` for `endsAt`). A stale alarm then
re-arms instead of promoting early.

Alternative rejected: promoting lazily at read time in
`lib/auction/queries.ts`. It spreads transition logic across read paths,
fires no alarms or notifications, and violates the project rule that
timing is server-authoritative with DO-driven transitions.

### D2: Promotion statement and side effects mirror `endAuction`

The promotion is one status-guarded statement
(`UPDATE auctions SET status = 'active', activated_at = ? WHERE id = ? AND
status = 'scheduled'`) batched with the `auction_activated` audit insert.
After the batch: `updateHotState({ status: 'active' })`, broadcast
`auction:published`, then arm the end alarm at the row's `endsAt` (or run
the end transition immediately if `endsAt` already passed). Guards against
double-fire: the `status = 'scheduled'` predicate makes retries no-ops,
same pattern as `auctionEndStatement`.

The audit action is `auction_activated`, matching the DO's underscore
style (`auction_ended`); the admin audit registry lists only dotted
admin-action ids, so no registry change is needed.

Alternative rejected: reusing `publishAuctionRow` from the DO. It is a
server-action module with redirect/audit helpers and an admin session
context the DO does not have.

### D3: Sweep gains a second due-set query

`sweepDueAuctions` runs a second prepared statement
(`status = 'scheduled' AND starts_at <= now`) and wakes those ids through
the same `/due` endpoint and `SWEEP_LIMIT` handling. The DO's serialized
`alarmTick` does the rest, so the sweep stays write-free. An id due in
both sets cannot occur (`scheduled` vs `active` are disjoint statuses).

### D4: Guard gets `ownFields`; role restriction drops

Extend the `published` rule from `ownField?: string` (applied only for
role `specialist`) to `ownFields?: string[]`, applied for every
authenticated non-admin caller. The auctions rule becomes
`ownFields: ['specialist', 'seller']`, producing
`or: [{status: active}, {specialist: me}, {seller: me}]`.

Why drop the role check: the clauses can only match rows the caller owns
(`seller = me` cannot match another user's row), so exposing them to
`private`/`company` callers adds no cross-user read capability. Admins
bypass earlier; guests keep the published-only filter. `specialist = me`
stays harmless for non-specialists because they are never assigned as
specialists.

Scope of effect on public surfaces: the portal list pins
`auctionStatus=active` and the default status filter is
`PUBLIC_AUCTION_STATUSES` (no `draft`), so anonymous and cross-user
listings are unchanged. The owner gains: `/user/objects` rows in every
status, own draft preview via `findByID`, and the `my-auctions`
underbid routes now resolve their auction for ended lots too (an
improvement; they were 404s before).

### D5: Scheduled card note in the existing card, no new components

`object-card.tsx` gains a `scheduled` branch in `sideNote()`
("Algab \<kuupäev\>" from `row.startsAt`, using the existing date
formatter). `StatusPill` already maps `scheduled → Plaanis`; tabs already
cover all statuses. Seller data flows unchanged once the guard admits the
rows.

## Risks / Trade-offs

- [Guard or-clause widens reads] → Clauses match only caller-owned rows;
  guard tests cover private, seller, specialist, guest, and admin; the
  portal list pins active-only filters, so public listings are unchanged.
- [Alarm at `startsAt` doubles armed DOs (one per scheduled auction)] →
  Scheduled auctions are a small, short-lived set; the alarm re-arms to
  `endsAt` after promotion and the sweep bounds misses.
- [Admin moves `startsAt` after arming] → `runAlarmTick` re-reads the row
  for `scheduled` and re-arms; no premature promotion.
- [Promotion and admin edit race (admin unpublishes/re-publishes mid
  tick)] → The promotion predicate is `status = 'scheduled'`, so a row
  already moved by the admin is not re-promoted; the tick re-reads the row
  before deciding.
- [DO evicted before start alarm] → Cron sweep wakes it within a minute.

## Migration Plan

1. Deploy the Worker (OpenNext build via `wrangler`).
2. Within one cron minute the sweep finds `scheduled` rows with past
   `starts_at` (including the stuck staging auction) and wakes their DOs,
   which promote to `active` and arm end alarms. No manual data fix.
3. Rollback: redeploy the previous Worker version. Rows already promoted
   stay `active` (valid transitions; end alarms already armed), which is
   the intended lifecycle state for past-start auctions.

## Open Questions

None. Staging unblock relies on the sweep, so no manual republish of
auction `4541ef20-…` is needed.
