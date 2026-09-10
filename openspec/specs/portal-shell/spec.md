# portal-shell Specification

## Purpose
TBD - created by archiving change phase-3-auction-portal. Update Purpose after archive.
## Requirements
### Requirement: Public portal chrome
The portal SHALL render the demo shell on all non-signing routes. The
header SHALL be sticky at 72px and SHALL shrink to 60px with a shadow
after 8px of scroll. It SHALL carry the logo (tree icon plus the
"Erametsad Oksjonid" wordmark) linking to `/`, and the inline nav:
Kõik oksjonid (`/`), Raieõigused (`/?tab=raieoigused`), Metskinnistud
(`/?tab=metskinnistud`), Ajalugu (`/ajalugu`), KKK and Kontakt (both to
the marketing host). The active nav item SHALL carry
`aria-current="page"` with the demo active style. The guest right side
SHALL show the outline button "Logi sisse" (to `/login?next=<path>`) and
the CTA button "Paku oma metsa" (to the marketing host), plus a
hamburger that opens a right-side mobile drawer (360px) with the same
nav and actions. The authed right side SHALL show a user menu: an avatar
circle with the user's initials, the display name, and a dropdown with
Minu pakkumised (`/user/bids`), Minu objektid (`/user/objects`),
Teavitused (`/user/notifications`, with an unread count badge), Minu
profiil (`/user/profile`), a divider, and "Logi välja" in the danger
style; the dropdown SHALL also include the profile switcher entries with
the active profile marked, and selecting one POSTs
`/api/v1/profiles/:id/select` and refreshes the session scope. The
footer SHALL render four link columns (Oksjonid: Raieõigused,
Metskinnistud, Põllumaad, Paketid, Kiiroksjonid; Ajalugu: Lõppenud
oksjonid, Tulemused; Erametsad: Metsa müümine, Hindamisaktid,
Metsateatis, Metsaspetsialistid, KKK; Jälgi meid: Facebook, Instagram,
YouTube) and a bottom bar with "© <year> Erametsad OÜ",
Privaatsuspoliitika, and "Küpsisesätted" which reopens the cookie
banner. The portal SHALL render a cookie banner on first visit with the
demo copy ("Kasutame küpsiseid." plus the explanation) and three
actions: "Nõustun kõigiga", "Ainult vajalikud", and "Sätete muutmine".
Each choice SHALL persist to the `erametsad_consent` cookie and POST to
`/api/v1/consent`.

#### Scenario: Guest header
- **WHEN** an anonymous user opens `/`
- **THEN** the header shows "Logi sisse" and "Paku oma metsa", and the
  nav marks Kõik oksjonid as current

#### Scenario: Authed header with user menu
- **WHEN** an authed user opens `/`
- **THEN** the header shows the avatar initials, the name, and the
  dropdown with the five menu items plus the profile switcher

#### Scenario: Sticky header shrink
- **WHEN** the user scrolls more than 8px
- **THEN** the header shrinks from 72px to 60px and gains a shadow

#### Scenario: Cookie consent persists
- **WHEN** the visitor clicks "Ainult vajalikud" in the cookie banner
- **THEN** the banner hides, `erametsad_consent` stores the choice, and
  `POST /api/v1/consent` logs it

#### Scenario: Küpsisesätted reopens the banner
- **WHEN** the user clicks "Küpsisesätted" in the footer
- **THEN** the cookie banner reopens

### Requirement: Logged-in Portal Shell
All `/user/*` routes SHALL render inside the standard public portal
header (with the authed user menu) and SHALL NOT render the ShellHeader,
the sidebar, or the bottom tab bar. Each user page SHALL render the demo
page head: the crumb line "Minu keskkond / <page name>", the page H1,
and the Estonian summary sentence. Below the head, the user area SHALL
render the tab row Pakkumised (`/user/bids`), Objektid
(`/user/objects`), Teavitused (`/user/notifications`), Profiil
(`/user/profile`) with the active tab marked per route; Lepingud SHALL
stay reachable from the header dropdown and the footer. The unread
count SHALL come from `GET /api/my/notifications?unread=1`, and an SSE
`notification` event SHALL increment it.

#### Scenario: User page uses the public shell
- **WHEN** the user opens `/user/bids`
- **THEN** the page renders the portal header, the "Minu keskkond /
  Minu pakkumised" page head, and the tab row with Pakkumised active,
  and no sidebar or bottom tab bar appears

#### Scenario: Bell badge reflects unread count
- **WHEN** the shell mounts and `GET /api/my/notifications?unread=1`
  returns 3 unread items
- **THEN** the Teavitused item shows badge 3, and an SSE `notification`
  event increments it

#### Scenario: Switch profile from the dropdown
- **WHEN** the user picks another profile in the header dropdown
- **THEN** the active profile changes and the page re-renders scoped to
  it

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

