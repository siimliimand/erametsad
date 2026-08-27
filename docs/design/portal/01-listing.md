# Oksjonite avaleht — Listing / home with tabs, map, filters
| Area | portal |
|---|---|
| **Route** | `/:tab?` — tabs: `raieoigused` (forest) · `metskinnistud` (property) · `polumaad` (field) · `paketid` (package) · `kiiroksjonid` (quick) |
| **Access** | public (guest + authed; authed gets personalization in header & bid hints) |
| **In nav** | portal root; linked from marketing site CTA "Oksjonikeskkond", footer "Aktiivsed oksjonid" |

## Purpose & user goals
Buyers land here to discover active auctions by object type, filter/narrow to a region or species, view lots on a map, and either open a lot or subscribe to future matches. Sellers use it to gauge market activity.

## Wireframe (desktop)
```
┌────────────────────────────────────────────────────────────────────────┐
│ EAMETSAD ⛁  Raieõigused Metsakinnistud Põllumaad Paketid Kiiroksjonid │ ← tabs + counters
│            [156]        [24]        [3]      [1]      [0]              │
├────────────────────────────────────────────────────────────────────────┤
│ "Hetkel on aktiivseid raieõiguste oksjoneid 18, kokku 94 ha            │
│  raiutavat mahtu 11 976 m³ ja 428 700 € väärtuses."                   │ ← summary sentence
├──────────────────────┬─────────────────────────────────────────────────┤
│ FILTERS          [3] │  [Kaardivaade | Loendivaade]   Sort: ▾ Varem    │
│ Maakond        ▾     │  lõppevad eespool                              │
│ Vald           ▾     │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐               │
│ Puuliigid      +     │  │ LotCard │ │ LotCard │ │ LotCard │ │ LotCard │
│ Raieliigid     +     │  └─────┘ └─────┘ └─────┘ └─────┘               │
│ Pindala/maht   – –   │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐               │
│ Hind €         – –   │  … or MapEstonia with pins …                   │
│ Aasta           ▾    │                                                 │
│ [Tühjenda]          │                                                 │
│ [⚑ Telli teavitus]  │                                                 │
├──────────────────────┴─────────────────────────────────────────────────┤
│ ‹ 1 2 3 … 8 ›                                    server pagination     │
└────────────────────────────────────────────────────────────────────────┘
```
Mobile: tabs become a horizontal scrollable chip row with counters; FilterPanel collapses into a "Filtrid (3)" accordion button opening a `<Drawer>`; cards single-column; map full-width above list.

## Block-by-block spec
1. **Tabs + counters** — `<Tabs>`; each label shows active count from statistics fetch. Kiiroksjonid tab is itself a filtered union (any lot with `isQuickAuction`). Default tab = raieoigused. Tab changes update URL (`/metskinnistud`) for shareability.
2. **Summary sentence** — generated per type from `GET /api/v1/statistics?status=active&objectType=…`:
   - forest: "Hetkel on aktiivseid raieõiguste oksjoneid {count}, kokku {area} ha raiutavat mahtu {volume} m³ ja {price} € väärtuses."
   - property/field/package: "Hetkel on aktiivseid {type} oksjoneid {count}, kokku {area} ha ja {price} € väärtuses." (volume omitted).
3. **View toggle** — "Kaardivaade"/"Loendivaade". Map = `<MapEstonia>` (Leaflet, Maa-amet orthophoto WMS, county GeoJSON outline). Pins from lot `coordinates`; pin popup: name, pindala, alghind/lõpphind, katastritunnus/register nr, "Aega jäänud" mini countdown, "Vaata" link. Clustering at low zoom. Clicking a pin navigates to `/oksjon/:id`.
4. **FilterPanel** — collapsible; fields: Maakond (15 ref counties, `GET /api/v1/counties`), Vald (dependent on county), Puuliigid (24 codes MA…PI, multi-chip), Raieliigid (AR,HL,HR,KR,LR,RD,SR,TR,VE,VR multi-chip), Pindala/rauemahu vahemik (min–max ha, or m³ on forest tab), Hind € (min–max), Aasta (forest: raietähtaeg year). Active filter count badge on header; "Tühjenda" resets all. Filters apply server-side on list query with 300 ms debounce; state serialized to query string.
5. **"Telli teavitus"** — `<Btn secondary>` "⚑ Telli teavitus" pinned to filter panel bottom. Guest → inline e-mail input + consent `<ConsentCheck>`; authed → prefilled. Saves filter_json via `POST /api/auction-subscriptions`; toast "Teavitus tellitud — saadame sõnumi, kui lisandub sobiv oksjon."
6. **Sorting** — select: Alghind kasvavalt/kahanevalt · Lõpphind kasvavalt/kahanevalt (archive only) · Varem lõppevad eespool (default) · Hiljem lõppevad eespool.
7. **LotCard grid** — `<LotCard>` spec: 16:10 image, lot name (H3), alghind (amber `--cta`), maakond, pindala ha (+ m³ on forest), `<Countdown>` "Aega jäänud {d}p {h}:{m}:{s}" (server-synced, SSE-corrected), `<StatusPill>` (Aktiivne/Lõppenud/Kiiroksjon badge). Whole card clickable.
8. **Pagination** — server-side, page size 12/24 (grid rows); "Laadi veel" on mobile infinite scroll alternative.
9. **Global portal header** — links to marketing: Metsa müümine · Raieõiguse müümine · Kinnistu müümine · Päringud · Hindamisaktid · Metsateatis · Metsaspetsialistid; right side: "Logi sisse" or user menu (avatar → Minu pakkumised · Minu müügid · Minu profiil · Teavitused · Logi välja).

## Interactions & edge cases
- SSE `/api/auctions/stream`: new lot published → card prepended with highlight; endTime extension (anti-snipe) updates countdowns live.
- Empty tab: EmptyState "Hetkel ei ole käkasolevaid {type} oksjoneid. Telli teavitus, et uutest teada saada." with subscription CTA.
- Filters yielding 0 results: "Filtritele ei vasta ükski oksjon" + "Tühjenda filtrid".
- Guests see LotCard identically to authed (leading bid hidden for both in list; only on detail).
- Countdown at <1 h switches to amber; <5 min to `--danger` and per-second tick.

## Data & API
| Field | Source |
|---|---|
| list items (id, name, image thumb, minBid, county, area, volume, endTime, auctionStatus, isQuickAuction) | `GET /api/auctions?objectType=…&auctionStatus=active&where[filters]&sort&page&limit` |
| counters + summary numbers | `GET /api/v1/statistics?status=active` (per objectType count/area/volume/cost) |
| counties/valds | `GET /api/v1/counties` |
| pins | same list query (coordinates) — raise limit for map, no pagination |
| subscription | `POST /api/auction-subscriptions` {email?, filter_json, channel, frequency} |
| realtime | SSE: `auction:published`, `auction:extended` |
Caching: list query cached 60 s at edge until any bid/extension event invalidates; statistics cached 5 min.

## States
- Loading: card skeletons ×8; map with spinner overlay.
- Error: "Oksjoneid ei õnnestunud laadida. Proovi uuesti." + retry Btn.
- Empty tab / empty filter result (above).
- Guest vs authed: identical listing; header differs; "Telli teavitus" prefills e-mail when authed.
- Kiiroksjon tab with 0: "Hetkel ei ole käimasolevaid kiiroksjoneid." + link to marketing `/kiiroksjon` explainer.

## Copy (Estonian, draft)
- H1 per tab: "Raieõiguste oksjonid" / "Metskinnistute oksjonid" / "Põllumaade oksjonid" / "Kinnistute paketid" / "Kiiroksjonid"
- "Kaardivaade" · "Loendivaade" · "Aega jäänud" · "Alghind" · "Telli teavitus" · "Tühjenda" · "Filtrid" · "Varem lõppevad eespool"

## SEO & analytics
- Title: "{Tab} | Eametsad Oksjonid"; description pattern "Osta {raieõigust/metskinnistut…} oksjonil üle Eesti — {count} aktiivset pakkumist." SSR-rendered first page per tab; JSON-LD `ItemList` of first 12 lots. Events: tab_switch, filter_applied, map_toggle, subscription_created, lot_card_click.

## Open questions
- Pin clustering threshold / should map respect filters or show all types?
- Infinite scroll vs numbered pages on mobile (recommend pages for shareability).
