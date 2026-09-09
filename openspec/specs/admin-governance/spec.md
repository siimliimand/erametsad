# admin-governance Specification

## Purpose
TBD - created by archiving change phase-5-admin-backend. Update Purpose after archive.
## Requirements
### Requirement: Audit log viewer

The audit viewer SHALL additionally provide:

- a Põhjus column in the table;
- reason, session id, IP hash, and user-agent family in the detail drawer;
- millisecond timestamps in Europe/Tallinn;
- per-action Estonian human labels as the action tooltip;
- entity links out to the owning module;
- the retention notice "Säilitamine: 7 aastat";
- a filtered-CSV export button, superadmin-only.

#### Scenario: Reason shown

- **WHEN** a settings change was saved with a reason
- **THEN** the reason appears in the table column and the drawer

#### Scenario: Export restricted

- **WHEN** an admin (not superadmin) opens the audit page
- **THEN** the export button is not rendered and the export routes reject

### Requirement: Settings with audited saves

Settings SHALL additionally provide:

- Üldandmed: KMKR number, support e-mail, support phone, alias domain;
- Teenustasud: kiiroksjoni fee override, minimum fee, and a live sample
  calculation; the default fee validated as 0-10 percent;
- Oksjonireeglid: global autobidder toggle and minimum auction duration;
- Lipud: named binary toggles (sealed_bids, sms_notifications, map_view,
  quick_auction, saved_search_digests, statistics_public, partner_portal)
  instead of a JSON textarea.

All saves keep the mandatory written reason and audit diff.

#### Scenario: Fee bound enforced

- **WHEN** the operator saves a default fee of 55 percent
- **THEN** the save is rejected with the range error

#### Scenario: Flag toggle

- **WHEN** the operator disables the sms_notifications flag
- **THEN** the named toggle persists and the audit entry records the change

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

Maintenance SHALL additionally support scheduled windows (start, end, scope,
creator, note) rendered as an "aknad" table, and a conflict checker that
blocks saving a window in which any auction ends, with a force-confirm
escape.

#### Scenario: Conflict blocks save

- **WHEN** the operator saves a window containing an auction end time
- **THEN** the save is blocked and the conflicting auctions are listed

### Requirement: Integration key display

Integration cards SHALL cover Smart-ID/eID Easy, e-mail, Äriregister, SMS,
and the map server; each card SHALL offer a "Testi ühendust" action with the
last-check timestamp and result, and a write-only rotation field.

#### Scenario: Connection test

- **WHEN** the operator tests an integration
- **THEN** the card shows OK with latency or the failure reason and the last
  check time

### Requirement: Hash-chained audit log

Audit entries SHALL additionally carry reason, sessionId, ipHash (salted),
and userAgent columns. The hash chain SHALL continue to verify entries
written before the columns existed.

#### Scenario: Mixed-era chain verifies

- **WHEN** the nightly integrity check runs over a chain containing
  pre-migration and post-migration rows
- **THEN** verification reports OK

### Requirement: Audit detail drawer and exports

The audit page SHALL open a 680px detail drawer with the entry payload
as JSON, the structured before/after diff, related entries, and a result
chip, and SHALL offer CSV and JSON exports scoped exactly like list
reads (admins see only their own actions; superadmins see all).

#### Scenario: Export respects scope

- **WHEN** an admin without superadmin exports the log
- **THEN** the export contains only that admin's entries

### Requirement: Notification templates

Seaded SHALL provide a Teavitused section backed by a notification-templates
store (event, channel, subject, body, version, active, updatedBy) with a
template list, an editor with a variable inserter, a test send, version
history with restore, and an SMS character and segment counter. Template
edits SHALL be audit-logged with the mandatory reason.

#### Scenario: Test send

- **WHEN** the operator sends a test of an e-mail template
- **THEN** the send is attempted to the operator's own address and the result
  is shown

### Requirement: Settings access tiers

Admin and superadmin settings access SHALL follow one documented tier model:
either both may write (spec updated) or admin is read-only with a
"Muutmise õigus puudub" banner while superadmin writes (code updated). The
chosen tier SHALL be enforced in permissions.

#### Scenario: Read-only tier

- **WHEN** the read-only tier is chosen and an admin opens Seaded
- **THEN** fields render disabled with the banner naming the superadmin

