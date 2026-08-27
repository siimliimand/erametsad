# Oksjoni koostamine — Auction editor (wizard)

> **In brief:** Create and edit an auction through a step-by-step wizard.
| Area | admin |
|---|---|
| **Route** | `/oksjonid/uus` and `/oksjonid/:id/muuda` |
| **Access** | admin, superadmin; specialist (own lots; cannot change specialist assign, cannot override fee) |
| **In nav** | from 02 toolbar / row action |

## Purpose & user goals
Create and edit the complete lot model (plan §5.4) through a 7-step wizard with autosave, validation summary and a diff-review before publishing. This is the densest form in the system.

## Wireframe (desktop)
```
┌──────────────────────────────────────────────────────────────────────┐
│ Oksjon #4810 · Lepsi   Olek: MUSTAND (salvestatud 12:41)  [Eelvaade] │
├──────────────┬───────────────────────────────────────────────────────┤
│ 1 Tüüp&meh. ●│  ┌─ Step 3 / 7 — Maa & mets ────────────────────────┐ │
│ 2 Asukoht  ●│  │ Pindala (ha)*      [12.4   ]                      │ │
│ 3 Maa&mets ◀│  │ Raiemahu (m³)      [980    ]                      │ │
│ 4 Hind     ○│  │ Katastritunnused   [+ lisa] 34801:001:0217 ✓      │ │
│ 5 Sisu     ○│  │ Kinnistu reg.-nr   [+ lisa] 150934                │ │
│ 6 Pakett   ○│  │ Puuliigid (24)     [MA.KU.NU ▾] 3 valitud         │ │
│ 7 Ülevaade ○│  │ Raieliigid         [VR HR ▾] 2 valitud             │ │
│              │  │ Eraldised          [+ lisa] "4 VR"                │ │
│ ⚠ 2 viga    │  │ Metsateatise nr    [+ lisa] 50001182112           │ │
│ [Salvesta]  │  │ Raie tähtaeg [31.12.2027] Väljaveo täht. [—]      │ │
│ [Avalda →]  │  │ Kooskõlastused [Ostja ▾] Väljaveoteed [Ostja ▾]   │ │
│              │  │ ☐ Maal on rendileping  → tähtaeg [—]              │ │
│              │  └───────────────────────────────────────────────────┘ │
└──────────────┴───────────────────────────────────────────────────────┘
```
Step 6 hidden unless objectType=package. Mobile: steps become top dropdown + linear form.

## Block-by-block spec — steps
**Step 1 Tüüp ja mehaanika**
- Objekti tüüp*: radio forest / property / field / package (cards with icons). Choosing property/field/package auto-sets auctionType=sealed (open disabled with tooltip "Kinnistu/põllumaa/pakett müüakse pimepakkumisega"; admin may still not override — hard rule).
- Oksjoni tüüp*: avatud (tõusev) / suletud (pimepakkumine). bidStep shown only in step 4 if open.
- ☐ Kiiroksjon (48 h) — toggle; sets defaults: duration 48h, minBid €1 (editable), enables reservePrice (step 4, secret).
- ☐ Automaatselt pikenev lõpp (anti-sniping) + N minutes input (default from settings 13; 1–30). Helper text: "Viimase N minuti jooksul tehtud pakkumine pikendab lõppu N minuti võrra."
- Algus* / Lõpp*: datetime pickers, TZ Europe/Tallinn always displayed ("UTC+3 suvi"); validation: start > now+10min for new publishes, **min duration 1 h** (kiiroksjon: exactly 48h suggested, 24–72 allowed), max 90 days; endTime editable later only by admin (logged).

**Step 2 Asukoht**
- Maakond* select (15) → Vald* cascading select (filtered by county).
- Aadress (küla/tanav) text. Koordinaadid: map picker (`MapEstonia`, Maa-amat ortho, click-to-pin, drag adjust, lat/lng inputs mirrored).
- Autolinks (read-only, generated): kataster kaart `ky.kataster.ee`, Metsaregister `register.metsad.ee` — built from first cadastral / registry number; " Ava" buttons.

**Step 3 Maa ja mets**
- Pindala ha* (0.01–10000), Raiemahu m³ (forest only).
- Katastritunnused* repeater — validation regex `^\d{5}:\d{3}:\d{4}$` ("XX:XXX:XXXX"), inline error "Vorming peab olema 34801:001:0217".
- Kinnistu register numbers repeater (numeric). Puuliigid multi-select, 24 fixed codes (MA.KU.NU.LH.SD.TS.TA.SA.VA.JA.KP.KS.HB.LM.LV.PN.PP.PA.SP.PK.TY.KL.KD.RE.TM.PI) with Estonian names in dropdown. Raieliigid multi-select (AR,HL,HR,KR,LR,RD,SR,TR,VE,VR). Eraldised repeater free text ("4 VR"). Metsateatise nr repeater (numeric 8–12).
- Raie teostamise tähtaeg date; Väljaveo tähtaeg date (≥ raie tähtaeg warning). Kooskõlastused select: müüja/ostja/kooskõlastatud; Väljaveoteed select same options. ☐ Rendi-/kasutusleping maal → rendi tähtaeg date.

**Step 4 Hind**
- Alghind* € (kiiroksjon default 1). Pakkumise samm € — open only, ≥1, integer suggested.
- Piirhind (reserve) — kiiroksjon & sealed; **secret**: after first save shows `••••••`; "Muuda" requires re-entry of full value (no partial reveal), masked in audit diffs, never shown to specialists/sellers.
- Teenustasu ülekaal (fee override) % — admin+ only; blank = global default (3% shown greyed placeholder).

**Step 5 Sisu**
- Nimi* (also used as display; auto-suggest from cadastral address). Alias e-mail — auto-generated read-only (e.g. `mt27082601@oksjonid.eametsad.ee`), regenerate button (logged).
- Spetsialist* assign select (admin only for reassign). Avalikuks info / Täiendav info: rich text editors (Lexical-style toolbar: H2/H3, bold, lists, links, table).
- Pilt* (hero) + galerii `images[]`: upload, drag order, focal-point picker per image, alt text required (accessibility gate on publish). Failid `files[]`: PDF only ("Takseer", "Metsateatised" tag select per file).

**Step 6 Pakett** (objectType=package only)
- Kinnistute arv* int. Paketi kirjeldus rich text.
- Paketi tabel row editor: columns [Katastritunnus, Kinnistu nr, Maakond, Pindala ha, Alghind €] add/remove/reorder rows; footer auto-sum; CSV paste-import ("Kleebi tabel") parsing tab/comma.

**Step 7 Ülevaade ja avaldamine**
- Read-only summary of all steps + inline "Muuda" links back.
- On edit of an existing published lot: **diff view** — two-column before/after, changed fields highlighted, secret fields "muudetud (varjatud)".
- Validation summary panel: all errors across steps, click-to-jump. Gate list: alt texts present, min required media, deadlines coherent, specialist set.
- Publish actions: `Salvesta mustandina` · `Ajasta` (status=scheduled, publishes at startTime) · `Avalda kohe` (status=active, startTime=now; requires start ≤ now ≤ end). `Eelvaade külalisena` link (portal preview route with draft token).

## Interactions & edge cases
- **Autosave**: every 10s idle / on step change / field blur → `PUT` draft; indicator "Salvestatud HH:MM"; conflict handling: if another admin edits same lot, banner "Seda oksjoni muudab ka Kaire — muudatused võivad üle kirjutada" with lock option.
- Editing an active auction: only content fields (info, images, files) editable; mechanics (times, price, type) locked — "Aktiivse oksjoni mehaanikat muuta ei saa"; force requires 02 manual-end + relist.
- reservePrice masked even in browser devtools (never sent back — write-only field).
- Keyboard: ⌘S save, ⌘⏎ next step, step numbers 1–7 jump.
- Every publish/audit note field: optional "Märkus auditile" on publish action.

## Data & API
`POST /api/admin/auctions` (create draft), `PATCH /api/admin/auctions/:id` (autosave), `POST /api/admin/auctions/:id/publish {mode: now|scheduled, auditNote}`, `GET :id/diff` (since last publish). Uploads via signed media endpoints; images processed to 350×175 thumbs + web sizes.

## States
Draft autosaved badge; "Avaldamine blokeeritud — 3 viga" disabled primary; preview token link expiry 24h; specialist step 4 fee override field hidden.

## Copy (Estonian, draft)
"Oksjoni koostamine" · "Tüüp ja mehaanika" · "Automaatselt pikenev lõpp" · "Kiiroksjon (48 h)" · "Lõpp peab olema vähemalt 1 tund pärast algust" · "Katastritunnuse vorming: 34801:001:0217" · "Piirhind on salajane — müüja ja avalik vaade seda ei näe" · "Sisesta piirhind uuesti" · "Ülevaade ja avaldamine" · "Avalda kohe" · "Ajasta" · "Eelvaade külalisena" · "Aktiivse oksjoni mehaanikat muuta ei saa" · "Märkus auditile (valikuline)".

## Permissions & audit
Audit-logged: create, publish (scheduled/now), field diffs on save (secret masked), reserve set/changed (value hidden, fact logged), alias regenerate, fee override. Specialist restrictions: no fee override, no specialist reassign, no time changes on published lots.

## Validation summary (step 7 gate — full list)
| Gate | Rule |
|---|---|
| Tüüp | objectType + auctionType set; sealed forced for property/field/package |
| Ajad | start ≥ now+10 min (new), end − start ≥ 1 h (kiiroksjon 24–72 h), end ≤ start+90 d |
| Asukoht | county+parish set; coordinates present (warning only if missing) |
| Maa & mets | area > 0; cadastres ≥ 1, all regex-valid; volume set if forest; loggingDeadline ≤ removalDeadline (warning) |
| Hind | minBid ≥ 0; bidStep ≥ 1 if open; reserve (kiiroksjon) required |
| Sisu | name; specialist; hero image; every image alt text; ≥1 file tagged (warning only) |
| Pakett | propertyCount ≥ 2; packageTable row count matches propertyCount (warning if mismatch) |
Each failed gate links to the exact step + field.

## Repeater behaviour (shared component)
Cadastres / registryNumbers / compartments / forestNotifications / packageTable all use one repeater: add row button, inline validation on blur, duplicate-value warning, paste-multi (one per line), remove with undo snackbar. Order preserved for arrays.

## Rich text rules
- Toolbar: H2, H3, bold, italic, bulleted/numbered list, link (internal picker + URL), table (extraInfo only), clear-format.
- Paste sanitised to allowlist (no styles/scripts); links force `rel="noopener"`.
- Character count shown; 20 000 char soft cap.
- Both info fields support {{placeholder}}-free plain authoring — no templating here (contracts only, 08).

## Media pipeline
Upload (jpg/png/webp, max 15 MB, min 1200px) → stored original + renditions (hero 1600×1000, thumb 350×175, gallery 1200×750). Focal point drives all crops. PDF files max 25 MB, tag select (Takseer / Metsateatised / Muu), stored in per-lot folder; filename kept for download familiarity.

## Keyboard & autosave UX
⌘S save now · ⌘⏎ next step · ⌘⇧⏎ previous · digits 1–7 jump · Esc closes modals. Autosave toast silent (only status text changes); on network failure status turns red "Salvestamine ebaõnnestus — muudatused on ainult selles brauseris" with retry.

## Accessibility
Steps are an `ol` with `aria-current`; errors announced via live region; map picker has lat/lng text inputs as keyboard alternative (never mouse-only); masked reserve field uses `type=password`-style masking with explicit label.

## Open questions
- Allow open-auction raieõigus as sealed (reference did both) — keep both options for forest?
- Should draft preview tokens be shareable externally with the seller?
- Package CSV paste import delimiter auto-detect (tab vs comma) or fixed tab?
