# seed-fixtures Specification

## Purpose
TBD - created by archiving change phase-2-core-backend. Update Purpose after archive.
## Requirements
### Requirement: Consent checkboxes in registration
Registration SHALL require three consents (terms, privacy, marketing) with
timestamps and SHALL persist all three with their timestamps on the
created profile for audit.

#### Scenario: Consents stored
- **WHEN** a user registers with all three consents accepted
- **THEN** the stored profile records each consent with its timestamp

#### Scenario: Missing consent rejected
- **WHEN** a registration omits any required consent
- **THEN** the response is HTTP 400

### Requirement: Sealed-bid revision cap
The revision cap SHALL be enforced as: one original plus up to N
revisions (N from Settings), after which further submissions are rejected
with a clear error. Sealed seed fixtures SHALL be created through the
encrypted submission path so amounts are unreadable at rest and the live
opening demo works.

#### Scenario: Seed sealed bids are encrypted
- **WHEN** seed data for a sealed auction is inspected in the database
- **THEN** every sealed bid row has amount 0 and encrypted payloads with
  auth tags

#### Scenario: Cap enforced
- **WHEN** a user submits more than 1 + N sealed bids
- **THEN** the next submission is rejected with the revision-limit error

### Requirement: Password strength and validation
Passwords MUST be at least 10 characters and MUST NOT match the user's
isikukood. The password field SHALL show a strength meter on the
registration and change-password forms. Weak passwords (common patterns)
SHALL be rejected server-side with a 400 error.

#### Scenario: Password matching isikukood rejected
- **WHEN** a user attempts to set a password that is their own isikukood
- **THEN** the request is rejected with an error message

#### Scenario: Strong password accepted
- **WHEN** a user submits a 12-character mixed-class password
- **THEN** the password is accepted and stored hashed

### Requirement: Auction type in seed data
Seed auctions SHALL set `type` (`open`/`sealed`) on every row, with at
least one sealed auction per supported object type in `ended` status
holding encrypted sealed bids ready for the live opening demo. The
Settings seed SHALL enable the framework-contract gate
(`requireFrameworkContract: true`). Seed auctions SHALL carry photos:
the seed run SHALL create `media` rows pointing at the bundled
same-origin assets under `apps/platform/public/seed/lot-photos/` and
SHALL attach 1-3 image entries to each auction's `media` JSON, so the
listing cards and the detail gallery render photos; the asset set SHALL
ship with `ATTRIBUTION.md` crediting the sources. Seed auctions SHALL
carry `deadlines` values (`loggingDeadline`, `removalDeadline`) so the
cut-deadline year column backfills and the dossier deadline rows
render. Seed logging codes SHALL use the canonical uppercase set VR,
HR, SR, LR, RD. The seed SHALL include `pollumaa` auctions in active
and ended states so the Põllumaad tab and the archive Põllumaa chip
have data. The seed SHALL leave the social URL settings keys empty.
`pnpm seed:reset` SHALL run against D1 through the repository layer and
SHALL reproduce the current fixture dataset unchanged.

#### Scenario: Fresh seed supports the sealed demo
- **WHEN** `pnpm seed:reset` completes against a fresh local D1
- **THEN** a sealed auction exists in `ended` status whose bids decrypt
  to the documented demo amounts during the ceremony

#### Scenario: Fresh seed shows photos on the listing
- **WHEN** `pnpm seed:reset` completes and the listing renders
- **THEN** lot cards show forest photos from the bundled assets instead
  of the SVG placeholder

#### Scenario: Fresh seed feeds the Raietähtaeg filter
- **WHEN** the listing renders after `pnpm seed:reset`
- **THEN** the Raietähtaeg select offers the years present in seed
  `loggingDeadline` values and selecting one returns matching auctions

#### Scenario: Fresh seed fills the Põllumaad tab
- **WHEN** the user opens `/?tab=polumaad` after `pnpm seed:reset`
- **THEN** at least one active pollumaa auction is listed

#### Scenario: Seed resets reproducibly
- **WHEN** `pnpm seed:reset` runs twice in a row
- **THEN** the second run wipes and reproduces the same dataset without
  errors

