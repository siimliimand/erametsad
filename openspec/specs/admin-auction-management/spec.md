# admin-auction-management Specification

## Purpose
TBD - created by archiving change phase-5-admin-backend. Update Purpose after archive.
## Requirements
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

### Requirement: Seven-step auction editor

Lot create and edit SHALL use a wizard with steps Tüüp & mehaanika,
Asukoht, Maa & mets, Hind, Sisu, Pakett, and Ülevaade. The wizard SHALL
enforce: sealed is forced (and open disabled) for property, field, and
package object types; kiiroksjon defaults to a 48-hour window with a
€1 minimum bid and a required secret reserve; anti-snipe is toggleable
with minutes from Settings (range 1-30); times validate against
Europe/Tallinn; cadastral numbers match `NNNNN:NNN:NNNN`; the county
select cascades into the parish select; the reserve price is write-only
and masked after first save; the fee override is visible to admin+
only. Step 6 renders only for package lots. The Ülevaade step SHALL
show a cross-step validation summary where each failure links to its
step and field, and publishing SHALL be blocked while required gates
fail.

#### Scenario: Sealed is forced for a property lot

- **WHEN** the operator selects object type property
- **THEN** the auction type locks to sealed and open is disabled with an
  explanatory tooltip

#### Scenario: Validation gate blocks publish

- **WHEN** the operator attempts to publish with a missing alt text and
  an invalid cadastral number
- **THEN** publish is blocked and the summary lists both failures with
  links to the exact fields

### Requirement: Editor media pipeline

Editor uploads SHALL generate renditions (hero 1600x1000, gallery
1200x750, thumb 350x175), accept jpg/png/webp up to 15 MB with a
minimum width of 1200px, restrict file attachments to PDF with a tag
select, and require alt text on every image before publish.

#### Scenario: Publish blocked without alt text

- **WHEN** a gallery image has no alt text and the operator publishes
- **THEN** the validation gate fails and names the image

### Requirement: Bulk schedule and CSV export

The list SHALL support bulk scheduling of draft lots to a shared start
time with validation that blocks non-draft selections, and CSV export
of the current filter or selection including cadastres, registry
numbers, finalPrice, and fee. Both actions SHALL be audit-logged.

#### Scenario: Bulk schedule validates selection

- **WHEN** the selection contains an active lot and the operator
  schedules the drafts
- **THEN** the action is rejected with a message naming the blocking lot

### Requirement: Guest preview token

The editor SHALL produce a guest preview link with a draft token valid
for 24 hours that renders the unpublished lot on the portal layout.

#### Scenario: Preview expires

- **WHEN** the operator opens a preview link older than 24 hours
- **THEN** the link is rejected with an expired notice

### Requirement: Auction wizard chrome and draft autosave

The auction wizard SHALL render the demo editor bar (auction id in mono,
status pill, autosave indicator with a ping on each save, portal preview
link) and a step rail with per-step status marks: done, current, todo,
and disabled (hidden Pakett step), plus a defect count footer. The wizard
SHALL autosave the in-progress draft to localStorage, offer restore on
return, and warn on unload when dirty. Durable saving stays on submit.

#### Scenario: Operator leaves and returns

- **WHEN** an operator with an unsaved wizard draft reopens the form
- **THEN** a restore prompt offers the local draft and submission still
  remains the authoritative save

### Requirement: Auctions list parity

The auctions list SHALL provide a column chooser with persisted
visibility, a mint selected-row tint, tab-count inversion on the active
tab, and a global keyboard shortcut to start a new auction. Existing
filters, bulk bar, row actions, countdowns, and the manual-end modal
SHALL keep their behavior.

#### Scenario: Hidden column stays hidden

- **WHEN** the operator hides a column and reloads the list
- **THEN** the column stays hidden from the persisted choice

### Requirement: Bid monitor parity

The bid monitor SHALL present the demo monitor-head strip (large ticking
timer, anti-snipe chip, leading bid with step), collapse rapid autobid
bursts into an expandable duel row, and offer audited bidder identity
reveals inline in the feed. An anomaly panel SHALL compute new-account
burst and rapid-overtake heuristics and let staff flag internal review
with an audit entry.

#### Scenario: Autobidder duel collapses

- **WHEN** two autobidders exchange several bids within seconds
- **THEN** the burst renders as one collapsed row that expands on demand

#### Scenario: Reveal is audited

- **WHEN** an admin reveals a bidder identity from the live feed
- **THEN** a `user.identity_view` audit entry records the reveal

### Requirement: Ceremony presentation

The sealed-bid ceremony SHALL render the persistent amber audit banner,
a blurred reveal table with a veil before the simultaneous reveal, a
staggered row reveal after it (disabled under reduced motion), toasts on
ceremony actions, and a live audit strip of sealed-event entries for the
auction. The existing two-person signing, reveal lock, and winner
decision behavior SHALL not change.

#### Scenario: Reveal reads as an event

- **WHEN** the operator triggers the reveal
- **THEN** the veil lifts, rows fade in staggered, and the audit strip
  appends the decryption entry

