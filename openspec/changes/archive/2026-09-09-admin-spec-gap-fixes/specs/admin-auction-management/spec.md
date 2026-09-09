## MODIFIED Requirements

### Requirement: Auctions list operations

The auctions list SHALL additionally provide:

- an "ha / m³" column rendered from real area/volume values;
- a toggleable "Uuendatud" column;
- default sort: active lots by endsAt ascending, all other filters by id
  descending;
- a Kiiroksjonid tab filtered by `isQuickAuction = true` across object types;
- archive permitted from ended, unsold, and completed lots.

#### Scenario: Quick-auction tab is cross-type

- **WHEN** a raieõigus lot has `isQuickAuction = true`
- **THEN** it appears under the Kiiroksjonid tab

#### Scenario: Default sort

- **WHEN** the operator opens the list with no explicit sort and the status
  filter is active
- **THEN** the lot ending soonest is listed first

### Requirement: Seven-step auction editor

The editor SHALL additionally:

- gate publishing on: specialist set, start time at least 10 minutes in the
  future, and area greater than 0;
- offer three distinct actions: Salvesta mustandina, Ajasta, Avalda kohe;
- show the reserve (piirhind) field only for sealed and kiiroksjon lots;
- allow an admin to edit the end time of a locked scheduled or active lot,
  with the change audit-logged;
- provide a read-only field summary in step 7 and a two-column diff against
  the published version when editing a published lot;
- persist kooskõlastused and väljaveoteed from step 3;
- gate the lease deadline field behind a rendi-/kasutusleping checkbox and
  build the Metsaregister link from the first registry number.

#### Scenario: Publish gate blocks without specialist

- **WHEN** the operator publishes a lot with no responsible specialist
- **THEN** publishing is blocked and step 5 is marked defective

#### Scenario: Reserved diff masks the reserve

- **WHEN** the step-7 diff includes a changed reserve price
- **THEN** the old and new values render as "muudetud (varjatud)"

### Requirement: Editor media pipeline

The editor SHALL upload images and PDFs through a server endpoint that stores
them and generates the documented renditions, replacing URL pasting.

#### Scenario: Upload validates and stores

- **WHEN** the operator uploads a 15 MB JPEG with alt text
- **THEN** the image is stored, renditions are queued, and the lot references
  the stored media id

### Requirement: Bulk schedule and CSV export

Bulk scheduling SHALL present the Ajasta avaldamine modal with a per-row
end-time preview and an "nihuta kõiki lõppe ×h" offset control that preserves
individual end-time offsets, and "Ekspordi valitud" SHALL export exactly the
selected ids.

#### Scenario: Offset schedule

- **WHEN** the operator shifts all start times by +2 hours with the offset
  control
- **THEN** each end time shifts by the same 2 hours

#### Scenario: Selection export

- **WHEN** three rows are selected and the operator clicks Ekspordi valitud
- **THEN** the CSV contains exactly those three lots

### Requirement: Auction wizard chrome and draft autosave

The wizard SHALL autosave drafts to the server (10 s idle, step change, or
blur), show a server-backed "Salvatud HH:MM" indicator, and show a conflict
banner with a lock option when another staff member has unsaved changes to
the same lot.

#### Scenario: Conflict banner

- **WHEN** another specialist saves the same draft while the wizard is open
- **THEN** the wizard shows the conflict banner and offers to take the lock
