## 1. Reference data & taxonomies

- [x] 1.1 County (15) + Parish ref tables with seed import <!-- agent: fullstack-engineer.build, depends_on: [], touches: [apps/platform/src/payload/collections/County.ts, apps/platform/src/payload/collections/Parish.ts, apps/platform/src/payload/seed/taxonomies.ts] -->
- [x] 1.2 Tree-species codes (24) + logging types (AR,HL,HR,KR,LR,RD,SR,TR,VE,VR) enums in `packages/types` <!-- agent: fullstack-engineer.build, depends_on: [], touches: [packages/types/src/enums.ts] -->

## 2. Identity & access collections

- [x] 2.1 User collection: isikukood encrypted column + hash index, email, phone, status, auth method <!-- agent: fullstack-engineer.build, depends_on: [], touches: [apps/platform/src/payload/collections/User.ts] -->
- [x] 2.2 Profile (private|company) + approval_status + CompanyAccessRequest collection <!-- agent: fullstack-engineer.build, depends_on: [2.1], touches: [apps/platform/src/payload/collections/Profile.ts, apps/platform/src/payload/collections/CompanyAccessRequest.ts] -->
- [x] 2.3 AuctionRight collection: user × objectType grant, granted_by, revoke <!-- agent: fullstack-engineer.build, depends_on: [2.1], touches: [apps/platform/src/payload/collections/AuctionRight.ts] -->
- [x] 2.4 Session store: short JWT + rotating refresh, httpOnly cookies, session list & revoke <!-- agent: fullstack-engineer.build, depends_on: [2.1], touches: [apps/platform/src/lib/auth/session.ts, apps/platform/src/lib/auth/jwt.ts] -->

## 3. Auction & bidding collections

- [x] 3.1 Auction collection with complete field model (identity/status, location, land/forest, pricing, content, package, specialist, seller) <!-- agent: fullstack-engineer.build, depends_on: [1.1, 2.1], touches: [apps/platform/src/payload/collections/Auction.ts] -->
- [x] 3.2 Status lifecycle field + transitions guard (draft→scheduled→active→ended→appraised/unsold→contract→completed→archived) <!-- agent: fullstack-engineer.build, depends_on: [3.1], touches: [apps/platform/src/payload/collections/Auction.ts, apps/platform/src/lib/auction/status-transitions.ts] -->
- [x] 3.3 Bid collection: append-only, amount, type, source, status set, identity_snapshot, ip_hash (salted) <!-- agent: fullstack-engineer.build, depends_on: [3.1, 2.1], touches: [apps/platform/src/payload/collections/Bid.ts] -->
- [x] 3.4 AutoBidder collection: max_amount, status (one active per user×auction) <!-- agent: fullstack-engineer.build, depends_on: [3.1, 2.1], touches: [apps/platform/src/payload/collections/AutoBidder.ts] -->
- [x] 3.5 AuctionSubscription collection: filter_json, channel, frequency, unsubscribe token <!-- agent: fullstack-engineer.build, depends_on: [3.1, 2.1], touches: [apps/platform/src/payload/collections/AuctionSubscription.ts] -->

## 4. Supporting collections

- [x] 4.1 Contract + ContractTemplate collections (type, version, placeholders, DOCX) <!-- agent: fullstack-engineer.build, depends_on: [3.1, 2.1], touches: [apps/platform/src/payload/collections/Contract.ts, apps/platform/src/payload/collections/ContractTemplate.ts] -->
- [x] 4.2 Lead collection: form_name, page_slug, contact, status pipeline, assigned specialist, consent_at, source <!-- agent: fullstack-engineer.build, depends_on: [2.1], touches: [apps/platform/src/payload/collections/Lead.ts] -->
- [x] 4.3 Notification collection: user, event, channel, payload, read_at <!-- agent: fullstack-engineer.build, depends_on: [2.1], touches: [apps/platform/src/payload/collections/Notification.ts] -->
- [x] 4.4 Specialist collection: name, slug, role, phone, email, photo, bio, region, active, featured <!-- agent: fullstack-engineer.build, depends_on: [], touches: [apps/platform/src/payload/collections/Specialist.ts] -->
- [x] 4.5 CMS collections: Page, Article, FAQCategory/FAQItem, Testimonial, PartnerService, LegalDocument, Redirect + per-page SEO <!-- agent: fullstack-engineer.build, depends_on: [], touches: [apps/platform/src/payload/collections/Page.ts, apps/platform/src/payload/collections/Article.ts, apps/platform/src/payload/collections/FAQCategory.ts, apps/platform/src/payload/collections/FAQItem.ts, apps/platform/src/payload/collections/Testimonial.ts, apps/platform/src/payload/collections/PartnerService.ts, apps/platform/src/payload/collections/LegalDocument.ts, apps/platform/src/payload/collections/Redirect.ts] -->
- [x] 4.6 Settings singleton: org data, fee % + VAT, anti-snipe defaults, alapakkumine default, sealed revision cap, feature flags <!-- agent: fullstack-engineer.build, depends_on: [], touches: [apps/platform/src/payload/collections/Settings.ts] -->
- [x] 4.7 AuditEntry append-only: actor, action, entity, before/after JSON <!-- agent: fullstack-engineer.build, depends_on: [], touches: [apps/platform/src/payload/collections/AuditEntry.ts] -->
- [x] 4.8 StatisticsSnapshot: date × objectType: count, area, volume, eur <!-- agent: fullstack-engineer.build, depends_on: [3.1], touches: [apps/platform/src/payload/collections/StatisticsSnapshot.ts] -->

## 5. Auth flows

- [x] 5.1 Password login (identifier + password), rate-limit 5/min/IP, neutral errors <!-- agent: fullstack-engineer.build, depends_on: [2.1], touches: [apps/platform/src/app/api/v1/auth/login/route.ts, apps/platform/src/lib/auth/password.ts] -->
- [x] 5.2 Demo eID simulator behind provider interface: POST /api/v1/auth/{smartid|mobileid|idcard}/start|status|complete; control-code screen; 2s polling; configure demo isikukoods <!-- agent: fullstack-engineer.build, depends_on: [2.1], touches: [apps/platform/src/app/api/v1/auth/smartid/start/route.ts, apps/platform/src/app/api/v1/auth/smartid/status/route.ts, apps/platform/src/app/api/v1/auth/mobileid/, apps/platform/src/app/api/v1/auth/idcard/, apps/platform/src/lib/auth/eid-provider.ts] -->
- [x] 5.3 Registration backend: profiles, consents (3 checkboxes), POST /api/v1/business/request-access <!-- agent: fullstack-engineer.build, depends_on: [2.1, 2.2, 5.1], touches: [apps/platform/src/app/api/v1/auth/register/route.ts, apps/platform/src/app/api/v1/business/request-access/route.ts] -->
- [x] 5.4 Company lookup mock GET /api/v1/company-lookup?regCode= (fixtures) <!-- agent: fullstack-engineer.build, depends_on: [2.2], touches: [apps/platform/src/app/api/v1/company-lookup/route.ts, apps/platform/src/lib/company-lookup-fixtures.ts] -->
- [x] 5.5 Password reset (2h tokens, single-use, revoke sessions) + change <!-- agent: fullstack-engineer.build, depends_on: [2.1, 5.1], touches: [apps/platform/src/app/api/v1/auth/reset-password/[token]/route.ts, apps/platform/src/lib/auth/reset-tokens.ts] -->
- [x] 5.6 Profile selection: session carries activeProfileId, POST /api/v1/profiles/:id/select; everything scoped <!-- agent: fullstack-engineer.build, depends_on: [2.2, 2.4], touches: [apps/platform/src/lib/auth/profile-scope.ts, apps/platform/src/app/api/v1/profiles/[id]/select/route.ts] -->

## 6. Bidding engine

- [x] 6.1 placeBid service: SERIALIZABLE transaction + row lock; chain (authed→active→not ended→objectType right→amount≥current+step); append-only audit <!-- agent: fullstack-engineer.build, depends_on: [3.1, 3.3, 2.3, 5.1], touches: [apps/platform/src/lib/bidding/place-bid.ts, apps/platform/src/app/api/bids/create/route.ts] -->
- [x] 6.2 Autobidder evaluation: min to lead, ties by earlier creation, auto-vs-auto = (secondMax + step) <!-- agent: fullstack-engineer.build, depends_on: [6.1, 3.4], touches: [apps/platform/src/lib/bidding/autobidder.ts, apps/platform/src/app/api/auto-bidders/route.ts] -->
- [x] 6.3 Anti-sniping: bid in last N min extends endTime by N; persisted + SSE broadcast <!-- agent: fullstack-engineer.build, depends_on: [6.1, 4.6], touches: [apps/platform/src/lib/bidding/anti-snipe.ts] -->
- [x] 6.4 Alapakkumine: under-start bid → pending_seller_approval; seller approve/reject; race guard <!-- agent: fullstack-engineer.build, depends_on: [6.1], touches: [apps/platform/src/lib/bidding/alapakkumine.ts] -->
- [x] 6.5 Sealed bids: one per user + revision cap, amount + identity encrypted at rest (AES-256-GCM); double-submit guard w/ idempotency key <!-- agent: fullstack-engineer.build, depends_on: [6.1], touches: [apps/platform/src/lib/bidding/sealed-bid.ts, apps/platform/src/lib/encryption.ts] -->
- [x] 6.6 Auction-ending worker: idempotent active→ended, server-authoritative; compute open-auction outcome; fire notifications; write StatisticsSnapshot <!-- agent: fullstack-engineer.build, depends_on: [6.1, 6.2, 6.3, 6.4, 4.8], touches: [apps/platform/src/lib/workers/auction-ending.ts] -->
- [x] 6.7 Sealed-opening service: two-person rule (opener + approver tokens); one-shot simultaneous decrypt; rank by amount desc; winner confirm/unsold/void paths <!-- agent: fullstack-engineer.build, depends_on: [6.5, 6.6], touches: [apps/platform/src/lib/bidding/sealed-opening.ts, apps/platform/src/app/api/admin/auctions/[id]/open-sealed/route.ts, apps/platform/src/app/api/admin/auctions/[id]/confirm-winner/route.ts] -->
- [x] 6.8 Contract gate for open bidding: signed framework contract required before first bid <!-- agent: fullstack-engineer.build, depends_on: [6.1, 4.1], touches: [apps/platform/src/lib/bidding/contract-gate.ts] -->
- [x] 6.9 Unit tests: step math, ties, anti-snipe boundary, alapakkumine, sealed encrypt/decrypt ceremony, idempotent ending <!-- agent: fullstack-engineer.build, depends_on: [6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7], touches: [apps/platform/src/lib/bidding/__tests__/place-bid.test.ts, apps/platform/src/lib/bidding/__tests__/autobidder.test.ts, apps/platform/src/lib/bidding/__tests__/anti-snipe.test.ts, apps/platform/src/lib/bidding/__tests__/alapakkumine.test.ts, apps/platform/src/lib/bidding/__tests__/sealed-bid.test.ts, apps/platform/src/lib/workers/__tests__/auction-ending.test.ts] -->

## 7. Realtime SSE streams

- [x] 7.1 GET /api/auctions/stream (SSE): auction:published, auction:extended, auction:ended, bid:created (anonymised) <!-- agent: fullstack-engineer.build, depends_on: [3.1, 6.1], touches: [apps/platform/src/app/api/auctions/stream/route.ts, apps/platform/src/lib/realtime/auction-stream.ts] -->
- [x] 7.2 GET /api/my/stream (authed SSE): bid, outbid, auction_end, notification, countdown_sync; heartbeat 30s; reconnect w/ exponential backoff + full refetch <!-- agent: fullstack-engineer.build, depends_on: [5.6, 7.1, 4.3], touches: [apps/platform/src/app/api/my/stream/route.ts, apps/platform/src/lib/realtime/my-stream.ts] -->

## 8. Notifications, contracts, stats, forms

- [x] 8.1 Notification service: event bus → channel matrix (email via Mailpit, SMS log stub); templates in packages/emails <!-- agent: fullstack-engineer.build, depends_on: [4.3, 2.1], touches: [apps/platform/src/lib/notifications/service.ts, apps/platform/src/lib/notifications/event-bus.ts, packages/emails/src/templates/bid-placed.tsx, packages/emails/src/templates/outbid.tsx, packages/emails/src/templates/auction-won.tsx, packages/emails/src/templates/auction-ended.tsx] -->
- [x] 8.2 Contract service: template placeholders ({{...}}), HTML preview + simple PDF, prepare/complete endpoints, mock signing 15-min expiry, hash audit <!-- agent: fullstack-engineer.build, depends_on: [4.1, 2.1], touches: [apps/platform/src/lib/contracts/service.ts, apps/platform/src/lib/contracts/render.ts, apps/platform/src/app/api/bids/framework-contract/prepare/route.ts, apps/platform/src/app/api/bids/framework-contract/complete/route.ts, apps/platform/src/app/api/bids/contract/prepare/route.ts, apps/platform/src/app/api/bids/contract/complete/route.ts] -->
- [x] 8.3 Statistics aggregation + GET /api/v1/statistics from snapshots <!-- agent: fullstack-engineer.build, depends_on: [4.8], touches: [apps/platform/src/app/api/v1/statistics/route.ts, apps/platform/src/lib/stats/aggregation.ts] -->
- [x] 8.4 POST /api/leads ingestion: honeypot, rate-limit (IP 5/min), consent required, source tracking <!-- agent: fullstack-engineer.build, depends_on: [4.2], touches: [apps/platform/src/app/api/leads/route.ts, apps/platform/src/lib/leads/ingestion.ts] -->

## 9. Seed & fixtures

- [ ] 9.1 Seed: taxonomies, 6 specialists, demo users for every role (guest+private+company-pending+seller+specialist+admin+superadmin) with documented credentials <!-- agent: fullstack-engineer.build, depends_on: [1.1, 2.1, 2.2, 4.4], touches: [apps/platform/src/payload/seed/index.ts, apps/platform/src/payload/seed/users.ts, apps/platform/src/payload/seed/specialists.ts] -->
- [x] 9.2 ~30 demo auctions: all 4 object types × open/sealed × statuses (draft/scheduled/active/ending-soon/ended/sold/unsold/archived) incl. kiiroksjon + package table <!-- agent: fullstack-engineer.build, depends_on: [3.1, 9.1], touches: [apps/platform/src/payload/seed/auctions.ts] -->
- [x] 9.3 Bid history fixtures incl. autobidder duel + pending alapakkumine; sealed bids ready for live opening demo <!-- agent: fullstack-engineer.build, depends_on: [3.3, 6.1, 9.2], touches: [apps/platform/src/payload/seed/bids.ts] -->
- [x] 9.4 CMS seed: homepage + service pages + FAQ (7 categories) + 6 articles + specialists + legal docs + contract templates + leads in all pipeline stages <!-- agent: fullstack-engineer.build, depends_on: [4.5, 4.1, 9.1], touches: [apps/platform/src/payload/seed/cms.ts, apps/platform/src/payload/seed/contracts.ts, apps/platform/src/payload/seed/leads.ts] -->
- [x] 9.5 pnpm seed:reset — wipe collections in FK-safe order and reseed; wire to workspace script <!-- agent: fullstack-engineer.build, depends_on: [9.1, 9.2, 9.3, 9.4], touches: [apps/platform/src/payload/seed/reset.ts, apps/platform/package.json] -->