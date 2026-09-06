# admin-ui (delta)

## MODIFIED Requirements

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

## ADDED Requirements

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
