# Proposal: fix-scheduled-start-and-seller-visibility

## Why

Two defects found while investigating staging auction `4541ef20-6e17-4d4a-9ae8-50208f070659` ("Kinnistu müük 34801:001:0217"), published 2026-09-15 20:02 UTC with a start time 16 minutes ahead (the 10-minute lead gate forces a future start):

1. **Auctions never activate.** Publishing a lot with a future start time sets status `scheduled` (`publishAuctionRow` in `apps/platform/src/app/(admin)/_actions/auctions.ts`), but no mechanism promotes `scheduled → active` when `startsAt` passes. The AuctionDO arms its alarm only for `active` auctions (at `endsAt`), `runAlarmTick` returns early unless status is `active`, the every-minute cron sweep selects only `status = 'active' AND ends_at <= now`, and no read path upgrades a stale row. The public portal list pins `auctionStatus=active`. Result: every scheduled-start auction stays invisible and unbiddable forever.
2. **Sellers cannot see their own objects.** The auctions read guard (`apps/platform/src/lib/data/guards.ts`) admits only `status = 'active'` rows for non-admin callers; the own-row escape covers `specialist` only. `/user/objects` therefore hides the owner's `scheduled`, `draft`, and ended lots, even though the page ships tabs and status pills for them. This silently breaks the "Submitted draft shows up" scenario delivered by `portal-object-submission`: the seller's own draft is filtered out by the guard before the page renders.

The same stuck auction demonstrated both defects: the owner could not see their object anywhere, and the public never saw it.

## What Changes

- **AuctionDO start promotion.** `hydrateState` arms the DO alarm at `startsAt` for `scheduled` auctions (today only `active` auctions arm at `endsAt`). `runAlarmTick` handles `scheduled` state by re-reading the D1 row (the hot state carries no `startsAt`, and re-reading keeps admin changes to the start time safe): if the start time is still ahead it re-arms; otherwise it promotes the row to `active` with `activatedAt` via a status-guarded statement, writes an `auction_activated` audit entry, bumps the hot state, broadcasts `auction:published` so live subscribers refresh, and arms the end alarm at `endsAt` (ending immediately if `endsAt` already passed).
- **Cron sweep covers starts.** `sweepDueAuctions` additionally selects `status = 'scheduled' AND starts_at <= now` and wakes those DOs through the existing `/due` endpoint, so auctions activate even when their DO was evicted or the alarm was lost.
- **Guard owner read escape.** The `published` read rule gains `ownFields` support. The auctions rule becomes `ownFields: ['specialist', 'seller']`: any authenticated non-admin caller reads `or: [{status: active}, {specialist: me}, {seller: me}]`. Guests and admins are unchanged. Sellers still cannot update (`ownRecord('specialist')`) or publish; this is a read-only escape. Sellers can now see their own lots in every status under `/user/objects` (and preview their own draft detail page).
- **Minu müügid status display.** Scheduled object cards get an "Algab \<kuupäev\>" side note so the owner sees when their lot goes live. The status pill already renders every status (`Plaanis`, `Mustand`, `Aktiivne`, `Lõppenud`, …) and the tabs already exist; once the guard admits the rows, they appear with correct status.
- **Staging unblock.** After deployment, the sweep finds the stuck auction (`starts_at` already past) and activates it within a minute. No manual data fix is required.

## Capabilities

### Modified Capabilities

- `durable-objects`: AuctionDO alarm scheduling covers start times and the `scheduled → active` promotion.
- `background-jobs`: the cron sweep also wakes scheduled auctions whose start time has passed.
- `d1-data-layer`: access-control guards give auction owners read access to their own rows in any status.
- `portal-customer-area`: Minu müügid shows the owner's lots in every status with the status pill and a start-time note for scheduled lots.

## Impact

- Code: `apps/platform/src/do/auction.ts` (alarm arming, promotion, broadcast), `apps/platform/src/lib/workers/auction-ending.ts` (sweep query), `apps/platform/src/lib/data/guards.ts` (`ownFields` on the `published` rule), `apps/platform/src/app/(portal)/user/objects/_components/object-card.tsx` (scheduled note), plus tests in `src/do/__tests__/auction.test.ts`, `src/do/__tests__/do-worker.test.ts`, `src/lib/data/repositories/__tests__/guards.test.ts`, `src/app/(portal)/user/objects/_components/__tests__/seller-data.test.ts`.
- No schema, migration, dependency, or CSP changes. The admin publish flow, bid admission, and anti-sniping are untouched.
- Risk: the guard or-clause widens reads for authenticated callers. It can only match rows they own (`seller`/`specialist` = their id), so no cross-user exposure. The portal list pins `auctionStatus=active`, so public listings stay unchanged.
- Verification: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
