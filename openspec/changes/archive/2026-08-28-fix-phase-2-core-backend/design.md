## Context

Phase 2 code lives in `apps/platform/src`. Payload 3 Local API is the data
layer (`payload.find/create/update`). Custom auth (hand-rolled HS256 JWT in
`lib/auth/jwt.ts`, in-memory session map in `lib/auth/session.ts`) sits
beside Payload's own `users` auth collection. The prototype deploys to
Cloudflare via OpenNext but runs locally on Node with docker-compose
(Postgres, Redis, Mailpit).

## Goals and Non-Goals

Goals: make every Phase 2 [M] requirement actually true in the running
system, with tests that assert spec values instead of masking defects.

Non-goals: BullMQ/Cloudflare Queues transport, ServiceRequest/newsletter/
saved-search/media pipelines ([S] deferrals), any Phase 3-5 UI.

## Decisions

### Transaction and row lock in placeBid

Payload 3's postgres adapter exposes the underlying Drizzle instance at
`payload.db`. `placeBid` will run inside `payload.db.transaction()` with
`SELECT … FOR UPDATE` on the auctions row. All validations (status,
endTime, rights, amount, gate, idempotency) read inside the transaction,
and the bid insert plus the previous leader's `outbid` update commit
atomically. The Local API calls stay for reads; writes use Drizzle so the
lock is real. This is the pattern the guardrails require
("server-authoritative, row locks, never client-triggered").

### Auction type field

Add a required `type` select (`open` | `sealed`) to the Auction
collection, defaulting `open`, with collection-level validation that
`kinnistu`, `pakett`, and `field` object types must be `sealed` (plan §5.4
mirrors the admin editor rule). Existing seed rows get the field via the
seed task. No migration concern: prototype databases are reseeded.

### Ending worker transitions

The guard map (`active → ended` only, `ended → appraised|unsold`) is
correct per the guardrails and stays. The worker changes to a two-step
update: first `active → ended` (+ `endedAt`), then the outcome step
(`ended → appraised` with winning bid, or `ended → unsold` when no bid or
reserve not met). Sealed auctions stop at `ended` and wait for the
ceremony. Open-auction outcome compares the leading amount against
`reservePrice` when set.

### Worker and listener bootstrap

Next.js `instrumentation.ts` (`register()` hook) starts
`scheduleAuctionEnding(30_000)` and `startListening(eventBus)` on the
Node runtime only (guarded so Edge/worker runtimes skip it). This is the
prototype answer to "worker runs"; the queue-interface swap is documented
as the production replacement. The in-process `inProgress` set plus the
status recheck stay as the idempotency guard; a cross-process guard is
not needed while a single Node process owns the worker.

### Autobidder algorithm

Single evaluation pass, no bidding loop:

1. Load active autobidders for the auction, sorted by `createdAt`.
2. Exclude the autobidder whose user currently leads (no self-overbid).
3. Winner = highest `maxAmount`; tie resolves to earliest `createdAt`.
4. Target amount = `max(currentLeading + bidStep, secondMax + bidStep)`,
   capped at the winner's `maxAmount`; with no rival autobidder the target
   is `currentLeading + bidStep` (or `minBid` when no bids exist), again
   capped.
5. One `placeBid` call when the target beats the current leading amount.

The 100-round loop is removed. Tests assert the spec numbers, including
leading 100 / maxes 300 and 200 / step 10 → winner bids 210.

### Auth tokens

`signAccessToken` gains real `role` and `activeProfileId` claims sourced
from the user record and session store. `POST /api/v1/auth/refresh`
rotates the refresh token (hash comparison, family invalidation on reuse)
and moves the refresh cookie path to `/api/v1/auth`. Admin routes keep
their role checks, which now can pass. Session list/revoke are minimal
authed endpoints over the session store.

### Opening ceremony persistence

Opening sessions move from a module `Map` to the cache abstraction
(`lib/cache.ts`) with a 30-minute TTL. Tokens stay 32-byte random values.
`confirmWinner` runs its own authorization (admin/superadmin role from the
JWT), verifies the bid belongs to the auction and tops the decrypted
ranking, compares `reservePrice`, writes `finalPrice` (decrypted amount)
to the auction, emits loser notifications with `userId`, and queues the
contract via `prepareContract`.

### Sealed at rest

Seeding creates sealed bids through `submitSealedBid` (or the encryption
helper directly), so DB rows store `amount: 0` plus encrypted
amount/identity with auth tags. `decryptSealedBids` no longer swallows
errors into `amount: 0`; decrypt failure marks the bid invalid and logs.

### Risks / Trade-offs

- Drizzle usage inside Payload is supported but version-coupled; the
  transaction helper is isolated in one module to keep the coupling small.
- In-memory session store and SSE client maps remain per-process. On
  Cloudflare (multi-isolate) sessions and streams degrade. Accepted for
  the prototype; the cache interface is the documented swap point.
- `nodemailer` is a new dependency, scoped to Mailpit SMTP only.

## Migration Plan

No production data exists. `pnpm seed:reset` recreates everything with
the new `type` field, encrypted sealed bids, and the enabled contract
gate flag.

## Open Questions

1. Should the framework-contract gate ever be per-auction rather than
   global? Plan says required before first bid; implemented global with a
   Settings override retained for demos.
2. Anti-snipe default (5 vs 13 minutes, docs/tasks.md open question 9)
   stays a Settings value; seed keeps 5.
