## MODIFIED Requirements

### Requirement: Public portal chrome
The portal SHALL render a public header on all non-user routes with links
to the marketing site (Metsa müümine, Raieõiguse müümine, Kinnistu müük,
Päringud, Hindamisaktid, Metsateatis, Metsaspetsialistid), an Ajalugu
link to the archive, and an auth-aware right side: "Logi sisse" plus
"Registreeru" for guests, or a profile chip with menu (Minu pakkumised,
Minu müügid, Minu profiil, Teavitused, Logi välja) for authed users. A
footer SHALL carry help contact and legal links.

#### Scenario: Guest header
- **WHEN** an anonymous user opens `/`
- **THEN** the header shows "Logi sisse" linking to `/login?next=/` and
  "Registreeru" linking to `/register`

#### Scenario: Archive reachable from the header
- **WHEN** any visitor opens the portal
- **THEN** the header offers an Ajalugu link to `/ajalugu`

#### Scenario: Authed header
- **WHEN** an authed user opens `/`
- **THEN** the header shows the active profile chip with the user menu

### Requirement: Logged-in Portal Shell
All `/user/*` routes SHALL render inside the Portal Shell: ShellHeader
(portal wordmark, quick search into `/`, notification bell with unread
badge, profile chip with dropdown), collapsible sidebar (Avaleht,
Pakkumised, Müügid, Teavitused, Profiil, Lepingud), breadcrumbs rooted at
"Minu keskkond", and a fixed bottom tab bar on viewports ≤768px with
Lepingud moved into the profile dropdown. The profile dropdown SHALL
include the profile switcher: the user's profiles with the active one
marked, and selecting one POSTs `/api/v1/profiles/:id/select` and
refreshes the session scope.

#### Scenario: Bell badge reflects unread count
- **WHEN** the shell mounts and `GET /api/my/notifications?unread=1`
  returns 3 unread items
- **THEN** the bell shows badge 3, and an SSE `notification` event
  increments it

#### Scenario: Switch profile from the dropdown
- **WHEN** the user picks another profile in the shell dropdown
- **THEN** the active profile changes and the shell re-renders scoped to
  it
