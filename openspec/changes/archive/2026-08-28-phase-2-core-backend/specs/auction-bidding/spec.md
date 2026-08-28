## ADDED Requirements

### Requirement: Auction collection complete field model
`Auction` SHALL be a Payload collection containing all fields specified in
the plan §5.4 dossier: identity and status fields (`status`, `objectType`,
`isQuickAuction`, `endYear`), location (`county`, `parish`, coordinates,
kataster and Metsaregister links), land and forest data (cadastres[],
registryNumbers[], species, logging types, compartments, notifications,
deadlines), pricing (`minBid`, `bidStep`, `reservePrice` encrypted,
`feeOverride`), content (two rich-text areas, alias email, media, files),
package fields (table with rows/columns for pakett auctions),
`specialist` (user relationship), and `seller` (user relationship).

#### Scenario: Instructor creates complete auction via admin
- **WHEN** an admin completes all 7 wizard steps in the auction editor
- **THEN** an Auction document is created with all fields populated and the
  relationship to seller and specialist resolves correctly

### Requirement: Auction status lifecycle
Auction status SHALL progress through a fixed sequence:
draft → scheduled → active → ended → appraised/unsold → contract →
completed → archived. An `unsold` branch is valid from `ended`. The system
MUST NOT skip or reorder statuses except through the auction-ending worker
(server-authoritative) or a manual admin action with audit logging.

#### Scenario: Admin cannot skip from draft to active
- **WHEN** a mutation sets Auction status from `draft` to `active`
- **THEN** the mutation is rejected with a 400 error

#### Scenario: Ended auction can transition to unsold or contract
- **WHEN** an ended auction has no qualifying bids
- **THEN** the system sets status to `unsold`

#### Scenario: Ended auction with a winner transitions to contract
- **WHEN** an ended auction has a winning bid confirmed
- **THEN** the system queues a contract and sets status to `contract`

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