# bidding-engine Specification

## Purpose
TBD - created by archiving change phase-2-core-backend. Update Purpose after archive.
## Requirements
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

### Requirement: Autobidder evaluation
Autobidder evaluation SHALL be invoked on every accepted bid. It SHALL
run as a single evaluation pass: the autobidder whose user does not
currently lead, with the highest `maxAmount` (tie broken by earliest
`createdAt`), bids `max(currentLeading + bidStep, secondHighestMax +
bidStep)`, capped at its own `maxAmount`, and never above it. An
autobidder whose user already leads SHALL NOT raise its own bid.

#### Scenario: Autobidder answers a manual bid at minimum
- **WHEN** a manual bid of 100 leads, step is 10, and one active
  autobidder with max 200 exists
- **THEN** the autobidder bids 110 and leads

#### Scenario: Autobidder-vs-autobidder resolves to second-max + step
- **WHEN** an autobidder bid of 100 leads, step is 10, and two active
  autobidders exist with maxes 300 and 200
- **THEN** the 300-max autobidder bids 210, not 110 and not 300

#### Scenario: No self-overbid
- **WHEN** the only active autobidder's user already holds the leading
  bid
- **THEN** evaluation places no bid

#### Scenario: Equal maxes tie-break to earliest
- **WHEN** two active autobidders have equal maxAmount
- **THEN** the earlier-created autobidder leads

### Requirement: Anti-sniping time extension
On every accepted open-auction bid, the system SHALL check whether the
bid arrived within the final N minutes before `endsAt` (N from Settings,
default 5, valid range 1-30). If so, it SHALL extend `endsAt` by N
minutes in the same request, write an audit entry, and broadcast
`auction:extended` with the new end time.

#### Scenario: Bid inside the window extends the auction
- **WHEN** a bid is accepted 2 minutes before `endsAt` with N = 5
- **THEN** `endsAt` moves 5 minutes later, an audit entry records the
  extension, and `auction:extended` is broadcast

#### Scenario: Bid outside the window does not extend
- **WHEN** a bid is accepted 30 minutes before `endsAt`
- **THEN** `endsAt` is unchanged

### Requirement: Alapakkumine (under-start bid)
When Settings enable alapakkumine, bid admission SHALL accept a bid below
`minBid` by creating it with status `pending_approval` instead of
rejecting it. When disabled, a below-minimum bid SHALL be rejected. Seller
approval SHALL move the bid to `leading` and demote any current leader to
`outbid`, unless the auction's current leading bid is a regular bid whose
amount exceeds the under-start amount; in that case approval SHALL be
rejected with the coded conflict `higher_bid_exists` and HTTP 409, the
pending bid stays `pending_approval`, and no leader is demoted. Rejection
of the under-start bid by the seller SHALL set `rejected` and notify the
bidder. Approval SHALL be race-guarded, and both decisions SHALL be
exposed as authed seller endpoints under
`/api/v1/my-auctions/:id/underbids/:bidId/approve|reject`.

#### Scenario: Under-start bid awaits approval
- **WHEN** alapakkumine is enabled and a user bids below `minBid`
- **THEN** the bid is stored as `pending_approval` and the seller is
  notified

#### Scenario: Approval takes the lead
- **WHEN** the seller approves a pending bid and no higher regular bid
  leads the auction
- **THEN** the bid becomes `leading` and any previous leader becomes
  `outbid`

#### Scenario: Approval rejected when a higher regular bid leads
- **WHEN** the seller approves a pending bid whose amount is below the
  current leading regular bid
- **THEN** the API responds 409 with code `higher_bid_exists`, the
  pending bid stays `pending_approval`, and the leader is unchanged

#### Scenario: Concurrent approvals are serialised
- **WHEN** two approval requests race
- **THEN** the second is a no-op or conflict response

### Requirement: Sealed-bid encryption at rest
Sealed submission SHALL verify the objectType right before accepting the
bid. The request SHALL carry an identity snapshot (name, isikukood or
registrikood, address, email, phone) validated on the server. Amount and
identity snapshot SHALL be encrypted with AES-256-GCM including auth-tag
storage; the Bid row SHALL store `amount: 0` and an unreadable
`identity_snapshot`. Sealed bids SHALL be admitted through the same
production path as open bids (the bid route and AuctionDO), and the
revision cap `1 + settings.sealedRevisionCap` SHALL be enforced
server-side with error code `revision_cap_exceeded`. Decryption SHALL
verify the auth tag; on tamper or failure the bid SHALL be marked invalid
rather than silently reported as 0.

#### Scenario: Rights required for sealed submission
- **WHEN** a user without the auction's objectType right submits a
  sealed bid
- **THEN** the response is HTTP 403

#### Scenario: Amount and identity unreadable in the database
- **WHEN** a sealed bid row is inspected in the database
- **THEN** the amount column is 0, the snapshot columns hold ciphertext
  only, and neither is decryptable without the key

#### Scenario: Revision cap exceeded
- **WHEN** the user submits more revisions than the configured cap allows
- **THEN** the response is an error with code `revision_cap_exceeded`
  and the earlier bid stands

#### Scenario: Tampered ciphertext is rejected
- **WHEN** the encrypted amount is modified in storage and then opened
- **THEN** decryption throws, the bid is marked invalid, and the ceremony
  continues with the remaining bids

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

### Requirement: Sealed-opening ceremony
Opening sessions SHALL be persisted with a 30-minute expiry, not held in
process memory. The two-person rule SHALL require distinct opener and
approver identities with server-verified tokens. Reveal SHALL be one-shot
and simultaneous, ranked by decrypted amount descending with ties broken
by earliest submission. Winner confirmation SHALL verify the bid belongs
to the auction and tops the ranking, compare the decrypted amount against
the reserve price, publish `finalPrice` on the auction, notify losers,
and queue the auction contract. A void path SHALL transition the auction
to `unsold`.

#### Scenario: Two distinct admins required
- **WHEN** the opener attempts to approve their own session
- **THEN** approval is rejected

#### Scenario: Session expiry
- **WHEN** more than 30 minutes pass before approval
- **THEN** the session is invalid and a new one must be started

#### Scenario: Confirmation publishes the final price
- **WHEN** the top-ranked bid meets the reserve and the winner is
  confirmed
- **THEN** the auction stores `finalPrice`, losers receive notifications,
  and a contract is prepared

### Requirement: Contract gate for open bidding
The framework-contract gate SHALL be active by default: a user without a
signed framework contract cannot bid on open auctions while an active
framework template exists. Signing SHALL record `signedBy` from the
authenticated session so the gate can match it. A Settings override MAY
disable the gate for demos.

#### Scenario: Gate passes after signing
- **WHEN** a user completes framework-contract signing
- **THEN** the contract row stores their `signedBy` id and subsequent
  bids pass the gate

#### Scenario: Gate blocks unsigned bidder
- **WHEN** a user without a signed framework contract bids on an open
  auction with an active framework template
- **THEN** the response is HTTP 403 with the contract redirect

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

