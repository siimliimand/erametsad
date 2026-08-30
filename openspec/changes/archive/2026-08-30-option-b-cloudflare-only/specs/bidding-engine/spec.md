## MODIFIED Requirements

### Requirement: placeBid service
`placeBid` SHALL execute inside `AuctionDO` admission (one Durable
Object per auction), whose single-threaded execution serialises
concurrent bids and replaces the Postgres row lock. The validation chain
SHALL run inside the DO: session valid -> user authenticated and not
suspended -> auction status `active` -> auction endTime not passed ->
user has a valid objectType right -> amount at least
`currentLeading + bidStep` (or `minBid` when no bids exist, or below
`minBid` when alapakkumine is enabled) -> framework-contract gate
satisfied. On success the DO SHALL write the new Bid, the auction
update, and the audit entry to D1 in one `batch()`, move the previous
leading bid to `outbid`, and emit `bid.created` plus an `outbid` event
for the displaced bidder. Idempotency keys SHALL replay the original
result without duplicate writes. `ipHash` SHALL be computed server-side
from the request IP with a salt via Web Crypto; the client-supplied
value MUST be ignored. The `source` field SHALL be set by the server,
not accepted from the request body.

#### Scenario: Valid bid succeeds atomically
- **WHEN** an authenticated user with the matching objectType right
  submits a valid bid on an active open auction
- **THEN** the new Bid is created, the previous leading bid becomes
  `outbid` in the same `batch()`, and `bid:created` is broadcast

#### Scenario: Concurrent bids serialise
- **WHEN** two bids for the same auction arrive simultaneously
- **THEN** the DO admits them one at a time, and the second bid is
  validated against the first bid's amount

#### Scenario: Client-supplied ipHash ignored
- **WHEN** a bid request body contains an `ipHash` value
- **THEN** the server discards it and stores its own salted hash of the
  request IP

### Requirement: Alapakkumine (under-start bid)
When Settings enable alapakkumine, bid admission SHALL accept a bid below
`minBid` by creating it with status `pending_approval` instead of
rejecting it. When disabled, a below-minimum bid SHALL be rejected. Seller
approval SHALL move the bid to `leading` and demote any current leader to
`outbid`; rejection SHALL set `rejected` and notify the bidder. Approval
SHALL be race-guarded by `AuctionDO` admission, and both decisions SHALL
be exposed as authed seller endpoints under
`/api/v1/my-auctions/:id/underbids/:bidId/approve|reject`.

#### Scenario: Under-start bid awaits approval
- **WHEN** alapakkumine is enabled and a user bids below `minBid`
- **THEN** the bid is stored as `pending_approval` and the seller is
  notified

#### Scenario: Approval takes the lead
- **WHEN** the seller approves a pending bid
- **THEN** the bid becomes `leading` and any previous leader becomes
  `outbid`

#### Scenario: Concurrent approvals are serialised
- **WHEN** two approval requests race
- **THEN** `AuctionDO` admission serialises them and the second is a
  no-op or conflict response

### Requirement: Auction-ending worker
Auction ending SHALL be triggered by `AuctionDO` `alarm()` with a cron
`scheduled()` sweep as a safety net for evicted DOs; auctions SHALL
never be ended by a client request. Processing SHALL first transition
`active -> ended` (writing `endedAt`), then compute the outcome in a
second update: for open auctions, `ended -> appraised` with the winning
bid when a leading bid meets the reserve price, otherwise
`ended -> unsold`; for sealed auctions (schema `type: 'sealed'`), stop at
`ended` and wait for the ceremony. Every update SHALL pass the
status-transition guard and write through D1 `batch()`. Double-fire SHALL
be idempotent per auction. Ending SHALL emit notifications with `userId`,
broadcast `auction:ended`, and write a statistics snapshot.

#### Scenario: Sealed auction detected by schema field
- **WHEN** a sealed-type auction's endTime passes
- **THEN** ending moves it to `ended` only, and the sealed-opening
  ceremony remains available

#### Scenario: Open auction with no bids becomes unsold
- **WHEN** an open auction ends with no leading bid
- **THEN** it transitions `active -> ended -> unsold` through the guard
  without error

#### Scenario: Reserve not met
- **WHEN** an open auction ends with a leading bid below the reserve
  price
- **THEN** the outcome is `unsold` and the bidder is notified

### Requirement: Unit tests for the bidding engine
Tests SHALL assert the specification values, including: autobidder
auto-vs-auto at `secondMax + bidStep` (210 in the canonical case),
no-self-overbid, anti-snipe boundary at the window edge, ending
transitions through the real guard, reserve-price outcomes, sealed
encrypt/decrypt roundtrip with tamper rejection, ceremony expiry and
tie-break, and idempotent ending. Tests SHALL exercise `AuctionDO`
admission through `@cloudflare/vitest-pool-workers`, and repository
tests SHALL run against `better-sqlite3` in memory with the same Drizzle
schema. Tests MUST NOT mock the collection hooks in a way that bypasses
the transition guard, and MUST NOT assert values that contradict the
requirement text.

#### Scenario: Spec-value assertions
- **WHEN** the autobidder auto-vs-auto test runs with leading 100, step
  10, maxes 300 and 200
- **THEN** the single placed bid is 210
