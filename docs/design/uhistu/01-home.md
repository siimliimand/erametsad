# Avaleht — Association home

> **In brief:** Association landing: subsidy teasers, service chips and a join call-to-action.
| Area | uhistu |
|---|---|
| **Route** | `metsauhistu.eametsad.ee/` |
| **Access** | public |
| **In nav** | subsite header, item "Avaleht"; also reached from eametsad.ee header dropdown "Metsaühistu" |

## Purpose & user goals
Forest owner lands here from the main site or search; must (a) understand in 5 seconds what Eametsad Metsaühistu does, (b) see current subsidy deadlines at a glance, (c) leave contact details via the join form or contact band.

## Wireframe (desktop)

```
┌────────────────────────────────────────────────────────────────────┐
│ HERO (--primary-dark, forest photo overlay)                        │
│  "Erametsad Metsaühistu"   ┌──────────────────────────────────┐   │
│  H1 Sinu mets. Meie nutsus. │ JOIN CARD (white, radius 14)     │   │
│  sub + 2. järgu CTA         │ nimi / telefon / email           │   │
│                             │ [ConsentCheck] [Btn cta "LIITU"] │   │
│                             └──────────────────────────────────┘   │
├────────────────────────────────────────────────────────────────────┤
│ H2 Metsandustoetuste taotlemine          [Vaata kõiki toetusi →]  │
│ ┌───────────────────────────────────────────────────────────────┐ │
│ │ <table>  Toetus | Tähtaeg | Toetuse suurus | (Taotle btn)    │ │
│ │  row ×6 … sorted by deadlineEnd asc, open programs first     │ │
│ └───────────────────────────────────────────────────────────────┘ │
├────────────────────────────────────────────────────────────────────┤
│ H2 Teenused — bg-mist band                                         │
│  [chip][chip][chip] … 9 chips → /teenused#anchor                   │
├────────────────────────────────────────────────────────────────────┤
│ H2 Toetused — "Aitame toetuste taotlemisel"                        │
│  ┌Card┐┌Card┐┌Card┐  (top 3 programs, deadline pill + max €/ha)   │
├────────────────────────────────────────────────────────────────────┤
│ <ContactBand>  Helista / Saada email / Jäta enda kontaktid         │
└────────────────────────────────────────────────────────────────────┘
```
Mobile: hero stacks (H1 → join card full-width); table becomes horizontally scrollable with sticky first column; chips wrap; cards 1-col.

## Block-by-block spec
1. **Hero** (distinct from main site: darker, association brand line "Erametsad Metsaühistu" in Manrope 800 above H1; photo of mixed forest w/ `--primary-dark` 70% gradient from left). Left: H1, 1-sentence subtitle, ghost Btn "Vaata teenuseid" + cta Btn "Toetuste tähtajad". Right: **join form card** (see 06-liitu.md for full field spec — nimi, telefon, email, ConsentCheck, submit). Submits to `POST /api/leads` (`form_name=hero-join`, `page=/`).
2. **Metsandustoetuste taotlemine** — semantic `<table>` (NOT the reference's CSS-div grid): `<thead>` Toetus / Tähtaeg / Toetuse suurus / empty action col; `<tbody>` 6 rows from `SubsidyProgram` where `showOnHome=true`, ordered `status=open` first then by `deadlineEnd` asc. Each row: program name (link), deadline window formatted `07.04–23.04.2026` (or free-text note e.g. "Sügis 2026"), max rate `"Kuni 356 €/ha"` or `"Selgub"`, and per-row `<Btn secondary small>` "Taotle" → detail page. `<caption class="sr-only">` for a11y; sortable headers optional (keep static v1). Footer link "Vaata kõiki toetusi" → /toetused.
3. **Teenused chips** — 9 `<a class="chip">` items (Istutamine, Hooldusraied, Metsataimede tellimine, Nõustamine, Taimekaitse & ulukitõrje, Metsamajandamiskavad, Metsataimede hooldamine, Maapinna ettevalmistus, Oksjonid → external `oksjonid.eametsad.ee`, `rel="noopener"`, opens new tab with icon). Anchors into /teenused.
4. **Toetused cards** — 3 `<Card>` from same collection (`featured=true`): title, StatusPill (Avatud/Varsti/Suletud, computed from date window), max rate, 1-line teaser, link.
5. **`<ContactBand>`** — shared component (00-global-shell): phone, email, "Jäta enda kontaktid" scrolls back to hero form.

## Interactions & edge cases
- Table on <640px: `overflow-x:auto` wrapper, first column sticky; "Taotle" button keeps 44px touch target.
- Deadline badges computed server-side/render-time from `deadlineStart/deadlineEnd` vs today: `open` (active window or window in future <60d) / `upcoming` / `closed`; closed rows dimmed but linked (archive value).
- Join form: honeypot + client validation; consent unchecked by default, required — submit disabled hint via inline error, never a modal.
- Oksjonid chip: external-link icon + `aria-label="oksjonid.eametsad.ee (avaneb uues aknas)"`.

## Data & API
- `GET /api/subsidy-programs?showOnHome=1` (public, 5-min cache; single source shared with /toetused hub and detail pages — no duplicated copy like the reference).
- Collection `SubsidyProgram`: `slug, title, parentProgram?, deadlineStart?, deadlineEnd?, deadlineNote?, rates[]{amount, unit(eur|eur/ha), applicantType}, maxRateLabel, teaser, showOnHome, featured, status(computed)`.
- Join form → `POST /api/leads` `{form_name:"hero-join", page:"/", occurrence:0, name, phone, email, consent:true}` → leads CRM (admin/09).

## States
- Subsidies API down → table hidden, fallback static "Toetuste tähtajad" link + Toast-free silent degrade.
- Form success: inline green confirmation "Täname! Võtame ühendust 1 tööpäeva jooksul." Error: inline field errors + retry.
- Empty programs (first deploy): section omitted.

## Copy (Estonian, draft)
- Brand line: "Erametsad Metsaühistu"; H1: "Sinu mets. Meie nõusanne."; sub: "Erametsaomanike ühistu, kus liitumine on tasuta ja toetused taotleme sinu eest."
- Table hdrs: "Toetus / Tähtaeg / Toetuse suurus / " ; row CTA: "Taotle".
- Chips H2: "Teenused"; cards H2: "Toetused, mida aitame taotleda"; section note: "Tähtajad ja määrad kontrollitakse PRIA ametlikust kalendrist."

## SEO & analytics
- Title: "Erametsad Metsaühistu — metsatoetused, nõustamine ja istutus | metsauhistu.eametsad.ee"; meta desc uses brand line + "liitumine tasuta".
- JSON-LD `Organization` (MTÜ, subOrganization of Eametsad) + `ItemList` of subsidy programs.
- Events: `join_form_start/submit`, `subsidy_row_click{slug}`, `service_chip_click`, `contact_band_click{channel}`.
- Canonical self; hreflang not needed (et only).

## Responsive notes
- ≥1024px: hero 7/5 split (text/join card); table 4 columns.
- 640–1023px: hero stacks (H1 → subtitle → join card full width); table drops "Toetuse suurus" column into a second line inside the Toetus cell (row height grows instead of horizontal scroll).
- <640px: chips become 2-col wrap grid; cards 1-col; ContactBand stacks buttons full-width.
- Hero photo: `object-fit: cover`, `srcset` 480/768/1280/1920, LCP target <2.5s — hero image is the LCP element; join form lazy-hydrates.

## Accessibility
- Table: real `<table>` with `<th scope>`, `<caption>` ("Käimasolevate metsandustoetuste tähtajad ja määrad"); buttons inside cells get `aria-label` = "Taotle <programmi nimi>".
- StatusPill colors always paired with text label (never color-only).
- Chips are real links with `:focus-visible` ring.

## Open questions
- Should the home table show closed programs (dimmed) or only open/upcoming? (Default: dim, 6 rows total.)
- Photo asset: single shared hero photo or rotating per season?
- Autoplay-count on hero join form (A/B ghost vs amber submit)?
