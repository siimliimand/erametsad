# notifications-contracts Specification

## Purpose
TBD - created by archiving change phase-2-core-backend. Update Purpose after archive.
## Requirements
### Requirement: Notification event bus
Domain events SHALL carry the affected `userId` so dispatch can reach the
user. Dispatch SHALL run in the Cloudflare Queues consumer worker (one
message per user and channel), not in an in-process dispatcher started by
application bootstrap. Email SHALL be sent through the Email Service
transport chain (`email-sender.ts`) with the `@erametsad/emails`
templates and stored as Notification rows with per-recipient delivery
status; SMS stays a log stub. Duplicate dispatch per user and event SHALL
be deduplicated through `dedupeKey`.

#### Scenario: Auction end notifies the winner
- **WHEN** an auction ends with a winning bid
- **THEN** the winner receives an email from the deployed worker and an
  in-app Notification row with delivery status

#### Scenario: Dispatcher runs without a request
- **WHEN** the queue consumer processes an ending event
- **THEN** the notification is dispatched without any HTTP request
  involved

### Requirement: Contract service
Prepare SHALL bind the contract to the authenticated user by storing
`signedBy` = user id at prepare time; the column is the signing-session
owner. Signing SHALL reject with a user error when the authenticated user
does not match the stored owner, then record `signedAt`. Prepare/complete
endpoints SHALL pass the session user through. Auction-type prepare SHALL
reject with 403 unless the caller holds the `won` bid on the auction
(server-side winner gate). The in-progress (`prepared`/`sent`) contract
lookup SHALL filter by `signedBy` = caller. The 15-minute signing expiry,
content hash, and status transitions remain as specified.

#### Scenario: Prepared contract records the owner
- **WHEN** a user prepares a framework or auction contract
- **THEN** the contract row stores `signedBy` = user id before any signing

#### Scenario: Signed contract records the signer
- **WHEN** a user completes framework-contract signing
- **THEN** the contract row stores `signedBy` = user id

#### Scenario: Cross-user sign rejected
- **WHEN** a user other than the stored owner completes signing with a
  contract id
- **THEN** the API rejects the request and no signature is recorded

#### Scenario: Non-winner auction prepare rejected
- **WHEN** an authed user without the `won` bid prepares an auction
  contract
- **THEN** the API responds 403

#### Scenario: In-progress lookup is user-scoped
- **WHEN** the raamleping page resolves an in-progress contract for a user
- **THEN** only rows with `signedBy` = that user are returned

### Requirement: Statistics aggregation
Statistics SHALL be computed from snapshots. Sealed-auction completion
SHALL backfill the auction's `eur` contribution from the published
`finalPrice` so sealed results appear in statistics after the ceremony.

#### Scenario: Sealed result lands in statistics
- **WHEN** a sealed auction's winner is confirmed with finalPrice 27 500
- **THEN** the day's snapshot for that objectType includes the amount

### Requirement: Lead ingestion endpoint
`POST /api/leads` SHALL rate-limit by IP at 5 requests/minute, require
the consent timestamp, validate contact fields with `@erametsad/types`
validators (Estonian phone, email), keep the `company_website` honeypot,
and record the source. Honeypot hits SHALL return a fake success without
storing anything.

#### Scenario: Rate limit at five per minute
- **WHEN** six lead submissions arrive from one IP within a minute
- **THEN** the sixth receives HTTP 429

#### Scenario: Invalid phone rejected
- **WHEN** a lead arrives with phone `123`
- **THEN** the response is HTTP 400 with an Estonian field error

### Requirement: Service-requests ingestion (deferred to Phase 5)
`POST /api/service-requests` SHALL accept service request submissions
(kava, hooldusraie, istutamine) with county, parcel info, and optional
file attachments. The endpoint SHALL be immediately routable once
Phase 5 implements the routing engine.

#### Scenario: Service request is persisted (phase 5 routing pending)
- **WHEN** `POST /api/service-requests` receives a valid service
  request payload
- **THEN** the ServiceRequest document is created with status `new`

