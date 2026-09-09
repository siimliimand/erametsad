## MODIFIED Requirements

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
