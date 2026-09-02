# Option B — All-in-Cloudflare Implementation Plan

**Target stack: Workers + D1 + Durable Objects + Queues + KV + R2 + Email Service — zero external services**

- Version: 0.1 (draft for decision)
- Date: 2026-08-28
- Status: **proposal — not yet approved for execution**
- Companion docs: `ERAMETSAD-PLAN.md` (product plan), `tasks.md` (current wave work)

---

## 1. Summary & motivation

Option A (current build) runs the app on Cloudflare Workers with **Postgres at an external host (Neon)**. Option B moves **every stateful component inside Cloudflare**:

| Concern | Option A (today) | Option B (target) |
|---|---|---|
| Compute | Workers (OpenNext) | Workers (OpenNext) — unchanged |
| Relational data | Neon Postgres via Payload | **D1** (SQLite) via custom data layer |
| Bid serialization | Postgres transaction + `SELECT … FOR UPDATE` | **Durable Object per auction** |
| Realtime bid stream | in-memory SSE `Map` (broken on Workers) | **Durable Object** pub/sub |
| Rate limiting | in-memory token bucket (broken on Workers) | **Durable Object** counters |
| Background jobs | Cloudflare Queues | Cloudflare Queues — unchanged |
| Cache | KV | KV — unchanged |
| Media | R2 | R2 — unchanged |
| Email | nodemailer → SMTP provider (TBD) | **Cloudflare Email Service** (beta) |

Two things triggered this re-evaluation:

1. **Cloudflare Email Service launched** (beta) — outbound transactional email is now first-party, removing the last hard external dependency.
2. The codebase's Workers-hostility was already discovered regardless of DB choice: the in-memory SSE registry and rate limiter must be rebuilt on Durable Objects **even under Option A**. Since DOs (Workers Paid, $5/mo) are required either way, the incremental cost of Option B is concentrated in a single item: **replacing Payload's database layer**.

**The one-line trade-off:** Option B trades a managed Postgres + a mature CMS admin for full platform consolidation and no external DB vendor.

---

## 2. Verified constraints (codebase facts, 2026-08-28)

These were checked against the code — they drive the plan:

| # | Finding | Evidence |
|---|---|---|
| C1 | Payload CMS has **no D1 adapter**; its SQLite adapter runs on `better-sqlite3` (native module, cannot run on Workers). 26 collections defined. | `apps/platform/src/payload/collections/` (26 files), `@payloadcms/db-postgres` in `package.json` |
| C2 | Bid placement serializes via a drizzle transaction with `SELECT … FOR UPDATE` on the auction row. D1 has **no interactive transactions / row locks**. | `src/lib/bidding/place-bid.ts:52-65` (`withAuctionLock`) |
| C3 | SSE client registry is a module-level `Map` — per-isolate on Workers; `broadcast()` misses listeners in other isolates. **Broken under both options.** | `src/lib/realtime/auction-stream.ts:14,38-47` |
| C4 | Rate limiter is an in-memory token bucket — effective limit multiplies by isolate count on Workers. | `src/lib/rate-limit.ts` (`RateLimiter`, `buckets = new Map()`) |
| C5 | Sessions use token families with an in-memory `accessTokenSessions` map + Node `crypto` hashing. Needs a shared store + Web Crypto port. | `src/lib/auth/session.ts:23-24,176-177` |
| C6 | Email goes through nodemailer SMTP; `.env.example` points at Mailpit (dev catcher). No production provider wired. | `src/lib/notifications/service.ts:44-54`, `.env.example` |
| C7 | D1: max 10 GB per database, single writer per database, atomicity only per-statement or via `batch()`. SQLite dialect (no Postgres enums/`jsonb`/`numeric`/row locks). | Cloudflare D1 docs |
| C8 | Email Service: beta, **Workers Paid plan required**, 3,000 emails/month included then $0.35/1k, conservative daily quota on new accounts that ramps up, 5 MiB message cap. | Cloudflare Email Service pricing/limits docs |
| C9 | Durable Objects require Workers Paid — same $5/mo plan that Email Service needs. | Cloudflare DO docs |

---

## 3. Target architecture

```
                        ┌────────────────────────────────────────────┐
                        │            Cloudflare Workers              │
                        │  (OpenNext: Next.js app + admin + API)     │
                        └──────┬───────────┬───────────┬─────────────┘
                               │           │           │
              ┌────────────────┘           │           └───────────────┐
              ▼                            ▼                           ▼
   ┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
   │  Durable Objects    │    │         D1          │    │  Cloudflare Queues  │
   │  · AuctionDO        │◄──►│  system of record   │◄──►│  · notification     │
   │    (bid serialize,  │    │  (users, auctions,  │    │    fan-out          │
   │     SSE hub, alarm) │    │   bids, contracts…) │    │  · outbound jobs    │
   │  · RateLimiterDO    │    └─────────────────────┘    └─────────────────────┘
   └─────────────────────┘
              │                           │                           │
              ▼                           ▼                           ▼
   ┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
   │  Email Service      │    │  KV                 │    │  R2                 │
   │  (EMAIL binding /   │    │  (cache, published  │    │  (media, documents) │
   │   REST fallback)    │    │   content cache)    │    │                     │
   └─────────────────────┘    └─────────────────────┘    └─────────────────────┘
```

### Component responsibilities

- **D1** — durable system of record. Written by Workers directly and by `AuctionDO` after each accepted bid. No caching layer on hot paths initially.
- **AuctionDO (one per auction)** — single-threaded per auction, therefore:
  1. **bid admission control**: validates and serializes bids (replaces `withAuctionLock`), writes accepted bids to D1;
  2. **SSE/WebSocket hub**: holds subscriber set for that auction; `bid:created` / `auction:extended` / `auction:ended` events fan out from here;
  3. **alarm-driven scheduling**: anti-snipe extension checks and auction-end via DO `alarm()` (replaces polling workers for in-flight auctions).
- **RateLimiterDO (one per key, e.g. per IP+route)** — token bucket with authoritative counters; ephemeral, no storage needed.
- **Queues** — decouple notification fan-out (one message per notification) and long jobs from request latency.
- **KV** — published marketing content cache, feature flags. Never authoritative.
- **R2** — media (Payload `Media` equivalent), contract PDFs. Buckets already exist.
- **Email Service** — transactional email via `EMAIL` binding; REST API as a portable fallback (see §4.4).

---

## 4. Implementation phases

Estimates assume one senior developer full-time. "d" = dev-days, "w" = weeks.

### Phase 0 — Decision spike & foundations *(1 w, go/no-go gate)*

The goal is to retire the biggest unknowns cheaply before committing.

- [ ] Spike: Drizzle ORM on D1 (local via `wrangler d1` miniflare) — schema subset of 3 collections (users, auctions, bids), CRUD + `batch()` semantics.
- [ ] Spike: minimal Durable Object (counter + WebSocket echo) inside the OpenNext worker; confirm `getCloudflareContext()` access pattern and vitest coverage via `@cloudflare/vitest-pool-workers`.
- [ ] Spike: Email Service — enable on the account, verify `erametsad.ee` zone, verify sender, send to a verified destination address.
- [ ] Decide the Payload replacement scope (see §5.1) and confirm the money-storage rule (§5.2).
- [ ] Confirm Cloudflare Email Service beta terms + current daily quota are acceptable for launch volume.

**Exit criteria:** all spikes green, admin-replacement scope signed off, rough launch-email volume < initial daily quota (or a plan to warm it up).

### Phase 1 — Data layer on D1 *(2–2.5 w)*

Replace `@payloadcms/db-postgres` with a first-party data layer.

- [ ] Define Drizzle schema for all 26 collections in SQLite dialect, applying the mapping rules in §5.2. Collections split:
  - **core** (transactional): users, profiles, auctions, auction-rights, auction-subscriptions, bids, auto-bidders, contracts, contract-templates, notifications, audit-entries, leads, company-access-requests, settings;
  - **content** (CMS-ish): articles, pages, faq-categories, faq-items, testimonials, partner-services, legal-documents, redirects, specialists, statistics-snapshots, counties, parishes, media.
- [ ] Repository layer (`src/lib/data/`) exposing a Payload-like surface used by app code: `find`, `findByID`, `create`, `update`, `delete`, with `where` support limited to what call sites actually use (grep inventory first).
- [ ] Access-control re-implementation: Payload field/collection access currently comes free; encode the same rules as explicit guard functions in the repository layer (inventory via `payload/collections/*.access.ts`).
- [ ] Migrations: `drizzle-kit generate` → `wrangler d1 migrations apply`; same flow for local dev.
- [ ] Port `src/lib/db.ts` / drizzle direct usage: `withAuctionLock` is *deleted* here (moves to AuctionDO in Phase 2); remaining direct SQL is rewritten in SQLite dialect.
- [ ] Seed: port `src/payload/seed/*.ts` to the new repositories so `seed:reset` works identically.

**Exit criteria:** all non-admin app routes run against D1 locally; seed reproduces current fixture data; vitest suite for repos passes.

### Phase 2 — Durable Objects: auctions & rate limiting *(1.5 w)*

- [ ] `AuctionDO` (`src/do/auction.ts`):
  - `bid(input)` — single-threaded admission: validate user status, amount vs current price, alas-/show rules (`src/lib/bidding/alapakkumine.ts`), sealed-bid constraints (`sealed-bid.ts`), idempotency key replay; on accept → D1 writes in one `batch()` (bid row + auction update + audit entry);
  - `subscribe()` — SSE (or WebSocket hibernation) endpoint; subscriber registry inside the DO; `broadcast()` becomes DO-local and therefore correct;
  - `alarm()` — anti-snipe window check (`src/lib/bidding/anti-snipe.ts` logic), auction end transition, winner computation incl. sealed-bid opening (`sealed-opening.ts`), enqueue notification messages;
  - on-demand hydration: first touch loads auction state from D1; DO storage holds only hot state (current price, endsAt, subscriber set).
- [ ] Rebuild `src/lib/realtime/auction-stream.ts` + `my-stream.ts` on top of AuctionDO events; keep the public event names (`bid:created`, `auction:extended`, `auction:ended`, `auction:published`) so the frontend is untouched.
- [ ] `RateLimiterDO` — token bucket per key; `src/lib/rate-limit.ts` keeps its API but delegates to the DO; used by leads endpoint and any new abuse-prone routes.
- [ ] DO migrations/alerts wiring in `wrangler.jsonc` (`durable_objects.bindings` + `migrations` list with new SQLite-backed class).

**Exit criteria:** concurrent-bid test (N parallel bids on one auction) yields exactly one winner-increment sequence and consistent D1 state; two browser tabs in different regions both receive `bid:created`.

### Phase 3 — Email Service *(2–3 d)*

- [ ] Implement the dual/triple transport from the reviewed sketch: `src/lib/notifications/email-sender.ts` (binding → REST → SMTP), `send_email` binding in `wrangler.jsonc`, `CLOUDFLARE_EMAIL_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` env for the REST path.
- [ ] Verify sending domain `erametsad.ee`; sender `noreply@erametsad.ee`.
- [ ] Surface `error.code` (`E_RATE_LIMIT_EXCEEDED`, `E_DAILY_LIMIT_EXCEEDED`, …) in notification logs; record per-recipient result (`delivered`/`queued`/`permanent_bounces`) on the `notifications` row.
- [ ] GDPR: `List-Unsubscribe` headers on marketing-ish templates; transactional templates exempt but reviewed.

**Exit criteria:** outbid / auction-won emails delivered from the deployed worker; Mailpit still used by `next dev`.

### Phase 4 — Auth & sessions on Workers *(3–5 d)*

- [ ] Replace in-memory `accessTokenSessions` (`session.ts:176-177`) with a D1-backed (or KV with short TTL) session store; refresh-token families already persist — verify.
- [ ] Port Node `crypto` (`createHash`, `randomUUID`, HMAC in `jwt.ts`, `computeIpHash` in `place-bid.ts:37-39`) to Web Crypto (`crypto.subtle`) — required for Workers purity; keep dual implementation for local vitest if needed.
- [ ] e-ID provider (`src/lib/auth/eid-provider.ts`): audit for TCP/Node assumptions; flows are redirect+signature based and expected to port, but must be tested against the real provider sandbox.

**Exit criteria:** login → bid → logout cycle on the deployed worker; token-family rotation survives isolate restarts.

### Phase 5 — Background jobs & queue *(3–4 d)*

- [ ] Queue consumer worker: notification fan-out (one message per user×channel, idempotent via existing `dedupeKey`), email sending, contract PDF generation into R2.
- [ ] Replace polling in `src/lib/workers/auction-ending.ts` with: AuctionDO alarms for per-auction timing + a cron trigger sweep (`scheduled()` handler) as a safety net for auctions whose DO was evicted.
- [ ] Dead-letter queue + retry policy; alerting on DLQ depth.

**Exit criteria:** auction end at T triggers: D1 state change → SSE event → queue messages → emails, with no worker polling loop.

### Phase 6 — Admin UI (Payload replacement) *(2–4 w — largest & least defined)*

Payload's admin (auto CRUD UI, auth, media library, drafts) is the biggest loss. Scope a minimal internal admin instead of a CMS clone:

- [ ] Inventory actual admin needs per collection (who edits articles vs who runs auctions?).
- [ ] Build `apps/platform/src/app/(admin)/`: table + form pages on the repository layer, server actions, role-guarded (`users.role`), Estonian UI.
- [ ] Media library on R2 (upload, browse, alt text) — replaces Payload `Media` collection UI.
- [ ] Auction operations screen: create/publish auction, monitor live bids (subscribes to the same AuctionDO stream), approve/reject bids, trigger contract flow.
- [ ] Migration tooling for content collections (import/export JSON) so marketing can bulk-load articles/pages.

**Exit criteria:** a non-developer operator can create an auction, publish an article, and manage media without Payload.

### Phase 7 — Testing, migration & cutover *(1–1.5 w)*

- [ ] Adapt vitest suites: repository tests against `better-sqlite3` in-memory (same Drizzle schema); DO tests via `@cloudflare/vitest-pool-workers`; existing bidding tests ported to exercise AuctionDO admission logic.
- [ ] Load test bid bursts at auction close against deployed worker (validate D1 single-writer ceiling + DO serialization).
- [ ] If any production data exists at cutover: export Postgres → transform (§5.2 rules) → import D1; otherwise fresh seed.
- [ ] Cutover runbook: DNS, bindings secrets (`wrangler secret put`), queue consumers enabled, rollback = previous Worker version (Cloudflare keeps instant rollback).

**Exit criteria:** end-to-end auction lifecycle (publish → bid → anti-snipe → end → win → contract → email) green on production.

---

## 5. Cross-cutting decisions & rules

### 5.1 Payload replacement scope (the pivotal decision)

Payload is abandoned wholesale under Option B — there is no supported way to run it on D1. Three sub-options were considered:

1. **Full replacement** (chosen for planning): repository layer + custom admin. Full control, all Workers-native, but Phase 6 is 2–4 w of UI work and we lose Payload's auto-generated TypeScript types (compensated by Drizzle schema types) and versioning/drafts (not currently used — verify).
2. Keep Payload on a small always-on Node container for admin + content collections only, core data in D1: halves Phase 6 but reintroduces an external runtime and splits the data model — rejected.
3. Wait for a community D1 adapter: none exists today (2026-08); timeline unknowable — rejected.

### 5.2 Postgres → SQLite mapping rules (apply everywhere, no exceptions)

| Postgres | D1/SQLite rule | Notes |
|---|---|---|
| `numeric` money | **INTEGER cents** (`bid_amount_cents`) | Never `REAL` — floats corrupt money. Convert at API boundary. Audit every `amount` field. |
| `enum` types | `TEXT` + `CHECK (col IN (…))` | Enum unions live in `@erametsad/types`, DB re-validates. |
| `jsonb` | `TEXT` with JSON parse in repository layer | Indexed JSON paths → denormalize columns if queried. |
| `uuid` | `TEXT` (generated in app) | `crypto.randomUUID()` at insert time. |
| `timestamptz` | `TEXT` ISO-8601 UTC or INTEGER epoch ms | Pick one (recommend TEXT ISO); D1 `DEFAULT CURRENT_TIMESTAMP` is UTC text. |
| `SELECT … FOR UPDATE` | AuctionDO serialization | Never emulate with D1. |
| multi-statement transaction | `batch()` (atomic, no intermediate reads) | Read-decide-write patterns move into a DO. |

### 5.3 Already-provisioned resources (2026-08-28, account `29f50b2c…`)

| Resource | Name / ID | Status |
|---|---|---|
| Queue | `erametsad-jobs` | created |
| KV namespace | id `5b67cd2c595f4d31b3b1be5db76e9bef` | created — **`wrangler.jsonc` currently has the `KV_NAMESPACE_ID` placeholder and needs this id restored** |
| R2 bucket | `erametsad-media` | created |
| R2 bucket | `erametsad-media-preview` | created |
| Email Service | — | not yet enabled (Phase 0 spike) |

Under Option B the `NEON_DATABASE_URL` / `DATABASE_URL` plain-text bindings in `wrangler.jsonc` are replaced by a D1 binding.

---

## 6. Effort summary

| Phase | Scope | Estimate |
|---|---|---|
| 0 | Spikes & decisions | 1 w |
| 1 | Data layer on D1 | 2–2.5 w |
| 2 | Durable Objects (auctions, streams, rate limit) | 1.5 w |
| 3 | Email Service | 2–3 d |
| 4 | Auth & sessions | 3–5 d |
| 5 | Jobs & queue | 3–4 d |
| 6 | Admin UI (Payload replacement) | 2–4 w |
| 7 | Testing, migration, cutover | 1–1.5 w |
| **Total** | | **≈ 8–11 weeks** one dev (≈ 5–6 w with two devs, Phase 6 parallelizable) |

For comparison, Option A's remaining work (Neon wiring + DO rebuild for streams/rate-limit + email provider) is ≈ 2–3 weeks — the delta spent on Option B is essentially Phases 1 + 6 + the D1 half of Phase 7.

Running cost after cutover: Workers Paid $5/mo + email overage ($0/3k, then $0.35/1k) + D1/DO/R2 usage (free tier covers dev scale; D1 paid beyond 5 GB). No external vendor invoices.

---

## 7. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| D1 single-writer ceiling at auction-close bursts | Medium | High (lost bids) | Phase 7 load test early; all hot writes route through AuctionDO; shard reads via D1 read replication if needed |
| Money precision bugs during dialect port | Medium | Critical | §5.2 integer-cents rule; property tests on amounts; ban `REAL` via schema lint |
| Admin UI scope creep (Payload had years of features) | High | Medium | Phase 6 inventory-first; explicit per-role needs list before building |
| Email Service beta changes / quota ramp strangles launch notifications | Medium | Medium | REST fallback swap to Postmark/Resend is a config-level change (transport abstraction); warm quota pre-launch; monitor `E_DAILY_LIMIT_EXCEEDED` |
| Lost Payload niceties (drafts/versioning, access rules) | Medium | Medium | Verify unused before assuming; encode access rules as repository guards with tests |
| e-ID flow breaks on Workers (crypto/TCP assumptions) | Low | High | Phase 4 audit + provider sandbox test |
| Two-system drift if migration stalls mid-way | Medium | High | Phases keep the app shippable; feature flag `DB_BACKEND=pg\|d1` only if a long overlap is approved |

---

## 8. Open questions

1. Does any current flow rely on Payload drafts/versions? (Determines admin scope.)
2. Expected launch email volume — enough to pre-warm Email Service daily quota?
3. Is any production Postgres data expected before cutover (today: no live deployment found)?
4. Who are the admin users and what do they actually touch day-to-day? (Phase 6 inventory.)
5. Contract PDF generation — keep in-Worker (CPU limits) vs Queue consumer? (Phase 5.)

---

## 9. Recommendation

Proceed with **Phase 0 only** (1 week, cheap), then re-decide with spike data in hand. The dominant risks — D1 write ceiling and admin scope — are both measurable in Phase 0/1 before the expensive Phase 6 commitment. If Phase 0 spikes fail (D1 burst behavior unacceptable, or Email Service quota impractical), fall back to Option A with the DO/streams/email work still 100% reusable — none of Phases 2–5 is wasted under either option.
