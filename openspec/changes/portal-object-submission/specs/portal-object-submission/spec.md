## ADDED Requirements

### Requirement: Wizard entry and service selection

The portal SHALL expose the submission wizard at `/user/objects/paku` behind an
authenticated portal session, and the route SHALL be registered in the portal
host allowlist so the portal host serves it. Step 1 SHALL offer five services:
Raieõiguse müük, Kinnistu müük, Metsamajanduskava, Hooldusraie, Metsa
istutamine. The wizard SHALL branch after selection: sale branches collect
location (cadastres, auto-derived county, optional address), object data (area,
species, logging types, optional volume), files, description, and a contact
step prefilled from the active profile; service branches collect the
service-request field set for their type. Every step SHALL validate against the
shared submission schema, and the contact step SHALL let the user correct
prefilled values before submit.

#### Scenario: CTA opens the wizard in-portal

- **WHEN** a logged-in user clicks "Paku oma objekti" on `/user/objects`
- **THEN** the browser navigates to `/user/objects/paku` on the portal host
  without leaving the logged-in area

#### Scenario: Cadastre derives county

- **WHEN** the user enters a valid cadastre number on a sale branch
- **THEN** the county selects itself from the derived code and stays editable

#### Scenario: Contact prefilled from profile

- **WHEN** the user reaches the contact step
- **THEN** name, email, and phone come from the active profile and the user can
  edit them before submit

### Requirement: Sale branch creates an owned draft

A sale submission SHALL create one auction row with `status: 'draft'`,
`seller_id` set to the submitter's user id, `minBidCents` 0 (placeholder),
`objectType` from the branch, and mechanics defaulted by type (kinnistu →
`sealed`, raieõigus → `open`). The submission SHALL generate title, slug, and
alias email server-side, derive county from the first cadastre, and store the
uploaded file keys on the draft. The draft SHALL appear in `/user/objects`
under Mustandid immediately after submit, and the same row SHALL be completable
in the admin auction wizard. The submission SHALL also create a `leads` row
with `source: 'portal'`, the submitter's `user_id`, and a reference to the
auction, routed into the existing Leads kanban.

#### Scenario: Draft visible at once

- **WHEN** the wizard submits a raieõiguse müük sale
- **THEN** `/user/objects?status=draft` lists the new draft under the
  submitter's account with the Mustandid chip

#### Scenario: Kinnistu defaults to sealed

- **WHEN** the wizard submits a kinnistu müük sale
- **THEN** the draft auction row has `type: 'sealed'` and an admin can change
  the mechanics during completion

#### Scenario: Lead lands in the kanban

- **WHEN** a sale submission completes
- **THEN** a `portal`-sourced lead with the submitter's user id and the auction
  reference appears in the Leads kanban assigned to a specialist

### Requirement: Service branch creates a linked request

A service submission (kava, hooldusraie, istutamine) SHALL reuse the service
request pipeline, SHALL stamp `user_id` with the submitter's id, and SHALL obey
the existing validation, consent, rate limits, and single 10 MB file rule. The
request SHALL appear in the admin Päringud queue with the existing routing
behavior.

#### Scenario: Authenticated service submission

- **WHEN** a logged-in user submits a metsamajanduskava request in the wizard
- **THEN** the created service request row carries the user's id and follows
  the same validation and routing as a marketing submission

#### Scenario: Marketing funnel unchanged

- **WHEN** an anonymous visitor submits the marketing LeadForm or service form
- **THEN** the row stores no user id and the existing contracts hold

### Requirement: Ownership and access

The submitter SHALL see their own drafts and lots on `/user/objects` via the
existing `seller_id` scoping, and SHALL be able to use the owner actions on
their own lots (draft preview, review request, relist request, alapakkumine
approve/reject) because those actions key off `seller_id === userId`. The
submitter SHALL NOT gain admin scope, pricing control, or publishing control:
status transitions remain admin/DO driven, and pricing fields stay absent from
the submission schema.

#### Scenario: Owner approves an alapakkumine

- **WHEN** a `private`-role submitter's active lot receives an
  alapakkumine and the submitter approves it in the drawer
- **THEN** the bid becomes leading and the bidder is notified, without any
  admin involvement

#### Scenario: No self-publishing

- **WHEN** the submitter opens their draft
- **THEN** no publish or pricing action exists in the portal, and the publish
  readiness gates still block an incomplete draft

### Requirement: Publish safety for submitted drafts

Publish readiness SHALL reject a draft whose `minBidCents` is 0, so a
submission placeholder can never reach `scheduled`. The existing gates
(specialist assigned, area set, lead time) SHALL continue to apply to submitted
drafts unchanged.

#### Scenario: Placeholder price blocks publish

- **WHEN** an admin tries to publish a submitted draft whose price was never
  set
- **THEN** the readiness gate reports the missing price and the draft stays
  draft

### Requirement: Auto-assignment and notifications

At submission the system SHALL auto-assign a specialist to the created lead and
to the sale draft's `specialistId` using the county round-robin (fewest open
items first, active specialists only), and the assignment SHALL remain
overridable in admin. The system SHALL notify the assigned specialist of the
new submission and SHALL send the submitter a submission-received
confirmation.

#### Scenario: Specialist notified of submission

- **WHEN** a sale submission completes with county round-robin assignment
- **THEN** the assigned specialist receives the new-submission notification and
  the draft lists them as specialist

#### Scenario: Submitter confirmation

- **WHEN** any wizard submission completes
- **THEN** the submitter receives a confirmation notification and the portal
  shows the success state
