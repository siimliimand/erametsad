## Context

Phase 0 delivered the Payload CMS scaffold with role-based access control,
CI, and Cloudflare deployment plumbing. Phase 1 shipped the design system
tokens and shared UI components. No collections, API routes, auth flows, or
seed data exist yet. This phase must fill every gap between the scaffold and
a runnable demo platform.

## Goals / Non-Goals

**Goals:**

- Implement every Payload collection Erametsad needs (14+ collections).
- Ship a server-authoritative bidding engine with transactional guarantees.
- Build a demo eID simulator so the platform is testable without real Smart-ID/Mobile-ID.
- Provide SSE streams for live auction and bid updates.
- Seed a realistic demo dataset covering every status, role, and edge case.

**Non-Goals:**

- Real eID provider integration (mock covers the same API shape).
- Production Redis or queue infrastructure (Cloudflare Queues + KV already pilot-wired in Phase 0).
- Analytics consent UI, SEO content production, EN/RU localization (follows later phases).
- Saved-search digests, Web Push, TOTP 2FA, GDPR export (post-prototype).

## Decisions

### D1: Payload collections as the single source of truth

All data models will be defined as Payload CMS collections rather than
standalone Prisma/Drizzle schemas. Payload generates the REST + GraphQL API,
admin UI, and zod schemas from the collection config, reducing duplication.

Alternative: separate Postgres schema via Drizzle + manual API wiring.
Rejected: too much duplication; Payload's admin panel is the internal tool
for specialists and admins.

### D2: App-level encryption for sealed bids

Sealed bids will be encrypted with AES-256-GCM at the application layer
before being persisted. Keys will be managed via an env variable in the
prototype (cloud KMS swap-in later). This avoids a database migration to
enable Transparent Data Encryption and keeps the encryption logic testable
in code.

Alternative: `pgcrypto` extension column-level encryption.
Rejected: harder to unit-test and the ceremony logic needs direct
control of encrypt/decrypt timing.

### D3: SSE over WebSocket for realtime

All live-updating channels will use Server-Sent Events (`/api/auctions/stream`,
`/api/my/stream`), matching the decision already locked in Phase 0 technical
foundation. SSE works through Cloudflare Pages Functions without upgrading
the connection protocol and has simpler reconnect semantics.

### D4: BullMQ interface abstracted behind a queue adapter

The `placeBid` service and auction-ending worker will communicate through a
queue adapter interface (`apps/platform/src/lib/queue/adapter.ts`). The local
implementation uses BullMQ + Redis (already in docker-compose from Phase 0).
The Cloudflare production implementation uses Cloudflare Queues. Neither
side changes the bidding engine code.

### D5: Session strategy: short-lived JWT access + rotating refresh token

Access tokens will have a 5-minute expiry. Refresh tokens will rotate on
every use (single-use, invalidate family on replay). Sessions are stored in
a Payload collection backed by Postgres so sessions survive process restarts.
HttpOnly secure cookies carry both tokens — nothing in localStorage.

### D6: Namespace-ish grouping in the admin API routing surface

The admin endpoints (`/api/admin/...`) and all admin actions (auction editing,
sealed-opening ceremony, user management) will live under a common route
prefixed with `/api/admin/auctions|users|...` to keep the portal and admin
API surfaces visually distinct in route files and in network inspector.

### D7: Seed data strategy: dedicated seed scripts in a `seed/` folder

Seed data will live in `apps/platform/src/payload/seed/`. Each script
(auctions, bids, users, cms, reset) will import from the shared types
package so type mismatches are caught in CI. `pnpm seed:reset` will call a
master script that truncates all collections in FK-safe order and re-runs
the full seed.

## Risks / Trade-offs

- **[Auction-ending worker clock skew]** → The Cloudflare Pages deployment
  environment may have small clock skew. All auction end-time comparisons
  MUST use the server's system time, validated at process start. The
  auction-ending worker will add ±30s tolerance to endTime checks.

- **[Sealed-bid ceremony stillness]** → The two-person ceremony requires two
  admin sessions to be active at once. For prototype purposes this is fine.
  In production a time-limited approval URL pattern would be needed.

- **[Payload + R2 media pipeline]** → Payload 3 uses Node.js internals for
  image processing (`sharp`). In a CF Pages environment this requires
  `nodejs_compat`. If issues arise, the media processing will move to a
  thin CF Worker sidecar.

- **[Auction anti-snipe broadcast race]** → Two bids arriving within
  milliseconds near the anti-snipe boundary could create conflicting endTime
  extensions. Mitigation: row lock on the auction + single-writer guarantee
  within the `placeBid` transaction.

## Open Questions

1. Production eID provider choice: eID Easy, Dokobit, or Signicat.
2. Auction anti-snipe default: plan says 5 min, admin editor says 13 min
   (from Settings). Both paths will be wired; the default is a single
   Settings value.
3. Whether `@cloudflare/next-on-pages` handles all of Payload's Node.js
   internals or if a sidecar Worker is required.