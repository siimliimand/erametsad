# admin-governance Specification

## Purpose
TBD - created by archiving change phase-5-admin-backend. Update Purpose after archive.
## Requirements
### Requirement: Audit log viewer

The admin SHALL provide an audit log viewer [S] with filters (actor,
action group, entity type, date range, entity id), server-side
pagination, and a detail drawer showing actor, session, IP hash, the
full before/after JSON as a two-column diff with changed-leaf
highlighting, and the recorded reason. Secret fields (reserve price,
integration keys, isikukood values) SHALL render as `<salajane>`
instead of their values. Superadmin SHALL see all entries; admin SHALL
see their own entries only. The table SHALL have no update or delete
path.

#### Scenario: Diff masks secrets

- **WHEN** an audit entry records a reserve price change
- **THEN** the diff shows `<salajane>` for the value while recording
  that the change happened

#### Scenario: Admin self-view

- **WHEN** an admin opens the audit log
- **THEN** only entries authored by that admin are listed and export is
  unavailable

### Requirement: Settings with audited saves

The settings screen [S] SHALL provide the Üldine, Tasud, Oksjonid, and
Lipud sections. Every save SHALL require a reason and SHALL write a
`settings.change` audit entry with the before/after values (secrets
excluded). The Oksjonid section SHALL control the anti-snipe default
minutes (1-30), the alapakkumine default and decision deadline,
the sealed revision cap, the kiiroksjon duration bounds, and the
sealed-approver role. Fee changes SHALL state that they apply to new
auctions only.

#### Scenario: Save without a reason is rejected

- **WHEN** the operator saves a settings section with an empty reason
- **THEN** the save is rejected and no values change

#### Scenario: Anti-snipe default change

- **WHEN** the anti-snipe default changes from 5 to 10 minutes
- **THEN** existing lots keep their per-lot value and new lots default
  to 10

### Requirement: CMS draft, publish, and scheduled publishing

Content collections SHALL support draft and published states, a draft
preview, and scheduled publishing at a Europe/Tallinn time across
pages, articles, FAQ, testimonials, partner services, legal documents,
and specialists. Publishing SHALL snapshot the published version so
the live site reads only published content. Slug changes on published
documents SHALL offer redirect creation.

#### Scenario: Scheduled publish goes live

- **WHEN** an article is scheduled for a future time
- **THEN** the live site renders it only after that time passes without
  a manual publish

#### Scenario: Draft is invisible to the public site

- **WHEN** a page is saved as a draft
- **THEN** the marketing site continues to render the last published
  version

### Requirement: Settings two-pane layout

The settings module SHALL render as a sticky section nav with six demo
sections (Platvorm, Oksjonite reeglid, Teenustasud, Teenuse päringud,
Integratsioonid, Rollid ja õigused) remapping the existing fields, with
switch controls, save toasts carrying the audit reference, and the
existing mandatory reason on save. The role matrix SHALL be a read-only
view generated from `permissions.ts` with the Superadmin column locked,
because permissions are code-defined.

#### Scenario: Save reports its audit entry

- **WHEN** a settings section is saved
- **THEN** a toast confirms the save and names the audited
  `settings.change` entry

### Requirement: Maintenance mode

Superadmins SHALL toggle maintenance mode from settings. Enabling SHALL
require typing the confirmation word HOOLDUS, SHALL write
`maintenance.start` to the audit log, and SHALL gate public (marketing
and portal) requests behind a maintenance response while staff admin
routes stay accessible. Disabling SHALL audit `maintenance.end`.

#### Scenario: Public is gated, admin is not

- **WHEN** maintenance mode is on
- **THEN** public hosts serve the maintenance response and an
  authenticated staff admin route still loads

### Requirement: Integration key display

The integrations section SHALL render one card per external service with
a masked key value sourced from the environment, a reveal action that
writes a `settings.key_reveal` audit entry before showing the value, and
a connection status indicator.

#### Scenario: Reveal is audited

- **WHEN** an operator reveals an integration key
- **THEN** the audit log gains a `settings.key_reveal` entry with actor
  and reason before the value is rendered

### Requirement: Hash-chained audit log

Every audit entry SHALL be chained: at write time the system SHALL
compute `hash = SHA-256(prevHash || canonical(entry))` and store both
`prevHash` and `hash`. A backfill SHALL chain all existing entries in
chronological order. The audit page SHALL show a chain-verification
indicator ("Ahela kontroll: OK") computed from the stored chain, and any
mismatch SHALL surface as a failure state.

#### Scenario: Tampering is detectable

- **WHEN** an entry is modified or removed outside the write path
- **THEN** chain verification fails for that entry and every entry after
  it

#### Scenario: Backfill is deterministic

- **WHEN** the backfill runs twice over unchanged data
- **THEN** it produces identical hashes

### Requirement: Audit detail drawer and exports

The audit page SHALL open a 680px detail drawer with the entry payload
as JSON, the structured before/after diff, related entries, and a result
chip, and SHALL offer CSV and JSON exports scoped exactly like list
reads (admins see only their own actions; superadmins see all).

#### Scenario: Export respects scope

- **WHEN** an admin without superadmin exports the log
- **THEN** the export contains only that admin's entries

