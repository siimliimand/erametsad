## ADDED Requirements

### Requirement: placeBid service
`placeBid` SHALL execute within a single serializable Postgres transaction.
The transaction SHALL acquire a `FOR UPDATE` row lock on the target
Auction so concurrent bids are serialised. The validation chain SHALL
be: session valid → user authenticated → auction status active → auction
endTime not passed → user has objectType right → bid amount is at least
`currentLeadingBid + bidStep` (or `minBid` if no bids exist) → user does
not have a signed framework contract requirement pending. On success the
service SHALL append a new Bid record and update the leading bid status
of the previous leading bid to `outbid`.

#### Scenario: Valid bid succeeds
- **WHEN** an authenticated user with `raieõigus` submits a bid of €500
  on an active auction with `minBid: 100` and `bidStep: 50`
- **THEN** the response is HTTP 201 with the created Bid document and
  the previous leading bid's status is moved to `outbid`

#### Scenario: Bid below minimum is rejected
- **WHEN** a user submits a bid below `minBid`
- **THEN** the response is HTTP 400 with a message indicating the minimum

#### Scenario: Bid on ended auction is rejected
- **WHEN** the auction endTime has passed before the bid acquires the lock
- **THEN** the response is HTTP 409 with a message that the auction has ended

#### Scenario: Framework contract gate enforced
- **WHEN** a user without a signed framework contract attempts to bid
  on an auction requiring one
- **THEN** the response is HTTP 403 with a redirect path to the contract

### Requirement: Autobidder evaluation
When a manual or autobidder bid arrives, the autobidder evaluation service
SHALL determine the new leading amount as the minimum required to stay
ahead, capped at each autobidder's `maxAmount`. Tie-breaks between equal
autobidder limits SHALL resolve to the autobidder created first.
Autobidder-vs-autobidder conflict shall resolve to `secondMax + bidStep`.

#### Scenario: Autobidder responds to a manual bid
- **WHEN** a manual bid of €300 arrives and an autobidder is active with
  `maxAmount: 500` and there are no other bidders
- **THEN** the autobidder evaluates and places a leading bid of €305
  (step over the manual bid)

#### Scenario: Autobidder-vs-autobidder tie break
- **WHEN** two autobidders with `maxAmount: 500` both exist and no manual
  bids have been placed
- **THEN** the new leading bid is €500 for the autobidder created first

### Requirement: Anti-sniping time extension
When a bid is accepted in the last N minutes of an auction (where N is the
Auction's anti-snipe window configured in Settings, default 5, range 1–30),
the system SHALL extend the auction endTime by N minutes and persist the
new endTime. The extension SHALL be broadcast via SSE to all connected
listeners.

#### Scenario: Bid in final 5 minutes extends auction
- **WHEN** a bid arrives 3 minutes before endTime and anti-snipe = 5
- **THEN** endTime is extended by 5 minutes and an SSE `auction:extended`
  event is sent

### Requirement: Alapakkumine (under-start bid)
When alapakkumine is enabled on an auction, a user MAY submit a bid below
`minBid`. Such a bid SHALL be created with status `pending_approval`. The
seller SHALL be able to approve (status becomes `leading`) or reject
(notify bidder via notification service). A concurrent approval race
SHALL be handled with an idempotency guard.

#### Scenario: Seller approves an under-bid
- **WHEN** seller calls `POST /api/my-auctions/:id/underbids/:bidId/approve`
- **THEN** the bid status changes to `leading` and the bidder is notified

#### Scenario: Seller rejects an under-bid
- **WHEN** seller calls `POST /api/my-auctions/:id/underbids/:bidId/reject`
  with a reason
- **THEN** the bid status changes to `rejected` and the bidder is notified
  with the reason

### Requirement: Sealed-bid encryption at rest
Sealed bids SHALL be encrypted with AES-256-GCM before persistence. The
encryption key SHALL be loaded from `SEALED_BID_KEY` environment variable.
Each sealed bid SHALL include an `encryptionIv` (12-byte) and
`encryptionTag` for authenticated decryption. A user SHALL NOT submit
more than one sealed bid per auction (revision cap from Settings applies
as a maximum resubmission count).

#### Scenario: Sealed bid is unreadable in database dump
- **WHEN** a sealed bid row is read directly from Postgres
- **THEN** the `amount` column is encrypted ciphertext, not a readable number

#### Scenario: Sealed bid double-submit blocked
- **WHEN** a user submits a second sealed bid without using the revision
  resubmission flow
- **THEN** the response is HTTP 409 indicating one bid is already submitted

### Requirement: Auction-ending worker
An auction-ending worker SHALL poll auctions with `endTime` in the past
that are still `active`. Processing SHALL be idempotent (key per auction).
The worker SHALL transition status to `ended` and compute the open-auction
outcome: set winning bid status to `won` and all others to `lost`. The
worker SHALL fire notifications and write a `StatisticsSnapshot`.

#### Scenario: Worker processes an auction end
- **WHEN** an auction endTime passes and the worker fires
- **THEN** the auction status moves from `active` to `ended` and the
  winning bid is set to `won`

#### Scenario: Double-fire is safe
- **WHEN** the worker fires twice for the same auction
- **THEN** the second run is a no-op because the idempotency key is
  already recorded

### Requirement: Sealed-opening ceremony
The sealed-opening service SHALL enforce a two-person rule: an opener
admin and an approver admin must both submit a typed keyword ("AVAN")
within 30 minutes. On dual-confirm the service SHALL decrypt all sealed
bids, rank them by amount descending (tie = earliest submission wins),
publish the finalPrice (minus unsold/void path), queue a contract for the
winner, and notify all participants. A `void` path SHALL be available
if the ceremony admin determines the auction should be voided.

#### Scenario: Two-person opening succeeds
- **WHEN** admin A starts the ceremony and admin B confirms with matching
  keyword within 30 minutes
- **THEN** sealed bids are decrypted, the winner is ranked and confirmed,
  and finalPrice is published

#### Scenario: Single-person opening is rejected
- **WHEN** only one admin submits the ceremony keyword
- **THEN** the ceremony is not completed and the reprint deadline timer
  continues

### Requirement: Contract gate for open bidding
Before a user's first open bid on any auction, the system SHALL verify
that the user has a signed framework contract (raamleping). A missing
contract SHALL return HTTP 403 with a redirect to the signing flow.

#### Scenario: Unblocked user bids successfully
- **WHEN** a user with a signed framework contract submits an open bid
- **THEN** the bid is accepted normally

#### Scenario: Blocked user is redirected
- **WHEN** a user without a signed framework contract attempts to bid
- **THEN** the response is HTTP 403 and includes signing redirect URL

### Requirement: Unit tests for the bidding engine
The bidding engine SHALL have unit tests covering step-math validation,
tied autobidder resolution, anti-snipe boundary conditions, alapakkumine
approval flows, sealed bid encrypt/decrypt ceremony, and idempotent
worker double-fire. The test suite SHALL run as part of CI.

#### Scenario: CI enforces unit tests
- **WHEN** a pull request changes anything under `apps/platform/src/lib/bidding`
- **THEN** the bidding engine unit test suite runs in CI and must pass