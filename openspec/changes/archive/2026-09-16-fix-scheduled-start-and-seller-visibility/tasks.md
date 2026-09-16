# Tasks

## 1. Auction start promotion

- [x] 1.1 AuctionDO start promotion: arm the alarm at `startsAt` for `scheduled` auctions in `hydrateState`; teach `runAlarmTick` to re-read the D1 row when status is `scheduled`, re-arm while the start is ahead, and otherwise promote to `active` (status-guarded raw SQL setting `activated_at`), write the `auction_activated` audit entry, bump hot state, broadcast `auction:published`, and arm (or immediately fire) the end transition at `endsAt`; DO tests cover arming, late wake, and promotion <!-- agent: fullstack-engineer.build, depends_on: [], touches: [apps/platform/src/do/auction.ts, apps/platform/src/do/__tests__/auction.test.ts] -->
- [x] 1.2 Cron sweep starts: extend `sweepDueAuctions` to also select `status = 'scheduled' AND starts_at <= now` and wake those DOs through the existing `/due` endpoint; sweep tests cover a due scheduled auction and leave active-only rows alone <!-- agent: fullstack-engineer.build, depends_on: [1.1], touches: [apps/platform/src/lib/workers/auction-ending.ts, apps/platform/src/do/__tests__/do-worker.test.ts] -->

## 2. Seller visibility guard

- [x] 2.1 Owner read escape: extend the `published` guard rule with `ownFields` support and change the auctions read rule to `ownFields: ['specialist', 'seller']` so any authenticated non-admin caller reads `or: [{status: active}, {specialist: me}, {seller: me}]`; guard tests cover private, seller, specialist, guest, and admin roles, including that a seller can read a `scheduled` or `draft` auction they own but cannot update it <!-- agent: fullstack-engineer.build, depends_on: [], touches: [apps/platform/src/lib/data/guards.ts, apps/platform/src/lib/data/repositories/__tests__/guards.test.ts] -->

## 3. Minu müügid status display

- [x] 3.1 Scheduled card note: show "Algab \<kuupäev\>" as the side note on scheduled object cards (start time from `startsAt`, formatted like the existing date helpers); component test asserts the note and the "Plaanis" pill render for a scheduled row <!-- agent: fullstack-engineer.build, depends_on: [2.1], touches: [apps/platform/src/app/(portal)/user/objects/_components/object-card.tsx, apps/platform/src/app/(portal)/user/objects/_components/__tests__/seller-data.test.ts] -->

## 4. Verification

- [x] 4.1 Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`; fix fallout <!-- agent: fullstack-engineer.fast, depends_on: [1.1, 1.2, 2.1, 3.1], touches: [] -->
