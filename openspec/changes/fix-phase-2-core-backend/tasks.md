## 1. Crypto fixes

- [x] 1.1 Store and verify the AES-256-GCM auth tag in both crypto modules: `encrypt`/`encryptSealedData` return `authTag`, `decrypt`/`decryptSealedData` require it and throw on tamper; fix all call sites <!-- agent: fullstack-engineer.build, depends_on: [], touches: [apps/platform/src/lib/crypto.ts, apps/platform/src/lib/encryption.ts, apps/platform/src/payload/collections/Users.ts] -->
- [ ] 1.2 Crypto unit tests: roundtrip, tamper rejection, wrong-key rejection, Users `afterRead` never throws on encrypted isikukood <!-- agent: fullstack-engineer.build, depends_on: [1.1], touches: [apps/platform/src/lib/__tests__/encryption.test.ts] -->

## 2. Auction schema & ending worker

- [x] 2.1 Add required `type` select (open|sealed, default open) to the Auction collection; validation forces sealed for kinnistu and pakett <!-- agent: fullstack-engineer.build, depends_on: [], touches: [apps/platform/src/payload/collections/Auction.ts] -->
- [x] 2.2 Fix the ending worker: two-step updates (`active → ended`, then `ended → appraised|unsold`), reserve-price outcome on open auctions, sealed branch keyed on the schema `type`, notifications carry userId <!-- agent: fullstack-engineer.build, depends_on: [2.1], touches: [apps/platform/src/lib/workers/auction-ending.ts] -->
- [ ] 2.3 Start the worker and the notification listener from `instrumentation.ts` (Node runtime guard, 30s interval); document the queue-interface swap point <!-- agent: fullstack-engineer.build, depends_on: [2.2, 7.2], touches: [apps/platform/src/instrumentation.ts, apps/platform/src/lib/queue.ts] -->
- [ ] 2.4 Worker tests: transitions pass the real guard, no-bid and reserve-not-met outcomes, sealed detection via schema field, double-fire idempotency <!-- agent: fullstack-engineer.build, depends_on: [2.2], touches: [apps/platform/src/lib/workers/__tests__/auction-ending.test.ts] -->

## 3. Bidding engine

- [x] 3.1 Transactional `placeBid`: wrap validation chain and writes in a Postgres transaction with `FOR UPDATE` on the auction row (Drizzle via `payload.db`); server-side salted ipHash; server-set source; alapakkumine amount path (below minBid → `pending_approval` when enabled) <!-- agent: fullstack-engineer.build, depends_on: [1.1], touches: [apps/platform/src/lib/bidding/place-bid.ts, apps/platform/src/lib/bidding/alapakkumine.ts] -->
- [x] 3.2 Wire the bid route to the engines: anti-snipe check + `auction:extended` broadcast + audit entry, autobidder evaluation, `bid:created` broadcast, `outbid` my-stream + eventBus events with userId <!-- agent: fullstack-engineer.build, depends_on: [3.1, 3.4, 7.1], touches: [apps/platform/src/app/api/v1/bids/create/route.ts] -->
- [ ] 3.3 Seller alapakkumine endpoints `POST /api/v1/my-auctions/:id/underbids/:bidId/approve|reject` with race guard, role check (seller/admin), and bidder notification <!-- agent: fullstack-engineer.build, depends_on: [3.1], touches: [apps/platform/src/app/api/v1/my-auctions/[id]/underbids/[bidId]/approve/route.ts, apps/platform/src/app/api/v1/my-auctions/[id]/underbids/[bidId]/reject/route.ts, apps/platform/src/lib/bidding/alapakkumine.ts] -->
- [x] 3.4 Rewrite autobidder evaluation as a single pass: highest max (tie earliest) bids `max(leading+step, secondMax+step)` capped at own max; no self-overbid; invoked from the bid flow <!-- agent: fullstack-engineer.build, depends_on: [], touches: [apps/platform/src/lib/bidding/autobidder.ts] -->
- [ ] 3.5 Rewrite autobidder tests to spec values: 210 case, no-self-overbid, single-autobidder minimum, equal-max tie-break <!-- agent: fullstack-engineer.build, depends_on: [3.4], touches: [apps/platform/src/lib/bidding/__tests__/autobidder.test.ts] -->

## 4. Sealed-bid flow

- [x] 4.1 `submitSealedBid`: add objectType rights check; decrypt failures propagate (no silent amount 0); revision cap semantics documented (1 + N) <!-- agent: fullstack-engineer.build, depends_on: [1.1], touches: [apps/platform/src/lib/bidding/sealed-bid.ts] -->
- [x] 4.2 Persist opening sessions in the cache abstraction with 30-minute expiry; two-person verification (distinct users, server-verified tokens); rank desc with earliest tie-break; step-up role checks use the real JWT role <!-- agent: fullstack-engineer.build, depends_on: [1.1, 5.1], touches: [apps/platform/src/lib/bidding/sealed-opening.ts, apps/platform/src/lib/cache.ts, apps/platform/src/app/api/v1/admin/auctions/[id]/open-sealed/route.ts] -->
- [x] 4.3 `confirmWinner`: verify the bid belongs to the auction and tops the ranking, compare reserve (sold/appraised vs unsold), publish `finalPrice`, notify losers with userId, queue the contract; fix the admin route role check <!-- agent: fullstack-engineer.build, depends_on: [4.2], touches: [apps/platform/src/lib/bidding/sealed-opening.ts, apps/platform/src/app/api/v1/admin/auctions/[id]/confirm-winner/route.ts] -->
- [ ] 4.4 Ceremony tests: reserve paths, tie-break, expiry, finalPrice publication, loser notifications <!-- agent: fullstack-engineer.build, depends_on: [4.3], touches: [apps/platform/src/lib/bidding/__tests__/sealed-opening.test.ts] -->

## 5. Auth & sessions

- [x] 5.1 JWT carries the real role and activeProfileId: populate from the user record at login/register/select, verify claims on admin routes <!-- agent: fullstack-engineer.build, depends_on: [], touches: [apps/platform/src/lib/auth/jwt.ts, apps/platform/src/lib/auth/session.ts, apps/platform/src/app/api/v1/auth/login/route.ts, apps/platform/src/app/api/v1/profiles/[id]/select/route.ts] -->
- [ ] 5.2 `POST /api/v1/auth/refresh`: rotation with reuse detection (family invalidation), new access token, refresh cookie path fixed to `/api/v1/auth` <!-- agent: fullstack-engineer.build, depends_on: [5.1], touches: [apps/platform/src/app/api/v1/auth/refresh/route.ts, apps/platform/src/lib/auth/session.ts] -->
- [ ] 5.3 eID `complete` endpoints for smartid/mobileid/idcard: verify session state, create the session and set cookies; demo isikukoods configurable via env <!-- agent: fullstack-engineer.build, depends_on: [5.1], touches: [apps/platform/src/app/api/v1/auth/smartid/complete/route.ts, apps/platform/src/app/api/v1/auth/mobileid/complete/route.ts, apps/platform/src/app/api/v1/auth/idcard/complete/route.ts, apps/platform/src/lib/auth/eid-provider.ts] -->
- [x] 5.4 Forgot-password endpoint (identifier → single-use 2h token → email link via Mailpit) and authed change-password endpoint (old password required, sessions revoked, min length 10) <!-- agent: fullstack-engineer.build, depends_on: [7.2], touches: [apps/platform/src/app/api/v1/auth/forgot-password/route.ts, apps/platform/src/app/api/v1/auth/change-password/route.ts, apps/platform/src/lib/auth/reset-tokens.ts] -->
- [x] 5.5 Login rejects suspended users; registration requires and stores 3 consents with timestamps on the profile; session list + revoke endpoints (`GET/DELETE /api/v1/my/sessions`) <!-- agent: fullstack-engineer.build, depends_on: [5.1], touches: [apps/platform/src/app/api/v1/auth/login/route.ts, apps/platform/src/app/api/v1/auth/register/route.ts, apps/platform/src/app/api/v1/my/sessions/route.ts] -->

## 6. Contracts

- [x] 6.1 `signContract` records `signedBy` from the authenticated token in both complete routes; framework-contract gate active by default (flag removed or default true) <!-- agent: fullstack-engineer.build, depends_on: [], touches: [apps/platform/src/lib/contracts/service.ts, apps/platform/src/app/api/v1/bids/framework-contract/complete/route.ts, apps/platform/src/app/api/v1/bids/contract/complete/route.ts, apps/platform/src/lib/bidding/place-bid.ts] -->

## 7. Realtime & notifications

- [x] 7.1 Emit all public SSE events: `bid:created` on accepted bids (anonymised), `auction:extended` on anti-snipe, `auction:published` on activation; my-stream `outbid`/`notification` pushes to the affected user <!-- agent: fullstack-engineer.build, depends_on: [], touches: [apps/platform/src/lib/realtime/auction-stream.ts, apps/platform/src/lib/realtime/my-stream.ts, apps/platform/src/lib/bidding/anti-snipe.ts] -->
- [x] 7.2 Notification dispatch: all emitted events carry userId; dispatcher started at bootstrap; email via Mailpit SMTP using nodemailer and `@eametsad/emails` templates; per-user+event dedupe; SMS stays a stub <!-- agent: fullstack-engineer.build, depends_on: [], touches: [apps/platform/src/lib/notifications/service.ts, apps/platform/src/lib/notifications/event-bus.ts, packages/emails/src/index.ts, apps/platform/package.json] -->

## 8. Forms & stats

- [ ] 8.1 Leads endpoint: 5/min/IP limiter, required-field validation with `@eametsad/types` validators (EE phone, email), no error leakage <!-- agent: fullstack-engineer.fast, depends_on: [], touches: [apps/platform/src/app/api/leads/route.ts, apps/platform/src/lib/leads/ingestion.ts] -->
- [ ] 8.2 Sealed completion backfills the statistics snapshot `eur` from the published finalPrice <!-- agent: fullstack-engineer.build, depends_on: [4.3], touches: [apps/platform/src/lib/bidding/sealed-opening.ts, apps/platform/src/lib/stats/aggregation.ts] -->

## 9. Seed, docs, verification

- [x] 9.1 Seed fixes: `type` set on every auction (≥1 sealed per supported object type, one `ended` ready for the opening demo); sealed bids created through the encrypted path; `requireFrameworkContract: true` in Settings seed <!-- agent: fullstack-engineer.build, depends_on: [1.1, 2.1, 6.1, 4.1], touches: [apps/platform/src/payload/seed/auctions.ts, apps/platform/src/payload/seed/bids.ts, apps/platform/src/payload/seed/index.ts] -->
- [ ] 9.2 Verification: workspace `test`, `typecheck`, `lint` green; `seed:reset` against local docker-compose Postgres; API-level smoke of the five §1.1 flows (lead → CRM row, open bid with autobidder + anti-snipe, sealed ceremony, contract signing, archive/stats consistency) <!-- agent: fullstack-engineer.build, depends_on: [1.2, 2.3, 2.4, 3.2, 3.3, 3.5, 4.4, 5.4, 5.5, 6.1, 7.1, 7.2, 8.1, 8.2, 9.1], touches: [] -->
- [ ] 9.3 Update `docs/tasks.md` Phase 2 checkboxes to match verified reality; record the [S]/[L] deferrals in writing next to the section <!-- agent: fullstack-engineer.fast, depends_on: [9.2], touches: [docs/tasks.md] -->
