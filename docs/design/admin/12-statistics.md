# Statistika — Statistics dashboard

> **In brief:** Auction outcomes and funnel analytics, with export.
| Area | admin |
|---|---|
| **Route** | `/statistika` |
| **Access** | admin, superadmin (full); specialist (own-lot aggregates); public-stats curator: superadmin |
| **In nav** | sidebar "Statistika" |

## Purpose & user goals
Business intelligence from auction outcomes and the lead funnel: sell-through, price levels by county/species, revenue — plus the curator that decides which aggregates are published on the public statistics page.

## Wireframe (desktop)
```
┌───────────────────────────────────────────────────────────────────────────┐
│ Statistika  Periood: [01.01.2026 — 31.12.2026 ▾]  Tüüp: [Kõik ▾]          │
│ [Ekspordi CSV] [Ekspordi XLSX]                                            │
├────────────┬────────────┬────────────┬────────────────────────────────────┤
│ Oksjoneid  │ Müüdud     │ Läbimüük   │ Teenustasu                          │
│    412     │ 318 (77%)  │ 2,4 M€     │ 71 900 €                            │
├───────────────────────────────┬────────────────────────────────────────────┤
│ Oksjonid kuude kaupa          │ €/ha maakonnakaart (kloro...               │
│ ▂▃▅▇▆▄▂▃ bar: aktiivne/       │ ┌──────────────┐                          │
│ lõppenud/müüdud/müümata       │ │ Eesti kaart, │  tabel: maakond €/ha €/m³ │
│                               │ │ toonid hinnad│  Harju 2 910  62         │
├───────────────────────────────┤ │ Tartu 2 450  55  …                     │
│ Lõhtr: juhtlõige → leping     │ └──────────────┘                          │
│ 342 → 210 → 96 → 61  (61%)   ├────────────────────────────────────────────┤
│                               │ Teenustasu kuude kaupa ▁▄▆█               │
├───────────────────────────────┴────────────────────────────────────────────┤
│ Avalik statistika kuraator [Muuda → seaded]                               │
└───────────────────────────────────────────────────────────────────────────┘
```

## Block-by-block spec
1. **Filter bar** — Periood (presets: see kuu / kvartal / aasta / kohandatud range, TZ Europe/Tallinn); Tüüp (objectType multi + kiiroksjon toggle); Maakond (multi); filters apply to all charts simultaneously (URL-shareable). Export buttons honour filters.
2. **KPI cards** — Oksjoneid kokku (ended in range); Müüdud + läbimüügi % (sell-through = sold / ended); Kogumahu € (sum finalPrice); Teenustasu (fees, VAT-excl vs incl toggle); secondary tooltips define each formula.
3. **Oksjonid kuude kaupa** — stacked bar per month by outcome status (aktiivne hetkel n/a for history: müüdud / müümata / tühistatud); hover tooltip exact numbers; click a bar → drill to 02 filtered.
4. **Keskmised hinnad** — tabs €/ha and €/m³; two views: **kloropleth kaart** (Estonian county GeoJSON, colour scale by selected metric, legend, click county → table row highlight + drill) and table: Maakond | oksjoneid | müüdud | kesk €/ha | kesk €/m³ (forest only) | kogu €. Secondary split selector: Puuliik (top species from forestType codes) — bar chart kesk €/m³ per species.
5. **Lõhtr (funnel)** — Juhtlõimed → Võetud ühendust → Kvalifitseeritud → Leping; horizontal funnel with counts + conversion % per stage; data from Lead statuses + contract link; period-consistent (leads created in range, statuses as of now — footnoted).
6. **Teenustasu kuude kaupa** — bar/line fees by month, cumulative line; hover shows contract count behind each month.
7. **Avaliku statistika kuraator** — panel listing aggregate groups (kokkumüüdud €/ha/m³ per tüüp ja aasta, oksjonite arv, edu-%): toggle each "avalik / varjatud"; preview link to public stats page; changes saved via 13 audit. Superadmin only.
8. **Ekspord** — CSV (raw rows behind each chart) and XLSX (workbook, one sheet per chart). Filename `erametsad-statistika-{filters}-{date}`.

## Interactions & edge cases
- Charts redraw on filter change with 300ms debounce; server aggregates from StatisticsSnapshot (daily) + live queries for current month (badge "käesolev kuu: reaalajas").
- Snapshot mismatch tooltip: "Päevane snapshot 26.08 03:00 + live kuu".
- Data-minimisation: no chart can isolate a single lot (small-cell suppression: n<3 aggregatsioon salaja? — decision below).
- Specialist view: same charts scoped to own lots, no fee revenue (business-sensitive).
- Accessibility: charts have table fallbacks (data-table toggle per chart).

## Data & API
`GET /api/admin/statistics/summary|by-month|prices|funnel|fees?from=&to=&types=`; snapshots `StatisticsSnapshot(date, object_type, county?, count, area, volume, eur)` written by daily worker + auction-end worker; public aggregates `GET /api/v1/statistics` respects curator toggles.

## States
No data in range: "Valitud perioodis andmeid ei ole" + chart empty outlines. Export running: spinner → download. Public-stats toggle pending save indicator.

## Copy (Estonian, draft)
"Statistika" · "Periood" · "Läbimüük" · "Keskmine hind hektari kohta" · "Keskmine hind m³ kohta" · "Lõhtr: juhtlõigest lepinguni" · "Teenustasu" · "käesolev kuu reaalajas" · "Avalik statistika" · "Avalik / Varjatud" · "Ekspordi CSV" · "Ekspordi XLSX" · "Valitud perioodis andmeid ei ole".

## Permissions & audit
Audit-logged: export (CSV/XLSX), public-stats visibility changes (what the public may see). Chart viewing not logged (aggregates only).

## Chart specs (implementation detail)
- **Oksjonid kuude kaupa**: stacked bars (müüdud green / müümata grey / tühistatud red outline), X = calendar months in range; y-labels rotated if >12 months; click → drill 02.
- **Kloropleth**: county GeoJSON, sequential green scale (quantile bins, 5), legend with € ranges, tooltip county+value+n; keyboard: table view is the a11y fallback and primary data source.
- **Puuliigid bar**: top 8 species by volume, kesk €/m³, error whiskers = IQR; n<3 species grouped "Muu".
- **Lõhtr**: SVG funnel, stages with counts + % of previous stage; hover shows definition ("Kvalifitseeritud = juhtlõige märgitud kvalifitseerituks …").
- **Teenustasu**: bars monthly + cumulative line on secondary axis.

## Public statistics curator (detail)
Panel rows: { aggregate group: kogusumma €, oksjonite arv, kesk €/ha, kesk €/m³, edu-% } × { tüüp, aasta }. Toggle avalik/varjatud per row; preview button opens public stats page (portal) with unpublished rows greyed "varjatud"; save via settings-audit path (13). Edits take effect on next public cache refresh (ISR, ≤5 min).

## Export detail
- CSV: one file per chart selected or "kõik" zip; columns mirror tables; UTF-8 BOM (Excel-EE).
- XLSX: workbook `erametsad-statistika.xlsx`, sheets: Kokkuvõte, Kuud, Hinnad, Lõhtr, Tasud; header styling; filters encoded in a Metadata sheet.
- Exports respect suppression rules (suppressed cells blank + footnote).

## Data-minimisation & suppression rules
- Any cell based on n<3 auctions: value suppressed in price charts (shown as "—"), count still visible.
- No chart or export exposes per-lot or per-user data; drill-downs land in 02 (permission-checked there).
- Specialist scope: own lots only, fee revenue hidden.

## Accessibility
Every chart has "Tabelina" toggle rendering an HTML table (also the export source); colour scales colourblind-safe (viridis-like); map has county list alternative.

## Filter state & sharing
Filters serialised to query string (`?from=2026-01-01&to=2026-12-31&types=forest,property`); "Jaga vaadet" copies URL; default landing = current year, all types. Per-user last-used filter remembered (localStorage, not server).

## States (full)
- No data: chart-area empty outlines + "Valitud perioodis andmeid ei ole".
- Export running: button spinner → browser download; failed → toast + retry (logged).
- Curator unsaved: dot on section + save button enabled only for superadmin.
- Live-month badge: "reaalajas" chip on current-month bars with tooltip on methodology.

## KPI formulas (footnoted in UI)
- Läbimüük % = müüdud oksjonid ÷ lõppenud oksjonid (tühistatud välja arvatud) — tooltip spells this out.
- Kesk €/ha = Σ finalPrice ÷ Σ area (müüdud, tüübiga ha) — weighted, never average-of-averages.
- Kesk €/m³ = Σ finalPrice ÷ Σ volume (müüdud raieõigus).
- Teenustasu = Σ fee (lepingu järgi, KM-väline vaikimisi) lepingute loomise kuu järgi.

## Open questions
- Small-count suppression rule (hide county cell if n<3?) — recommended yes for price levels.
- Public stats granularity: monthly or yearly? (Yearly recommended at launch.)
- Benchmark series (Maa-amet market prices) overlay — Phase 5?
