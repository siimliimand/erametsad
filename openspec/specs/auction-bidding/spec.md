# auction-bidding Specification

## Purpose
TBD - created by archiving change phase-2-core-backend. Update Purpose after archive.
## Requirements
### Requirement: Auction collection complete field model
The Auction collection SHALL include a required `type` select field with
values `open` and `sealed` (default `open`). Collection validation SHALL
force `sealed` for `kinnistu` and `pakett` object types. All other field
groups remain as specified (identity/status including `isQuickAuction`
and `endYear`, location with coordinates and register links, land/forest
data, pricing, content, package fields, specialist, seller).

#### Scenario: Property auction must be sealed
- **WHEN** an auction with objectType `kinnistu` is saved with type
  `open`
- **THEN** validation fails with an Estonian error message

#### Scenario: Sealed flag stored on the row
- **WHEN** a sealed auction is created
- **THEN** the row stores `type: 'sealed'` and the ending worker can
  branch on it

### Requirement: Auction status lifecycle
The transition guard SHALL remain exactly: `draft → scheduled → active →
ended`, `ended → appraised | unsold`, `appraised → contract`,
`unsold | contract → completed → archived`. All status writes, including
worker updates, SHALL pass through the guard; no code path SHALL write a
status transition the guard rejects.

#### Scenario: Worker path passes the guard
- **WHEN** the ending worker processes an open auction with no bids
- **THEN** the auction moves `active → ended → unsold` and neither update
  throws

### Requirement: Bid collection
`Bid` SHALL be a Payload collection storing every bid as an append-only
record. Each record SHALL contain `amount`, `auction` relationship, `type`
(open or sealed), `source` (manual or autobidder), `status` (leading,
outbid, won, lost, pending_approval, rejected), `identitySnapshot`
(isikukood or registrikood at bid time), and `ipHash` (salted SHA-256).

#### Scenario: Existing bid is never updated
- **WHEN** a new bid outbids an existing one
- **THEN** the new bid is inserted and the old bid's status is moved to
  `outbid` via an update; the old bid document's `amount` field is unchanged

### Requirement: AutoBidder collection
`AutoBidder` SHALL be a Payload collection binding a User to an Auction
with a `maxAmount` and a `status` (active/paused/expired). One active
autobidder per user per auction.

#### Scenario: Single active autobidder per user-auction pair
- **WHEN** a User creates a second autobidder on the same Auction while the
  first is active
- **THEN** the system returns a 409 conflict

### Requirement: AuctionSubscription collection
`AuctionSubscription` SHALL persist user saved-search filters
(`filterJson`, `channel`, `frequency`), the subscribing user, and an
`unsubscribeToken` that allows email-based opt-out without authentication.

#### Scenario: Anonymous subscription via unsubscribe token
- **WHEN** a user visits the unsubscribe link with a valid token
- **THEN** the subscription status changes to unsubscribed
