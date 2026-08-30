# notifications-contracts Specification

## Purpose
TBD - created by archiving change phase-2-core-backend. Update Purpose after archive.
## Requirements
### Requirement: Notification event bus
Domain events SHALL carry the affected `userId` so dispatch can reach the
user. Dispatch SHALL run in the Cloudflare Queues consumer worker (one
message per user and channel), not in an in-process dispatcher started by
application bootstrap. Email SHALL be sent through the Email Service
transport chain (`email-sender.ts`) with the `@eametsad/emails`
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
Signing SHALL record `signedBy` with the authenticated user's id so the
framework gate can match signed contracts to users. Prepare/complete
endpoints SHALL pass the session user through. The 15-minute signing
expiry, content hash, and status transitions remain as specified.

#### Scenario: Signed contract records the signer
- **WHEN** a user completes framework-contract signing
- **THEN** the contract row stores `signedBy` = user id

### Requirement: Statistics aggregation
Statistics SHALL be computed from snapshots. Sealed-auction completion
SHALL backfill the auction's `eur` contribution from the published
`finalPrice` so sealed results appear in statistics after the ceremony.

#### Scenario: Sealed result lands in statistics
- **WHEN** a sealed auction's winner is confirmed with finalPrice 27 500
- **THEN** the day's snapshot for that objectType includes the amount

### Requirement: Lead ingestion endpoint
`POST /api/leads` SHALL rate-limit by IP at 5 requests/minute, require
the consent timestamp, validate contact fields with `@eametsad/types`
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
