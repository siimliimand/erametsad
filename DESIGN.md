---
# Design tokens - Erametsad

colors:
  primary: "#012d1d"
  primary-hover: "#1b4332"
  primary-dark: "#16382A"
  primary-light: "#c1ecd4"
  accent: "#58B368"
  cta: "#F2A93B"
  cta-hover: "#D98F1F"
  ink: "#181a2e"
  ink-muted: "#414844"
  ink-inverse: "#FFFFFF"
  bg-page: "#fbf8ff"
  bg-mist: "#f4f2ff"
  border: "#c1c8c2"
  danger: "#B3261E"
  danger-light: "#FBEAE9"
  info: "#2D6FA8"
  info-light: "#E9F1F7"
  status-active: "#2E9E5B"
  status-ending-soon: "#F2A93B"
  status-critical: "#B3261E"
  status-ended: "#6B7570"
  status-draft: "#9E9E9E"
  status-scheduled: "#2D6FA8"

typography:
  font-heading: Public Sans
  font-body: Inter
  font-mono: JetBrains Mono
  heading-weights: [600, 700]
  body-weights: [400, 500, 600]
  mono-weights: [400, 500]
  scale:
    h1: { size: 48, line-height: 1.15 }
    h2: { size: 36, line-height: 1.2 }
    h3: { size: 24, line-height: 1.25 }
    h4: { size: 18, line-height: 1.35 }
    body: { size: 16, line-height: 1.6 }
    body-sm: { size: 14, line-height: 1.5 }
    label: { size: 13, line-height: 1.4 }
    count: { size: 32, line-height: 1.1 }

spacing:
  space-2xs: 4
  space-xs: 8
  space-sm: 12
  space-md: 24
  space-lg: 40
  space-xl: 64
  space-2xl: 96
  space-3xl: 128

layout:
  grid-columns: 12
  container-max: 1200
  gutter: 24
  content-narrow: 720
  sidebar: 280

radii:
  card: 14
  button: 10
  input: 10
  hero: 12
  modal: 16
  pill: 9999

elevation:
  card-shadow: "0 2px 12px rgba(22,56,42,.08)"
  card-hover-shadow: "0 2px 8px rgba(22,56,42,.12), 0 8px 24px rgba(22,56,42,.08)"
  modal-shadow: "0 4px 16px rgba(22,56,42,.12), 0 16px 48px rgba(22,56,42,.10)"

motion:
  hover: { duration: 150, easing: ease-out }
  reveal: { duration: 300, easing: cubic-bezier(.22,.61,.36,1) }
  dropdown: { duration: 200, easing: cubic-bezier(.4,0,.2,1) }
  modal-entry: { duration: 200, easing: cubic-bezier(0,0,.2,1) }
  toast: { duration: 300, easing: cubic-bezier(.22,.61,.36,1) }
  page-transition: { duration: 250, easing: cubic-bezier(.4,0,.2,1) }
  countdown-pulse: { duration: 80, easing: ease }
  anti-snipe-extend: { duration: 500, easing: cubic-bezier(.22,.61,.36,1) }

# Admin scope: the (admin) route group redefines tokens under the
# `.admin-scope` class (apps/platform/src/app/(admin)/admin.css). Root
# defaults above are unchanged outside the admin shell.
admin-scope:
  body: { size: 14, line-height: 20 }
  table-text: { size: 13, line-height: 18 }
  label: { size: 12, line-height: 16 }
  radii: { card: 8, button: 8, input: 8 }
  container-xl: 1400
  spacing: { md: 16, lg: 24 }
  extras: "status triads (--st-*), tints (--tint-primary, --tint-primary-strong), shadows, --rail-w 56, --topbar-h 64, --overlay, --z-scale (topbar 90, drawer 140, modal 150, toast 160), keyframes cd-blink/row-flash/live-pulse/save-ping/modal-in"

# Portal scope: the (portal) route group redefines color tokens under the
# `.portal-scope` class (apps/platform/src/app/(portal)/portal.css). Root
# defaults above are unchanged outside the portal shell.
portal-scope:
  primary: "#2E6B4F"
  primary-hover: "#25573F"
  primary-light: "#E9F0EC"
  bg-page: "#FFFFFF"
  bg-mist: "#F1F5F2"
  ink: "#1B211D"
  ink-muted: "#6B7570"
  border: "#E3E7E4"
  font-heading: "Manrope 700/800 (next/font, --font-manrope)"

hero-overlay: "linear-gradient(90deg, rgba(22,56,42,.85), rgba(22,56,42,.35))"
---

# Erametsad design system

Erametsad is an Estonian forest-transaction platform: a marketing site, an auction portal, and an admin backend. The backend runs on Cloudflare Workers (via OpenNext) with Cloudflare D1 for storage and Durable Objects for bid serialization. The design keeps the Estonian forest as its visual anchor and pairs it with a pale, lavender-tinted paper surface. The look is calm, genuine, and trustworthy. Nothing is hidden. Fees are stated upfront. Consent checkboxes are visible and unchecked.

## Design principles

The system follows five principles. Calm, not cluttered: generous white space, one clear call to action per block. Estonian, authentic: real woodland photography, unfiltered texture, natural light. Trustworthy: everything visible, no surprises. Fast: server-rendered first paint, progressive enhancement, zero layout shift. Accessible: WCAG 2.1 AA from day one.

## Colour

The palette keeps its forest roots and gains a pale lavender surface. Primary is a deep, near-black spruce green (`#012d1d`). It covers buttons, links, active tab markers, and the card call to action. The hover step is `#1b4332`. The dark variant (`#16382A`) still covers hero overlays and footers. The light variant (`#c1ecd4`) is a soft mint that fills count pills and selected states.

Surfaces are pale and warm. The page background is a lavender-tinted paper (`#fbf8ff`). Section alternates use a lighter mist tone (`#f4f2ff`). Borders use grey-green `#c1c8c2`. Body text is a blue-black ink (`#181a2e`), and muted text is `#414844`. Both pass WCAG AA on the paper surface.

The CTA amber (`#F2A93B`) and the accent green (`#58B368`) keep their roles: main actions, price highlights, and success states. Danger red (`#B3261E`) and info blue (`#2D6FA8`) keep their light background pairs. The status pill set is unchanged: active green, amber for auctions ending within an hour, red for five minutes or less, grey for ended and draft, blue for scheduled. The admin extends this set with the unified `StatusChip` families described in the admin section below.

## Typography

Three font families serve different roles. Public Sans carries headings at weights 600 and 700. It loads through `next/font` as `--font-heading` and sets a sturdy, neutral tone at large sizes. Inter stays the body and UI face at weights 400, 500, and 600, with full Estonian diacritic support. JetBrains Mono at weights 400 and 500 serves price figures, countdowns, and KPI numbers. It uses tabular number alignment, so digits line up in columns.

The scale is unchanged. H1 runs at 48 pixels with a 1.15 line-height, H2 at 36, H3 at 24, and H4 at 18. Body text runs at 16 pixels with a 1.6 line-height. Labels use 13 pixels with a tighter line-height. Status digits and KPI numbers use a separate 32-pixel size in JetBrains Mono. Card prices use the mono face with tabular figures.

## Spacing and layout

A 12-column CSS grid with a 1200-pixel max container and 24-pixel gutters governs all layouts. Sections alternate between 64-pixel and 96-pixel padding on desktop, stepping down one level on mobile.

Card padding uses 24 pixels as the standard unit. Large section gaps reach 128 pixels between major blocks. A narrow content track of 720 pixels is reserved for long-form articles and FAQ answers.

The portal listing page splits the container at `lg`. The filter aside takes 3 columns and the main column takes 9. The main column stacks the heading, tabs, map, results bar, a two-column card grid, and pagination. Below `lg` everything stacks in one column, and the filters collapse behind a disclosure.

## Components

Every component is built once and shared across all three sites.

Core interactive components include `Btn` in three styles (solid primary green, solid CTA amber, outline and ghost) and three sizes (48, 40, and 32 pixels). Buttons use a full pill radius. `Card` has 8-pixel corners with an optional shadow and a hover lift effect.

`LotCard` has two presentations. The enhanced listing card shows the photo with two overlays: an object-type badge at the top left and a countdown pill at the top right. Under the title sits a two-by-two metadata grid with a Lucide icon per cell: `MapPin` for the parish and county, `Ruler` for the area in hectares, `Trees` for the species list, and `Package` for the volume in cubic metres. Cells without data collapse. A divider separates the Alghind (or archive Lõpphind) price block from a "Vaata lähemalt" pill. The whole card is one link, and the call to action is a styled span inside it, so no nested interactive elements appear. Without the optional props the card renders the minimal presentation, which `AuctionTicker` and `ArchiveCard` still use.

The listing filters live in a sidebar aside on desktop. They keep chip selects for species (Puuliik) and logging type (Raieliik), range sliders for area (Pindala) and price (Hind), a Raietähtaeg (aasta) select whose options are the cut-deadline years found in the active set (the current-year window when none are stored), and the "Telli teavitus" and "Tühjenda" actions. The Maht (m³) range left the panel with the demo parity change, and legacy `volumeMin`/`volumeMax` URL parameters still apply server-side. The sort control moved to the results bar. On mobile the filters collapse behind a disclosure above the map.

A slim server-rendered results bar sits above the card grid. It shows the found count as "Leitud N oksjonit" with Estonian pluralization, next to a "Sorteeri" select. The select posts the same `sort` and `order` URL parameters the filter panel used, so shared links keep working.

`MapEstonia` wraps Leaflet with Maa-amet orthophoto tiles and county GeoJSON overlays. On the listing page the map is a toggle: the toolbar's Kaardivaade and Loendivaade pair switches between the pin map and the card grid, and `view=kaart` (legacy `view=kart` still parses) selects the map view in the URL. The map runs 400 pixels tall at desktop and about 240 pixels on mobile, with a demo popup card showing Pindala, Alghind, Katastritunnus, Aega jäänud, and a "Vaata" action. Clustering stays as built.

`Countdown` synchronises with the server and uses the status colour phases: neutral, amber below one hour, red below five minutes, with optional pulse. The listing tabs row holds six tabs: Kõik objektid, Raieõigused, Metskinnistud, Põllumaad, Paketid, and Kiiroksjonid. Kõik objektid comes first and is the default view, under the heading "Aktiivsed oksjonid". Each tab carries a live count pill. Põllumaad lists auctions of the `pollumaa` object type.

The bidding panel (`BidPanel`) handles step-based and sealed input, auto-bidder toggle, and under-bid mode. `DataTable` renders inside the admin demo card treatment (white card with mist header row and 13px/18px cells) and takes optional per-column sort descriptors that render `aria-sort` header links; non-sortable columns render plain. `Accordion`, `Tabs`, `Steps`, `EmptyState`, `Toast`, `Modal`, and `Drawer` cover the usual interaction patterns on the marketing site and portal. The admin ships its own overlay and feedback set under `(admin)/_components/ui/`, described in the admin section below.

Form components use floating labels, inline errors, and hint text. `ConsentCheck` is always visible and always unchecked. `LeadForm` includes honeypot fields. `FormFile` supports drag-and-drop uploads with progress indication.

Content components include `SpecialistCard`, `AuctionTicker` (a smooth-scrolling row of lot cards), `ContactBand` in the pre-footer, `CookieBanner` with three-button choice, `Testimonial`, `ArticleCard`, `SubsidyCard`, and `DocumentLink`.

## Admin design system

The admin redefines tokens under `.admin-scope` in `apps/platform/src/app/(admin)/admin.css`: 14/20 body text, 13/18 table text, 12/16 labels, 8-pixel radii, a 1400-pixel container, an overlay token, and a z-scale. Shared primitives live in `(admin)/_components/ui/`, and every admin page builds from them.

The chrome is a 56px icon rail with hover and focus tooltips plus a sticky 64px topbar. Rail icons carry pending markers fed by server counts: an amber dot for unhandled work, a red count pill capped at "99+" for urgent queues. The topbar search opens the Cmd/Ctrl+K route palette, grouped by module; the auctions list also listens for Cmd/Ctrl+N to start a new auction.

Overlays come in two shapes. `Modal` centers a dialog at 480 pixels (sm, confirmations) or 720 pixels (lg, previews and editors). `Drawer` slides in from the right at 460 (sm, lead cards), 560 (md, service requests and CMS versions), 680 (lg, audit detail), or 720 pixels (xl, user detail). Below 768px the drawer goes full-width; the modal fills the viewport minus its 16-pixel gutters. Every overlay traps Tab focus, closes on Esc and backdrop click, locks body scroll, and restores focus on close. The z-scale (drawer 140, modal 150, toast 160) lets a modal stack above an open drawer.

Feedback uses one toast pattern: a dark ink card with a 3px tone stripe (green success, red error, blue info), bottom-center, at most three visible, auto-dismissed after 3600 ms unless overridden. A toast can carry a secondary subline (the audit note under save confirmations) and a one-shot save-ping dot. Destructive actions confirm through `ConfirmDialog` in one of two guards: a required reason of at least 5 characters ("Põhjus on kohustuslik (vähemalt 5 tähemärki).") or a typed keyword matched case-insensitively (HOOLDUS turns on maintenance mode). The confirm button stays disabled until the guard passes.

Status rendering is one `StatusChip` pill set. The auction lifecycle (draft, scheduled, active, ending, ended, unsold, contract, completed, archived, appraised) uses bare names. Absorbed domains use prefixed variants: `user:active/suspended/banned`, `contract:prepared/sent/signed/voided`, `lead:new/contacted/qualified/contract/disqualified`, `content:draft/published`, and `company:pending/approved/rejected/held`. Colors come from the `--st-*` triads. Contract states render glyphs (◻ ▣ ✓ ✕) in place of the dot; the other states keep a 6-pixel dot.

KPI strips use `KpiCard`: a muted label, a 32-pixel JetBrains Mono value with tabular alignment, an optional amber alert badge beside the value, an optional sub line, an optional link wrapper, and a danger flag that turns the value red. Supporting primitives are `Switch`, `TabBar` (pill tabs with counts and roving tabindex), `FilterChip`, and `EmptyRow`.

Admin motion stays subtle and purposeful. `admin.css` defines the keyframes the primitives reference: cd-blink (critical countdown blink), row-flash, live-pulse, save-ping, and modal-in. Overlay entry animates in 180 to 200 ms, and the drawer slide uses the 200 ms dropdown curve. The ceremony reveal honors `prefers-reduced-motion` with a plain, unstaggered fallback.

## Portal design tokens

The portal redefines tokens under `.portal-scope` in `apps/platform/src/app/(portal)/portal.css`, and `(portal)/layout.tsx` renders that class on its root element. The overrides change the shared color variables from `packages/ui/src/styles/tokens.css` inside the `(portal)` route group only. Marketing and admin keep the root defaults, and the layering follows the same pattern the admin uses with `.admin-scope`. The Colour and Typography sections above describe those shared defaults.

The portal palette replaces eight values. Primary relaxes to a leaf green (`#2E6B4F`) with hover `#25573F` and light `#E9F0EC`. The page surface turns white and the mist band warms to `#F1F5F2`. Ink deepens to `#1B211D`, muted text lifts to `#6B7570`, and borders lighten to `#E3E7E4`. Accent, CTA amber, danger, info, status colours, radii, and shadows stay shared with the root tokens.

Headings render in Manrope at weights 700 and 800. The portal layout loads the face through `next/font` as `--font-manrope`, and `portal.css` points `--font-heading` at it inside the scope. The files stay self-hosted, so the CSP gains no hosts. Inter remains the body face and JetBrains Mono keeps prices and countdown digits.

The shared `Countdown` gains a `format="portal"` preset that renders `2p HH:MM:SS` and swaps to a "Lõpeb varsti" pill in the final hour. The default output is unchanged, so admin and marketing render as before. Lucide stays the icon set; every demo icon maps to a Lucide equivalent.

## Motion

Motion is kept subtle. Hover transitions run 150 milliseconds with ease-out. Element reveals on scroll run 300 milliseconds with a custom cubic bezier. Dropdowns and accordions use 200 milliseconds. Modal entries fade in and scale slightly over 200 milliseconds. Countdown digits pulse at 80 milliseconds when below one hour. An anti-snipe extension flashes the timer green over 500 milliseconds.

All animations respect `prefers-reduced-motion`. No motion occurs without a functional purpose.

## Imagery

Photography is the emotional anchor. Every image shows real Estonian forest: birch and spruce stands, morning mist, snow, bark texture, field work. No generic stock photography, no tropical or urban imagery.

Hero images use a 16-to-10 aspect ratio with a left-to-right gradient overlay. Cards use the same ratio for thumbnails and a 4-to-3 ratio for portrait photos. All images carry descriptive alt text in Estonian; the media library enforces this at upload and edit, so an image cannot save without alt text. Image assets can store a focal point (normalized 0-1 coordinates) so crops keep the intended subject in view.

The hero overlay is a linear gradient from dark green transparency on the left to transparent on the right. Section images use no filter and keep natural colour, slightly desaturated by about five percent.

## Icons

Lucide React is the only icon set. Key icons map to product concepts: `TreePine` for cutting rights, `MapPinHouse` for properties, `Wheat` for fields, `Zap` for quick auctions. The lot card metadata grid adds four mappings: `MapPin` for location, `Ruler` for area, `Trees` for species, and `Package` for volume. Social media icons use brand SVGs. No icon font is loaded, so the CSP gains no new hosts.

## Mockup deviations

The demo mockups in `docs/design/demo/portal/` are the design baseline for the auction portal. Every portal page matches its demo page in tokens and layout. The five deviations recorded earlier came from an older mockup round and no longer apply. One deviation group remains: working features the static mockups lack.

Functional deviations, kept on purpose and styled in the demo design language:

- Open auctions restate the bid amount in a confirm modal before the API call. The demo submits directly.
- The user menu keeps the profile switcher entries (active profile marked) beside the navigation items.
- The "Teavitused" menu item carries an unread badge.
- The sealed-bid panel renders the identity snapshot fields (name, isikukood, address, email, phone) above the amount form.
- The open bid panel keeps the alapakkumine toggle; the demo has no equivalent.
- The notifications page keeps a third panel, Otsingute tellimused (saved searches), below the demo's two panels.
- The free-text `q` filter keeps working as a URL parameter. The visible search box went with the old shell header, and the demo has no search UI.
- Registration keeps its functional 4-step flow (Tuvastus, Profiili tüüp, Andmed ja nõusolekud, Valmis) under the demo step-bar visuals. The demo shows 3 steps.
- The Jälgi meid footer column reads its links from the settings social keys (`social.facebook_url`, `social.instagram_url`, `social.youtube_url`) and hides the whole column when none are set. The demo hardcodes the targets.

## Brand voice

The voice in Estonian follows four traits: clear (short sentences, no jargon), honest (fees upfront, no hidden conditions), matter-of-fact (friendly but not chatty), and human (real names, real phone numbers, the tone of a trusted forester).

<!-- Last updated: 2026-09-11 -->
