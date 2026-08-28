# notifications-contracts Specification

## Purpose
TBD - created by archiving change phase-2-core-backend. Update Purpose after archive.
## Requirements
### Requirement: Notification event bus
An in-process event bus SHALL emit typed domain events (for example,
`bid.created`, `auction.ended`, `contract.ready`). Each event SHALL
trigger a per-user channel matrix lookup (email, sms) from the user's
notification preferences. Email sending SHALL use the `packages/emails`
templates rendered into Mailpit (local) or a real provider (production).

#### Scenario: Outbid notification via email
- **WHEN** a user is outbid and has email notifications enabled for that
  event type
- **THEN** an email is dispatched via the notification service using the
  `outbid` template

#### Scenario: SMS log stub in prototype
- **WHEN** a notification targets the SMS channel in prototype mode
- **THEN** the payload is logged with no external API call

### Requirement: Contract service
The contract service SHALL render template placeholders (`{{key}}`) into
a document from a ContractTemplate record. It SHALL generate both an HTML
preview and a simple PDF. `POST /api/bids/framework-contract/prepare` SHALL
create a prepared framework contract. The mock eID signing session SHALL
expire after 15 minutes. On signing, a hash of the signed content SHALL
be written to the Contract record.

#### Scenario: Framework contract signed successfully
- **WHEN** a user completes the mock PIN2 ceremony
- **THEN** the Contract status moves from `prepared` to `signed` and
  `signedAt` is populated with the current timestamp

#### Scenario: Signing session expires
- **WHEN** 15 minutes pass after a contract is prepared without signing
- **THEN** the contract status is set to `voided`

### Requirement: Statistics aggregation
A statistics service SHALL compute totals from `StatisticsSnapshot`
records grouped by objectType. `GET /api/v1/statistics` SHALL return
total count, total area (hectares), total volume (cubic metres), and
total value (EUR) across all time.

#### Scenario: Statistics endpoint returns aggregated data
- **WHEN** `GET /api/v1/statistics` is called
- **THEN** the response contains sums grouped by objectType
  (raieõigus, kinnistu, kiire, pakett)

### Requirement: Lead ingestion endpoint
`POST /api/leads` SHALL accept lead submissions from the marketing site
forms. The endpoint SHALL reject requests missing a required
`consentAt` timestamp and shall rate-limit to 5 requests per IP per
minute. A honeypot field `company_website` SHALL be present and must be
empty; a non-empty honeypot returns HTTP 200 silently without persisting
the lead.

#### Scenario: Valid lead is persisted
- **WHEN** `POST /api/leads` receives a valid payload with consentAt
- **THEN** a Lead document is created and the response is HTTP 201

#### Scenario: Honeypot silently drops bot submission
- **WHEN** `company_website` field is non-empty
- **THEN** the endpoint returns HTTP 200 but no Lead is persisted

### Requirement: Service-requests ingestion (deferred to Phase 5)
`POST /api/service-requests` SHALL accept service request submissions
(kava, hooldusraie, istutamine) with county, parcel info, and optional
file attachments. The endpoint SHALL be immediately routable once
Phase 5 implements the routing engine.

#### Scenario: Service request is persisted (phase 5 routing pending)
- **WHEN** `POST /api/service-requests` receives a valid service
  request payload
- **THEN** the ServiceRequest document is created with status `new`

