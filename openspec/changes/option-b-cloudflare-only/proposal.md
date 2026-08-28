## Why

The current build runs the app on Cloudflare Workers but keeps relational
data in an external Postgres (Neon) and runs the admin on Payload CMS,
whose only SQLite adapter (`better-sqlite3`) cannot run on Workers.
Workers-hostility defects are already proven in the codebase regardless of
the database choice: the in-memory SSE registry (`auction-stream.ts`), the
in-memory rate limiter (`rate-limit.ts`), and the in-memory access-token
session map (`session.ts`) all break across isolates. Cloudflare Email
Service (beta) removes the last hard external dependency, so a fully
Cloudflare-hosted stack (D1 + Durable Objects + Queues + KV + R2 + Email)
is now possible with zero external vendors. Source plan:
`docs/option-b-cloudflare-only-plan.md` (v0.1, 2026-08-28).

## What Changes

- **BREAKING** D1 replaces Neon Postgres as the system of record: a
  Drizzle schema in SQLite dialect for all 26 collections, a first-party
  repository layer, and drizzle-kit to `wrangler d1 migrations` flows.
- **BREAKING** Payload CMS is removed wholesale (no D1 adapter exists).
  Its data layer is replaced by the repository layer with explicit
  access-control guards. Its admin panel is replaced by a custom
  role-guarded admin UI in Estonian.
- **BREAKING** Money storage rule: all currency amounts become INTEGER
  cents in SQLite. `REAL` is banned for money via schema lint. Postgres
  `enum`, `jsonb`, `uuid`, and `timestamptz` follow the fixed mapping
  rules in the source plan (section 5.2).
- Durable Objects become the correctness substrate. `AuctionDO` (one per
  auction) serializes bid admission (replacing `SELECT ... FOR UPDATE`),
  hosts the SSE subscriber hub, and schedules anti-snipe and auction-end
  alarms. `RateLimiterDO` provides authoritative token-bucket counters.
- Email moves to Cloudflare Email Service with a transport chain of EMAIL
  binding, then REST API, then SMTP. Per-recipient delivery status is
  recorded on notification rows.
- Sessions move to a D1-backed store. Node `crypto` usage is ported to
  Web Crypto for Workers purity.
- Background jobs restructure: a queue consumer worker handles
  notification fan-out, email sending, and contract PDF generation into
  R2. DO alarms plus a cron sweep replace the polling auction-ending
  worker. A dead-letter queue with retry policy and depth alerting is
  added.
- Phase 0 is a go/no-go gate: cheap spikes retire the biggest unknowns
  (D1 batch semantics, DO access inside OpenNext, Email Service quota)
  before the expensive phases start. Phases 2 to 5 remain 100% reusable
  under an Option A fallback if the gate fails.

## Capabilities

### New Capabilities

- `d1-data-layer`: Drizzle SQLite schema for all 26 collections,
  Postgres-to-SQLite mapping rules, repository layer, access-control
  guards, migrations, and a schema lint that bans `REAL` money columns.
- `durable-objects`: `AuctionDO` bid admission, event hub, and alarm
  scheduling; `RateLimiterDO`; wrangler bindings and DO migrations.
- `email-service`: Cloudflare Email Service transport chain, sender
  verification, delivery status with error codes, GDPR unsubscribe
  headers.
- `background-jobs`: queue consumer worker, DO alarm plus cron sweep
  scheduling, dead-letter queue with alerting.
- `admin-ui`: custom role-guarded admin on the repository layer:
  auction operations, users and rights, CRM, content screens, R2 media
  library, JSON import and export.

### Modified Capabilities

- `cloudflare-deployment`: the Neon serverless Postgres requirement is
  removed; the D1 binding becomes the relational store; DO and EMAIL
  bindings are declared; the provisioned KV namespace id is restored; SSE
  broadcast moves from KV to Durable Objects.
- `bidding-engine`: `placeBid` executes inside `AuctionDO` admission and
  writes accepted bids to D1 in one `batch()`; auction ending runs on DO
  alarms with a cron safety net; the test requirement moves to
  `@cloudflare/vitest-pool-workers`.
- `realtime-sse`: both streams are served from the `AuctionDO` hub with
  the public event names unchanged; the runtime requirement becomes the
  Workers runtime.
- `auth-flows`: rate-limit counters move to `RateLimiterDO`; sessions
  persist in D1 so rotation survives isolate restarts; a Web Crypto
  runtime purity requirement is added.
- `notifications-contracts`: notification dispatch moves to the Cloudflare
  Queues consumer; email sends through the Email Service transport chain.
- `seed-fixtures`: `pnpm seed:reset` runs against D1 through the
  repositories and reproduces the current fixtures.
- `payload-foundation`: the Payload bootstrap and CMS versioning
  requirements are removed; access control is re-expressed as repository
  guard functions.

## Impact

- **Removed code**: Payload config and adapters, `@payloadcms/*`
  dependencies, `withAuctionLock` (moves to `AuctionDO`), the in-process
  polling worker, the in-memory SSE registry, the in-memory rate-limiter
  buckets, and the in-memory access-token session map.
- **New code**: `apps/platform/src/lib/data/` (schema, repositories,
  guards), `apps/platform/src/do/` (AuctionDO, RateLimiterDO),
  `apps/platform/src/app/(admin)/` (admin UI),
  `apps/platform/src/workers/queue-consumer.ts`, and
  `apps/platform/src/lib/notifications/email-sender.ts`.
- **Config**: `wrangler.jsonc` gains D1, DO, and EMAIL bindings; the
  `NEON_DATABASE_URL` and `DATABASE_URL` plain-text bindings are removed;
  the KV placeholder id is restored.
- **Data**: no production Postgres data is expected at cutover (to
  verify in Phase 0); if any exists, an export-transform-import path is
  required.
- **Cost and plan**: Durable Objects and Email Service both require the
  Workers Paid plan ($5/month). Email Service is beta with a daily quota
  ramp on new accounts.
- **Effort**: roughly 8 to 11 weeks for one developer, about 5 to 6 weeks
  with two. Phase 6 (admin UI) is the largest and least defined block.
- **Documentation**: `ARCHITECTURE.md` and the project guardrails must be
  rewritten at cutover; they describe the Postgres plus Payload stack
  today.
- **Agent note**: no specialist engineers exist in `.opencode/agents/`,
  so every task is annotated `fullstack-engineer`. A Cloudflare-platform
  engineer and an admin-UI engineer would fit most Phase 2 to 7 work
  better; create them with `/make-engineer` if desired.
