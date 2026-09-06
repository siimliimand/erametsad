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

### Requirement: Shared admin components follow demo density

The shared admin components SHALL follow the ADMIN-DESIGN-SPEC §1.2
density. `DataTable`, `PageHeader`, `FormField`, and `ErrorNotice` render at
the demo scale: data tables render 13px/18px row text with mist-background
header rows and hover row highlight; page headers render a breadcrumb line
and a 28px/34px Public Sans 700 title with an action slot; form fields and
error notices use the admin token scale. Screens composed from these
components SHALL inherit the styling without per-screen edits.

`DataTable` SHALL render inside the demo card treatment: white surface,
8px radius, 1px border, and the `--shadow-card` elevation, with edge-cell
padding on the first and last columns.

#### Scenario: Auctions list table density

- **WHEN** the auctions list renders its table
- **THEN** header cells use the mist background at 12px/16px label size and
  body cells render 13px/18px text with hover row highlight

#### Scenario: Page header composition

- **WHEN** an admin page renders `PageHeader`
- **THEN** a 12px breadcrumb line appears above a 28px page title and the
  page's primary action renders right-aligned on the same row

#### Scenario: Table card elevation

- **WHEN** any admin screen renders `DataTable`
- **THEN** the table sits on a white card with an 8px radius, a 1px border,
  and the demo card shadow

### Requirement: Status chips use semantic triads

A shared `StatusChip` component SHALL render auction and bid statuses using
the demo's per-status text/background/dot triads (mustand, ajastatud,
aktiivne, lõppenud, müümata, leping, arhiivis), with müümata rendered as an
outline style. The auctions list and bids list SHALL use this component for
status display.

#### Scenario: Active auction chip

- **WHEN** an auction with status aktiivne renders in the auctions list
- **THEN** the chip shows green text on the light green background with the
  green dot

#### Scenario: Unsold chip outline

- **WHEN** a status chip for müümata renders
- **THEN** the chip shows danger-red text with a red outline border and a
  transparent background

### Requirement: Sortable data table headers

The shared `DataTable` SHALL support optional sortable columns: a column
MAY declare a sort descriptor carrying the sort key, the current
direction, and a URL for toggling to the opposite direction. Sortable
headers SHALL render as buttons with an ascending/descending arrow icon
and the active direction SHALL set `aria-sort` on the `th`. Toggling sort
SHALL preserve all other URL parameters. Columns without a sort
descriptor SHALL render unchanged.

#### Scenario: Toggling sort preserves filters

- **WHEN** the auctions list is filtered by county and the operator clicks
  the Alghind header
- **THEN** the list re-sorts by minimum bid and the county filter remains
  applied in the URL

#### Scenario: Active sort is announced

- **WHEN** the list is sorted by Lõpp descending
- **THEN** the Lõpp `th` carries `aria-sort="descending"` and its button
  shows the active arrow icon

