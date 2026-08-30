## Why

Phases 0-2 delivered the scaffold, the design system, and the full backend:
data layer, auth, bidding engine, SSE, notifications, contracts, and seed
data. None of it is usable by an end user yet. There is no portal UI, so a
buyer cannot browse lots, place a bid, or sign a contract. Phase 3 builds
the auction portal (`oksjonid.*`): the surface that proves the core demo
story - browse, bid, win, sign.

## What Changes

- **Portal shells**: public portal header with marketing links and auth
  chip, and the logged-in Portal Shell for `/user/*` routes (search,
  notification bell, profile chip, sidebar, mobile bottom tabs, breadcrumbs,
  `/api/my/stream` mount).
- **Listing**: type tabs with counters and the Estonian summary sentence,
  LotCard grid, Kaardivaade map toggle with pin popups, URL-encoded
  FilterPanel (county-parish cascade, species, logging types, ranges),
  sorting, server pagination, SSE live updates.
- **Lot detail (shared dossier)**: header with server-synced Countdown,
  gallery lightbox, map with kataster/Metsaregister links, full dossier
  DataTable plus package table, rich-text cards, signed-URL file downloads,
  SpecialistCard with per-lot alias email.
- **Open-auction bidding**: BidPanel with step input and confirm modal,
  alapakkumine toggle with pending chip, inline autobidder CRUD,
  raamleping gate redirect, role-shaped bid list, outbid banner, all panel
  states (guest / no-rights / not-started / ended).
- **Sealed-bid page**: explanation card, identity snapshot form with
  validators, binding confirm modal, locked submitted card, revision
  resubmit, post-opening result states.
- **Archive**: per-type tabs with counters, filters with endYear chips,
  finalPrice-descending default sort, 24/page, privacy footer.
- **Auth pages**: login with three eID method cards over the demo simulator,
  4-step registration wizard with company lookup and access request,
  profile switcher, password set/change/reset with strength meter.
- **Customer area**: Minu pakkumised, Minu müügid with alapakkumine approval
  queue, Teavitused (inbox, preference matrix, saved searches), Minu
  profiil (rights matrix, sessions, consents log), and the full contract
  signing flow for raamleping and oksjonileping.
- **Supporting APIs**: public auction list/detail, role-shaped bids,
  with-user-bids, counties, notifications read endpoints, saved-search
  subscription CRUD with token unsubscribe, seller list/actions, profile
  read/update, rights request with a new `rights_requests` table,
  auto-bidder item PATCH/DELETE.

## Capabilities

### New Capabilities

- `portal-shell`: public portal chrome, logged-in Portal Shell, portal
  session helpers, SSE client hooks.
- `portal-api`: read and mutation endpoints the portal UI consumes, with
  role-shaped responses.
- `portal-auth`: login, registration, profile selection, password pages.
- `portal-listing`: listing page with tabs, filters, map view, SSE.
- `portal-lot-detail`: shared dossier plus open-auction BidPanel and
  sealed-bid panel variants.
- `portal-archive`: history pages and the ended-lot detail state.
- `portal-customer-area`: bids, sales, notifications, profile, and
  contract signing under the Portal Shell.

### Modified Capabilities

(none - the data layer and engine are unchanged; one additive
`rights_requests` table is noted under portal-api)

## Impact

- New route group `apps/platform/src/app/(portal)/` with layouts, pages,
  and co-located components; placeholder `app/page.tsx` removed so the
  portal owns `/`.
- New API routes under `apps/platform/src/app/api/v1/` (auctions list,
  detail, bids, with-user-bids, counties, notifications, subscriptions,
  my-auctions actions, profiles, rights).
- One new D1 table `rights_requests` via Drizzle Kit migration.
- New client hooks `use-auction-stream.ts` and `use-my-stream.ts`.
- No changes to the bidding engine, schema lifecycle, or SSE servers; the
  portal is a consumer of the phase 2 services.

## Deferred (accepted in writing)

- Listing quick-subscribe button ("Telli teavitus" on the filter panel) [S]
  - the saved-search CRUD lives in Teavitused [M] and its API ships here.
- Archive statistics band [S].
- CSV exports for bids and sales [S].
- Sales drawer statistics mini-chart [S].
- Digest scheduling for saved searches [L] - frequency is stored, no jobs.
- GDPR export/delete jobs [L].
- Saved-search matcher (phase 2 [S] deferral stands - subscriptions are
  stored, nothing matches against them yet).
- Real eID and signing providers; TOTP 2FA [L]; EN/RU localization.
