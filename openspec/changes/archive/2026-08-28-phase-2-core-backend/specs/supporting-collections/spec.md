## ADDED Requirements

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
`Lead` SHALL be a Payload collection capturing form submissions from the
marketing site. Fields: `formName`, `pageSlug`, `contactName`, `phone`,
`email`, `cadastr` (optional), `consentAt` (timestamp), `source`, `status`
(new, contacted, qualified, contract, disqualified), `assignedSpecialist`.
The `POST /api/leads` endpoint SHALL require a non-empty `consentAt` value.

#### Scenario: Rate limit blocks excessive lead submissions
- **WHEN** `POST /api/leads` receives more than 5 requests from the same IP
  in one minute
- **THEN** the endpoint returns HTTP 429

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
The system SHALL expose Payload collections `Page`, `Article`,
`FAQCategory`, `FAQItem`, `Testimonial`, `PartnerService`, `LegalDocument`,
and `Redirect`. Pages SHALL support a block-builder layout with hero,
text, cards, accordion, steps, forms, ticker, stats, CTA, and testimonial
blocks. Each page SHALL carry per-page SEO fields.

#### Scenario: FAQ item deep link resolves
- **WHEN** a user visits `/#q-slug` on the KKK page
- **THEN** the page scrolls to the matching FAQ item

### Requirement: Settings singleton
`Settings` SHALL be a Payload singleton holding org data, fee percentage
with VAT rate, anti-snipe duration defaults, alapakkumine toggle default,
sealed-bid revision cap, and feature flags.

#### Scenario: Anti-snipe default affects new auctions
- **WHEN** the anti-snipe setting is updated to 13 minutes
- **THEN** new auctions created after the change inherit 13 minutes as
  their default

### Requirement: AuditEntry collection
`AuditEntry` SHALL be an append-only Payload collection storing every
admin or system action that affects a user, bid, rights grant, identity
reveal, or contract. Each entry SHALL contain `actor`, `action`
(key), `entityType`, `entityId`, and a JSON `before`/`after` snapshot.

#### Scenario: Bid reveal is audit-logged
- **WHEN** an admin reveals a bidder's identity in a sealed auction
- **THEN** an AuditEntry is created with `action: identity_reveal` and the
  `before`/`after` JSON is recorded

### Requirement: StatisticsSnapshot collection
`StatisticsSnapshot` SHALL store a daily aggregated snapshot keyed by
`date` and `objectType` containing `count`, `area`, `volume`, and `eur`
(total value).

#### Scenario: Snapshot is written on auction completion
- **WHEN** the auction-ending worker finalises an auction
- **THEN** the snapshot for that date is upserted with the new counters