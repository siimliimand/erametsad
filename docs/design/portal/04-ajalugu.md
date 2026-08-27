# Oksjonite ajalugu — Archive / history
| Area | portal |
|---|---|
| **Route** | `/ajalugu/:tab?` — same 5 tabs as listing (raieoigused/metskinnistud/polumaad/paketid/kiiroksjonid) |
| **Access** | public |
| **In nav** | portal secondary nav "Ajalugu"; marketing footer "Oksjonite ajalugu" |

## Purpose & user goals
Buyers and sellers research realized prices (finalPrice only — privacy posture), market volume by type, county and year, to calibrate their own reserve/bid levels.

## Wireframe (desktop)
```
┌────────────────────────────────────────────────────────────────────────┐
│ Oksjonite ajalugu                                                       │
│ Raieõigused [1984] Metskinnistud [1394] Põllumaad [68] Paketid [11]     │
├────────────────────────────────────────────────────────────────────────┤
│ STATISTIKALINT:  1 984 oksjonit · 9 041 ha · 1,54 M m³ · 56,4 M €      │
├──────────────────────┬─────────────────────────────────────────────────┤
│ FILTRID          [2] │ Sort: ▾ Lõpphind kahanevalt                      │
│ Maakond ▾  Aasta ▾   │ ┌────────────────────────────────────────┐      │
│ Vald ▾     Hind  – – │ │ [img] Lepsi    [2018] Lõppenud 12.05.18 │     │
│ Pindala – –          │ │ Lõpphind 7 500 € · Harju mk · 12,4 ha   │     │
│ [Tühjenda]           │ └────────────────────────────────────────┘ ×N    │
├──────────────────────┴─────────────────────────────────────────────────┤
│ ‹ 1 2 3 … 110 ›                                                        │
├────────────────────────────────────────────────────────────────────────┤
│ ⓘ Avalikustame ainult lõpphinda — võitja andmeid ei avaldata.          │
└────────────────────────────────────────────────────────────────────────┘
```
Mobile: stats band becomes 2×2 grid; tabs scrollable chips; filters in Drawer; cards single column.

## Block-by-block spec
1. **Tabs + archived counters** — same tabs as listing, counts from `GET /api/v1/statistics?status=archived`. Tab persisted in URL.
2. **Statistics band** — per current tab totals: "Raieõiguse oksjoneid on edukalt lõppenud {count}, kokku {area} ha, {volume} m³ ja {priceSum} € eest." Four metric cards (oksjoneid / hektarit / m³ (forest only) / kogumaksumus €). Updated with filter? No — band always shows all-time type totals (trust signal), independent of filters.
3. **FilterPanel** — identical component to listing minus subscription: Maakond, Vald, **Lõppemise aasta (endYear)** multi-select chips (2015…2026), Lõpphind € range, Pindala range, Puuliigid/Raieliigid (forest tab). Active count badge, "Tühjenda".
4. **Sorting** — Lõpphind kasvavalt/kahanevalt (default kahanevalt) · Lõppemise aeg varem/hiljem · Alghind kasvavalt/kahanevalt.
5. **LotCard (archive variant)** — image, name, **endYear badge** (top-right chip), StatusPill "Lõppenud", lõpphind in amber (or "Müümata jäi" when unsold), lõppkuupäev ("Lõppes {dd.mm.aaaa}"), maakond, pindala ha (+m³ forest). No countdown. Click → archived lot detail (`/oksjon/:id` ended state: full dossier + "Oksjon on lõppenud. Lõpphind {X} €").
6. **Server pagination** — page-based, 24/page, deep-linkable.
7. **Privacy note** — persistent footer line under grid.

## Interactions & edge cases
- Filters + sort + page all in URL query string (shareable research links).
- Unsold lots: shown with "Müümata" tag when the archive record is public; policy toggle (admin setting) can hide them.
- Legacy years with sparse data: endYear chips only for years with data.
- Cross-links: each LotCard links to detail; detail links "Vaata sarnaseid oksjoneid" (same county+type active listing search).

## Data & API
| Field | Source |
|---|---|
| archived list (id, name, image, finalPrice, county, area, volume, endTime, endYear) | `GET /api/auctions?auctionStatus=archived&objectType=…&where[endYear][in]&…&sort=-finalPrice&page&limit` |
| counters + stats band | `GET /api/v1/statistics?status=archived` (count/area/volume/eur per objectType) |
| counties/valds | `GET /api/v1/counties` |
Caching: heavily cacheable (immutable history) — 24 h edge cache, purge on archive corrections.

## States
- Empty tab: "Arhiivis ei ole selle tüüpi oksjoneid."
- Empty filter result: "Filtritele ei vasta ükski lõppenud oksjon." + "Tühjenda filtrid".
- Loading skeletons; error retry.
- Guest = authed (identical archive; no personalization by design).

## Copy (Estonian, draft)
"Oksjonite ajalugu" · "Lõppenud oksjonid" · "Lõpphind" · "Lõppes" · "Müümata jäi" · "Edukalt lõppenud oksjoneid" · "Avalikustame ainult lõpphinda — võitja andmeid ei avaldata." · "Tühjenda"

## SEO & analytics
High-value SEO surface. Title "{Type} oksjonite ajalugu | Eametsad"; SSR all tab landing pages + first page per year filter (landing pages per year+county possible Phase 2). JSON-LD `Dataset` for statistics band. Events: archive_tab_switch, archive_filter, archive_card_click, stats_band_view.

## Open questions
- Publish unsold lots in archive (transparency) or hide (optics)? Recommend publish with "Müümata" tag.
- Per-year/per-county SEO landing pages now or Phase 2?
