# admin-commerce-ops Specification

## Purpose
TBD - created by archiving change phase-5-admin-backend. Update Purpose after archive.
## Requirements
### Requirement: Contracts management

The contracts list SHALL additionally provide the Nr, Tüüp (raamleping /
oksjonileping, including framework rows), Mall with pinned version,
Allkirjastatud, and Pakkuja transaction-ref columns; type/status/date filters
with free-text search over user, lot, and contract number; search by signing
transaction id; pagination; a blue chip for the sent status; a double-confirm
dialog on Tühista listing the consequences; and a framework-void prompt
linking the rights matrix.

#### Scenario: Sent chip is blue

- **WHEN** a contract is in the saadetud state
- **THEN** its status chip renders in the blue triad

#### Scenario: Void double confirm

- **WHEN** the operator voids a contract
- **THEN** a dialog lists the consequences and requires a second explicit
  confirm

### Requirement: Contract templates with placeholder validation

Template version history SHALL additionally record the uploader, note, and
active period per version, show the number of contracts generated per
version, and warn when an active template in use by pending auctions is
edited. The placeholder catalogue sidebar SHALL have a search filter.

#### Scenario: In-use warning

- **WHEN** the operator edits an active template referenced by pending
  contracts
- **THEN** a warning names the count of affected auctions

### Requirement: Leads CRM pipeline

The leads module SHALL additionally provide:

- a county value on every lead (derived from the first cadastre or manual),
  with a Maakond filter, kanban chip, and table columns for ID and Maakond;
- an admin CSV export that blanks contacts with withdrawn marketing consent;
- exit guards: the first note is required to reach Võetud ühendust, and an
  auction/contract reference or note is required to reach Leping;
- settings-driven automatic assignment with county round-robin applied on
  creation;
- a duplicate merge action with a banner;
- superadmin soft delete with a typed reason;
- the original submitted message and attachments in the detail view.

#### Scenario: Exit guard blocks an empty move

- **WHEN** a lead with no notes is dragged from Uus past Võetud ühendust
- **THEN** the move is blocked with the note prompt

#### Scenario: Export blanks withdrawn consent

- **WHEN** a lead has withdrawn marketing consent
- **THEN** the exported row omits the marketing contact fields

### Requirement: Service-request routing and partner directory

The inquiries module SHALL additionally provide:

- statuses teostatud and suletud with "Märgi teostatuks" and close row
  actions;
- date-range, county, and free-text filters with the client name masked in
  the table;
- a sisu preview column and an attachments count with a ZIP download;
- a routing confirm modal listing the selected recipients and a capacity
  soft-warning confirm;
- forwarding-log columns Vastanud and Märkus with a järjekorras state;
- partner form fields registrikood (with Äriregister prefill), kontaktisik,
  and märkus; a deactivate reason input;
- a manual e-mail copy fallback when no partner matches;
- the preselect count read from Seaded.

#### Scenario: Close a done request

- **WHEN** the operator marks a vastatud request as teostatud
- **THEN** the status persists and the row action set updates

#### Scenario: Capacity confirm

- **WHEN** a pre-selected partner's capacity is full
- **THEN** sending requires an explicit confirmation

### Requirement: Contract template manager parity

The contracts module SHALL render templates as a card grid with version
chips, expandable version history, and active/draft pills, and SHALL
provide an editor modal where HTML/TXT template placeholders insert at
the cursor from a clickable chip list, with test render reusing the
existing preview drawer. The existing upload validation, activation, and
DOCX support SHALL not regress.

#### Scenario: Placeholder insert

- **WHEN** the operator clicks a placeholder chip in the editor
- **THEN** the token is inserted at the cursor position of the template
  source

### Requirement: Service request routing parity

The inquiries module SHALL show the 7-day response rule as an info
strip, tint expired requests in the list, and track per-partner responses
(with price and status) in the routing drawer. Existing capacity,
county-coverage, minimal-payload, and forward-log behavior SHALL be
preserved.

#### Scenario: Expired request is visible

- **WHEN** a forwarded request passes the 7-day window without response
- **THEN** its row is tinted and its age is rendered in the danger style

### Requirement: Template source persistence

The system SHALL store editable template source per contract template
version in two nullable columns on `contract_templates`: `source_content`
(TEXT) and `source_format` (TEXT, CHECK-constrained to `'html'` and
`'txt'`). Versions created by the DOCX upload flow SHALL keep both columns
NULL and continue to render through the existing path.

#### Scenario: DOCX-only versions are unaffected

- **WHEN** a contract template version has no stored source
- **THEN** the render falls back to the existing generated HTML path and
  the version row remains valid

### Requirement: Save as new draft version

The admin SHALL save editor source as a NEW inactive `contract_templates`
row (a new version), never by mutating an existing version row. The save
SHALL require the `contracts:write` permission, copy `name`, `type` and
`placeholders` from the head version, store the source content and format,
set `active` to false, suggest the next version string (validated, editable
by the operator), write a `template.draft_save` audit entry, and revalidate
the templates view. Activation of the draft remains the existing explicit
action.

#### Scenario: Operator saves a draft

- **WHEN** an operator with `contracts:write` saves editor source for a
  template
- **THEN** a new inactive version row exists with a bumped version string,
  the stored source, and a `template.draft_save` audit entry, and the
  previously active version is unchanged

#### Scenario: Save is permission-gated

- **WHEN** a session without `contracts:write` calls the save action
- **THEN** the action rejects with the standard Estonian permission error
  and writes nothing

#### Scenario: Version string is validated

- **WHEN** the save action receives a version string that is empty or
  already used by the same template name
- **THEN** the action rejects with a per-field Estonian error and writes
  nothing

### Requirement: Stored source drives renders

`renderTemplate` SHALL use the stored source when present: `html` format
passes through as the HTML content; `txt` format is escaped and wrapped.
The test-render action SHALL render the head version's stored source with
the fixture data set.

#### Scenario: TXT source renders escaped

- **WHEN** a template version stores `txt`-format source
- **THEN** the rendered HTML escapes the source and no raw markup from the
  source reaches the output

#### Scenario: Test render shows the stored source

- **WHEN** the operator opens "Testrender" for a version with stored
  source
- **THEN** the preview renders that source with fixture data instead of
  the generated fallback

