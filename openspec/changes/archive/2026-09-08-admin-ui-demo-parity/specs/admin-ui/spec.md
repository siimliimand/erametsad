## ADDED Requirements

### Requirement: Admin overlay primitives

The admin SHALL provide one Modal (480px and 720px sizes), one right-side
Drawer (460/560/680/720px sizes, full-width below 768px), a ToastProvider,
and a ConfirmDialog as the only overlay implementations. Every overlay
SHALL close on Escape and backdrop click, trap focus while open, restore
focus to the trigger on close, and lock body scroll. ConfirmDialog SHALL
support two guards: a reason textarea with minimum 5 characters and a
typed confirmation keyword. Demo styling quirks (button radius, toast
position, drawer widths) SHALL be normalized to one component set.

#### Scenario: Ad-hoc overlays are replaced

- **WHEN** any admin page needs a modal, drawer, or confirmation
- **THEN** it composes one of the shared primitives and no new fixed-
  position or details-based overlay is introduced

#### Scenario: Drawer is responsive

- **WHEN** the viewport is below 768px
- **THEN** every drawer renders full-width and its action footer stacks

### Requirement: Unified status pill

The admin SHALL use a single status pill component for all status
rendering (auction lifecycle triads, user states Aktiivne/Peatatud/
Keelatud, contract lifecycle glyphs, lead stages, CMS content states).
Duplicate pill implementations SHALL be removed.

#### Scenario: One implementation

- **WHEN** a status label is added or restyled
- **THEN** the change happens in the single component and propagates to
  every screen

### Requirement: Rail badges and command palette

The sidebar nav SHALL render badge flags (amber dot, numeric count) from
server-provided pending counts per module. The topbar search SHALL focus
on Cmd/Ctrl+K and offer a grouped route-jump palette over auctions,
users, leads, contracts, and settings.

#### Scenario: Pending approvals visible in nav

- **WHEN** company approvals or sealed ceremonies are pending
- **THEN** the matching rail item shows its badge without a page load

#### Scenario: Keyboard search

- **WHEN** the operator presses Cmd/Ctrl+K anywhere in the admin
- **THEN** the search palette opens, navigates with arrows, and jumps to
  the chosen record list on Enter

### Requirement: Workspace dashboard

The admin landing page SHALL render the demo workspace: a 7-card KPI
strip with alert badges, sparkline, and trend sublines; a live
"Lõpevad täna" table with ticking countdowns and critical blink; a
system health card; action queue rows with counts; and a recent leads
list. All numbers SHALL come from one aggregation module scoped by the
operator role.

#### Scenario: Ending auctions tick live

- **WHEN** an auction in the ending-today table has less than 5 minutes
  left
- **THEN** its countdown turns red and blinks, and the Monitor button
  links to the bid monitor

#### Scenario: Specialist sees scoped counts

- **WHEN** a specialist opens the workspace
- **THEN** queue counts and leads reflect only lots and leads assigned to
  them

### Requirement: Statistics dashboard

The admin SHALL provide a statistics page at the registry path with a
period selector (30/90/365 days), 6 KPI cards, a grouped monthly bar
chart (start price vs final price), an object-type donut, a 30-day bid
trend, a Top-5 auctions table, and a county overview table. Charts SHALL
be server-rendered SVG with no chart library dependency, and the page
SHALL offer a CSV export preserving the selected period.

#### Scenario: No client chart dependency

- **WHEN** the statistics page loads
- **THEN** all charts are inline SVG from the server and no chart
  package is added to the bundle

#### Scenario: Period switch recomputes

- **WHEN** the operator selects a different period
- **THEN** KPI values and chart data recompute for that window
