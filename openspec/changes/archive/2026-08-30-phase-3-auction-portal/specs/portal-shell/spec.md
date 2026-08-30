## ADDED Requirements

### Requirement: Public portal chrome
The portal SHALL render a public header on all non-user routes with links
to the marketing site (Metsa müümine, Raieõiguse müümine, Kinnistu müük,
Päringud, Hindamisaktid, Metsateatis, Metsaspetsialistid) and an auth-aware
right side: "Logi sisse" for guests, or a profile chip with menu (Minu
pakkumised, Minu müügid, Minu profiil, Teavitused, Logi välja) for authed
users. A footer SHALL carry help contact and legal links.

#### Scenario: Guest header
- **WHEN** an anonymous user opens `/`
- **THEN** the header shows "Logi sisse" linking to `/login?next=/`

#### Scenario: Authed header
- **WHEN** an authed user opens `/`
- **THEN** the header shows the active profile chip with the user menu

### Requirement: Logged-in Portal Shell
All `/user/*` routes SHALL render inside the Portal Shell: ShellHeader
(portal wordmark, quick search into `/`, notification bell with unread
badge, profile chip with dropdown), collapsible sidebar (Avaleht,
Pakkumised, Müügid, Teavitused, Profiil, Lepingud), breadcrumbs rooted at
"Minu keskkond", and a fixed bottom tab bar on viewports ≤768px with
Lepingud moved into the profile dropdown.

#### Scenario: Bell badge reflects unread count
- **WHEN** the shell mounts and `GET /api/my/notifications?unread=1`
  returns 3 unread items
- **THEN** the bell shows badge 3, and an SSE `notification` event
  increments it

### Requirement: Portal session helpers
Portal pages SHALL obtain auth state only through the portal session
helpers. Anonymous access to an authed page SHALL redirect to
`/login?next=<current path>`. All profile-scoped reads SHALL resolve the
active profile from the session.

#### Scenario: Anonymous user blocked from customer area
- **WHEN** a guest opens `/user/bids`
- **THEN** the request redirects to `/login?next=/user/bids`

### Requirement: SSE client hooks
The portal SHALL consume SSE only through two shared hooks: an auction
stream hook (`bid:created`, `auction:extended`, `auction:ended`,
`auction:published`) and a personal stream hook (`bid`, `outbid`,
`auction_end`, `notification`, `countdown_sync`). Both SHALL reconnect with
exponential backoff and trigger a full refetch of the current view on
reconnect.

#### Scenario: Reconnect after connection loss
- **WHEN** the SSE connection drops and reconnects
- **THEN** the hook refetches the current page data and renders fresh
  state without a manual reload
