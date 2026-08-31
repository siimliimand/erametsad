## Context

The mockup is a static prototype of the portal listing. This change ports
its layout and visual identity onto the live page without regressing the
features the prototype fakes: SSE live updates, anti-snipe countdowns,
server-side filters, subscriptions, pagination, and an accessible status
system.

Key files:

- `apps/platform/src/app/(portal)/page.tsx` — server listing page,
  tab/filter/view resolution, pagination
- `apps/platform/src/app/(portal)/_components/` — `ListingTabs`,
  `ListingFilters`, `ListingMap`, `LiveListing`, `PortalHeader/Footer`
- `packages/ui/src/components/content/LotCard.tsx` — shared lot card,
  also used by `AuctionTicker` (marketing) and `ArchiveCard`
- `packages/ui/src/styles/tokens.css` — every visual token, shared by all
  three sites through semantic Tailwind classes
- `apps/platform/src/app/layout.tsx` — `next/font` imports

## Goal / Non-Goal

Goal: the listing page matches the mockup's layout, density, and theme;
the Kõik tab exists and is the landing view; the map is always visible.

Non-Goal: restructuring marketing pages, dark mode, client-side map
refetch on filter change, replacing Lucide, adopting Material Symbols, or
changing the status color system.

## Decisions

### D1. Kõik via explicit flag, not empty-equals-all

`ListingTabDef` gains `allTypes?: boolean`. Empty `objectTypes` keeps its
current meaning ("schema has no value yet" — Põllumaad renders its empty
state). `page.tsx` queries when `allTypes || objectTypes.length > 0`, and
`statsForTab` sums every bucket when `allTypes` is set. `buildTabQuery`
already omits the `objectType` param when the list is empty, so Kõik
reuses that path unchanged.

### D2. Kõik becomes the default tab

`DEFAULT_LISTING_TAB` moves from `raieoigused` to `koik`, heading
"Aktiivsed oksjonid", matching the mockup's landing view. `?tab=` values
keep resolving; unknown values fall back to Kõik.

### D3. Map always visible; toggle removed

`listAuctionMapPoints` runs alongside `listAuctions` in list view
(`Promise.all` already structures this). The `?view=kart` value keeps
parsing but stops affecting the layout, so old shared links still load.
The map renders above the results bar, 400px tall at desktop, about 240px
on mobile. Clustering and popups stay as built. The second query per load
is accepted cost; it replaces the previous exclusive-view query.

### D4. Sidebar layout

At `lg` the page becomes `grid-cols-12`: aside `lg:col-span-3` (filters),
main `lg:col-span-9` (summary, tabs, map, results bar, grid, pagination).
Below `lg` the stack is: heading, tabs, collapsed filters, map, results
bar, single-column grid. The filters collapse through a disclosure
(`<details>`-based or equivalent) so no new modal surface is introduced.

### D5. Results bar

A small server component renders "Leitud N oksjonit" and the Sorteeri
select. The select posts the same `sort`/`order` params the filter panel
used, so URL state and the debounced router replace behavior are
unchanged. `ListingFilters` drops its Sorteeri field and keeps everything
else, including Telli teavitus and Tühjenda.

### D6. LotCard v2 stays backward compatible

New optional props: `typeLabel`, `parish`, `speciesNames`, `volumeM3`,
and an explicit `ctaLabel` default ("Vaata lähemalt"). Without them the
card renders today's minimal presentation, so `AuctionTicker` and
`ArchiveCard` need no edits. `LiveListing.lotCardProps` maps the new
fields from `AuctionSummary` (`objectType` → label via the tab
definitions, `species` codes → names, `volume` → m³, `parish` +
`county` → location line). Whole card stays a link; the CTA is visual
inside it, avoiding nested interactive elements.

### D7. Species names helper

`ListingFilters` holds the only code→name table today. A shared helper in
`(portal)/_lib/` (for example `species.ts`) exports the table and a
`speciesNames(codes)` function; the filter chips and the card both use
it. Data stores bare codes; the UI owns the Estonian labels.

### D8. Token values

| Token | Old | New |
|---|---|---|
| `--color-primary` | `#2E6B4F` | `#012d1d` |
| `--color-primary-hover` | `#25573F` | `#1b4332` |
| `--color-primary-light` | `#E9F0EC` | `#c1ecd4` |
| `--color-ink` | `#1B211D` | `#181a2e` |
| `--color-ink-muted` | `#6B7570` | `#414844` |
| `--color-bg-page` | `#FFFFFF` | `#fbf8ff` |
| `--color-bg-mist` | `#F1F5F2` | `#f4f2ff` |
| `--color-border` | `#E3E7E4` | `#c1c8c2` |
| `--radius-card` | `14px` | `8px` |
| `--radius-input` | `10px` | `8px` |
| `--radius-button` | `10px` | `9999px` |
| `--layout-container-max` | `1280px` | `1200px` |

Unchanged on purpose: all status colors, danger/info pairs, CTA amber
(stays for price-highlight and ending-soon usage), shadows (re-tinted
rgba base only if trivially green-dependent), spacing, motion, layout
sidebar/content widths. `primary-dark` keeps a green-dark value for hero
overlays and the footer.

### D9. Typography

`layout.tsx` swaps the Manrope `next/font` import for Public Sans
(`latin`, `latin-ext`, weights 600 and 700), still exposed as
`--font-heading`. Inter stays body; JetBrains Mono stays for numerals.
The existing scale (h1 48/1.15 and so on) is kept; the mockup's Public
Sans sizes land close enough that the scale does not move.

### D10. Icons stay Lucide

The card's metadata icons use `MapPin`, `Ruler`, `Trees`, `Package`; the
countdown overlay uses the existing `Countdown` (already `Timer`-flavored
visually). No Material Symbols font is added; the CSP allows no new
external hosts.

### D11. Contrast notes

Text tokens pass WCAG AA on the new surfaces (`#414844` on `#fbf8ff`
about 7.5:1, white on `#012d1d` above 12:1). The new border `#c1c8c2` on
`#fbf8ff` is decorative-only contrast, standard for borders; interactive
component boundaries keep the focus ring treatment. A quick axe pass on
the listing page is part of verification.

## Risks / Trade-offs

- [tokens are shared] The admin area and marketing components inherit the
  new identity immediately. → Accepted: the design system is shared by
  rule; DESIGN.md is updated in the same change.
- [markup-asserting tests] `PortalHeader.test` and `ListingFilters.test`
  may assert classes or structure that the theme and layout work moves.
  → Update tests with the tasks that move the markup, not in a sweep at
  the end.
- [second map query per load] List view now pays the map-points query
  too. → Accepted (D3); both queries already run in parallel and the map
  payload is bounded by the active-auction set.
- [grid density] `LiveListing` drops from up to 4 columns to 2 in a
  narrower column. Fewer cards above the fold; pagination unchanged.
  → Accepted; the mockup targets scannability per card.
- [`?view=kart` legacy] The param stops doing anything. → Kept parsing
  and ignored; no redirect needed.

## Migration Plan

Single deploy. No schema, API, or data changes. The only external
surface is the URL contract, which stays compatible (tab params, filter
params, sort params, and a now-inert view param).

## Open Questions

None. Scope decisions were settled in the explore session: layout +
visual identity, map always visible, Kõik included.
