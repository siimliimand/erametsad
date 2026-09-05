# admin-auction-management Specification

## Purpose
TBD - created by archiving change phase-5-admin-backend. Update Purpose after archive.
## Requirements
### Requirement: Auctions list operations

The auctions list SHALL provide type tabs with counts (including a
cross-type Kiiroksjonid tab), URL-shareable filters (status, type,
specialist, county, end-date range, freetext over id, name,
cadastral number, registry number, and alias email), server-side
pagination at 25 rows, a live countdown column with pending-alapakkumine
markers, and row actions: end-manually, archive, and re-list/clone.
Specialists SHALL see only their own lots and SHALL NOT see the
end-manual action.

#### Scenario: Manual end with reason and outcome

- **WHEN** an admin ends an active auction manually with a typed reason
  and chooses an outcome (declare leading bid winner, or mark unsold)
- **THEN** the auction ends through the server-authoritative path, the
  outcome is applied, and an `auction.end_manual` audit entry records
  the actor, reason, and outcome

#### Scenario: Filters are shareable

- **WHEN** an operator copies the list URL after filtering by county and
  status and opens it in a new session
- **THEN** the same filter set is applied from the URL parameters

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

