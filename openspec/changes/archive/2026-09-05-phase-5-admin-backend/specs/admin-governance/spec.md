# admin-governance (delta)

## ADDED Requirements

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
