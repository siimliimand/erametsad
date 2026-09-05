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

The admin SHALL render inside a shell with a 56px icon sidebar listing
the 13 modules (Töölaud, Oksjonid, Pakkumised, Sul. avamine,
Kasutajad, Ettevõtted, Lepingud, Juhtlõimed, Päringud, Sisu,
Statistika, Seaded, Auditlogi) with tooltips and an active-state
indicator, and a topbar with an environment badge, a notification bell
with an unread count, and the user menu. Modules hidden for the current
role SHALL not render. Labels SHALL be in Estonian.

#### Scenario: Specialist sidebar

- **WHEN** a specialist loads the admin
- **THEN** governance modules that the role cannot use are absent from
  the sidebar and deep-linking to their routes is rejected

### Requirement: Notification bell

The notification bell SHALL show the unread count of the operator's
notifications and link to a list view with mark-as-read.

#### Scenario: Unread count decreases

- **WHEN** the operator marks a notification read
- **THEN** the unread count decreases without a full page reload

