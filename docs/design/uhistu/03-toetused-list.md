# Toetused (list) — Subsidies hub
| Area | uhistu |
|---|---|
| **Route** | `metsauhistu.eametsad.ee/toetused` |
| **Access** | public |
| **In nav** | subsite header "Toetused"; home "Vaata kõiki toetusi" |

## Purpose & user goals
Owner compares all metsatoetused in one place: which are open now, what deadlines loom, what rates apply; then dives into a program detail page or leaves contacts.

## Wireframe (desktop)

```
┌──────────────────────────────────────────────────────────────────────┐
│ H1 Metsatoetused + intro                                             │
├───────────────┬──────────────────────────────────────────────────────┤
│ SIDEBAR (3col)│ MAIN PANE (9col)                                    │
│ Eralditoetused│  ┌ Status legend: ● Avatud ◐ Varsti ○ Esitatud/Suletud│
│  · hooldusraie│  │                                                  │
│  · uuendamine │  │ <table> (same component as home, FULL list)       │
│  · natura2000 │  │  Toetus | Tähtaeg [pill] | Suurus | Taotle        │
│  · pärandkult.│  │  ~15 rows grouped: Eraldistoetused / Metsameede / │
│  · kava       │  │  Muud                                             │
│  · …          │  ├ How-to band: "Esita ise e-PRIAs VÕI ühisühistu    │
│ Metsameede ▸  │  │  kaudu — me teenustasu 7%" → steps mini          │
│   · hooldus ≤10│  ├ <Card> 2 featured programs                      │
│   · taimehaig.│  └ note: andmed kontrollitakse PRIA kalendriga       │
│   · ulukikahj.│                                                     │
│   · taastamine│                                                     │
└───────────────┴──────────────────────────────────────────────────────┤
│ <ContactBand>                                                        │
└──────────────────────────────────────────────────────────────────────┘
```
Mobile: sidebar becomes a collapsible `<Accordion>` group list above the table; table horizontally scrollable.

## Block-by-block spec
1. **Header** — H1 "Metsatoetused", intro: the association submits applications for members (joint application) or guides self-application in e-PRIA; service fee 7% (link to detail template §Teenustasu).
2. **Left sidebar** — program list from `SubsidyProgram` tree: standalone programs under group label "Eraldistoetused"; `parentProgram=Metsameede` children **nested** (indented, chevron) under "Metsameede"; third group "Muud" (looduskaitseliste piirangute, üraskitõrje jne). Active item highlighted on detail pages (shared component). Each link → `/toetused/<slug>`.
3. **Status legend + badges** — deadline badge on every row, computed from date window vs today: `Avatud` (green `--accent`), `Varsti` (amber `--cta`), `Suletud`/`Esitamise aeg läbi` (grey). Free-text deadlines (e.g. "Sügis 2026", "Selgub") get neutral grey note badge.
4. **Main table** — full-list variant of the home semantic `<table>`: grouped with `<tbody>` per group + `scope="colgroup"` headers; columns Toetus / Tähtaeg (+badge) / Toetuse suurus / "Taotle" Btn. Default sort: status=open first, then `deadlineEnd` asc; column-header sort toggle (date, name).
5. **How-to band** — 3 `Steps`: 1) Vali toetus ja kontrolli tingimusi → 2) Saada ühistule andmed või esita e-PRIAs → 3) Me koostame ja esitame ühistaotluse. CTA "Jäta kontakt" scrolls to ContactBand/hero form.
6. **Featured cards + data note** — as on home, reused component; footnote: "Tähtajad pärinevad PRIA ametlikust taotlusvoorude kalendrist; viimane kontroll: <date> (CMS)."
7. **`<ContactBand>`**.

## Interactions & edge cases
- Sidebar ↔ table mutual highlight: hovering a table row highlights sidebar item (desktop only).
- Sorting: ARIA-sort attributes on headers; keyboard operable.
- Closed programs remain listed (archive/SEO value), rows at 60% opacity, badge "Suletud".
- Deep link: `/toetused?filter=avatatud` preset chip (v2).

## Data & API
- `GET /api/subsidy-programs` (full list, public, cached 5 min; same collection feeds home table and detail pages — single source of truth, unlike the reference where home and detail copy diverge).
- Computed `status`: `open` when `today ∈ [deadlineStart, deadlineEnd]`; `upcoming` when `deadlineStart > today`; `closed` when `deadlineEnd < today`; `tbd` when only `deadlineNote`.
- Sidebar tree derived from `parentProgram` refs; order field `sortOrder`.

## States
- Empty collection: EmptyState "Toetuste loend täieneb — kirjuta meile, küsime PRIA käest" + contact link.
- API error: cached last-good render w/ stale timestamp; if none, hide table, keep sidebar from build-time static data.

## Copy (Estonian, draft)
- H1: "Metsatoetused"; intro: "Jälgime kõiki metsandustoetuste taotlusvoorusid ja esitame liikmete eest ühistaotlused."
- Badges: "Avatud" / "Varsti" / "Suletud" / "Aeg täpsustub".
- Group labels: "Eraldistoetused", "Metsameede alusmeetmed", "Muud toetused"; CTA row: "Taotle".

## SEO & analytics
- Title: "Metsatoetused 2026 — tähtajad ja määrad | Erametsad Metsaühistu"; desc mentions hooldusraie, metsauuendamine, Metsameede.
- `ItemList` JSON-LD over all programs; each item links to detail page.
- Events: `subsidy_table_sort{col}`, `subsidy_row_click{slug}`, `sidebar_nav_click{slug}`, `howto_cta_click`.

## Responsive notes
- ≥1024px: 3/9 sidebar/main split; sidebar sticky (top offset = header height).
- 768–1023px: sidebar collapses to `<Accordion>` ("Toetuste loend") above table; badges move into Tähtaeg cell.
- <768px: table → stacked "program cards" rendered from the same data (not a squeezed table): title, badge, rate, Taotle — one component, two presentations; `<table>` semantics kept on desktop via the shared DataTable component.
- Status legend hidden on mobile (badges self-explanatory with text labels).

## Accessibility
- Sidebar nav `aria-label="Toetuste programmide loend"`; active link `aria-current="page"` when embedded on detail pages (same component reused there).
- Sort headers: `<button>` inside `<th>`, `aria-sort` maintained; group headers use `scope="colgroup"`.
- Badge text is read before the date by placing pill before date text in DOM order.

## Performance
- List fully static-generated from the same build-time fetch as home page; client JS only for sorting + highlight (progressive enhancement — no-JS shows default order).

## Open questions
- Do we keep per-year slugs (`/toetused/hooldusraie-2026`) for SEO, or one evergreen slug per program updated yearly? (Default: evergreen slug + year in content; redirects via `Redirect` collection on rename.)
- Who owns the "viimane kontroll" date — manual CMS field or auto from `updatedAt`?
