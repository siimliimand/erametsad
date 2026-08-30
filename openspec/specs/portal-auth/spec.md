# portal-auth Specification

## Purpose
TBD - created by archiving change phase-3-auction-portal. Update Purpose after archive.
## Requirements
### Requirement: Login page with eID method cards
`/login` SHALL offer three eID method cards (Smart-ID, Mobiil-ID, ID-kaart)
driving the demo simulator endpoints (`start`/`status`/`complete`), plus an
isikukood + password fallback form. The page SHALL honor `?next=` with
same-origin validation and redirect to `/select-profile?next=` when the
user has multiple profiles. eID pending state SHALL show the control code
with cancel; expired and rejected states SHALL offer restart. The demo
provider SHALL accept any seeded isikukood, and a suspended account SHALL
produce a distinguishable response that renders the "Sinu konto on
peatatud" banner instead of the neutral error.

#### Scenario: Seeded user completes demo login
- **WHEN** the user enters a seeded isikukood and confirms in the
  simulator
- **THEN** polling observes `completed`, the session cookie is set, and
  the browser redirects to `next`

#### Scenario: Suspended account banner
- **WHEN** a suspended user logs in by password or eID
- **THEN** the page shows "Sinu konto on peatatud" contact banner instead
  of entering the portal

#### Scenario: Wrong password yields neutral error
- **WHEN** the fallback form is submitted with wrong credentials
- **THEN** the error copy does not reveal which field was wrong

### Requirement: Registration wizard
`/register` SHALL implement 4 steps: eID identify (or email + isikukood
fallback), profile type (Eraisik, or Ettevõte with 8-digit registrikood
lookup), contact data (name, phone, address) with 3 consent checkboxes
(2 required, timestamps stored), and a done screen. The wizard SHALL
submit the isikukood and the server SHALL validate its checksum and store
it hashed, so password login by isikukood and future eID matching work.
Registration SHALL issue a session. The done screen SHALL link to
`/update-password?first=1` and to `/lepingud/raamleping`. A company
already registered SHALL route to the access-request dead-end pending
screen. Existing eID accounts SHALL short-circuit to login. `next` SHALL
survive the whole flow.

#### Scenario: Isikukood stored at registration
- **WHEN** a user registers with isikukood 47001010002
- **THEN** the stored account logs in later by that isikukood and
  password

#### Scenario: Done screen leads to first password
- **WHEN** the wizard reaches the done screen
- **THEN** the password link opens the first-set form without asking for
  a current password

#### Scenario: Company access request dead-end
- **WHEN** the entered registrikood matches an already-registered company
- **THEN** the wizard sends the access request and shows the pending
  screen instead of creating a profile

#### Scenario: Required consent blocks submit
- **WHEN** a required consent checkbox is unchecked at step 3
- **THEN** submit is blocked with an inline error on that checkbox

### Requirement: Profile selection page
`/select-profile` SHALL render profile cards (type icon, name, rights
summary, AKTIIVNE marker) as a keyboard-accessible radio group, grey out
pending company profiles as unselectable, offer a "+ Lisa ettevõtte" ghost
card, and auto-redirect when the user has a single profile. Selection SHALL
switch the session's active profile and redirect to `next`.

#### Scenario: Switch to company profile
- **WHEN** the user selects an approved company card and confirms
- **THEN** the session's active profile changes and subsequent pages scope
  to that company

### Requirement: Password pages
The password pages SHALL enforce the password rules: minimum 10 characters,
one uppercase, one number, one symbol, not equal to the isikukood. The
server SHALL enforce all rules on change and reset, not only the client
meter. `/update-password` covers the authed change and the eID-user
first-password set, `/reset-password` uses neutral request copy with no
account enumeration, and `/reset-password/:token` handles the valid, used,
expired, and invalid token states. Reset links SHALL point at
`/reset-password/:token` and tokens SHALL persist in the database with a
2-hour expiry and single use. A live strength meter SHALL gate submit
until at least "Kesine". Successful reset SHALL revoke all other sessions.

#### Scenario: Reset email link resolves
- **WHEN** the reset email is generated
- **THEN** its link opens `/reset-password/:token`, an existing route

#### Scenario: Server rejects weak password
- **WHEN** a password passing the client meter but failing a server rule
  reaches the API
- **THEN** the API rejects it with the specific rule error

#### Scenario: Reset token expired
- **WHEN** the user opens a reset link older than 2 hours
- **THEN** the page shows the expired state with a link to request a new
  one

#### Scenario: Reset revokes other sessions
- **WHEN** a reset completes
- **THEN** all other sessions of that user are invalidated and the UI
  notes it

