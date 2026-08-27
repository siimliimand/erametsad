# Phase 1 — Design system (`packages/ui`)

## Why

Phase 0 gave us a working repo, Payload CMS scaffold, and a deploy path to
Cloudflare. The app boots but renders a blank page. Before we can build a
single marketing page, auction listing, or admin screen, every component
(buttons, cards, forms, maps, data tables) and every design token (colours,
spacing, typography, motion) that pages reference must exist in `packages/ui`.

Phase 1 produces the complete shared component library. Pages in Phases 2–5
compose from it.

## What Changes

- CSS variable tokens for the full colour palette (including the 6 auction
  status colours), the 8-step spacing scale, radii, shadows, and 8 motion
  durations with easings. All map to Tailwind theme extensions.
- Self-hosted fonts: Manrope (700/800), Inter (400/500/600), and JetBrains
  Mono, subset to `latin-ext` for Estonian diacritics.
- Base accessibility styles: `prefers-reduced-motion`, focus-visible ring,
  skip-link pattern, and a colour-contrast audit (WCAG AA minimum for all
  token pairs).
- 22+ shared React components across four groups:
  - Core: `Btn`, `Card`, `StatusPill`, `Countdown`, `Accordion`, `Tabs`,
    `Modal`, `Drawer`, `Toast`, `EmptyState`, `DataTable`, `Steps`, `ChipNav`
  - Form: `FormInput`, `FormSelect`, `FormCheck`, `ConsentCheck`, `LeadForm`
    (with honeypot and source tracking), `FormRange`, `FormFile`
  - Content: `LotCard`, `AuctionTicker`, `SpecialistCard`, `ContactBand`,
    `Testimonial`, `ArticleCard`, `DocumentLink`, `FilterPanel`, `MapEstonia`
    (Leaflet + Maa-amet WMS + county GeoJSON), sticky TOC/side-nav with
    scroll-spy, `SearchableAccordion`
  - Validators: Estonian phone (`+372…`), isikukood (11-digit checksum),
    registrikood (8 digits), cadastral (`NNNNN:NNN:NNNN`) in `packages/types`
- Styleguide dev route rendering every component with every state (empty,
  loading, error).
- Component unit tests for validators, Countdown timer math, and DataTable
  sorting/pagination.

## Capabilities

### New Capabilities

- `design-system`: CSS tokens, fonts, base styles, core components, form
  components, content components, Estonian validators, styleguide route.

### Modified Capabilities

- `repo-tooling`: `packages/types` gains Estonian validators; `packages/ui`
  fills in from its empty scaffold.

## Impact

- Packages affected: `packages/ui` (component library), `packages/types`
  (validators).
- Mock components become real: currently only `export {}`.
- Drag-through dependency: every page in Phases 2–5 is blocked until the
  components it needs exist. Phase 1 ships 31 tasks.
