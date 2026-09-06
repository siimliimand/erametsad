# admin-auction-management (delta)

## MODIFIED Requirements

### Requirement: Auctions list operations

The auctions list SHALL provide type tabs with counts (including a
cross-type Kiiroksjonid tab), URL-shareable filters (status, type,
specialist, county, end-date range, freetext over id, name, cadastral
number, registry number, and alias email), server-side pagination at 25
rows, a live countdown column with pending-alapakkumine markers, and row
actions: end-manually, archive, and re-list/clone. Specialists SHALL see
only their own lots and SHALL NOT see the end-manual action.

The list SHALL present the demo layout
(`docs/design/demo/admin/02-auctions-list.html`):

- Type tabs render as pill buttons with count badges; the active tab
  carries the pressed state. Tab selection remains a URL filter.
- Filters render as a chip filter bar: chip-wrapped selects (Olek keeps
  its multi-select), an inline date-range chip, a pill search input, and
  a clear action showing the active-filter count. Filter URL parameters
  are unchanged.
- The table supports working sort on ID, Nimi, Alghind, Pakkumisi, and
  Lõpp. Defaults are unchanged: `endsAt` ascending when exactly the
  active status is filtered, otherwise newest first.
- Row actions appear on row hover or keyboard focus and include the
  portal "Vaata" link, Muuda, Dupl., and the role-gated end/archive/
  re-list controls; quick auctions carry a zap marker; specialists
  render as initials avatars; bid counts keep the pending alapakkumine
  marker.
- The countdown ticks client-side for active auctions, shows a critical
  state under five minutes, and exposes the full end time via
  `aria-label`.
- Row selection drives a fixed bulk bar showing the selected count with
  the "Ajasta avaldimine" and "Ekspordi valitud" actions; the bar is
  hidden when nothing is selected.
- Manual end opens a guarded modal: an irreversibility warning, an
  auction context line, the outcome choice (declare the leading bid
  winner, or mark unsold), and a required reason of at least five
  characters, wrapping the existing server action and its audit entry.

#### Scenario: Manual end with reason and outcome

- **WHEN** an admin ends an active auction manually through the modal
  with a typed reason and chooses an outcome (declare leading bid
  winner, or mark unsold)
- **THEN** the auction ends through the server-authoritative path, the
  outcome is applied, and an `auction.end_manual` audit entry records
  the actor, reason, and outcome

#### Scenario: Manual end modal blocks short reasons

- **WHEN** the operator submits the end-manual modal with a reason
  shorter than five characters
- **THEN** the submission is blocked with the hint to write at least
  five characters and no state changes

#### Scenario: Filters are shareable

- **WHEN** an operator copies the list URL after filtering by county and
  status and opens it in a new session
- **THEN** the same filter set is applied from the URL parameters

#### Scenario: Sort toggle preserves filters

- **WHEN** the operator sorts by Alghind while county and status filters
  are active
- **THEN** the list re-sorts and both filters remain applied

#### Scenario: Bulk bar follows selection

- **WHEN** the operator selects two draft rows
- **THEN** the bulk bar appears showing the count of two with the
  schedule and export actions, and disappears when the selection is
  cleared

#### Scenario: Countdown critical state

- **WHEN** an active auction has fewer than five minutes remaining
- **THEN** its countdown renders in the critical style with the full end
  time available to assistive technology via `aria-label`
