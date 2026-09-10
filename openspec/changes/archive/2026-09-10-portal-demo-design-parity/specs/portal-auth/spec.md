## MODIFIED Requirements

### Requirement: Login page with eID method cards
`/login` SHALL render the demo centered auth card (maximum 440px): the
H1 "Logi sisse", the intro "Vali turvaline tuvastusmeetod — sama konto
kehtib nii pakkumiseks kui oma metsa müümiseks.", and three eID method
buttons 58px tall: "Smart-ID" (primary, hint "Kiireim viis — kinnita
telefonis PIN1"), "Mobiil-ID" (outline, hint "Kinnituskood saadetakse
SMS-iga"), and "ID-kaart" (outline, hint "Kaardilugejaga, kinnita
arvutis PIN1"). Below the "või" divider SHALL render the fallback form
with "Isikukood" (placeholder "38001010000", 11 digits), "Parool", the
outline submit "Logi sisse parooliga", and the link "Unustasid
salasõna?" to `/reset-password`. The card bottom SHALL show "Pole veel
kasutajat? Loo konto" linking to `/register`. The eID pending view
SHALL show the spinner, the per-method hint, the big mono "Kontrollkood"
with cancel ("Tühista"); expired and rejected states SHALL offer
restart; the success state SHALL show the green check with "Sisselogimine
õnnestus". Under the card SHALL render the privacy line "Turvaline
sisselogimine EU eIDAS tasemega. Isikuandmeid töödeldakse vastavalt
GDPR-ile — vaata privaatsuspoliitikat." and the back link "Tagasi
oksjonitele". The page SHALL honor `?next=` with same-origin validation
and redirect to `/select-profile?next=` when the user has multiple
profiles. The demo provider SHALL accept any seeded isikukood, and a
suspended account SHALL produce a distinguishable response that renders
the "Sinu konto on peatatud" banner instead of the neutral error.

#### Scenario: Seeded user completes demo login
- **WHEN** the user enters a seeded isikukood and confirms in the
  simulator
- **THEN** polling observes `completed`, the session cookie is set, and
  the browser redirects to `next`

#### Scenario: Control code shows while pending
- **WHEN** an eID method starts
- **THEN** the pending view shows the control code in large mono digits
  with a "Tühista" action

#### Scenario: Suspended account banner
- **WHEN** a suspended user logs in by password or eID
- **THEN** the page shows "Sinu konto on peatatud" contact banner instead
  of entering the portal

#### Scenario: Wrong password yields neutral error
- **WHEN** the fallback form is submitted with wrong credentials
- **THEN** the error copy does not reveal which field was wrong

### Requirement: Registration wizard
`/register` SHALL render the demo wizard visual: the mist section with a
centered card (maximum 600px), the H1 "Loo konto" with the sub line "Üks
konto kõigiks Erametsadi oksjoniteks.", and the step bar with numbered
circles and connectors (done steps show a check). The wizard SHALL keep
its functional 4-step structure: eID identify (or email + isikukood
fallback), profile type (Eraisik, or Ettevõte with 8-digit registrikood
lookup), contact data (name, phone, address) with 3 consent checkboxes
(2 required, timestamps stored), and a done screen. Step 1 SHALL keep
the honeypot field visually hidden and the demo validation messages.
The eID step SHALL render the demo eid-card buttons ("Smart-ID"
marked "Soovitatav — kinnitus telefoni või arvuti kaudu", "Mobiil-ID",
"ID-kaart") with the simulator status box and the control code. The done
screen SHALL show the success check, "Konto loodud!", the greeting with
the name, and the note about bidding rights and the framework contract.
The wizard SHALL submit the isikukood and the server SHALL validate its
checksum and store it hashed, so password login by isikukood and future
eID matching work. Registration SHALL issue a session. The done screen
SHALL link to `/update-password?first=1`, to profile selection, and to
`/lepingud/raamleping`. A company already registered SHALL route to the
access-request dead-end pending screen. Existing eID accounts SHALL
short-circuit to login. `next` SHALL survive the whole flow.

#### Scenario: Isikukood stored at registration
- **WHEN** a user registers with isikukood 47001010002
- **THEN** the stored account logs in later by that isikukood and
  password

#### Scenario: Required consent blocks submit
- **WHEN** a required consent checkbox is unchecked at the contact step
- **THEN** submit is blocked with an inline error on that checkbox

#### Scenario: Company access request dead-end
- **WHEN** the entered registrikood matches an already-registered company
- **THEN** the wizard sends the access request and shows the pending
  screen instead of creating a profile

#### Scenario: Done screen leads onward
- **WHEN** the wizard reaches the done screen
- **THEN** the links open the first-set password form and the profile
  selection without asking for a current password

### Requirement: Profile selection page
`/select-profile` SHALL render the demo mist page head (H1 "Vali
profiil", summary "Pakkumised ja lepingud seotakse valitud profiiliga.
Saad hiljem menüüst vahetada.") and the profile cards as a
keyboard-accessible radio group with arrow-key selection. Each card
SHALL show the profile name, the type chip (Eraisik or Ettevõte), the
status pill ("AKTIIVNE" or "Ülevaatamisel"), the sub line (for company
profiles the registry number and the application date), and the rights
check list. A checked card SHALL show the demo selected style (primary
border, primary-light background, filled radio dot). Pending company
profiles SHALL render as dashed disabled cards with the note
"Pakkumiste õigused avanevad pärast kinnitamist." The page SHALL offer
the ghost dashed "Lisa ettevõtte profiil" action, the "Jätka" primary
action, and "Jäta vahele". Selection SHALL switch the session's active
profile and redirect to `next`. The page SHALL auto-redirect when the
user has a single profile.

#### Scenario: Switch to company profile
- **WHEN** the user selects an approved company card and confirms
- **THEN** the session's active profile changes and subsequent pages
  scope to that company

#### Scenario: Pending card is not selectable
- **WHEN** the user tries to select a pending company card
- **THEN** the card stays disabled with its status pill "Ülevaatamisel"

#### Scenario: Keyboard moves the selection
- **WHEN** the user presses the down arrow inside the radio group
- **THEN** the selection moves to the next selectable card

### Requirement: Password pages
The password pages SHALL enforce the password rules: minimum 10
characters, one uppercase, one number, one symbol, not equal to the
isikukood. The server SHALL enforce all rules on change and reset, not
only the client meter. `/update-password` covers the authed change and
the eID-user first-password set and SHALL render the demo card (maximum
480px): the H1 "Parooli muutmine" (or "Määra parool" on first set), the
explainer about other devices being signed out, the info note "eID
(ID-kaart, Mobiil-ID või Smart-ID) on peamine sisselogimisviis — parool
on ainult varuviis.", show/hide eye toggles ("Näita parooli"), the
per-field caps-lock warning "Caps Lock on sees.", the 5-segment strength
meter with the labels "Nõrk" / "Keskmine" / "Tugev", and the rules
checklist ("Vähemalt 10 tähemärki", "Üks suur täht", "Üks number", "Üks
sümbol", "Ei tohi kattuda isikukoodiga") whose items tick green as they
satisfy. Submit SHALL stay disabled until the current password is
present, the strength reaches "Keskmine", and the repeat field matches;
the mismatch error reads "Paroolid ei kattu." Success SHALL render the
demo success view ("Parool on uuendatud") with the masked email
confirmation note. `/reset-password` uses neutral request copy with no
account enumeration, and `/reset-password/:token` handles the valid,
used, expired, and invalid token states, both rendered in the same auth
card language. Reset links SHALL point at `/reset-password/:token` and
tokens SHALL persist in the database with a 2-hour expiry and single
use. Successful reset SHALL revoke all other sessions.

#### Scenario: Strength meter gates submit
- **WHEN** the entered password satisfies fewer than three rules
- **THEN** the meter shows "Nõrk" and submit stays disabled

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
