# admin-shell Specification

## Purpose
TBD - created by archiving change phase-5-admin-backend. Update Purpose after archive.
## Requirements
### Requirement: Staff-role admin access with scoping

The admin SHALL accept the staff roles admin, superadmin, specialist, and
seller. Specialist access SHALL scope to lots where the user is the
assigned specialist and to leads assigned to that specialist; the seller
role SHALL scope to lots owned by the seller profile and grant only
read access plus alapakkumine decisions. Manual end, archive, export,
fee override, and specialist reassignment SHALL be denied server-side
for the specialist role. Write rejections SHALL return an explicit
error.

#### Scenario: Specialist opens another specialist's lot

- **WHEN** a specialist requests the editor of a lot assigned to a
  different specialist
- **THEN** the request is rejected with a permission error and no data
  is rendered

#### Scenario: Seller decides an alapakkumine

- **WHEN** a seller approves or rejects an alapakkumine on their own lot
- **THEN** the decision succeeds and the decision is audit-logged

### Requirement: AdminShell chrome

The admin SHALL render inside a shell with a 56px icon sidebar listing the
13 modules (Töölaud, Oksjonid, Pakkumised, Sul. avamine, Kasutajad,
Ettevõtted, Lepingud, Juhtlõimed, Päringud, Sisu, Statistika, Seaded,
Auditlogi) with tooltips and an active-state indicator, and a topbar with an
environment badge, a notification bell with an unread count, and the user
menu. Modules hidden for the current role SHALL not render. Labels SHALL be
in Estonian.

The sidebar SHALL render on a white surface with a right border, muted
icons, tint hover and active states, and a 3px primary-color active
indicator on the rail's left edge, matching
`docs/design/demo/admin/index.html`. The topbar SHALL be sticky at 64px
height and show the brand title "Erametsad haldus" beside the environment
badge, the operator's name and role chip visible in the topbar, and a
global search bar rendered as a non-functional stub with a ⌘K hint. The
environment badge SHALL use semantic colors (development red, test amber)
and stay hidden in production. The main workspace SHALL use a 1400px
container with the admin density token scale.

#### Scenario: Specialist sidebar

- **WHEN** a specialist loads the admin
- **THEN** governance modules that the role cannot use are absent from
  the sidebar and deep-linking to their routes is rejected

#### Scenario: Active rail item

- **WHEN** the operator is on a page inside the Oksjonid module
- **THEN** the Oksjonid rail icon renders with the primary icon color, the
  strong tint background, and the 3px primary indicator on the rail's left
  edge

#### Scenario: Search stub is not a dead affordance

- **WHEN** the operator focuses or activates the topbar search bar
- **THEN** the input stays disabled, performs no request, and no error or
  empty result state is shown

### Requirement: Notification bell

The notification bell SHALL show the unread count of the operator's
notifications and link to a list view with mark-as-read.

#### Scenario: Unread count decreases

- **WHEN** the operator marks a notification read
- **THEN** the unread count decreases without a full page reload

### Requirement: Admin-scoped design tokens

The `(admin)` route group SHALL override design tokens — density scale
(14px body, 13px table text, 16px `md` spacing, 24px `lg` spacing), 8px
radii, 1400px container width, status text/background/dot triads, tints,
and shadows — through a CSS variable layer scoped to the admin shell.
Tailwind theme keys consumed by the admin SHALL reference CSS variables
whose root defaults match the public rendering. Surfaces outside the admin
scope SHALL render pixel-identical to their state before this change.

#### Scenario: Public page unaffected

- **WHEN** a marketing or portal page renders after the change
- **THEN** its computed colors, radii, text sizes, spacing, and container
  width match its pre-change rendering

#### Scenario: Admin density

- **WHEN** an admin page renders body text, a data table, and a card
- **THEN** body text is 14px, table text is 13px, card radius is 8px, and
  the content container is 1400px

### Requirement: Complete module routing

Every module id in `ADMIN_MODULES` SHALL resolve to a real page: the
companies module at `/admin/companies`, inquiries at `/admin/inquiries`,
statistics at `/admin/statistics`, settings at `/admin/settings`, a
sealed-opening index at `/admin/sealed-opening`, and a notifications
list at `/admin/notifications`. Relocated screens (companies, inquiries,
settings) SHALL redirect from their previous paths. No admin module href
MAY return 404 for a role that can see the module.

#### Scenario: Old paths redirect

- **WHEN** a bookmarked `/admin/leads/requests`, `/admin/requests`, or
  `/admin/content/settings` URL is opened
- **THEN** the request redirects to the new module path with the same
  role gating

### Requirement: Sealed-opening index

The sealed-opening module SHALL list sealed auctions whose end time has
passed and whose ceremony is not completed, with the registered bid
count and a link into the per-auction ceremony. The count SHALL feed the
module's rail badge.

#### Scenario: Admin finds the next ceremony

- **WHEN** a sealed auction ends
- **THEN** it appears in the sealed-opening list and the rail badge
  count increases

