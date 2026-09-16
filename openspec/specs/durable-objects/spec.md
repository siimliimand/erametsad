# durable-objects Specification

## Purpose
TBD - created by archiving change option-b-cloudflare-only. Update Purpose after archive.
## Requirements
### Requirement: AuctionDO bid admission
Bid placement SHALL execute inside `AuctionDO` (one Durable Object per
auction), whose single-threaded execution replaces the Postgres
`SELECT ... FOR UPDATE` lock. The DO SHALL run the existing validation
chain, replay idempotency keys, and write an accepted bid to D1 in one
`batch()`: the bid row, the auction update, and the audit entry.
Autobidder evaluation SHALL run inside the DO after each accepted bid.

#### Scenario: Parallel bids serialize
- **WHEN** N bids for the same auction arrive in parallel
- **THEN** the DO admits them one at a time and D1 holds exactly one
  consistent winner-increment sequence

#### Scenario: Idempotency key replays
- **WHEN** the same bid request is retried with the same idempotency key
- **THEN** the DO returns the original result and writes no duplicate
  bid

### Requirement: AuctionDO event hub
Each `AuctionDO` SHALL hold the subscriber set for its auction and fan
out `bid:created`, `auction:extended`, `auction:ended`, and
`auction:published` from DO-local state. The public event names SHALL
remain unchanged so the frontend needs no modification. Subscription
SHALL use SSE or WebSocket hibernation.

#### Scenario: Cross-isolate broadcast
- **WHEN** two clients connected from different regions listen to the
  same auction and a bid is accepted
- **THEN** both receive `bid:created`

### Requirement: AuctionDO alarm scheduling

Auction timing SHALL be server-authoritative and driven by DO `alarm()`:
start activation for scheduled auctions, anti-snipe window checks, the
`scheduled -> active` promotion, the `active -> ended` transition, winner
computation including the sealed-opening trigger, and notification
enqueue. `hydrateState` SHALL arm the alarm at `startsAt` while status is
`scheduled` and at `endsAt` while status is `active`. The promotion tick
SHALL re-read the D1 row instead of trusting hot state, because the row
decides the current `startsAt` and `endsAt`. The promotion SHALL be
status-guarded against double-fire, SHALL write an `auction_activated`
audit entry, SHALL broadcast `auction:published`, and SHALL arm the end
alarm at `endsAt` afterwards. A cron `scheduled()` sweep SHALL act as a
safety net for auctions whose DO was evicted.

#### Scenario: Scheduled auction activates at start time

- **WHEN** the DO alarm fires for a `scheduled` auction whose `startsAt`
  has passed
- **THEN** the row becomes `active` with `activatedAt` set, the audit
  entry `auction_activated` exists, the hot state status is `active`, and
  the end alarm is armed at `endsAt`

#### Scenario: Scheduled auction arms a start alarm

- **WHEN** `hydrateState` hydrates a `scheduled` auction with a future
  `startsAt`
- **THEN** the DO sets its alarm at `startsAt` when no earlier alarm exists

#### Scenario: Stale start alarm re-arms from the row

- **WHEN** the alarm fires for a `scheduled` auction whose `startsAt` was
  moved later by an admin after the alarm was armed
- **THEN** the tick re-reads the row and re-arms at the new `startsAt`
  without promoting

#### Scenario: Auction ends on time after DO eviction

- **WHEN** an auction's DO is evicted before its end time
- **THEN** the cron sweep rehydrates the DO or ends the auction so the
  end still processes at the right time

### Requirement: On-demand hydration
`AuctionDO` SHALL load auction state from D1 on first touch and keep only
hot state (current price, `endsAt`, subscriber set) in DO storage. A
restarted DO SHALL rehydrate and continue correctly.

#### Scenario: DO restart rehydrates
- **WHEN** an AuctionDO restarts mid-auction
- **THEN** it reloads current price and `endsAt` from D1 before admitting
  the next bid

### Requirement: RateLimiterDO
Rate limiting SHALL use `RateLimiterDO` (one per key, for example IP plus
route) as the authoritative token bucket. `src/lib/rate-limit.ts` SHALL
keep its public API and delegate to the DO. The DO SHALL be ephemeral
with no durable storage.

#### Scenario: Limit holds across isolates
- **WHEN** requests that share a rate-limit key hit different isolates
- **THEN** the combined request count respects the configured limit

### Requirement: DO bindings and migrations
`wrangler.jsonc` SHALL declare `durable_objects.bindings` for both DO
classes and the `migrations` list with the new SQLite-backed classes.

#### Scenario: Bindings resolve at deploy
- **WHEN** the worker deploys with DO bindings declared
- **THEN** both DO classes are addressable and the migrations list
  applied

