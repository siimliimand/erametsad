## Why

Phase 0 established the repository scaffold and Cloudflare deployment path.
Phase 1 built the design system and component library. Neither produces usable
output on their own — there are no collections, no auth flows, no bidding logic,
and no seed data. Phase 2 builds the entire business-logic layer that every
other phase depends on: data models, authentication, the bidding engine,
realtime SSE, notifications, contracts, statistics, and the seed dataset.

Without Phase 2 the portal cannot list auctions, the admin cannot create lots,
and the marketing site has no live data to display.

## What Changes

- **Reference data & taxonomies**: County/Parish tables, tree-species codes,
  logging-type enums.
- **Identity & access**: `User` (encrypted isikukood), `Profile` (private/company),
  `CompanyAccessRequest`, `AuctionRight`, session store with JWT + refresh tokens.
- **Auction & bidding collections**: `Auction` (full field model with status
  lifecycle guard), `Bid` (append-only), `AutoBidder`, `AuctionSubscription`.
- **Supporting collections**: `Contract`, `ContractTemplate`, `Lead`, `Notification`,
  `Specialist`, CMS collections (`Page`, `Article`, `FAQ*`, `Testimonial`,
  `PartnerService`, `LegalDocument`, `Redirect`), `Settings` singleton, `AuditEntry`,
  `StatisticsSnapshot`.
- **Auth flows**: password login, demo eID simulator (Smart-ID/Mobile-ID/ID-card),
  company lookup mock, registration with profiles and consents, password reset,
  profile selection scoping.
- **Bidding engine**: `placeBid` service with serializable row-lock transactions,
  autobidder evaluation with tie-breaks, anti-sniping time extension, alapakkumine
  (under-start bids with seller approval), sealed-bid encryption/decryption with
  two-person ceremony, auction-ending worker, contract-gate enforcement, and a full
  unit test suite covering every rule.
- **Realtime**: public `GET /api/auctions/stream` (SSE) and authed
  `GET /api/my/stream` with heartbeat and reconnect.
- **Notifications, contracts, stats, forms**: notification service (event bus +
  channel matrix + email templates), contract service (template render + mock sign),
  statistics aggregation from snapshots, lead ingestion with honeypot and rate limits.
- **Seed & fixtures**: taxonomies, 6 specialists, demo users for every role, ~30
  auctions across all types/statuses, bid history with autobidder duels and sealed
  bids, CMS content, contract templates, and `pnpm seed:reset`.

## Capabilities

### New Capabilities

- `reference-data`: county, parish, tree-species, and logging-type seed data.
- `identity-access`: user, profile, auction-right, session, and company-access collections.
- `auction-bidding`: auction, bid, auto-bidder, and auction-subscription collections.
- `supporting-collections`: contract, lead, notification, specialist, CMS pages, settings, audit, statistics.
- `auth-flows`: password login, demo eID simulator, registration, profile selection, session management.
- `bidding-engine`: place-bid service, autobidder, anti-sniping, alapakkumine, sealed bids, ending worker, ceremony, contract gate.
- `realtime-sse`: public and authed SSE streams.
- `notifications-contracts`: event-driven notifications, contract templating, statistics aggregation, lead ingestion.
- `seed-fixtures`: full demo dataset and reset command.

### Modified Capabilities

(none — greenfield)

## Impact

- New Payload collections (14+): `User`, `Profile`, `CompanyAccessRequest`,
  `AuctionRight`, `Auction`, `Bid`, `AutoBidder`, `AuctionSubscription`,
  `Contract`, `ContractTemplate`, `Lead`, `Notification`, `AuditEntry`,
  `StatisticsSnapshot`, plus CMS and Settings.
- New API routes under `/api/v1/auth/`, `/api/bids/`, `/api/auctions/`,
  `/api/my/`, `/api/v1/statistics`, `/api/leads`.
- New services in `apps/platform/src/lib/`: auth, bidding, realtime, notifications,
  contracts, stats, encryption, workers.
- New package `packages/emails/` expanding from Phase 0 scaffolds to real templates.
- New seed scripts producing re-usable, resettable demo data.
- `pgcrypto` or app-level AES encryption required for sealed bids at rest.