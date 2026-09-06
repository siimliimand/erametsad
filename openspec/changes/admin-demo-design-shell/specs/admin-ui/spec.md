# admin-ui (delta)

## ADDED Requirements

### Requirement: Shared admin components follow demo density

The shared admin components `DataTable`, `PageHeader`, `FormField`, and
`ErrorNotice` SHALL follow the ADMIN-DESIGN-SPEC §1.2 density: data tables
render 13px/18px row text with mist-background header rows and hover row
highlight; page headers render a breadcrumb line and a 28px/34px
Public Sans 700 title with an action slot; form fields and error notices
use the admin token scale. Screens composed from these components SHALL
inherit the styling without per-screen edits.

#### Scenario: Auctions list table density

- **WHEN** the auctions list renders its table
- **THEN** header cells use the mist background at 12px/16px label size and
  body cells render 13px/18px text with hover row highlight

#### Scenario: Page header composition

- **WHEN** an admin page renders `PageHeader`
- **THEN** a 12px breadcrumb line appears above a 28px page title and the
  page's primary action renders right-aligned on the same row

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
