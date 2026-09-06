# admin-shell (delta)

## MODIFIED Requirements

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

## ADDED Requirements

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
