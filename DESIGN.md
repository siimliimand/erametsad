---
# Design tokens — Eametsad

colors:
  primary: "#2E6B4F"
  primary-hover: "#25573F"
  primary-dark: "#16382A"
  primary-light: "#E9F0EC"
  accent: "#58B368"
  cta: "#F2A93B"
  cta-hover: "#D98F1F"
  ink: "#1B211D"
  ink-muted: "#6B7570"
  ink-inverse: "#FFFFFF"
  bg-page: "#FFFFFF"
  bg-mist: "#F1F5F2"
  border: "#E3E7E4"
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
  font-heading: Manrope
  font-body: Inter
  font-mono: JetBrains Mono
  heading-weights: [700, 800]
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
  container-max: 1280
  gutter: 24
  content-narrow: 720
  content-standard: 1280
  sidebar: 280

radii:
  card: 14
  button: 10
  input: 10
  hero: 16
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

# Eametsad design system

Eametsad is an Estonian forest-transaction platform: a marketing site, an auction portal, and an admin backend. The design uses the Estonian forest as its visual anchor. The look is calm, genuine, and trustworthy. Nothing is hidden. Fees are stated upfront. Consent checkboxes are visible and unchecked.

## Design principles

The system follows five principles. Calm, not cluttered: generous white space, one clear call to action per block. Estonian, authentic: real woodland photography, unfiltered texture, natural light. Trustworthy: everything visible, no surprises. Fast: server-rendered first paint, progressive enhancement, zero layout shift. Accessible: WCAG 2.1 AA from day one.

## Colour

The palette comes from the Estonian forest: spruce green, dark soil, moss, golden birch.

Primary is a muted forest green (`#2E6B4F`). It works for buttons, links, and accent elements. The dark variant (`#16382A`) covers hero overlays and footers. The light variant (`#E9F0EC`) makes subtle section backgrounds and selected states.

The CTA colour is amber (`#F2A93B`). It calls attention to main actions and price highlights. The accent green (`#58B368`) shows success and active states.

Body text uses `#1B211D` instead of pure black. It reads softer on screen. Muted ink (`#6B7570`) works for captions, metadata, and archived items. Danger red (`#B3261E`) and info blue (`#2D6FA8`) have matching light backgrounds for inline status use.

Status pills use a separate set: active green (`#2E9E5B`), amber for auctions ending within an hour, red for five minutes or less, grey for ended and archived, grey for draft, and blue for scheduled.

## Typography

Three font families serve different roles. Manrope for headings: geometric, slightly warm, readable at large sizes. Inter for body and UI: clean, highly legible, with full Estonian diacritic support. JetBrains Mono for price figures, countdowns, and data tables, with tabular number alignment.

H1 uses 800 weight at 48 pixels. H2 uses 700 at 36 pixels. H3 uses 700 at 24 pixels. Body text runs at 16 pixels with generous 1.6 line-height for comfortable reading.

Labels use 13 pixels with tighter line-height. Status digits and KPI numbers use a separate 32-pixel size in JetBrains Mono.

## Spacing and layout

A 12-column CSS grid with a 1280-pixel max container and 24-pixel gutters governs all layouts. Sections alternate between 64-pixel and 96-pixel padding on desktop, stepping down one level on mobile.

Card padding uses 24 pixels as the standard unit. Large section gaps reach 128 pixels between major blocks. A narrow content track of 720 pixels is reserved for long-form articles and FAQ answers.

## Components

Every component is built once and shared across all three sites.

Core interactive components include `Btn` in three styles (solid primary green, solid CTA amber, outline and ghost) and three sizes (48, 40, and 32 pixels). `Card` has rounded corners with an optional shadow and a hover lift effect. `LotCard` is a card variant for auction listings with image, price, countdown, and status.

`FilterPanel` is a collapsible sidebar with chip selects and range sliders. `MapEstonia` wraps Leaflet with Maa-amet orthophoto tiles and county GeoJSON overlays. `Countdown` synchronises with the server and uses the status colour phases: neutral, amber below one hour, red below five minutes, with optional pulse.

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

Lucide React provides the icon set. Key icons map to product concepts: `TreePine` for cutting rights, `MapPinHouse` for properties, `Wheat` for fields, `Zap` for quick auctions. Social media icons use brand SVGs.

## Brand voice

The voice in Estonian follows four traits: clear (short sentences, no jargon), honest (fees upfront, no hidden conditions), matter-of-fact (friendly but not chatty), and human (real names, real phone numbers, the tone of a trusted forester).

<!-- Last updated: 2026-08-27 -->