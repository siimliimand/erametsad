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
  card: 8
  button: 9999
  input: 8
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

hero-overlay: "linear-gradient(90deg, rgba(22,56,42,.85), rgba(22,56,42,.35))"
---

# Erametsad design system

Erametsad is an Estonian forest-transaction platform: a marketing site, an auction portal, and an admin backend. The backend runs on Cloudflare Workers (via OpenNext) with Cloudflare D1 for storage and Durable Objects for bid serialization. The design keeps the Estonian forest as its visual anchor and pairs it with a pale, lavender-tinted paper surface. The look is calm, genuine, and trustworthy. Nothing is hidden. Fees are stated upfront. Consent checkboxes are visible and unchecked.

## Design principles

The system follows five principles. Calm, not cluttered: generous white space, one clear call to action per block. Estonian, authentic: real woodland photography, unfiltered texture, natural light. Trustworthy: everything visible, no surprises. Fast: server-rendered first paint, progressive enhancement, zero layout shift. Accessible: WCAG 2.1 AA from day one.

## Colour

The palette keeps its forest roots and gains a pale lavender surface. Primary is a deep, near-black spruce green (`#012d1d`). It covers buttons, links, active tab markers, and the card call to action. The hover step is `#1b4332`. The dark variant (`#16382A`) still covers hero overlays and footers. The light variant (`#c1ecd4`) is a soft mint that fills count pills and selected states.

Surfaces are pale and warm. The page background is a lavender-tinted paper (`#fbf8ff`). Section alternates use a lighter mist tone (`#f4f2ff`). Borders use grey-green `#c1c8c2`. Body text is a blue-black ink (`#181a2e`), and muted text is `#414844`. Both pass WCAG AA on the paper surface.

The CTA amber (`#F2A93B`) and the accent green (`#58B368`) keep their roles: main actions, price highlights, and success states. Danger red (`#B3261E`) and info blue (`#2D6FA8`) keep their light background pairs. The status pill set is unchanged: active green, amber for auctions ending within an hour, red for five minutes or less, grey for ended and draft, blue for scheduled.

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

The listing filters live in a sidebar aside on desktop. They keep chip selects for species (Puuliik) and logging type (Raieliik), range sliders for area (Pindala), volume (Maht), and price (Hind), plus the "Telli teavitus" and "Tühjenda" actions. The sort control moved to the results bar. On mobile the filters collapse behind a disclosure above the map.

A slim server-rendered results bar sits above the card grid. It shows the found count as "Leitud N oksjonit" with Estonian pluralization, next to a "Sorteeri" select. The select posts the same `sort` and `order` URL parameters the filter panel used, so shared links keep working.

`MapEstonia` wraps Leaflet with Maa-amet orthophoto tiles and county GeoJSON overlays. On the listing page the map is always visible above the results bar. It runs 400 pixels tall at desktop and about 240 pixels on mobile. Clustering and popups stay as built. The old `?view=kart` parameter still parses but no longer changes the layout.

`Countdown` synchronises with the server and uses the status colour phases: neutral, amber below one hour, red below five minutes, with optional pulse. The listing tabs row holds six tabs: Kõik objektid, Raieõigused, Metskinnistud, Põllumaad, Paketid, and Kiiroksjonid. Kõik objektid comes first and is the default view, under the heading "Aktiivsed oksjonid". Each tab carries a live count pill. Põllumaad renders its empty state until the schema stores its object type.

The bidding panel (`BidPanel`) handles step-based and sealed input, auto-bidder toggle, and under-bid mode. `DataTable` uses 40-pixel rows with sortable and filterable columns. `Accordion`, `Tabs`, `Steps`, `EmptyState`, `Toast`, `Modal`, and `Drawer` cover the usual interaction patterns.

Form components use floating labels, inline errors, and hint text. `ConsentCheck` is always visible and always unchecked. `LeadForm` includes honeypot fields. `FormFile` supports drag-and-drop uploads with progress indication.

Content components include `SpecialistCard`, `AuctionTicker` (a smooth-scrolling row of lot cards), `ContactBand` in the pre-footer, `CookieBanner` with three-button choice, `Testimonial`, `ArticleCard`, `SubsidyCard`, and `DocumentLink`.

## Motion

Motion is kept subtle. Hover transitions run 150 milliseconds with ease-out. Element reveals on scroll run 300 milliseconds with a custom cubic bezier. Dropdowns and accordions use 200 milliseconds. Modal entries fade in and scale slightly over 200 milliseconds. Countdown digits pulse at 80 milliseconds when below one hour. An anti-snipe extension flashes the timer green over 500 milliseconds.

All animations respect `prefers-reduced-motion`. No motion occurs without a functional purpose.

## Imagery

Photography is the emotional anchor. Every image shows real Estonian forest: birch and spruce stands, morning mist, snow, bark texture, field work. No generic stock photography, no tropical or urban imagery.

Hero images use a 16-to-10 aspect ratio with a left-to-right gradient overlay. Cards use the same ratio for thumbnails and a 4-to-3 ratio for portrait photos. All images carry descriptive alt text in Estonian.

The hero overlay is a linear gradient from dark green transparency on the left to transparent on the right. Section images use no filter and keep natural colour, slightly desaturated by about five percent.

## Icons

Lucide React is the only icon set. Key icons map to product concepts: `TreePine` for cutting rights, `MapPinHouse` for properties, `Wheat` for fields, `Zap` for quick auctions. The lot card metadata grid adds four mappings: `MapPin` for location, `Ruler` for area, `Trees` for species, and `Package` for volume. Social media icons use brand SVGs. No icon font is loaded, so the CSP gains no new hosts.

## Mockup deviations

The listing redesign follows the approved mockup with five deliberate deviations.

- Status phases stay live: the countdown runs neutral, turns amber below one hour, and turns red below five minutes. The mockup's static red badge is not used.
- JetBrains Mono stays for prices and countdown digits.
- Volume keeps the unit m³ from the data layer, not the mockup's "tm".
- Lucide stays the icon set. The mockup's Material Symbols map to `MapPin`, `Ruler`, `Trees`, and `Package`.
- The Maht and Raieliik filters stay even though the mockup lacks them.

## Brand voice

The voice in Estonian follows four traits: clear (short sentences, no jargon), honest (fees upfront, no hidden conditions), matter-of-fact (friendly but not chatty), and human (real names, real phone numbers, the tone of a trusted forester).

<!-- Last updated: 2026-08-30 -->
