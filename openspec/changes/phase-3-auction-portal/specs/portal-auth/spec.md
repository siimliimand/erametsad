## ADDED Requirements

### Requirement: Login page with eID method cards
`/login` SHALL offer three eID method cards (Smart-ID, Mobiil-ID, ID-kaart)
driving the demo simulator endpoints (`start`/`status`/`complete`), plus an
isikukood + password fallback form. The page SHALL honor `?next=` with
same-origin validation and redirect to `/select-profile?next=` when the
user has multiple profiles. eID pending state SHALL show the control code
with cancel; expired and rejected states SHALL offer restart.

#### Scenario: Smart-ID login completes
- **WHEN** the user picks Smart-ID, enters a demo isikukood, and confirms
  in the simulator
- **THEN** polling observes `completed`, the session cookie is set, and
  the browser redirects to `next`

#### Scenario: Wrong password yields neutral error
- **WHEN** the fallback form is submitted with wrong credentials
- **THEN** the error copy does not reveal which field was wrong

#### Scenario: Suspended account banner
- **WHEN** a suspended user logs in
- **THEN** the page shows "Sinu konto on peatatud" contact banner instead
  of entering the portal

### Requirement: Registration wizard
`/register` SHALL implement 4 steps: eID identify (or email + isikukood
token fallback), profile type (Eraisik, or Ettevõte with 8-digit
registrikood lookup), contact data with 3 consent checkboxes
(2 required, timestamps stored), and a done screen. A company already
registered SHALL route to the access-request dead-end pending screen.
Existing eID accounts SHALL short-circuit to login. `next` SHALL survive
the whole flow.

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
`/update-password` (authed change or eID-user first-password set),
`/reset-password` (neutral request copy, no account enumeration), and
`/reset-password/:token` (valid/used/expired/invalid states) SHALL enforce
the password rules: minimum 10 characters, one uppercase, one number, one
symbol, not equal to the isikukood. A live strength meter SHALL gate submit
until at least "Kesine". Successful reset SHALL revoke all other sessions.

#### Scenario: Reset token expired
- **WHEN** the user opens a reset link older than 2 hours
- **THEN** the page shows the expired state with a link to request a new one

#### Scenario: Reset revokes other sessions
- **WHEN** a reset completes
- **THEN** all other sessions of that user are invalidated and the UI
  notes it
