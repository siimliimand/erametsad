# supporting-collections Specification

## Purpose
TBD - created by archiving change phase-2-core-backend. Update Purpose after archive.
## Requirements
### Requirement: Contract collection
`Contract` SHALL be a Payload collection storing rendered contracts for
won auctions. Each record SHALL contain a `template` relationship, a
`lot` (Auction relationship), `status` (prepared, sent, signed, voided),
`signedAt`, and a hash of the signed content.

#### Scenario: Contract created on winner confirm
- **WHEN** the sealed-opening service confirms a winner
- **THEN** a Contract document is inserted with status `prepared`

### Requirement: ContractTemplate collection
`ContractTemplate` SHALL store contract type (framework or auction),
version number, placeholders (an array of`{{key}}` strings), and a DOCX
file. Exactly one template per type shall be active at any time.

#### Scenario: Only one active template per type
- **WHEN** an admin activates a new `framework` template
- **THEN** the previously active `framework` template is automatically
  deactivated

### Requirement: Lead collection

The lead collection SHALL additionally carry `countyId` referencing the
counties table, nullable, derived from the first cadastre where possible.

#### Scenario: Derived county

- **WHEN** a lead is created with cadastre 12345:678:9010
- **THEN** the county resolves from the cadastre prefix when known

### Requirement: Notification collection
`Notification` SHALL store per-user events with `event` key, `channel`
(email, sms), `payload` JSON, and `readAt` timestamp. The API SHALL
offer cursor-paginated read at `GET /api/my/notifications`.

#### Scenario: Unread notification count available
- **WHEN** a user has 3 unread notifications
- **THEN** `GET /api/my/notifications/unread-count` returns `{ count: 3 }`

### Requirement: Specialist collection
`Specialist` SHALL be a Payload collection with fields for `name`, `slug`,
`role`, `phone`, `email`, `photo` (media), `bio` (rich text), `region`,
`active`, and `featured` (boolean). The marketing site SHALL display
specialists filtered by `active: true`.

#### Scenario: Featured specialist appears on homepage
- **WHEN** the homepage loads
- **THEN** specialists with `featured: true` are returned from the
  `/api/specialists` endpoint

### Requirement: CMS content collections

The content collections SHALL additionally carry:

- articles: `category` (uudised | klientide-lood), `seoTitle`,
  `seoDescription`, `ogImageId`, `canonicalUrl`, `robotsIndex`,
  `authorSpecialistId`;
- faq categories and items: `active`;
- faq items: `shortAnswer`;
- testimonials: `status` (draft | published) and optional `rating`;
- redirects: `hits` counter;
- media: `focalX`, `focalY`;
- leads: `countyId`.

All additions are additive columns with Drizzle migrations and CHECK
constraints where enums apply.

#### Scenario: Article category constraint

- **WHEN** a row is written with a category outside the enum
- **THEN** the CHECK constraint rejects it

### Requirement: Settings singleton

The settings row SHALL additionally carry: orgVatCode, supportEmail,
supportPhone, aliasDomain, quickAuctionFeePercent, minimumFeeCents,
autobidderEnabled, minimumAuctionDurationHours, and the named feature-flag
toggles. The default fee remains an integer percent bounded 0-10.

#### Scenario: Support contacts persist

- **WHEN** the operator saves Üldandmed with support e-mail and phone
- **THEN** both values persist and appear in the audit diff

### Requirement: AuditEntry collection

Audit entries SHALL additionally carry `reason`, `sessionId`, `ipHash`, and
`userAgent` as nullable TEXT columns; the prevHash/hash chain columns and
their semantics are unchanged.

#### Scenario: Legacy rows unaffected

- **WHEN** legacy rows with NULL new columns are read
- **THEN** the viewer renders them with em-dash placeholders

### Requirement: StatisticsSnapshot collection
`StatisticsSnapshot` SHALL store a daily aggregated snapshot keyed by
`date` and `objectType` containing `count`, `area`, `volume`, and `eur`
(total value).

#### Scenario: Snapshot is written on auction completion
- **WHEN** the auction-ending worker finalises an auction
- **THEN** the snapshot for that date is upserted with the new counters

### Requirement: NotificationTemplate collection

A notification-templates store SHALL keep one row per template version:
event, channel, subject, body, version, active flag, and updatedBy. Renders
SHALL read the active version per event and channel.

#### Scenario: Active version renders

- **WHEN** an event notification fires
- **THEN** the active template version for that event and channel supplies
  subject and body

### Requirement: MaintenanceWindow collection

A maintenance-windows store SHALL keep start, end, scope, creator, and note
per window for the Hooldusaken scheduler and its auction conflict checker.

#### Scenario: Window row persisted

- **WHEN** an admin saves a maintenance window without conflicts
- **THEN** the row persists with the creator recorded

### Requirement: ServiceRequest lifecycle statuses

The service-request status enum SHALL extend to `teostatud` and `suletud`
with the CHECK constraint updated, alongside the existing `new` and
`routed`; `vastatud` and `aegunud` remain derived states.

#### Scenario: Status constraint updated

- **WHEN** a request is marked teostatud
- **THEN** the new value passes the CHECK constraint

### Requirement: Auction area and volume columns

Auctions SHALL persist `areaHa` and `volumeM3` as real columns with a
one-time backfill from the `deadlines` JSON, so list views can render the
ha/m³ column without JSON parsing.

#### Scenario: Backfill preserves values

- **WHEN** the migration runs on a lot with areaHa 3.5 in the JSON
- **THEN** the new column holds the same value and the list column renders
  it

