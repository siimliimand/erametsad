## 1. Sealed-bid identity persistence

- [x] 1.1 Extend `SealedIdentityForm` and `SealedBidPanel` with aadress, e-post, and telefon fields; the snapshot builder covers all five spec fields; a `revision_cap_exceeded` API response locks the form with an inline Estonian message <!-- agent: fullstack-engineer.build, depends_on: [], touches: [apps/platform/src/app/(portal)/oksjon/[id]/_components/sealed/**] -->
- [x] 1.2 `POST /api/v1/bids/create` reads and validates `identitySnapshot` (name, code, address, email, phone) and forwards it through both admission paths (AuctionDO RPC and `placeBid` fallback); extend `PlaceBidParams` and the DO payload <!-- agent: fullstack-engineer.build, depends_on: [], touches: [apps/platform/src/app/api/v1/bids/create/route.ts, apps/platform/src/lib/bidding/place-bid.ts, apps/platform/src/do/auction.ts] -->
- [x] 1.3 Encrypt the snapshot with the existing AES-256-GCM module and write `identity_snapshot` on sealed bids in both paths; enforce the `1 + settings.sealedRevisionCap` budget server-side in the same turn that appends the bid, returning `revision_cap_exceeded` <!-- agent: fullstack-engineer.build, depends_on: [1.2], touches: [apps/platform/src/lib/bidding/place-bid.ts, apps/platform/src/do/auction.ts] -->
- [x] 1.4 Tests: snapshot ciphertext at rest (amount 0, unreadable snapshot), cap rejection, ceremony decrypt roundtrip returns the submitted snapshot, open bids without the field behave as before <!-- agent: fullstack-engineer.build, depends_on: [1.1, 1.3], touches: [apps/platform/src/lib/bidding/__tests__/**, apps/platform/src/do/__tests__/**] -->

## 2. Registration and password flows

- [x] 2.1 Registration stores the isikukood: wizard payload includes it, the register route validates the checksum, hashes, and stores it the same way the Users identity path does <!-- agent: fullstack-engineer.build, depends_on: [], touches: [apps/platform/src/app/(portal)/register/_components/RegisterWizard.tsx, apps/platform/src/app/api/v1/auth/register/route.ts] -->
- [x] 2.2 Fix the reset link: `forgot-password` builds `/reset-password/${token}`; an integration test asserts the generated link matches an existing route <!-- agent: fullstack-engineer.build, depends_on: [], touches: [apps/platform/src/app/api/v1/auth/forgot-password/route.ts] -->
- [x] 2.3 New-user password flow: register route issues a session, `StepDone` links to `/update-password?first=1` and to `/lepingud/raamleping` <!-- agent: fullstack-engineer.build, depends_on: [2.1], touches: [apps/platform/src/app/(portal)/register/_components/StepDone.tsx, apps/platform/src/app/api/v1/auth/register/route.ts] -->
- [x] 2.4 Server-enforced password rules: change-password and reset-password validate length, character classes, and ≠ isikukood; the change page passes the viewer's isikukood to `PasswordForm` <!-- agent: fullstack-engineer.build, depends_on: [], touches: [apps/platform/src/app/api/v1/auth/change-password/route.ts, apps/platform/src/app/api/v1/auth/reset-password/route.ts, apps/platform/src/app/(portal)/update-password/page.tsx, apps/platform/src/app/(portal)/_components/PasswordForm.tsx] -->

## 3. Lot page live behavior

- [x] 3.1 The lot page reads `alapakkumineEnabled` from Settings (same fetch that supplies `antiSnipeMinutes`) and passes `allowUnderStart` to `BidPanel` for open active auctions <!-- agent: fullstack-engineer.build, depends_on: [], touches: [apps/platform/src/app/(portal)/oksjon/[id]/page.tsx] -->
- [x] 3.2 `GET /api/v1/auto-bidders?auction=` returns the caller's own row (id, max) or 204; the lot page passes `autobidderId`/`maxAmount` to `AutobidderControl`; the Minu pakkumised inline editor prefills from it too <!-- agent: fullstack-engineer.build, depends_on: [], touches: [apps/platform/src/app/api/v1/auto-bidders/route.ts, apps/platform/src/app/(portal)/oksjon/[id]/page.tsx, apps/platform/src/app/(portal)/user/bids/_components/autobidder-inline.tsx] -->
- [x] 3.3 Lot page handles `auction:extended` (countdown and panel deadline update without reload) and `auction:ended` (panel locks to the ended state, outcome refreshes); `packages/ui` `Countdown` gains an optional `serverNow` prop for drift correction and an `onEnd` callback wired to a bid-state refresh <!-- agent: fullstack-engineer.build, depends_on: [], touches: [apps/platform/src/app/(portal)/oksjon/[id]/_components/**, packages/ui/src/components/Countdown.tsx] -->
- [x] 3.4 Tests: toggle renders only when the setting allows, autobidder prefill and delete flows, extension moves the countdown, end event locks the panel <!-- agent: fullstack-engineer.build, depends_on: [3.1, 3.3], touches: [apps/platform/src/app/(portal)/oksjon/[id]/_components/__tests__/**] -->

## 4. Auth polish and demo alignment

- [x] 4.1 Demo eID accepts any seeded isikukood (hardcoded list stays as fallback; `.env.example` and README document `EID_DEMO_ISIKUKOOD`); the login route returns a distinguishable code for suspended accounts so `SuspendedBanner` renders <!-- agent: fullstack-engineer.build, depends_on: [], touches: [apps/platform/src/lib/auth/eid-provider.ts, apps/platform/src/app/api/v1/auth/login/route.ts, .env.example, README.md] -->
- [x] 4.2 Portal header gains Ajalugu and Registreeru links <!-- agent: fullstack-engineer.fast, depends_on: [], touches: [apps/platform/src/app/(portal)/_components/PortalHeader.tsx] -->
- [x] 4.3 Shell profile dropdown gains the profile switcher listing the user's profiles, POSTing `/api/v1/profiles/:id/select` on pick <!-- agent: fullstack-engineer.build, depends_on: [], touches: [apps/platform/src/app/(portal)/user/_components/ShellHeader.tsx] -->

## 5. Dossier secondaryInfo

- [x] 5.1 Add nullable `description_secondary` TEXT column to `auctions` (Drizzle migration), map it through the repository layer, add the admin auction editor field <!-- agent: fullstack-engineer.build, depends_on: [], touches: [apps/platform/src/lib/data/schema/auctions.ts, apps/platform/drizzle/**, apps/platform/src/app/(admin)/admin/auctions/[id]/edit/**] -->
- [x] 5.2 Lot page renders the "Lisainfo" card from the new column; the rich-text renderer keeps headings for both info cards; `SellerContact` shows the stored specialist photo and role <!-- agent: fullstack-engineer.build, depends_on: [5.1], touches: [apps/platform/src/app/(portal)/oksjon/[id]/page.tsx, apps/platform/src/app/(portal)/oksjon/[id]/_components/SellerContact.tsx] -->

## 6. Notification preferences

- [x] 6.1 Add `notificationPreferences` TEXT-JSON column to profiles, accept it in the profiles PATCH allowlist, enable the matrix toggles, add the eighth event (auction published), and make the dispatcher consult preferences before queueing a channel (missing keys default to email on, SMS off) <!-- agent: fullstack-engineer.build, depends_on: [], touches: [apps/platform/src/lib/data/schema/profiles.ts, apps/platform/src/app/api/v1/profiles/route.ts, apps/platform/src/app/(portal)/user/notifications/_components/preference-matrix.tsx, apps/platform/src/app/(portal)/user/notifications/_components/notifications-data.ts, apps/platform/src/lib/notifications/service.ts] -->
- [x] 6.2 Dispatcher tests: default matrix unchanged, a muted channel produces no notification, the persisted state reloads into the matrix <!-- agent: fullstack-engineer.build, depends_on: [6.1], touches: [apps/platform/src/lib/notifications/__tests__/**] -->

## 7. Register step 3 fields

- [x] 7.1 Add phone and address fields to `StepContactConsents` with the existing validators; the register route persists the phone on the profile <!-- agent: fullstack-engineer.build, depends_on: [2.1], touches: [apps/platform/src/app/(portal)/register/_components/StepContactConsents.tsx, apps/platform/src/app/api/v1/auth/register/route.ts] -->

## 8. Reset token durability

- [x] 8.1 Move reset tokens from the in-memory Map to a `password_reset_tokens` D1 table (token hash, user id, expires at, used at); forgot inserts, reset marks used in a single statement; routes read through Drizzle <!-- agent: fullstack-engineer.build, depends_on: [2.2], touches: [apps/platform/src/lib/auth/reset-tokens.ts, apps/platform/src/app/api/v1/auth/forgot-password/route.ts, apps/platform/src/app/api/v1/auth/reset-password/route.ts, apps/platform/drizzle/**] -->

## 9. Listing, archive, and small fixes

- [x] 9.1 "Telli teavitus" entry in the listing filter panel: authed users get the subscription modal prefilled with active filters; guests get email plus required visible consent; both save through `POST /api/v1/auction-subscriptions` <!-- agent: fullstack-engineer.build, depends_on: [], touches: [apps/platform/src/app/(portal)/_components/ListingFilters.tsx, apps/platform/src/app/(portal)/_components/SubscribeDialog.tsx] -->
- [x] 9.2 Archive statistics band per tab (auction count, ha, m³ on forest, €) from the existing statistics aggregation, hidden when empty <!-- agent: fullstack-engineer.build, depends_on: [], touches: [apps/platform/src/app/(portal)/ajalugu/page.tsx] -->
- [x] 9.3 Archive adds `endTime:asc` and `startPrice:asc` sort options and the active-filter count badge with "Tühjenda" <!-- agent: fullstack-engineer.fast, depends_on: [], touches: [apps/platform/src/app/(portal)/ajalugu/page.tsx, apps/platform/src/lib/auction/queries.ts] -->
- [x] 9.4 Small fixes batch: arrow-key amount stepping in `BidPanel`, species full-name tooltips in the dossier table, stale `/contracts/framework` redirect strings replaced with `/lepingud/raamleping` in `contract-gate.ts` and `place-bid.ts`, county GeoJSON outlines on `MapEstonia` <!-- agent: fullstack-engineer.build, depends_on: [], touches: [apps/platform/src/app/(portal)/oksjon/[id]/_components/BidPanel.tsx, apps/platform/src/app/(portal)/oksjon/[id]/_components/DossierTable.tsx, apps/platform/src/lib/bidding/contract-gate.ts, apps/platform/src/lib/bidding/place-bid.ts, packages/ui/src/components/content/MapEstonia.tsx] -->
- [x] 9.5 Update `docs/tasks.md` Phase 3 checkboxes to verified reality; record the deferrals in writing next to the section <!-- agent: fullstack-engineer.fast, depends_on: [9.1, 9.2, 9.3, 9.4], touches: [docs/tasks.md] -->

## 10. Host routing for the portal

- [x] 10.1 Host-aware middleware maps `oksjonid.erametsad.ww0.dev` to the `(portal)` area, redirects portal routes on the wrong host preserving path and query, keeps host-only cookie scope, and no-ops for every other hostname; document the DNS/Workers-route dashboard step and the api/admin follow-up in the cutover runbook and wrangler comments <!-- agent: fullstack-engineer.build, depends_on: [], touches: [apps/platform/src/middleware.ts, apps/platform/wrangler.jsonc, docs/runbooks/cutover-cloudflare-only.md] -->
- [x] 10.2 Smoke checks for both hostnames: portal host serves the listing, wrong-host redirect preserves path and query, sessions work per host <!-- agent: fullstack-engineer.fast, depends_on: [10.1], touches: [] -->

## 11. Verification

- [x] 11.1 Workspace lint, typecheck, tests, and build green; smoke the five §1.1 demo flows on a fresh `seed:reset`, including the sealed identity roundtrip and demo eID login with a seeded isikukood <!-- agent: fullstack-engineer.build, depends_on: [1.4, 2.3, 2.4, 3.4, 4.1, 4.3, 5.2, 6.2, 7.1, 8.1, 9.5, 10.2], touches: [] -->
