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

The shell SHALL keep the 13-module icon rail, and in addition:

- the ⌘K command palette SHALL list jump targets for all 13 modules;
- the environment badge SHALL distinguish PROD, STAGE, and dev/test;
- the CMS nav label SHALL read "Sisuhaldus".

#### Scenario: Palette covers every module

- **WHEN** the operator opens the ⌘K palette
- **THEN** a jump target exists for each of the 13 nav modules

#### Scenario: Stage badge

- **WHEN** the app runs in a staging deployment
- **THEN** the topbar shows a STAGE badge, and PROD shows no badge

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

### Requirement: Impersonation banner shows session expiry

The impersonation banner SHALL display the remaining session time as a
countdown while an admin views the system as a user.

#### Scenario: Countdown visible

- **WHEN** an impersonation session is active
- **THEN** the banner shows whose view it is and the remaining minutes

### Requirement: Dashboard parity

Töölaud SHALL follow the documented semantics: the "Lõpevad täna" window is
the Europe/Tallinn calendar day, the ending-today KPI is amber when the count
is greater than 0, bids-today shows a 7-day sparkline, pending confirmations
are red only when greater than 0, new-lead counting is today AND (unassigned
OR status uus), the fee KPI excludes VAT, the recent-leads block shows the 8
newest leads with county and specialist chips linking to Juhtlõimed, and
Süsteemi tervis is visible to admins and superadmins only.

#### Scenario: Calendar-day window

- **WHEN** an auction ends tomorrow at 00:30 Europe/Tallinn
- **THEN** it is not counted in "Lõpevad täna" today

#### Scenario: Amber KPI

- **WHEN** at least one auction ends today
- **THEN** the KPI card renders amber

#### Scenario: Lead count filter

- **WHEN** an unassigned lead from today sits in status Võetud ühendust
- **THEN** the "Uued juhtlõimed" KPI counts it

