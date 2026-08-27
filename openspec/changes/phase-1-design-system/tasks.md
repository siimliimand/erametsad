## 1. Tokens & base styles

- [ ] 1.1 CSS variables: full colour palette incl. status colours (Active `#2E9E5B`, Ending `<1h` amber, Critical `<5min` red, Ended `#6B7570`, Draft `#9E9E9E`, Scheduled info-blue), spacing scale, radii, shadows, motion durations/easings <!-- agent: fullstack-engineer.build, depends_on: [], touches: [packages/ui/src/styles/tokens.css] -->
- [ ] 1.2 Tailwind theme mapping; 12-col grid, containers (1280 standard / 720 narrow / 280 sidebar) <!-- agent: fullstack-engineer.build, depends_on: [1.1], touches: [packages/ui/src/styles/tokens.css, apps/platform/tailwind.config.ts] -->
- [ ] 1.3 Fonts: Manrope (700/800 headings, H4 `letter-spacing .02em`), Inter (400/500/600), JetBrains Mono for figures + `font-feature-settings: "tnum"` on prices/countdowns — self-hosted, `latin-ext` <!-- agent: fullstack-engineer.build, depends_on: [1.1], touches: [packages/ui/src/styles/fonts.css, apps/platform/src/app/layout.tsx] -->
- [ ] 1.4 `prefers-reduced-motion` handling, focus-visible styles, skip-link pattern <!-- agent: fullstack-engineer.build, depends_on: [1.1], touches: [packages/ui/src/styles/base.css, packages/ui/src/components/SkipLink.tsx] -->
- [ ] 1.5 Colour-contrast audit of token pairs (WCAG AA) <!-- agent: fullstack-engineer.fast, depends_on: [1.1, 1.2], touches: [packages/ui/src/styles/tokens.css] -->

## 2. Core components

- [ ] 2.1 `Btn` (primary/CTA-amber/outline/ghost; lg 48 / md 40 / sm 32; full-width mobile) <!-- agent: fullstack-engineer.build, depends_on: [1.1, 1.2], touches: [packages/ui/src/components/Btn.tsx] -->
- [ ] 2.2 `Card` (radius 14, hover lift, image/content/action slots) <!-- agent: fullstack-engineer.build, depends_on: [1.1, 1.2], touches: [packages/ui/src/components/Card.tsx] -->
- [ ] 2.3 `StatusPill` (Aktiivne / Lõppenud / Kiiroksjon / Mustand / Plaanitud; shared colour map portal+admin) <!-- agent: fullstack-engineer.build, depends_on: [1.1, 1.2], touches: [packages/ui/src/components/StatusPill.tsx] -->
- [ ] 2.4 `Countdown` — server-synced client component with drift correction; phases neutral → amber `<1h` (pulse) → red `<5min`; "Aega jäänud Xp XXh XXm XXs" format <!-- agent: fullstack-engineer.build, depends_on: [1.1, 1.2, 2.3], touches: [packages/ui/src/components/Countdown.tsx] -->
- [ ] 2.5 `Accordion` (two variants: single-open FAQ, multi-open process with full keyboard/ARIA) <!-- agent: fullstack-engineer.build, depends_on: [1.1, 1.2], touches: [packages/ui/src/components/Accordion.tsx] -->
- [ ] 2.6 `Tabs` (counter badges, underline indicator, responsive overflow) <!-- agent: fullstack-engineer.build, depends_on: [1.1, 1.2], touches: [packages/ui/src/components/Tabs.tsx] -->
- [ ] 2.7 `Modal` (focus trap, Esc, backdrop), `Drawer` (right slide, mobile nav/filters/detail), `Toast`, `EmptyState` <!-- agent: fullstack-engineer.build, depends_on: [1.1, 1.2, 2.1], touches: [packages/ui/src/components/Modal.tsx, packages/ui/src/components/Drawer.tsx, packages/ui/src/components/Toast.tsx, packages/ui/src/components/EmptyState.tsx] -->
- [ ] 2.8 `DataTable` (sortable, server-paginated, 40px rows, URL-encoded filters) <!-- agent: fullstack-engineer.build, depends_on: [1.1, 1.2], touches: [packages/ui/src/components/DataTable.tsx] -->
- [ ] 2.9 `Steps` (numbered, vertical/horizontal, emphasis variant) <!-- agent: fullstack-engineer.build, depends_on: [1.1, 1.2], touches: [packages/ui/src/components/Steps.tsx] -->
- [ ] 2.10 `ChipNav` <!-- agent: fullstack-engineer.build, depends_on: [1.1, 1.2], touches: [packages/ui/src/components/ChipNav.tsx] -->

## 3. Form components

- [ ] 3.1 `FormInput` / `FormSelect` / `FormCheck` (floating label, inline error, hint) <!-- agent: fullstack-engineer.build, depends_on: [1.1, 1.2], touches: [packages/ui/src/components/form/FormInput.tsx, packages/ui/src/components/form/FormSelect.tsx, packages/ui/src/components/form/FormCheck.tsx] -->
- [ ] 3.2 `ConsentCheck` — always visible, never pre-checked, required <!-- agent: fullstack-engineer.build, depends_on: [3.1], touches: [packages/ui/src/components/form/ConsentCheck.tsx] -->
- [ ] 3.3 `LeadForm` — name/phone(EE)/email/cadastre(optional)/consent/honeypot `company_website` + hidden `form_name` = `<slug>-<occurrence>`; submits `POST /api/leads`; locked button while sending; Toast success <!-- agent: fullstack-engineer.build, depends_on: [3.1, 3.2, 2.1, 2.7], touches: [packages/ui/src/components/form/LeadForm.tsx] -->
- [ ] 3.4 `FormRange` (min–max sliders + numeric inputs) <!-- agent: fullstack-engineer.build, depends_on: [1.1, 1.2], touches: [packages/ui/src/components/form/FormRange.tsx] -->
- [ ] 3.5 `FormFile` (drag-drop, type/size validation, progress) — needed by hooldusraie form [S] <!-- agent: fullstack-engineer.build, depends_on: [1.1, 1.2], touches: [packages/ui/src/components/form/FormFile.tsx] -->
- [ ] 3.6 Estonian validators in `packages/types`: phone `+372…`, isikukood (11-digit checksum), registrikood (8), cadastral `NNNNN:NNN:NNNN` <!-- agent: fullstack-engineer.build, depends_on: [], touches: [packages/types/src/validators.ts] -->

## 4. Content components

- [ ] 4.1 `LotCard` (image, name, alghind, county, area, countdown, status pill; archive variant with endYear + finalPrice) <!-- agent: fullstack-engineer.build, depends_on: [2.2, 2.3, 2.4], touches: [packages/ui/src/components/content/LotCard.tsx] -->
- [ ] 4.2 `AuctionTicker` (4 LotCards, snap scroll, 60s client refresh, empty state) <!-- agent: fullstack-engineer.build, depends_on: [4.1, 2.7], touches: [packages/ui/src/components/content/AuctionTicker.tsx] -->
- [ ] 4.3 `SpecialistCard` (+ mini variant) <!-- agent: fullstack-engineer.build, depends_on: [2.2], touches: [packages/ui/src/components/content/SpecialistCard.tsx] -->
- [ ] 4.4 `ContactBand`, `Testimonial`, `ArticleCard`, `DocumentLink` (PDF icon + size) <!-- agent: fullstack-engineer.build, depends_on: [2.2, 2.1], touches: [packages/ui/src/components/content/ContactBand.tsx, packages/ui/src/components/content/Testimonial.tsx, packages/ui/src/components/content/ArticleCard.tsx, packages/ui/src/components/content/DocumentLink.tsx] -->
- [ ] 4.5 `FilterPanel` (collapsible, chip selects, range sliders, "Tühjenda", active-count badge; mobile → Drawer) <!-- agent: fullstack-engineer.build, depends_on: [2.2, 2.5, 2.6, 2.7, 2.10, 3.4], touches: [packages/ui/src/components/content/FilterPanel.tsx] -->
- [ ] 4.6 `MapEstonia` — Leaflet + Maa-amet WMS orthophoto, county GeoJSON outlines, pins w/ popups, clustering; graceful fallback to OSM tiles; static-image fallback for CDN failure <!-- agent: fullstack-engineer.build, depends_on: [1.1, 1.2], touches: [packages/ui/src/components/content/MapEstonia.tsx, packages/ui/src/components/content/MapEstonia.css] -->
- [ ] 4.7 Sticky TOC / numbered side-nav with scroll-spy (IntersectionObserver) + mobile chip-bar variant <!-- agent: fullstack-engineer.build, depends_on: [1.1, 1.2, 2.10], touches: [packages/ui/src/components/content/StickyTOC.tsx] -->
- [ ] 4.8 `SearchableAccordion` (FAQ: teaser + "Loe edasi…", `#q-slug` deep-link, diacritic-insensitive filter, aria-live results) <!-- agent: fullstack-engineer.build, depends_on: [2.5], touches: [packages/ui/src/components/content/SearchableAccordion.tsx] -->

## 5. Verification

- [ ] 5.1 Styleguide dev route rendering every component + states (empty/loading/error) [S] <!-- agent: fullstack-engineer.build, depends_on: [2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8], touches: [apps/platform/src/app/styleguide/**] -->
- [ ] 5.2 Component unit tests for validators, Countdown math, DataTable sorting/pagination [S] <!-- agent: fullstack-engineer.fast, depends_on: [3.6, 2.4, 2.8], touches: [packages/ui/src/__tests__/Countdown.test.ts, packages/ui/src/__tests__/DataTable.test.ts, packages/types/src/__tests__/validators.test.ts] -->
