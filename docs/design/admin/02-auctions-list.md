# Oksjonid — Auctions list
| Area | admin |
|---|---|
| **Route** | `/oksjonid` (tabs: Kõik / Raieõigus / Kinnistud / Põllumaad / Paketid / Kiiroksjonid) |
| **Access** | admin, superadmin (full); specialist (own lots, no manual-end); seller (own lots read-only) |
| **In nav** | sidebar "Oksjonid" |

## Purpose & user goals
Operational control room for all lots: find any lot fast, check status/countdown/bids, and execute lifecycle actions (publish, edit, end manually, archive, re-list) including bulk scheduling.

## Wireframe (desktop)
```
┌──────────────────────────────────────────────────────────────────────────┐
│ Oksjonid   [Kõik 4823][Raieõigus 2401][Kinnistud 1902][Põllumaa 68]...    │
│ + Uus oksjon (⌘N)                                    [Ekspordi CSV] [⚙]  │
├──────────────────────────────────────────────────────────────────────────┤
│ Filtrid: [Olek ▾][Tüüp ▾][Spetsialist ▾][Maakond ▾][Lõpp: alates—kuni]   │
│          [Otsing: id/nimi/kataster…]  × 3 aktiivset  · Tühjenda          │
├──┬────┬───────────────┬────┬────┬────────┬──────┬─────┬─────┬────┬──────┤
│☐ │ ID │ Nimi          │Tüüp│Olek│Maakond │ha/m³ │Algh.│Pakk.│Lõpp│Spets.│
│☐ │4810│ Lepsi         │🌲 A│ ●  │Tartu   │12/980│3 000│ 14  │00:14│ Marit│
│☐ │4812│ Ööviiuli      │🏠 S│ ●  │Saare   │21/—  │45 000│ 3(p)│02:41│ Kaire│
│☐ │4809│ Kõpu pakett   │📦 S│ ◻  │Hiiu    │86/—  │—     │ 0   │28.08│ Marit│
├──┴────┴───────────────┴────┴────┴────────┴──────┴─────┴─────┴────┴──────┤
│ 1–25 / 4823                                                    ‹ 1 2 3 ›  │
└──────────────────────────────────────────────────────────────────────────┘
Row hover → action bar: [Vaata][Muuda][Dupl.[Lõpeta][Arhiivi][Avalda uuesti]
Selection ≥1 → bulk bar: [Ajasta avaldamine…][Ekspordi valitud]
```

## Block-by-block spec
1. **Tabs** — object types with counts (matching portal tabs); "Kiiroksjonid" = `isQuickAuction=true` cross-type; "Kõik". Tab selection is a filter, not a page.
2. **Toolbar** — `+ Uus oksjon` → wizard 03. Export: current filter → CSV (all visible columns + cadastres, finalPrice).
3. **Filter panel** —
   - Olek: draft / scheduled / active / ended / unsold / contract / completed / archived (multi).
   - Tüüp: objectType × auctionType matrix chips (Raieõigus-avatud, Raieõigus-suletud, …).
   - Spetsialist (specialist: fixed to self, hidden).
   - Maakond (15 ref).
   - Lõpp vahemik: date-range picker (TZ Europe/Tallinn, end-of-day inclusive).
   - Freetext: id, name, katastritunnus, registryNumber, alias e-mail.
   Active-filter count badge + "Tühjenda"; filters URL-encoded (shareable).
4. **DataTable columns** (sortable asc/desc; default endTime asc for active, id desc otherwise):
   | Col | Content | Notes |
   |---|---|---|
   | ID | numeric, link → portal detail (new tab) | monospace |
   | Nimi | lot name; kiiroksjon ⚡ badge | link → editor 03 |
   | Tüüp | icon + A(avatud)/S(suletud) | tooltip full label |
   | Olek | `StatusPill` (color map below) | |
   | Maakond | county | |
   | ha / m³ | `area` / `volume` ("—" if null) | right-aligned |
   | Alghind | `minBid` €; leading bid shown on hover tooltip | right |
   | Pakkumisi | count; `(p)` suffix = N pending alapakkumised, amber | link → 04 |
   | Lõpp | countdown (active), date (others); ⏱ icon if anti-snipe extended | |
   | Spetsialist | avatar initials | |
   | Uuendatud | relative `updatedAt` (collapsed column; toggle ⚙) | |
5. **Row actions** (hover; overflow "⋯" for narrow):
   - Vaata → portal detail. Muuda → 03. Dupleeeri → 03 prefilled copy, status=draft, times cleared.
   - **Lõpeta käsitsi** (admin+, active only): modal — warning "Lõpetamine on pöördumatu", typed reason required, preview of current leading bid & bid count, secondary effect chooser: {declare leading bid winner / mark unsold}. Audit `auction.end_manual`.
   - Arhiivi: typed reason, only from ended/unsold/completed. Audit.
   - Avalda uuesti (re-list): from unsold/ended → 03 draft clone with new schedule; original keeps `finalPrice`.
6. **Bulk bar** (checkbox selection incl. "select all filtered"):
   - **Ajasta avaldamine**: pick common startTime (individual endTime offsets kept or recomputed); applies to drafts only; validation blocks mixed non-draft selection.
   - **Ekspordi valitud** CSV. No bulk destructive actions (deliberate).

## Status color map (matches portal `StatusPill`)
draft `#6B7570` grey · scheduled `#2D6FA8` info blue · active `#2E9E5B` green (pulse dot if ending <1h) · ended `#F2A93B` amber · unsold `#B3261E` outline red · contract `#58B368` light green · completed/archived `#6B7570` grey.

## Interactions & edge cases
- Keyboard: ↑/↓ row focus, Enter=Vaata, E=Muuda, X=Lõpeta (opens confirm), ⌘A select page.
- Countdown <5min → row left-border amber; anti-snipe extension event flashes row.
- Specialist sees only `specialist_id=me` (filter locked); seller `seller_profile_id=me`, actions disabled.
- Manual end during final minute: modal shows "Anti-snipe võib lõppu pikendada — kinnita lõplik aeg" re-check before submit.
- Pagination server-side (25/page); filter+sort preserved.

## Data & API
`GET /api/admin/auctions?where=…&sort=…&page=` (Payload-style); mutations `PATCH /api/admin/auctions/:id/status`, `POST /api/admin/auctions/:id/end-manual {reason, outcome}`, `POST /api/admin/auctions/:id/relist`, `POST /api/admin/auctions/bulk-schedule`. Live updates: SSE refresh of visible rows (countdowns, bid counts).

## States
Empty: "Filtritele vastavaid oksjone ei leitud" + "Tühjenda filtrid". Loading: 25 skeleton rows. Bulk-validation error toast: "Valimis on oksjone, mida ei saa ajastada".

## Copy (Estonian, draft)
"Uus oksjon" · "Ajasta avaldamine" · "Lõpeta käsitsi" · "Lõpetamise põhjus (kohustuslik)" · "Sisesta põhjus" · "Kinnitan lõpetamise — see on pöördumatu" · "Märgi müümata" · "Kuuluta võitjaks praegune kõrgeim pakkumine" · "Arhiivi" · "Avalda uuesti" · "Dupl" · "Pakkumisi ootel" · "Automaatselt pikenenud lõpp".

## Permissions & audit
Audit-logged: manual end (reason), archive (reason), bulk schedule, export. Not logged: view/filter. Specialist may not export (data-minimisation).

## Bulk actions detail
- **Ajasta avaldamine modal**: shows N selected drafts; single shared startTime picker (TZ note); per-row endTime preview column (existing durations kept, editable via "nihuta kõiki lõppe ×h"); validation: all must be status=draft, all must have endTime set; success toast "Ajastatud N oksjoni" with link to scheduled filter.
- **Ekspordi valitud**: CSV columns = visible columns + cadastres, registryNumbers, finalPrice, specialist, fee%; filename `oksjonid-{filter}-{date}.csv`.
- Selection persists across pagination (badge "valitud 12 / filtri 240 — [tühista]").

## Keyboard map
↑/↓ row focus · Enter Vaata · E Muuda · D dupleeri · X Lõpeta (opens confirm) · S toggle selection · ⌘A select page · Esc closes modals/dropdowns.

## Accessibility
Table rows are focusable (`tabindex=0`); StatusPill has text (not colour only); countdown cells get `aria-label` full datetime; bulk bar is a focus-trapped toolbar when visible.

## Error & edge states
- Manual-end reason <5 characters → submit disabled, hint "Kirjuta põhjus (min 5 tähemärki)".
- Ending auction row while user hovers: SSE refresh preserves hover; row animates to ended status.
- Duplicate action on a package lot prefills packageTable rows too.
- Export running: button spinner → file download; failed → toast "Eksport ebaõnnestus — proovi uuesti" (logged).

## Copy additions (Estonian, draft)
"Lõpp kuupäeval" · "Lõpp vahemik alates / kuni" · "Kiiroksjonid" · "Ajastatud" · "Müümata" · "Leping" · "Lõpetatud" · "Arhiivitud" · "Valitud {n}" · "Ajasta valitud oksjonid" · "Kõik lõpuajad nihkuvad {h} tundi" · "Filtritele vastavaid oksjoneid ei leitud" · "Eksport ebaõnnestus — proovi uuesti".

## Open questions
- Should re-list link old and new lots for statistics continuity (parent_id)?
- CSV export of bids included here or only in 04?
- Row density toggle (compact 32px / normal 40px) persisted per user?
