## ADDED Requirements

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
