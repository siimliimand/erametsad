# admin-ui Specification

## Purpose
TBD - created by archiving change option-b-cloudflare-only. Update Purpose after archive.
## Requirements
### Requirement: Role-guarded admin route group

The admin SHALL live in `apps/platform/src/app/(admin)/` as table and
form pages on the repository layer with server actions. Every admin
route and action SHALL be guarded by `users.role` (staff roles only:
specialist, seller, admin, superadmin). Specialist access SHALL be
scoped to lots assigned to that specialist and leads assigned to that
specialist; seller access SHALL be scoped to the seller's own lots and
limited to read access plus alapakkumine decisions; manual end, export,
fee override, and specialist reassignment SHALL be denied server-side
for the specialist role. The admin UI SHALL be in Estonian.

#### Scenario: Non-admin is rejected

- **WHEN** a user without a staff role opens an admin route
- **THEN** the request is redirected or rejected with HTTP 403

#### Scenario: Specialist scope is enforced server-side

- **WHEN** a specialist submits a write action on a lot assigned to a
  different specialist
- **THEN** the action is rejected with an explicit permission error and
  no state changes

### Requirement: Auction operations screens
The admin SHALL provide: auction create and publish, a live bid monitor
that subscribes to the same `AuctionDO` stream as the portal, bid
approve and reject (alapakkumine and sealed ceremony screens), and
contract flow triggers.

#### Scenario: Operator runs an auction end to end
- **WHEN** a staff user creates an auction, publishes it, watches bids,
  and triggers the contract flow
- **THEN** all steps complete in the admin without Payload

### Requirement: Users, rights, contracts, and CRM screens
The admin SHALL manage users and auction rights, contracts and
templates, and the leads CRM pipeline.

#### Scenario: Rights granted per auction type
- **WHEN** an admin grants a user the right for an object type
- **THEN** the right is stored and enforced on the next bid submission

### Requirement: Content management screens
The admin SHALL manage articles, pages, FAQ categories and items,
testimonials, partner services, legal documents, redirects,
specialists, statistics snapshots, and settings.

#### Scenario: Editor publishes an article
- **WHEN** a staff user creates and publishes an article
- **THEN** the marketing site renders it

### Requirement: Media library on R2
The admin SHALL provide a media library: upload to R2, browse, and edit
alt text. It replaces the Payload Media collection UI.

#### Scenario: Upload and reuse
- **WHEN** a staff user uploads an image with alt text and references it
  in an article
- **THEN** the image is stored in R2 and rendered with the alt text

### Requirement: Content import and export
The admin SHALL offer JSON import and export for content collections so
marketing can bulk-load articles and pages.

#### Scenario: Round-trip preserves content
- **WHEN** articles are exported to JSON and imported into a fresh
  environment
- **THEN** the articles match the originals field for field

