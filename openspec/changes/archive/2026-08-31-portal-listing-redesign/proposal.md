## Why

The auction portal listing works but its layout and visual identity lag the
approved mockup the user provided. The mockup shows a sidebar filter layout
with the map always visible beside the results, a default "Kõik objektid"
tab, richer lot cards (type badge, metadata grid, price block, call to
action), and a darker, sharper Material-inspired visual theme. The current
page is single-column with filters stacked above the results, the map locked
behind an exclusive Kaardivaade toggle, cards that show only county, area,
price, and countdown, and the muted forest palette from Phase 1.

Direct code inspection confirmed the build is cheaper than the mockup
suggests, because most of it already exists:

- All filter, sort, and subscription behavior exists in `ListingFilters`
  and exceeds the mockup (adds Maht, Raieliik, Telli teavitus).
- `AuctionSummary` already carries `species`, `volume`, `parish`, and
  `objectType`; `LotCard` simply does not render them.
- The map (`ListingMap` on `MapEstonia`) already has clustering, popups,
  and mini countdowns; it is only gated behind `?view=kart`.
- Every visual token lives in one file,
  `packages/ui/src/styles/tokens.css`, consumed through semantic Tailwind
  classes, so the identity swap is a value change, not a component rewrite.

## What Changes

- **Kõik objektid tab**: a new first tab backed by an explicit `allTypes`
  flag (not an empty `objectTypes` array, so Põllumaad keeps its
  empty-state semantics), summing counts and statistics across all object
  types, with heading "Aktiivsed oksjonid". It becomes the default landing
  tab, matching the mockup.
- **Listing layout**: the page splits into a 12-column grid at `lg`:
  filters in a left aside (3 columns), results in the main column
  (9 columns). The Loendivaade/Kaardivaade toggle is removed; the map
  renders always visible above the results with both queries running per
  page load. On mobile the filters collapse (accordion/drawer) above a
  shorter map.
- **Results bar**: "Leitud N oksjonit" plus the Sorteeri select move out of
  the filter panel into a bar above the card grid. Pagination is unchanged.
- **Lot card v2**: image overlays for the object-type badge and countdown,
  a 2×2 metadata grid (location, area, species, volume), an Alghind price
  block, and a "Vaata lähemalt" call to action. All new props are optional
  so `AuctionTicker` and `ArchiveCard` keep working unchanged. The grid in
  the narrower main column becomes 2-across instead of 3–4.
- **Visual identity**: `tokens.css` adopts the mockup theme — primary
  `#012d1d`, hover `#1b4332`, light `#c1ecd4`, ink `#181a2e`, muted
  `#414844`, page `#fbf8ff`, mist `#f4f2ff`, border `#c1c8c2`; radii card
  and input 8px, button pill; container 1200px. Headings switch from
  Manrope to Public Sans (600/700) via `next/font` (self-hosted, CSP-safe).
  Because the tokens are shared, the identity reaches the admin area and
  any marketing usage by design.
- **Deliberate deviations from the mockup**: Lucide icons stay (the
  mockup's Material Symbols map to `MapPin`, `Ruler`, `Trees`, `Package`,
  `Timer`); the status color phases stay (neutral, amber under one hour,
  red under five minutes) instead of the mockup's static red badge;
  JetBrains Mono stays for prices and countdowns; the Maht (m³) and
  Raieliik filters stay even though the mockup lacks them; volume keeps
  the unit m³ from the data layer, not the mockup's "tm".
- **Docs**: DESIGN.md is rewritten in the same change (token tables,
  typography, component notes, icon section) so it does not drift from
  reality.

## Deferrals (accepted in writing)

- Marketing site pages are not restructured in this change; they inherit
  the new tokens and are reconciled visually in a later change.
- No dark mode. The mockup's dark variants are recorded in DESIGN.md as
  future tokens only.
- Map and list stay server-fetched per page load (no client-side
  filter-driven refetch of the map); the 300ms debounced URL update keeps
  today's behavior.

## Missing specialization

`.opencode/agents/` contains only `build`, `plan`, and
`fullstack-engineer`. No specialist frontend or design-system engineer
exists, so all tasks are annotated `fullstack-engineer` (fallback worker).
Consider `/make-engineer` for a frontend engineer.
