## Context

Phase 2 shipped the repository layer (`apps/platform/src/lib/data/`), the
bidding engine, demo eID endpoints, SSE streams (`/api/v1/auctions/stream`,
`/api/v1/my/stream`), the notification service, and the contract service.
Phase 1 shipped the full design system in `packages/ui`, including `LotCard`,
`FilterPanel`, `MapEstonia`, `Countdown`, `DataTable`, and the form
components. The app currently has only an `(admin)` route group and a
placeholder `app/page.tsx`. The portal UI does not exist.

Page-level truth lives in `docs/design/portal/01..13`; this change
implements those specs against the phase 2 services.

## Goals / Non-Goals

**Goals:**

- Every page in `docs/design/portal/` reachable at its spec route.
- Bidding through the existing server-authoritative engine; the portal is a
  thin client.
- Role-shaped data everywhere: guest, authed bidder, seller, and public
  archive each see exactly what the specs allow.
- Live updates through the two existing SSE streams.
- The supporting endpoints the specs reference that phase 2 did not build.

**Non-Goals:**

- Admin UI work (phase 5), marketing site (phase 4).
- Real eID or signing providers; the demo simulator and mock ceremony are
  the implementations.
- Digest jobs, GDPR export/delete, CSV exports, Web Push, TOTP (deferred,
  see proposal).
- Any change to bid admission, anti-sniping, sealed encryption, or the
  ending worker.

## Decisions

### D1: `(portal)` route group owns `/`

The portal gets its own route group `apps/platform/src/app/(portal)/`,
mirroring the `(admin)` group (layout + `_components` + `_lib` + co-located
pages). The placeholder `app/page.tsx` is deleted so `(portal)/page.tsx`
can serve `/` without a Next.js route conflict. Marketing pages arrive in
phase 4 as a separate group; route collisions are a phase 4 concern.

Alternative: path-prefix everything under `/oksjonid/`. Rejected: the
design specs define portal routes at the root (`/`, `/oksjon/:id`,
`/user/bids`), and the prototype deploys as one app.

### D2: Server components read repositories; REST only for client interactivity

The `(admin)` group already renders pages straight from the repository
layer. The portal follows the same pattern: server components query
repositories via helpers, and REST endpoints are added only where client
code needs them (bid list refresh after SSE events, autobidder edit,
notification read flags, subscription CRUD, profile switching). This avoids
building a redundant REST facade over the repos.

Alternative: full REST coverage of every read. Rejected: duplication of the
repository query logic with no consumer.

### D3: Portal session helpers wrap the existing auth stack

`apps/platform/src/app/(portal)/_lib/session.ts` exposes
`requirePortalSession()` (redirect to `/login?next=` when anonymous) and
`getActiveProfile()` (profile-scoped context from `lib/auth/profile-scope`).
Pages never touch cookies or JWT directly.

### D4: Two SSE client hooks, one reconnect policy

`use-auction-stream.ts` and `use-my-stream.ts` are the only EventSource
consumers. Both share one policy: exponential backoff reconnect, full
refetch of the current view on reconnect, heartbeat is server-side already.
The Portal Shell mounts `useMyStream` once and fans events out through
context; the listing and lot pages use `useAuctionStream`.

### D5: Role shaping computed server-side, rendered as-is

Bid lists and leading-bid visibility are shaped at the data boundary (the
new bids endpoint and repository helpers), not filtered in the browser.
Guests get counts and times only; authed users get amounts with `Pakkuja #n`
labels; sellers get the seller shape in their drawer. Leading bid is visible
to all authed users (spec recommendation, tasks.md open question 4).
Sealed lots show bid count only (open question 5), never amounts or times.

### D6: New `rights_requests` table for "Taotle õigust"

The profile page lets users request bidding rights per object type. No
storage exists for that queue, so this change adds a minimal
`rights_requests` table (user, objectType, status, timestamps) through
Drizzle Kit, following the schema conventions in `lib/data/schema/`. Admin
approval stays a phase 5 concern; the portal shows pending state only.

Alternative: reuse `Notification` as the queue. Rejected: notifications are
a delivery log, not a request lifecycle.

### D7: Estonian product copy, English identifiers

All UI text follows the Estonian drafts in the design specs verbatim where
provided. Component and file names stay English per repo conventions.

### D8: Contract signing reuses the phase 2 contract service

`prepare`/`complete` endpoints, template rendering, mock signing sessions,
and hash audit already exist. The signing pages implement the 4-step flow,
PDF preview, status timeline, and the version-bump no-force-resign rule on
top. No new contract backend logic.

## Risks / Trade-offs

- 33 tasks touch many new files with few shared ones; waves stay
  file-disjoint by construction. The `BidPanel` cluster (4.2-4.4) is
  serialized through shared `touches`.
- Sealed-bid page renders almost no dynamic data; incorrect role shaping
  here would leak amounts. Mitigation: shaping lives in one repository
  helper covered by task 7.1 tests.
- `rights_requests` is the only schema change; it is additive and cannot
  affect existing flows.
