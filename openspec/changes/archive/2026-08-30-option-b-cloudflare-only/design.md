## Context

Option A (the current build) runs a Next.js 15 app on Cloudflare Workers
through OpenNext, with Payload CMS 3 embedded and Postgres at an external
host (Neon, via `@neondatabase/serverless`). Verified codebase facts that
drive this design (source plan, section 2):

- Payload has no D1 adapter. Its SQLite adapter needs `better-sqlite3`, a
  native module that cannot run on Workers. 26 collections are defined in
  `apps/platform/src/payload/collections/`.
- Bid placement serializes through a Drizzle transaction with
  `SELECT ... FOR UPDATE` (`src/lib/bidding/place-bid.ts`,
  `withAuctionLock`). D1 has no interactive transactions or row locks.
- The SSE client registry is a module-level `Map`
  (`src/lib/realtime/auction-stream.ts`), so `broadcast()` misses listeners
  in other isolates. Broken under both options.
- The rate limiter is an in-memory token bucket (`src/lib/rate-limit.ts`),
  so the effective limit multiplies by isolate count.
- Sessions keep an in-memory `accessTokenSessions` map and use Node
  `crypto` hashing (`src/lib/auth/session.ts`).
- Email goes through nodemailer SMTP with Mailpit in dev and no production
  provider.
- D1 constraints: 10 GB per database, single writer per database,
  atomicity per statement or via `batch()` only, SQLite dialect.
- Cloudflare Email Service: beta, Workers Paid required, 3,000
  emails/month included, daily quota ramp on new accounts, 5 MiB cap.
- Durable Objects require the same Workers Paid plan.

Provisioned resources (account `29f50b2c...`): queue `erametsad-jobs`, KV
namespace `5b67cd2c595f4d31b3b1be5db76e9bef` (id missing from
`wrangler.jsonc` today), R2 buckets `erametsad-media` and
`erametsad-media-preview`. Email Service is not yet enabled.

## Goals / Non-Goals

**Goals:**

- Every stateful component runs inside Cloudflare: no external database,
  email, or cache vendor.
- Auction correctness on Workers: serialized bid admission, authoritative
  rate limiting, correct cross-isolate SSE broadcast, server-authoritative
  auction timing.
- Same public behavior: SSE event names, API routes, Estonian UI, and the
  seed dataset stay as they are.
- A go/no-go gate after Phase 0 so the expensive phases start only with
  spike data in hand.

**Non-Goals:**

- Rebuilding all of Payload's admin features. The custom admin covers the
  per-role needs inventory from Phase 6, not a CMS clone.
- i18n beyond Estonian, new product features, or the Phase 5 association
  subsite.
- A long dual-backend overlap. The `DB_BACKEND=pg|d1` feature flag is out
  of scope unless a specific migration need is approved.
- Postgres compatibility shims. The mapping rules below are applied
  everywhere with no exceptions.

## Decisions

### D1 as the system of record

D1 is durable and written by Workers directly and by `AuctionDO` after
each accepted bid. No caching layer on hot paths at first. Alternative
considered: keep Neon Postgres (Option A) and only rebuild the broken
isolate-hostile parts. Rejected for this plan because consolidation is the
goal, but the fallback stays open until the Phase 0 gate.

### Payload replaced wholesale (sub-option 1 of three)

1. Full replacement with a repository layer plus custom admin. Chosen.
   Full control, all Workers-native. Costs Phase 6 (2 to 4 weeks) and the
   Payload TypeScript types (compensated by Drizzle schema types) and
   versioning or drafts (believed unused, verified in Phase 0).
2. Keep Payload on an always-on Node container for admin and content only.
   Halves Phase 6 but reintroduces an external runtime and splits the data
   model. Rejected.
3. Wait for a community D1 adapter. None exists (2026-08), timeline
   unknowable. Rejected.

### Postgres to SQLite mapping rules (fixed, no exceptions)

| Postgres | D1/SQLite rule | Notes |
|---|---|---|
| `numeric` money | INTEGER cents (`bid_amount_cents`) | Never `REAL`. Convert at the API boundary. |
| `enum` types | TEXT plus `CHECK (col IN (...))` | Enum unions stay in `@erametsad/types`. |
| `jsonb` | TEXT, parsed in the repository layer | Indexed JSON paths become denormalized columns when queried. |
| `uuid` | TEXT generated in the app | `crypto.randomUUID()` at insert time. |
| `timestamptz` | TEXT ISO-8601 UTC | One format everywhere; D1 `DEFAULT CURRENT_TIMESTAMP` is UTC text. |
| `SELECT ... FOR UPDATE` | `AuctionDO` serialization | Never emulated with D1. |
| multi-statement transaction | `batch()` | Atomic, no intermediate reads. Read-decide-write moves into a DO. |

A schema lint enforces the money rule: it fails on `REAL` columns for
money fields and on enum-like TEXT columns without a CHECK constraint.

### Durable Objects as the correctness substrate

`AuctionDO`, one per auction, is single-threaded per auction and owns:

1. Bid admission control: the full validation chain from `place-bid.ts`,
   idempotency key replay, and one `batch()` write on accept (bid row,
   auction update, audit entry). Autobidder evaluation runs in the DO.
2. The SSE or WebSocket hub: the subscriber set lives in the DO, so
   `broadcast()` is DO-local and correct. Public event names stay:
   `bid:created`, `auction:extended`, `auction:ended`,
   `auction:published`.
3. Alarm-driven scheduling: anti-snipe extension checks and auction end
   run in `alarm()`, replacing the polling worker. A cron `scheduled()`
   sweep stays as a safety net for auctions whose DO was evicted.

The DO hydrates on demand from D1 at first touch and keeps only hot state
(current price, `endsAt`, subscriber set) in DO storage.

`RateLimiterDO`, one per key such as IP plus route, holds authoritative
token-bucket counters. `src/lib/rate-limit.ts` keeps its API and
delegates. It is ephemeral and needs no storage.

### Email transport chain

`email-sender.ts` tries the `EMAIL` binding first, then the Email Service
REST API (`CLOUDFLARE_EMAIL_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`), then SMTP.
`next dev` keeps Mailpit. This keeps a Postmark or Resend swap a
config-level change if the beta becomes impractical. Sending domain
`erametsad.ee`, sender `noreply@erametsad.ee`.

### Sessions and crypto

Access-token sessions move from the in-memory map to a D1-backed store.
Refresh-token families already persist; Phase 4 verifies rotation survives
isolate restarts. Node `crypto` (`createHash`, `randomUUID`, HMAC in
`jwt.ts`, `computeIpHash` in the bid path) ports to Web Crypto
(`crypto.subtle`), with a dual implementation only where local vitest
needs it. The eID provider is audited for TCP or Node assumptions and
tested against the provider sandbox; its redirect-plus-signature flows
are expected to port.

### Background jobs

A queue consumer worker handles notification fan-out (one message per
user and channel, idempotent through the existing `dedupeKey`), email
sending, and contract PDF generation into R2. A dead-letter queue with a
retry policy and depth alerting backs it.

### Admin UI scope

Minimal internal admin instead of a CMS clone: an inventory of actual
per-collection needs comes first (open question 4 in the source plan),
then `apps/platform/src/app/(admin)/` with table and form pages on the
repository layer, server actions, `users.role` guards, and Estonian UI.
Media runs on R2. JSON import and export covers bulk content loads.

## Risks / Trade-offs

- [D1 single-writer ceiling at auction-close bursts] -> Phase 7 load test
  early; all hot writes route through `AuctionDO`; shard reads via D1
  read replication if needed.
- [Money precision bugs during the dialect port] -> integer-cents rule,
  schema lint banning `REAL`, property tests on amounts.
- [Admin UI scope creep] -> Phase 6 inventory first; an explicit per-role
  needs list before building.
- [Email Service beta changes or quota ramp blocks launch notifications]
  -> transport abstraction makes a Postmark or Resend swap config-level;
  warm the quota pre-launch; monitor `E_DAILY_LIMIT_EXCEEDED`.
- [Lost Payload drafts, versioning, access rules] -> verify unused before
  assuming; encode access rules as repository guards with tests.
- [eID flow breaks on Workers] -> Phase 4 audit plus provider sandbox
  test before cutover.
- [Two-system drift if the migration stalls] -> phases keep the app
  shippable; no long dual-backend overlap by default.
- [DO cost or behavior surprises] -> the Phase 0 spike covers DO access
  inside OpenNext before anything depends on it.

## Migration Plan

Phases 0 to 7 from the source plan, each with exit criteria:

| Phase | Scope | Estimate |
|---|---|---|
| 0 | Spikes and decisions (gate) | 1 week |
| 1 | Data layer on D1 | 2 to 2.5 weeks |
| 2 | Durable Objects | 1.5 weeks |
| 3 | Email Service | 2 to 3 days |
| 4 | Auth and sessions | 3 to 5 days |
| 5 | Jobs and queue | 3 to 4 days |
| 6 | Admin UI | 2 to 4 weeks |
| 7 | Testing, migration, cutover | 1 to 1.5 weeks |

Rollback before cutover is trivial: the Option A codepath stays on its
branch. Rollback after cutover is the previous Worker version (Cloudflare
keeps instant rollback). DNS, `wrangler secret put` values, and queue
consumer enablement are documented in the cutover runbook. No production
Postgres data is expected today (verified in Phase 0); if any appears, an
export-transform-import path applies the mapping rules above.

## Open Questions

1. Does any current flow rely on Payload drafts or versions? Determines
   admin scope. Answered in the Phase 0 decision record.
2. Expected launch email volume versus the Email Service daily quota
   ramp. Answered in Phase 0.
3. Is any production Postgres data expected before cutover? No live
   deployment found today; verified in Phase 0.
4. Who are the admin users and what do they touch day-to-day? Phase 6
   inventory.
5. Contract PDF generation in-Worker (CPU limits) versus queue consumer?
   Phase 5.

## Addendum: prototype domain strategy (2026-08-28, user decision)

The site is currently a prototype. The zone `erametsad.ee` stays at Zone
Media; no registrar or MX change happens now. All prototype hostnames run
under the Cloudflare-hosted zone `ww0.dev`:

| Production host | Prototype host |
|---|---|
| erametsad.ee | erametsad.ww0.dev |
| oksjonid.erametsad.ee | oksjonid.erametsad.ww0.dev |
| api.erametsad.ee | api.erametsad.ww0.dev |
| admin.erametsad.ee | admin.erametsad.ww0.dev |

Email sending uses the subdomain `erametsad.ww0.dev` on the `ww0.dev`
zone; the prototype sender becomes `noreply@erametsad.ww0.dev`. Placeholder
DNS records for the web hostnames are not created in advance: Workers
custom domains attach at deploy time and pre-existing records on those
names block attachment. The production `.ee` cutover stays a documented
later step.
