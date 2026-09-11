## MODIFIED Requirements

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
banner. The social links SHALL come from the settings keys
`social.facebook_url`, `social.instagram_url`, and
`social.youtube_url`; an unset URL SHALL drop its icon, and the
"Jälgi meid" column SHALL render only when at least one URL is set, so
the footer never shows fabricated targets. The portal SHALL render a
cookie banner on first visit with the demo copy ("Kasutame küpsiseid."
plus the explanation) and three actions: "Nõustun kõigiga", "Ainult
vajalikud", and "Sätete muutmine". Each choice SHALL persist to the
`erametsad_consent` cookie and POST to `/api/v1/consent`.

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

#### Scenario: Social links come from settings
- **WHEN** only `social.facebook_url` is set in settings
- **THEN** the "Jälgi meid" column shows the Facebook icon only, and
  Instagram and YouTube icons are absent

#### Scenario: Social column hides when all unset
- **WHEN** all three social settings keys are empty
- **THEN** the footer renders three link columns and no "Jälgi meid"
  column

#### Scenario: Cookie consent persists
- **WHEN** the visitor clicks "Ainult vajalikud" in the cookie banner
- **THEN** the banner hides, `erametsad_consent` stores the choice, and
  `POST /api/v1/consent` logs it

#### Scenario: Küpsisesätted reopens the banner
- **WHEN** the user clicks "Küpsisesätted" in the footer
- **THEN** the cookie banner reopens
