# portal-api Specification

## Purpose
TBD - created by archiving change phase-3-auction-portal. Update Purpose after archive.
## Requirements
### Requirement: Public auction list endpoint
`GET /api/v1/auctions` SHALL return paginated auction summaries filtered by
`objectType`, `auctionStatus`, county, parish, species, logging type,
area/volume range, and price range, with sort options (start price, end
price, end time) and page/limit. Map requests SHALL receive coordinates
without pagination.

#### Scenario: Filter by county and species
- **WHEN** the endpoint is called with `county=harju` and `species=MA,KU`
- **THEN** only active auctions in Harju county whose species include
  Mänd or Kuusk are returned, with total count for pagination

### Requirement: Auction detail endpoint
`GET /api/v1/auctions/:id` SHALL return the full public dossier for a lot:
identity and status fields, location with coordinates, land/forest data,
pricing (minBid, bidStep; reservePrice never), rich-text info, files, and
specialist alias contact. For sealed auctions it SHALL include `bidCount`
but no bid payloads. For authed users on open auctions it SHALL include
`leadingBidAmount` and the caller's participation flags.

#### Scenario: Guest detail response omits bid amounts
- **WHEN** a guest requests an open auction's detail
- **THEN** the response contains no `leadingBidAmount` and no bid list

#### Scenario: Reserve price never leaves the server
- **WHEN** any caller requests auction detail
- **THEN** the response contains no `reservePrice` field

### Requirement: Role-shaped bid list endpoint
`GET /api/v1/auctions/:id/bids` SHALL return: for authed users, bid
amounts with anonymized "Pakkuja #n" labels, relative timestamps, autobid
source markers, and an own-bid flag; for guests, only the bid count and the
latest timestamp. Alapakkumine entries pending seller approval SHALL NOT
appear in the list for other users.

#### Scenario: Authed bid list shape
- **WHEN** an authed user with bids requests the list
- **THEN** each row has amount, "Pakkuja #k" label, time, source marker,
  and `isOwn` true only on their own bids

#### Scenario: Pending alapakkumine hidden from others
- **WHEN** an alapakkumine has status `pending_seller_approval`
- **THEN** it appears only in the submitter's own view, not in other
  users' lists

### Requirement: With-user-bids endpoint
`GET /api/v1/auctions/with-user-bids` SHALL return the active profile's
bid participation grouped by status (active/ended) with the user's standing
bid, the auction's current state, and outcome fields for ended auctions,
scoped strictly to the active profile.

#### Scenario: Profile scoping
- **WHEN** a user with a private and a company profile requests their bids
- **THEN** only bids made under the active profile are returned

### Requirement: Notification read endpoints
`GET /api/v1/my/notifications` SHALL return the caller's notifications with
cursor pagination (25/page) and category/unread filters.
`PATCH /api/v1/my/notifications/:id/read` and
`PATCH /api/v1/my/notifications/read-all` SHALL mark items read.

#### Scenario: Mark all read
- **WHEN** `read-all` is called with 3 unread notifications
- **THEN** all 3 have `readAt` set and the bell badge clears

### Requirement: Saved-search subscription CRUD
`/api/v1/auction-subscriptions` SHALL support list/create,
`:id` update/delete, and token-authenticated unsubscribe
(`POST .../unsubscribe?token=`) that works without a session. Create SHALL
require consent for guests and store `filter_json`, channel, and frequency.

#### Scenario: Token unsubscribe without session
- **WHEN** an email footer link calls the unsubscribe endpoint with a valid
  token and no cookies
- **THEN** the subscription is deleted and the response confirms success

### Requirement: Seller auction endpoints
`GET /api/v1/my-auctions` SHALL return auctions owned by the seller with
view counts, bid counts, leading price for open auctions, and status.
`POST /api/v1/my-auctions/:id/relist-request` and
`.../request-review` SHALL create the corresponding requests and
notifications. Underbid approve/reject SHALL return HTTP 409 with the
conflict reason when a higher regular bid has arrived since submission.

#### Scenario: Stale alapakkumine approval rejected
- **WHEN** the seller approves an alapakkumine after a higher bid arrived
- **THEN** the API responds 409 with a reason the UI can display

### Requirement: Profile and rights endpoints
`GET/PATCH /api/v1/profiles` SHALL read and update the caller's profiles
with consent and preference fields. `GET /api/v1/my/auction-rights` SHALL
return the rights matrix per object type. `POST /api/v1/my/rights-requests`
SHALL create a `rights_requests` row (pending) for one object type and
refuse duplicates while one is pending.

#### Scenario: Duplicate rights request refused
- **WHEN** a rights request for `property` is already pending and the user
  requests it again
- **THEN** the endpoint responds 409 and no new row is created

### Requirement: Auto-bidder item endpoint
`PATCH /api/v1/auto-bidders/:id` SHALL update the max amount only upward
past the current leading bid plus step, and `DELETE` SHALL cancel the
autobidder leaving the last placed bid standing. Both SHALL be scoped to
the caller's active profile. `GET /api/v1/auto-bidders?auction=:id`
SHALL return the caller's own autobidder row for that auction (id and
max amount), or 204 when none exists, so the lot page and the customer
area can prefill and offer removal.

#### Scenario: Own row is retrievable
- **WHEN** a user with an autobidder row requests
  `GET /api/v1/auto-bidders?auction=:id`
- **THEN** the response carries that row's id and max amount and no
  other user's row

#### Scenario: Max below current leading rejected
- **WHEN** the autobidder max is set below leading + step
- **THEN** the PATCH responds 422 with the minimum allowed amount

