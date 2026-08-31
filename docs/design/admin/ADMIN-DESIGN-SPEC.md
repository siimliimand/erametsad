# Eametsad Admin — Comprehensive UI/UX Design Specification for Designers

> **Purpose:** This document provides a complete, screen-by-screen design specification for sketching and prototyping all pages of the **Eametsad Admin Platform** (`admin.eametsad.ee`). Every view, component, data table, modal, drawer, state, and interaction pattern is specified in full detail to allow immediate sketching in Figma, Sketch, or Penpot.

---

## 1. Global Shell & Layout Architecture

### 1.1 Canvas & Grid Specs
- **Default Desktop Artboard:** `1440 × 900 px` (Standard design canvas; fluid up to 1920px).
- **Minimum Desktop Width:** `1280 px`.
- **Mobile Artboard:** `390 × 844 px` (Responsive fallback: sidebar collapses to bottom bar / hamburger drawer, tables become cards).
- **Grid Layout:** 
  - Left Fixed Rail: `56 px` width.
  - Main Canvas: Flexible (`calc(100vw - 56px)`), standard content container max-width `1400 px` with `24 px` horizontal padding.
  - Spacing Units: 4px base (`4`, `8`, `12`, `16`, `24`, `32`, `40`, `48`, `64 px`).

---

### 1.2 Global Design Tokens

#### Color Palette
| Token | Hex Value | Usage in Admin |
|---|---|---|
| `--primary` | `#012d1d` | Active rail indicator, primary buttons, active tabs, main headings |
| `--primary-hover` | `#1b4332` | Primary button hover, sidebar hover |
| `--primary-dark` | `#16382A` | Hero cards, dark header bars |
| `--primary-light` | `#c1ecd4` | Subtle mint background for count pills, selected row highlights |
| `--accent` | `#58B368` | Success badges, positive deltas, contract signed state |
| `--cta` | `#F2A93B` | Call-to-action buttons, ending soon warnings (<1h), amber alert pills |
| `--cta-hover` | `#D98F1F` | CTA button hover state |
| `--ink` | `#181a2e` | Primary body text, table headers, dark labels |
| `--ink-muted` | `#414844` | Secondary text, timestamps, table column headers, helper text |
| `--ink-inverse` | `#FFFFFF` | Text on dark buttons, sidebar icon highlights |
| `--bg-page` | `#fbf8ff` | Main background (pale lavender-tinted warm surface) |
| `--bg-mist` | `#f4f2ff` | Section alternates, card headers, table hover rows |
| `--border` | `#c1c8c2` | Card borders, input outlines, table row dividers |
| `--danger` | `#B3261E` | Destructive buttons, anti-snipe <5m, error text, banned status |
| `--danger-light` | `#FBEAE9` | Danger alerts, error background banners, diff removals |
| `--info` | `#2D6FA8` | Information banners, scheduled status, help tooltips |
| `--info-light` | `#E9F1F7` | Info chips, scheduled status background |

#### Status Palette (Exact Semantic Map)
- **Draft (`mustand`):** Text `#414844`, background `#EBEBEB`, dot `#6B7570`
- **Scheduled (`ajastatud`):** Text `#1F4E79`, background `#E9F1F7`, dot `#2D6FA8`
- **Active (`aktiivne`):** Text `#1B6338`, background `#E8F6ED`, dot `#2E9E5B` (pulses green when ending <1h)
- **Ending Soon (<5 min):** Text `#941E17`, background `#FBEAE9`, dot `#B3261E` (blinking dot)
- **Ended (`lõppenud`):** Text `#8F590A`, background `#FEF5E7`, dot `#F2A93B`
- **Unsold (`müümata`):** Text `#B3261E`, outline border `#B3261E`, background transparent
- **Contract (`leping`):** Text `#236B3B`, background `#EBF7F0`, dot `#58B368`
- **Completed / Archived (`arhiivis`):** Text `#414844`, background `#ECEEEB`, dot `#6B7570`

#### Typography
- **Headings (`--font-heading`):** `Public Sans`, weights `600` (SemiBold) and `700` (Bold).
- **Body & UI (`--font-body`):** `Inter`, weights `400` (Regular), `500` (Medium), `600` (SemiBold). Latin-ext subset with full Estonian diacritic support (`õ`, `ä`, `ö`, `ü`, `š`, `ž`).
- **Data, Prices & Timestamps (`--font-mono`):** `JetBrains Mono`, tabular figures (`tnum`), weights `400`, `500`.
- **Scale:**
  - H1 Page Title: `28 px` / `34 px` line-height, weight 700.
  - H2 Section Title: `20 px` / `26 px`, weight 600.
  - H3 Subsection / Card Title: `16 px` / `22 px`, weight 600.
  - Body Text: `14 px` / `20 px`, weight 400.
  - Dense Table Text: `13 px` / `18 px`, weight 400 / 500.
  - Micro / Labels / Badges: `12 px` / `16 px`, weight 500.
  - KPI Hero Numbers: `32 px` / `36 px`, weight 700 (JetBrains Mono).

---

### 1.3 The Global Shell Layout

```
┌──────┬─────────────────────────────────────────────────────────────────────────────┐
│ ◉ LOG│ [PROD]  Eametsad haldus  ──  [ 🔍 Otsi kõike... (⌘K) ]        🔔 [3] 👤 Marit ▾│
├──────┼─────────────────────────────────────────────────────────────────────────────┤
│ ⌂ 01 │  ⚠ VAADELD KASUTAJANA: Jaan Torn (sessioon lõpeb 14:32)   [ LÕPETA VAATLUS ]│
│ ▤ 02 ├─────────────────────────────────────────────────────────────────────────────┤
│ ⇄ 04 │ Breadcrumb: Oksjonid > #4810 Lepsi kinnistu > Pakkumised                    │
│ ✉ 05 │ Page Header: H1 Title                                       [ Action CTA ]  │
│ ☰ 06 ├─────────────────────────────────────────────────────────────────────────────┤
│ 🗎 08 │                                                                             │
│ ◉ 09 │                                                                             │
│ ⛁ 10 │                              MAIN WORKSPACE                                 │
│ ✎ 11 │                                                                             │
│ 📊 12 │                                                                             │
│ ⚙ 13 │                                                                             │
│ 🛡 14 │                                                                             │
└──────┴─────────────────────────────────────────────────────────────────────────────┘
```

#### 1. Left Icon Rail (Fixed `56 px` width, full height)
- **Top:** Eametsad Monogram / Spruce logo mark (`32 × 32 px`, forest green `#012d1d` on light background).
- **Navigation Icons (Lucide Icons, 20px, vertically centered in 40×40px target):**
  1. `LayoutDashboard` → **Töölaud** (Dashboard)
  2. `Gavel` → **Oksjonid** (Auctions list)
  3. `Activity` → **Pakkumised** (Live bids & under-bids)
  4. `KeyRound` → **Sul. avamine** (Sealed opening ceremony)
  5. `Users` → **Kasutajad** (Users & rights)
  6. `Building2` → **Ettevõtted** (Company approvals)
  7. `FileSignature` → **Lepingud** (Contracts & templates)
  8. `Kanban` → **Juhtlõimed** (Leads CRM)
  9. `SendHorizontal` → **Päringud** (Service requests)
  10. `FileEdit` → **Sisuhaldus** (CMS content)
  11. `BarChart3` → **Statistika** (Analytics & BI)
  12. `Settings` → **Seaded** (Platform settings)
  13. `ShieldCheck` → **Auditlogi** (Audit log)
- **Item States:**
  - *Default:* `#414844` ink-muted.
  - *Hover:* Background `rgba(1, 45, 29, 0.06)`, icon `#012d1d`. Tooltip pops on the right (dark badge, 12px Inter).
  - *Active:* 3px solid `#012d1d` left indicator line, background `rgba(1, 45, 29, 0.1)`, icon `#012d1d`.
  - *Badge Pill:* Floating red/amber dot if items require urgent action (e.g. pending company approvals or sealed bids awaiting opening).

#### 2. Topbar (`64 px` height, sticky `top-0`, white bg, bottom border `#c1c8c2`)
- **Left:** Environment badge pill:
  - `PROD` (Green `#E8F6ED` / `#1B6338`)
  - `STAGE` (Amber `#FEF5E7` / `#8F590A`)
  - `DEV` (Red `#FBEAE9` / `#B3261E`)
  - Platform Title: `Eametsad haldus` (Public Sans 600, 15px).
- **Center:** Global Search Input Bar (width `420 px`, height `36 px`, radius `8 px`, bg `#f4f2ff`, placeholder: `"Otsi oksjoneid, kasutajaid, juhtlõimi... (⌘K)"`, icon `Search` left, shortcut badge `⌘K` right).
- **Right:**
  - Notification Bell (`Bell` icon, unread counter pill `3`, click opens popover with recent events).
  - User Profile Menu: Avatar (`32 px` circle with initials or photo) + Name (`Marit Vain`) + Role Chip (`Admin`) + chevron down.

#### 3. Impersonation Warning Banner (Conditional)
- **Dimensions & Visuals:** Fixed strip below topbar, height `40 px`, vibrant amber background `#F2A93B`, text `#012d1d` (Public Sans 600, 13px).
- **Content:** Warning triangle icon + `"Vaatled keskkonda kasutajana: Jaan Torn (38705162718) — Kirjutustegevused on blokeeritud — Sessioon aegub 14:32"` + Button `[ LÕPETA VAATLUS ]` (pill button, white bg, dark text, hover lift).

---

## 2. Page-by-Page Detailed Sketching Specifications

---

### Page 01: Töölaud — Dashboard
**Route:** `/`  
**Access:** All staff roles (Specialist, Seller, Admin, Superadmin — customized per role).  
**Purpose:** Daily operational control room. Shows critical queues, live countdowns of ending auctions, incoming leads, and system health.

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ KPI STRIP (7 Cards horizontal scroll / grid):                                               │
│ [ Aktiivsed: 36 ] [ Lõpevad täna: 4! ] [ Pakkumisi: 87 ] [ Ootel: 3+5 ]                   │
│ [ Uued juhtlõimed: 6 ] [ Allkirja ootel: 9 ] [ Tasud kuus: 12 480 € ]                       │
├─────────────────────────────────────────────────────────────┬───────────────────────────────┤
│ LÕPEVAD TÄNA (Live SSE Table)                               │ SÜSTEEMI TERVIS               │
│ #4810 Lepsi raieõigus   12 ha  00:14:32  7 500 € [▶ Monitor]│ Queue lag:    0.4 s        ●  │
│ #4812 Ööviiuli kinnistu 21 ha  02:41:05  3 suletud [▶ Ava]  │ Failed jobs:  0            ●  │
│ #4815 Kõpu pakett       86 ha  04:12:00  12 000 € [▶ Mon]   │ SSE ühendusi: 214          ●  │
│                                           [ Vaata kõiki → ] │ Integratsioonid: Kõik OK   ●  │
├─────────────────────────────────────────────────────────────┼───────────────────────────────┤
│ KIIRE TEGEVUS (Action Queues)                               │ VIIMASED JUHTLÕIMED           │
│ ▸ Ettevõtte taotlused ootel (3 uut)               [ Ava → ] │ 11:40  Mikk T. (Harju, kava)  │
│ ▸ Alapakkumised ootel (5 vajab otsust, vanim 3p)  [ Ava → ] │ 10:15  Piret K. (Pärnu, raie) │
│ ▸ Lepingud allkirjastamisel (9 saadetud)          [ Ava → ] │ 09:02  Jüri R. (Võru, ost)    │
└─────────────────────────────────────────────────────────────┴───────────────────────────────┘
```

#### Detailed Blocks:
1. **KPI Cards Strip (7 items):**
   - *Card Anatomy:* White card, 8px radius, 16px padding, subtle shadow. Label (12px muted), Metric (28px Mono bold), Subtitle / trend indicator (12px: e.g. `▲ +12% vs eile`).
   - Cards:
     1. *Aktiivsed oksjonid:* `36` (+4 planeeritud).
     2. *Lõpevad täna:* `4` (Amber highlight badge if >0; click filters auctions list).
     3. *Pakkumisi täna:* `87` (+ 7 päeva miniatuurne sparkline graafik).
     4. *Ootel kinnitamisel:* `3 + 5` (3 ettevõtet + 5 alapakkumist; punane tekst kui >0).
     5. *Uued juhtlõimed:* `6` (tänased käsitlemata päringud).
     6. *Allkiri ootel:* `9` (saadetud lepingud).
     7. *Teenustasu kuu jooksul:* `12 480 €` (prognoos, info tooltip).
2. **Lõpevad täna (Table Card, 2/3 width):**
   - Header: `"Lõpevad täna"` + live pulse indicator (`● Reaalajas`).
   - Columns: Lot ID + Nimi (link), Tüüp (ikoon + badge), Pindala, Live Countdown (`JetBrains Mono`, punane/vilkuv kui <5 min), Hetke parim pakkumine, Tegevusnupp (`[▶ Monitor]` roheline outline nupp).
   - Anti-snipe efekt: Rea taust välgatab roheliselt kui oksjon pikeneb +5 min.
3. **Süsteemi tervis (Card, 1/3 width - Admin/Superadmin only):**
   - Status rows with colored dots:
     - *Queue lag:* `0.4 s` (roheline dot; punane kui >5s).
     - *Failed jobs 24h:* `0` (roheline dot; punane link kui >0).
     - *SSE klientide ühendusi:* `214`.
     - *eID / Äriregister / SMS lüüs:* Kõik rohelised indikaatortäpid.
4. **Kiire tegevus (Action Queues Card):**
   - 3 prominent action rows with badge counts and arrow buttons:
     - Ettevõtte taotlused (3 ootel) → viib `/ettevotted`.
     - Alapakkumised kinnitamisel (5 ootel, märge: "vanim 3 päeva") → viib `/pakkumised`.
     - Lepingud allkirja ootel (9 saadetud) → viib `/lepingud`.
5. **Viimased juhtlõimed (Recent Leads):**
   - Mini list of latest 8 inquiries: Kell, Allikas chip, Kliendi nimi, Maakond, Määratud spetsialist (või punane `"määramata"` chip).

---

### Page 02: Oksjonid — Auctions List
**Route:** `/oksjonid`  
**Tabs:** `Kõik (4823)` | `Raieõigus (2401)` | `Kinnistud (1902)` | `Põllumaad (68)` | `Paketid (452)` | `Kiiroksjonid (⚡ 14)`  
**Access:** Full: Admin, Superadmin. Scoped: Specialist (own lots), Seller (own lots read-only).  
**Purpose:** Primary operational overview of all auctions with advanced filtering, bulk operations, and status controls.

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ [ Kõik 4823 ] [ Raieõigus 2401 ] [ Kinnistud 1902 ] [ Põllumaad 68 ] [ Paketid 452 ] [⚡Kiiroks 14] │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│ [ + Uus oksjon (⌘N) ]                                       [ 📥 Ekspordi CSV ] [ ⚙ Veerud ]│
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│ FILTRID: [ Olek: Kõik ▾ ] [ Maakond: Vali ▾ ] [ Spetsialist: Vali ▾ ] [ Kuupäev: Alates—Kuni ]│
│          [ 🔍 Otsi nime, katastri, ID järgi... ]             [ × Tühjenda filtrid (3 aktiivset) ]│
├───┬────┬─────────────────────┬──────┬─────────┬────────┬───────┬───────┬──────┬─────┬──────┤
│ ☐ │ ID │ Nimi                │ Tüüp │ Olek    │Maakond │ ha/m³ │ Algh. │Pakk. │Lõpp │Spets.│
├───┼────┼─────────────────────┼──────┼─────────┼────────┼───────┼───────┼──────┼─────┼──────┤
│ ☐ │4810│ Lepsi kinnistu      │ 🌲 A │●Aktiivne│ Tartu  │12/980 │3 000 €│14    │00:14│ M.V. │
│ ☐ │4812│ Ööviiuli ⚡         │ 🏠 S │●Aktiivne│ Saare  │21/—   │45 000 │3 (p) │02:41│ K.M. │
│ ☐ │4809│ Kõpu metsapagett    │ 📦 S │◻Mustand │ Hiiu   │86/—   │—      │0     │28.08│ M.V. │
│ ☐ │4801│ Kuusiku lank        │ 🌲 A │✕Müümata │ Pärnu  │8/640  │12 000 │1     │Lõpp.│ T.K. │
└───┴────┴─────────────────────┴──────┴─────────┴────────┴───────┴───────┴──────┴─────┴──────┘
[ BULK BAR: 2 valitud ] -> [ ⏰ Ajasta avaldamine... ] [ 📥 Ekspordi valitud ] [ × Tühista ]
```

#### Detailed Blocks:
1. **Header & Tabs:**
   - Tabs row matching portal object types with live count badges.
   - Action buttons: Primary `[ + Uus oksjon ]` (Forest green pill, ⌘N), `[ Ekspordi CSV ]`, `[ ⚙ Veerud ]` (veergude valik).
2. **Filter Bar (Collapsible / Sticky):**
   - Dropdown chips:
     - *Olek:* Multi-select checkboxes (Mustand, Ajastatud, Aktiivne, Lõppenud, Müümata, Lepingus, Arhiivis).
     - *Tüüp:* Raieõigus / Kinnistu / Põllumaa / Pakett × Avatud / Suletud.
     - *Maakond:* 15 Eesti maakonda.
     - *Spetsialist:* Töötajate nimekiri.
     - *Kuupäevavahemik:* Kalendri picker (Alates — Kuni).
     - *Vabateksti otsing:* ID, nimi, katastritunnus, reg kood, e-posti alias.
3. **DataTable Columns (40px row height, sortable headers):**
   - `Checkbox` (Rea valik massitegevusteks).
   - `ID` (Monospace, link detailvaatesse).
   - `Nimi` (Objekti nimi; Kiiroksjoni puhul kollane `⚡` ikoon).
   - `Tüüp` (Ikoon: 🌲 Raie / 🏠 Kinnistu / 🌾 Põld / 📦 Pakett + täht `A` avatud / `S` suletud).
   - `Olek` (Värviline `StatusPill`).
   - `Maakond` (Tekst).
   - `ha / m³` (Pindala hektarites ja maht tihumeetrites, paremale joondatud).
   - `Alghind` (€ Monospace).
   - `Pakkumisi` (Arv; kui ootel alapakkumisi, siis merevaigukollane `(p)` lisa).
   - `Lõpp` (Live countdown aktiivsetel, fikseeritud kuupäev lõppenutel).
   - `Spetsialist` (Initiaalide ringavatar).
4. **Row Actions (Hover State):**
   - Rea kohale liikudes ilmuvad paremale tegevusnupud:
     - `[ Vaata ]` (avab portaali uuel vahelehel)
     - `[ Muuda ]` (viib wizardisse 03)
     - `[ Dupl. ]` (kopeerib uueks mustandiks)
     - `[ Lõpeta käsitsi ]` (ainult aktiivsel, admin+ rollile)
     - `[ Arhiivi ]` / `[ Avalda uuesti ]`
5. **Bulk Action Bar (Ilmub kui valitud ≥1 rida):**
   - Ujuv riba ekraani allservas: `"Valitud N oksjonit"` + nupud:
     - `[ Ajasta avaldamine ]` (avab modaali ühise algusaja määramiseks)
     - `[ Ekspordi valitud CSV ]`
6. **Modal: Lõpeta käsitsi (Destructive Guarded Modal):**
   - Hoiatav punane ikoon: `"Lõpetamine on pöördumatu"`.
   - Info: Hetke kõrgeim pakkumine ja pakkujate arv.
   - Raadionupud tulemuse valikuks: `[ Kuuluta praegune pakkumine võitjaks ]` või `[ Märgi müümata ]`.
   - Kohustuslik tekstiväli: `"Lõpetamise põhjus (min 5 tähemärki)"`.
   - Kinnitusnupp punane: `[ Kinnita lõpetamine ]`.

---

### Page 03: Oksjoni koostamine — Auction Editor Wizard
**Route:** `/oksjonid/uus` ja `/oksjonid/:id/muuda`  
**Access:** Admin, Superadmin, Specialist (piirangutega).  
**Purpose:** Comprehensive 7-step wizard to create and edit auctions with live autosave, validation checks, and diff review.

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ Oksjon #4810 · Lepsi kinnistu    Olek: MUSTAND  ● Autosaved 12:41          [ Eelvaade ↗ ]   │
├─────────────────┬───────────────────────────────────────────────────────────────────────────┤
│ 1 Tüüp&meh.   ✓ │ STEP 3 / 7: MAA JA METS                                                   │
│ 2 Asukoht     ✓ │ ───────────────────────────────────────────────────────────────────────── │
│ 3 Maa & mets  ● │ Pindala (ha)*:          [ 12.40      ]   Raiemaht (m³): [ 980       ]     │
│ 4 Hinnad      ○ │ Katastritunnused*:                                                        │
│ 5 Sisu & fail ○ │   [ 34801:001:0217                 ] [✓ Kehtiv Maa-ametis] [ ✕ Eemalda ]  │
│ 6 Pakett      — │   [ + Lisa teine katastritunnus ]                                         │
│ 7 Ülevaade    ○ │ Kinnistu registriosa nr: [ 150934                  ]                      │
│ ────────────────│ Puuliigid (24 koodi):   [ MA (Mänd) × ] [ KU (Kuusk) × ] [ + Vali ▾ ]    │
│ ⚠ 2 puudust     │ Raieliigid:             [ VR (Lageraie) × ] [ HR (Harvendus) × ]          │
│ [ Salvesta ]    │ Eraldised (vabatekst):   [ Eraldis 4 (1.2 ha, VR), eraldis 7 (2.1 ha)      ]│
│ [ Avalda → ]    │ Metsateatise number:    [ 50001182112              ]                      │
│                 │ Raie tähtaeg:           [ 31.12.2027 📅 ]  Väljaveo tähtaeg: [ 31.03.2028 ]│
│                 │ Kooskõlastused:         [ Ostja kohustus ▾ ]   Väljaveoteed: [ Olemas ▾ ] │
│                 │ ☑ Maal lasub kehtiv rendileping  →  Rendi lõpp: [ 01.05.2026 📅 ]         │
└─────────────────┴───────────────────────────────────────────────────────────────────────────┘
```

#### Detailed Step-by-Step Breakdown:
1. **Left Navigation Sidebar (Wizard Steps):**
   - Vertikaalne nimekiri: `1 Tüüp ja mehaanika`, `2 Asukoht`, `3 Maa ja mets`, `4 Hinnad`, `5 Sisu ja meedia`, `6 Pakett` (peidetud kui pole pakett-tüüp), `7 Ülevaade ja avaldamine`.
   - Igal sammul staatuse märk: roheline linnuke `✓` (täidetud), tühi ring `○` (täitmata), punane hüüumärk `!` (vead).
   - Allservas staatuse tekst: `"Mustand salvestatud 12:41"` + veateadete koondarv.
2. **Step 1: Tüüp ja mehaanika:**
   - Objekti tüüp (4 suurt valikukaarti ikoonidega): Raieõigus / Metsakinnistu / Põllumaa / Pakett.
   - Reegel: Kui valitakse Kinnistu, Põllumaa või Pakett, lülitub oksjoni tüüp automaatselt `Suletud (Pimepakkumine)` peale ja avatud valik lukustub selgitusega.
   - Oksjoni tüüp raadionupud: `Avatud (tõusev)` vs `Suletud (pimepakkumine)`.
   - Lüliti: `☐ Kiiroksjon (48h kiirmüük)` (määrab automaatselt algus- ja lõpuajad).
   - Lüliti: `☑ Automaatselt pikenev lõpp (anti-sniping)` + sisendväli: minutid (vaikimisi `5 min`).
   - Algusaeg ja Lõppaeg: Kuupäeva ja kellaaja valijad koos ajavööndi märkega (`Europe/Tallinn UTC+3`). Minimaalne kestus 1 tund.
3. **Step 2: Asukoht:**
   - Maakond (rippmenüü 15 maakonnaga) → Vald (kaskaad-rippmenüü vastavalt maakonnale).
   - Aadress / Küla (tekstiväli).
   - Interaktiivne kaardivalija (`MapEstonia` - Maa-ameti ortofoto kiht, klõpsa punkti määramiseks, lohista koordinaate). Koordinaatide väljad (laiuskraad / pikkuskraad).
   - Automaatlingid: Katastri kaart (`ky.kataster.ee`) ja Metsaportaal (`register.metsad.ee`).
4. **Step 3: Maa ja mets:**
   - Pindala (ha) ja Raiemaht (m³).
   - Katastritunnused (korduv repeater-komponent): Regex valideerimine `XXXXX:XXX:XXXX`. Reaalajas Maa-ameti kontrolli märge.
   - Kinnistu registriosa numbrid.
   - Puuliigid (mitmikvalik 24 standardsest koodist: MA, KU, KS, HB jne koos nimedega).
   - Raieliigid (mitmikvalik: Lageraie VR, Harvendus HR, Sanitaar SR jne).
   - Eraldised ja Metsateatise numbrid (repeater väljad).
   - Tähtajad: Raie teostamise tähtaeg ja Väljaveo tähtaeg.
5. **Step 4: Hinnad:**
   - Alghind (€).
   - Pakkumise samm (€) — kuvatakse ainult avatud oksjoni puhul (vaikimisi nt 100 € või 250 €).
   - **Piirhind (Salajane reserve price):**
     - Kiiroksjoni ja suletud pakkumise puhul.
     - Pärast salvestamist kuvatakse maskeeritult: `••••••`. Muutmiseks tuleb kogu number uuesti sisestada. Müüjatele ega spetsialistidele ei kuvata kunagi.
   - Teenustasu ülekaal (%): Ainult Admin/Superadmin rollile (tühi = süsteemi vaikimisi 3%).
6. **Step 5: Sisu ja meedia:**
   - Oksjoni pealkiri (automaatne soovitus katastrijärgsest nimest).
   - Automaatselt genereeritud unikaalne alias e-post (`mt27082601@oksjonid.eametsad.ee`).
   - Vastutav metsaspetsialist (rippmenüü töötajatest).
   - Avalik kirjeldus ja Täiendav info (Rich Text redaktor: H2, H3, paks, loendid, lingid, tabel).
   - Fotod: Päisefoto (Hero image) + galerii. Piltide lohistamine järjekorra muutmiseks, fookuspunkti valija (focal point), **kohustuslik alt-teksti väli igale pildile**.
   - Failid: Ainult PDF (Takseerandmed, Metsateatised, Piiriprotokoll). Sildistamine rippmenüüst.
7. **Step 6: Pakett (ainult pakett-tüübi puhul):**
   - Kinnistute arv kokku.
   - Paketi tabeli redaktor: Veerud [Katastritunnus, Reg. osa, Maakond, Pindala ha, Alghind €]. Ridade lisamine, kustutamine, CSV-st kleepimise võimalus.
8. **Step 7: Ülevaade, diff ja avaldamine:**
   - Kokkuvõte kõigist andmetest koos `"Muuda"` linkidega vastava sammu juurde.
   - Juba avaldatud oksjoni muutmisel: **Kaheveeruline Diff-vaade** (enne vs pärast, roheline/punane esiletõst).
   - Avaldamise eelsed kontrollid (Validation Gates):
     - Kas kõik kohustuslikud väljad on täidetud?
     - Kas igal pildil on alt-tekst?
     - Kas tähtajad on loogilises järjekorras?
   - Tegevusnupud:
     - `[ Salvesta mustandina ]`
     - `[ Ajasta avaldamine ]` (määratud algusajal)
     - `[ Avalda kohe ]` (muudab staatuse aktiivseks)
     - `[ Eelvaade külalisena ↗ ]` (avab portaali eelvaate spetsiaalse tokeniga).

---

### Page 04: Pakkumiste jälgimine — Bid Monitoring
**Route:** `/oksjonid/:id/pakkumised` (ja globaalne vaade `/pakkumised`)  
**Access:** Admin, Superadmin, Specialist (oma objektid), Müüja (ainult alapakkumiste otsustamine).  
**Purpose:** Realtime operational monitoring of incoming bids, live anti-snipe extensions, shill-bid heuristic alerts, and under-bid approval queue.

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ #4810 Lepsi raieõigus · AVATUD                           Lõpp: 00:14:32 ⏱ anti-snipe: 5 min │
│ Juhtiv pakkumine: 7 500 € (Pakkuja #14) · Samm: +250 €   [ Lõpeta käsitsi ] [ 📥 Ekspordi ] │
├─────────────────────────────────────────────────────────────┬───────────────────────────────┤
│ REAALAJAS PAKKUMISTE VOOG (SSE - Uusim eespool)             │ ANOMAALIAD & SHILL-HOIATUSED  │
│ 12:41:03  Pakkuja #14 (Tõnis K.)    7 500 €  [Käsitsi] ●Juht│ ⚠ 2 anomaaliat tuvastatud:    │
│ 12:40:55  Pakkuja #9  (Kalle T.)    7 250 €  [Auto]    ○Ület│ ▸ IP klaster (3 pakkujal sama │
│ 12:33:12  Pakkuja #9  (Kalle T.)    6 500 €  [Auto]    ○Ület│   IP räsi: 8f2e… ) [ Vaata ] │
│ 12:31:00  Pakkuja #7  (Anonüümne)   2 800 €  [Alapakk.] ⏳   │ ▸ Uued kontod (2 kontot <7 p, │
│           └── Alapakkumine: 200 € alla alghinna             │   teinud 8 pakkumist) [ Uuri ]│
├─────────────────────────────────────────────────────────────┴───────────────────────────────┤
│ OOTEL ALAPAKKUMISED (Vajab müüja või halduri kinnitust)                                    │
│ 2 800 € · Pakkuja #7 · Esitatud 11:58 (ootel 42 min)       [ Nõustu ja tee juhtivaks ]     │
│                                                            [ Keeldu põhjusega ▾ ]          │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│ ANTI-SNIPING PIKENDUSTE AJALUGU:                                                            │
│ 12:40:55 Pikenenud +5 min (Uus lõpp 12:50:55) — päästik: Pakkumine #9 (7 250 €)            │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

#### Detailed Blocks:
1. **Header KPI & Action Bar:**
   - Suur reaalajas tiksuv taimer.
   - Juhtiv pakkumine ja marginaal teise pakkuja ees.
   - Nupud: `[ Lõpeta käsitsi ]` ja `[ Ekspordi logi CSV ]`.
2. **Reaalajas pakkumiste voog (Live SSE Feed):**
   - Iga rida: Kellaaeg (hh:mm:ss), Anonüümne tähis (`Pakkuja #14`) + adminnile nime paljastamise kiip (klõpsates avaneb kasutaja profiil; iga paljastamine logitakse auditisse), Summa (€), Allika märgis (`[Käsitsi]` vs `[Automaatpakkuja]`), Olekumärk (`● Juhtiv`, `○ Ületatud`, `⏳ Ootel alapakkumine`).
   - Automaatpakkujate lahing: Kui kaks robotit teevad sekundite jooksul mitu sammu, pakitakse need visuaalselt kokku: `"Automaatpakkujate duell: 6 sammu (Laienda ▾)"`.
3. **Alapakkumiste haldus (Under-bids Queue):**
   - Eraldi esiletõstetud kollane blokk pakkumistest, mis on alla alghinna.
   - Tegevused:
     - `[ Nõustu ]` → Avaneb kinnitus: *"Aktsepteerimisel saab sellest ametlik juhtiv pakkumine ja teised osalejad saavad teavituse"*.
     - `[ Keeldu ]` → Kohustuslik tekstiväli keeldumise põhjusega, mis saadetakse pakkujale.
4. **Anomaaliate tuvastamise kaart (Shill Bidding Heuristics):**
   - Hoiatavad kaardid potentsiaalsete pettuste või kokkumängu tuvastamiseks:
     - *IP klaster:* Mitu pakkujat kasutavad sama võrguühendust (IP räsi kattuvus).
     - *Uute kontode burst:* Hiljuti registreeritud kasutajad teevad korduvalt agressiivseid pakkumisi.
     - *Kiire ületamise muster:* Kaks pakkujat vahetavad juhtpositsiooni alla 5 sekundi vahega.
   - Nupp: `[ Märgi sisejuurdluseks ]` (lisab kasutajale märke ilma avaliku hoiatuseta).
5. **Anti-snipe pikenduste logi:**
   - Kronoloogiline loend hetkedest, mil viimase 5 minuti jooksul tehtud pakkumine lükkas lõpuaega edasi.

---

### Page 05: Suletud pakkumiste avamine — Sealed-Bid Opening Ceremony
**Route:** `/oksjonid/:id/avamine`  
**Access:** Admin, Superadmin. **Kahe isiku reegel (Two-Person Rule):** Avaja + Eraldi kinnitaja.  
**Purpose:** Ceremonial, cryptographically verifiable unsealing of sealed bids after auction end. Absolute auditability.

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ #4812 Ööviiuli kinnistu · SULETUD OKSJON · LÕPPENUD 28.08 kell 14:00                        │
│ 🔒 Pakkumised on krüpteeritud. Registreeritud: 3 suletud pakkumist.                          │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│ ETAPILINE EELKONTROLL JA KAHE ISIKU ALLKIRJASTAMINE                                         │
│ ☑ 1. Lõppaeg möödas ja süsteemis kinnitatud (Worker 14:00:02 ✓)                             │
│ ☑ 2. Ootel alapakkumisi või vaidlusi ei ole ✓                                              │
│ ☑ 3. Kinnistu lepingumall kontrollitud: Versioon 3.1 (Aktiivne) ✓                           │
│ ─────────────────────────────────────────────────────────────────────────────────────────── │
│ ALLKIRJAD TSEREMOONIA ALUSTAMISEKS:                                                         │
│ ☑ AVAJA:      Marit Vain (Admin) — Kinnitatud 14:02:15 ✓                                    │
│ ☐ KINNITAJA:  Ootab teist isikut (Superadmin)...         [ Logi sisse ja kinnita ]          │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│ ┌─ DEKRÜPTEERITUD PAKKUMISTE EDETABEL ─────────────────────── [ ⚡ PALJASTA PAKKUMISED ] ─┐ │
│ │ Koht  Summa €     Pakkuja                    Esitamise aeg    Kehtivus     Erinevus     │ │
│ │ 1.    61 000 €    Tamm OÜ (Kalle Tamm)       26.08 09:12      ✓ Kehtiv     + 2 500 €    │ │
│ │ 2.    58 500 €    Tõnis Kask                 27.08 19:44      ✓ Kehtiv     + 6 500 €    │ │
│ │ 3.    52 000 €    Annika Saar                25.08 11:03      ✓ Kehtiv     —            │ │
│ │ * Viigi korral võidab ajaliselt varem esitatud pakkumine.                                │ │
│ └──────────────────────────────────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│ TULEMUSE KINNITAMINE                                                                        │
│ Juhtiv pakkumine: 61 000 € (Tamm OÜ)  ≥  Piirhind ületatud ✓ (Salajane piirhind: 55 000 €)  │
│ [ Kinnita võitja ja avalda lõpphind ]                 [ Tühista oksjon (põhjusega) ]        │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│ REAALAJAS AUDITILOGI KANNE: 14:02 Avaja allkiri · 14:03 Kinnitaja allkiri · 14:04 Dekrüpteeritud │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

#### Detailed Blocks:
1. **Turvalisuse päis ja olek:**
   - Kuni avamiseni näeb administraator vaid pakkumiste arvu (`3 suletud pakkumist`), mitte summasid ega pakkujaid.
   - Püsiv hoiatav auditiriba: `"Kõik tegevused sel lehel salvestatakse püsivasse auditlogisse"`.
2. **Eelkontrolli kontroll-leht (Pre-flight Checklist):**
   - Lõppaeg ametlikult fikseeritud.
   - Lahtiseid alapakkumisi pole.
   - Lepingumall on kehtiv.
3. **Kahe isiku allkirjastamise plokk:**
   - Esimene administraator klõpsab `[ Kinnita avajana ]` (nõuab kinnitussõna `AVAN` trükkimist).
   - Teine administraator (superadmin eraldi kontoga) peab samuti lehele tulema ja klõpsama `[ Kinnita avamise heakskiit ]`.
   - Mõlema isiku sessioonid seotakse tseremooniaga. Kui möödub üle 30 minuti, allkirjad aeguvad.
4. **Paljastamise tabel (Simultaneous Reveal Table):**
   - Nupp `[ ⚡ Paljasta pakkumised ]` dekrüpteerib kõik pakkumised ühekorraga.
   - Veerud:
     - Koht (1., 2., 3.).
     - Summa (€, Monospace, tuhandete eraldajatega).
     - Pakkuja (Täisnimi, varjatud isikukood/regkood, ettevõtte kiip, link profiilile).
     - Esitamise aeg (Täpne ajatempel; viigi korral kuvatakse märge `"Viik — võidab varasem esitus"`).
     - Kehtivus (Kehtiv / Kehtetu koos põhjendusega).
     - Vahe järgmise pakkumisega (+2 500 €).
5. **Võitja kinnitamine ja tagajärjed:**
   - Süsteem võrdleb automaatselt parimat pakkumist salajase piirhinnaga (reserve price).
   - *Kui piirhind on täidetud:* Roheline nupp `[ Kinnita võitja ja avalda lõpphind ]`. Selle vajutamisel:
     1. Lõpphind avalikustatakse portaalis.
     2. Võitjale genereeritakse leping ja saadetakse allkirjastamise kutse.
     3. Kaotajatele saadetakse neutraalne teavitus (teiste pakkumiste summasid ei avaldata).
   - *Kui piirhinda ei saavutatud:* Valikud: `[ Märgi müümata ]` või kiiroksjoni puhul `[ Käivita Eametsad varupakkumise ostutöövoog ]`.

---

### Page 06: Kasutajad & õigused — Users & Rights
**Route:** `/kasutajad` (nimekiri) ja `/kasutajad/:id` (detailvaade)  
**Access:** Admin, Superadmin.  
**Purpose:** User directory, managing personal vs company profiles, granting auction rights, enforcement (suspend/ban), support impersonation, and GDPR data requests.

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ Kasutajad   [ 🔍 Otsi nime, isikukoodi, e-posti, reg. koodi järgi... ]                      │
│ Filtrid: [ Profiil: Kõik ▾ ] [ Olek: Aktiivne ▾ ] [ Pakkumisõigus: Vali ▾ ] [ Maakond: Vali ▾]│
├───┬──────────────────────┬──────────────────┬───────────────┬────────────┬──────────────────┤
│ID │ Nimi / Isikukood     │ Profiilid        │ Oksjonite õig.│ Olek       │ Viimane sisselog.│
├───┼──────────────────────┼──────────────────┼───────────────┼────────────┼──────────────────┤
│82 │ Tõnis Kask           │ ○ Era  ● Tamm OÜ │ R✓ K✓ P— B—   │ ● Aktiivne │ 28.08 14:12      │
│   │ 3870516***** [👁]    │                  │ (12 pakkumist)│            │                  │
│79 │ Kalle Tamm           │ ○ Era            │ R✓ K— P— B—   │ ● Aktiivne │ 26.08 09:04      │
│   │ 3810214***** [👁]    │                  │ (3 pakkumist) │            │                  │
│64 │ Andres Mets          │ ○ Era  ● Metsad AS│ — (blokeeritud)│ ✕ Peatatud │ 12.07 10:00      │
└───┴──────────────────────┴──────────────────┴───────────────┴────────────┴──────────────────┘
DETAILVAATE DRAWER (Kasutaja #82: Tõnis Kask):
[ Identiteet ] [ Profiilid ] [ Õigused ] [ Lepingud ] [ Pakkumised ] [ Teavitused ] [ GDPR ]
─────────────────────────────────────────────────────────────────────────────────────────────
Isikukood: 38705162718  E-post: tonis@tamm.ee  Tel: +372 5123 4567  Autentimine: Smart-ID
Aktiivsed seansid: 1 arvuti (Chrome, Windows, IP räsi: 4f1a…) [ Lõpeta teised seansid ]
─────────────────────────────────────────────────────────────────────────────────────────────
OKSJONITEL PAKKUMISE ÕIGUSED:
  🌲 Raieõigus:    ● Antud 12.05 (Marit Vain)              [ Eemalda õigus põhjusega ]
  🏠 Kinnistud:    ● Antud 15.06 (Kaire Mets)              [ Eemalda õigus põhjusega ]
  🌾 Põllumaad:    ○ Puudub                                [ + Anna õigus ]
  📦 Paketid:      ○ Puudub                                [ + Anna õigus ]
─────────────────────────────────────────────────────────────────────────────────────────────
KASUTAJA TEGEVUSNUPUD:
[ 👁 Vaata kasutajana (Impersonate) ]  [ ⏸ Peata konto ajutiselt ]  [ 🚫 Keela kasutaja (Ban) ]
```

#### Detailed Blocks:
1. **Kasutajate nimekiri (DataTable):**
   - Maskeeritud isikukood: `3870516*****`. Ikoon `[👁]` paljastab koodi, kuid iga vaatamine salvestatakse auditisse (`user.identity_view`).
   - Profiilid kiibid: `Era` ja/või `Ettevõtte nimi`. Kollane märge kui ettevõte ootab kinnitust.
   - Õiguste lühikoodid: `R` (raieõigus), `K` (kinnistu), `P` (põllumaa), `B` (pakett/bundle) rohelise või hallina.
2. **Detailvaate vahelehed (Drawer / Paneel):**
   - *Tab 1: Identiteet:* Täisnimi, kontaktid, eID viis, registreerumise aeg, aktiivsed seansid koos kaug-väljalogimise nupuga.
   - *Tab 2: Profiilid:* Seotud ettevõtted ja eraisiku andmed.
   - *Tab 3: Õigused:* Maatriks neljast oksjonitüübist. Iga õiguse juures kirjas, kes ja millal andis. Nupp `[ + Anna õigus ]` (avab modaali kohustusliku põhjendusega).
   - *Tab 4: Lepingud:* Kasutaja allkirjastatud raamlepingud ja oksjonilepingud.
   - *Tab 5: Pakkumised:* Täielik pakkumiste ajalugu läbi aegade.
   - *Tab 6: Teavitused:* SMS ja e-posti seadistuste ülevaade.
   - *Tab 7: GDPR:* `[ Käivita andmete eksport ZIP ]` ja `[ Käivita konto kustutamine / anonümiseerimine ]` (arvestab 7-aastast raamatupidamislikku säilituskohustust).
3. **Kriitilised tegevused (Modaalid):**
   - *Vaata kasutajana (Impersonation):* Nõuab põhjendust. Avab portaali kasutaja vaates, ülaosas oranž hoiatusriba. Kirjutustegevused (pakkumine, allkirjastamine) on rangelt blokeeritud.
   - *Peata konto (Suspend):* Valikuline kestus (24h, 7 päeva, tähtajatu) + kohustuslik põhjendus.
   - *Keela kasutaja (Ban):* Pöördumatu blokeerimine isikukoodi tasemel.

---

### Page 07: Ettevõtte taotlused — Company Access Approvals
**Route:** `/ettevotted`  
**Tabs:** `Ootel taotlused (3)` | `Otsustatud taotluste ajalugu (412)`  
**Access:** Admin, Superadmin.  
**Purpose:** Verify and approve company profile access requests by matching applicant identity against Äriregister registry data and detecting duplicates.

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ Ettevõtte taotlused   [ Ootel taotlused (3) ] [ Ajalugu (412) ]                             │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│ TAOTLUS #77: Tamm OÜ (Registrikood: 14309277)                     Esitatud: Täna kell 11:02 │
│ ┌─ ÄRIREGISTRI ANDMED (Automaatne päring) ──┐ ┌─ TAOTLEJA PROFIIL ────────────────────────┐ │
│ │ Ärinimi:        Tamm OÜ                   │ │ Kasutaja:     Tõnis Kask (#82)            │ │
│ │ Registrikood:   14309277                  │ │ Isikukood:    38705162718                 │ │
│ │ Õiguslik vorm:  Osaühing (OÜ)             │ │ E-post:       tonis@tamm.ee               │ │
│ │ Staatus:        ● REGISTREERITUD          │ │ Konto loodud: 28.05.2025                  │ │
│ │ Aadress:        Tartu mnt 12, Tallinn     │ │ Ajalugu:      3 pakkumist, 1 raamleping   │ │
│ │ Juhatuse liige: Tõnis Kask ✓ (Kattub!)    │ └───────────────────────────────────────────┘ │
│ └───────────────────────────────────────────┘ ┌─ TAOTLEJA PÕHJENDUS ──────────────────────┐ │
│ ⚠ DUPLIKAADI HOIATUS:                         │ "Soovime ettevõtte alt osaleda raieõiguste│ │
│ Ettevõte Tamm OÜ on juba registreeritud teise │ oksjonitel ja sõlmida raamlepingu."       │ │
│ kasutaja profiili all: #14 (Kalle Tamm).      └───────────────────────────────────────────┘ │
│ ─────────────────────────────────────────────────────────────────────────────────────────── │
│ TEGEVUSED:                                                                                  │
│ [ Nõustu — Aktiveeri profiil ]      [ Keeldu põhjusega ]            [ Jäta ootele ]         │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

#### Detailed Blocks:
1. **Ootel taotluse kaart (Request Card):**
   - Päises: Ettevõtte nimi, registrikood, esitamise aeg ja ooteaja badge (`Oodanud 2 päeva`).
2. **Äriregistri integratsiooni paneel:**
   - Automaatselt päritud andmed: Juriidiline nimi, registrikood, staatus (kui on `KUSTUTATUD`, kuvatakse punane hoiatus ja taotlust ei saa heaks kiita).
   - Juhatuse liikmete nimekiri koos automaatse ristkontrolliga taotleja nime ja isikukoodi vastu (`✓ Juhatuse liige tuvastatud`).
   - Kui juhatuse liige ei kattu: Punane hoiatus `"Taotleja ei ole juhatuse liige"` → Nõuab volikirja olemasolu kontrolli.
3. **Duplikaatide tuvastamise hoiatus:**
   - Kui sama registrikood on juba süsteemis mõne teise konto all, kuvatakse kollane hoiatus koos lingiga olemasolevale profiilile.
4. **Otsustamise modaalid:**
   - *Nõustu:* Avaneb modaal, kus saab valida ettevõttele vaikimisi antavad pakkumisõigused (raieõigus, kinnistud jne). Kasutajale saadetakse automaatne e-kiri.
   - *Keeldu:* Kohustuslik keeldumise põhjus, mis edastatakse taotlejale.
   - *Jäta ootele:* Võimalus lisada sisemine märkus (nt ootab volikirja saatmist).
5. **Ajaloo vaheleht (History DataTable):**
   - Kõik varasemad otsused: Kuupäev, Ettevõte, Taotleja, Otsus (Heaks kiidetud / Tagasi lükatud), Otsustaja nimi ja keeldumise põhjus.

---

### Page 08: Lepingud & mallid — Contracts & Templates
**Route:** `/lepingud` (lepingute nimekiri) ja `/lepingud/mallid` (mallide haldus)  
**Access:** Admin, Superadmin.  
**Purpose:** Lifecycle tracking of framework and auction contracts (prepared → sent → signed → voided) and DOCX contract template manager with variable replacement.

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ Lepingud   [ Lepingute nimekiri (1284) ]   [ Lepingumallid (9) ]                            │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│ TAB 1: LEPINGUD   Filtrid: [ Tüüp: Kõik ▾ ] [ Olek: Saadetud ▾ ] [ Kuupäev: Alates—Kuni ]    │
├───┬────┬──────────┬──────────────┬───────────────┬──────────┬──────────────┬────────────────┤
│Nr │Tüüp│ Kasutaja │ Ettevõte     │ Oksjon        │ Mall     │ Olek         │ Allkirjastatud │
├───┼────┼──────────┼──────────────┼───────────────┼──────────┼──────────────┼────────────────┤
│102│Oksj│ T. Kask  │ Tamm OÜ      │ #4812 Ööviiuli│ MK v3.1  │ ▣ Saadetud   │ — (Ootel 2 p)  │
│101│Raam│ A. Saar  │ Saar Mets OÜ │ —             │ RL v2.0  │ ✓ Allkirjast.│ 27.08 14:22    │
│99 │Oksj│ M. Sepp  │ —            │ #4801 Kuusiku │ RÕ v2.4  │ ✕ Tühistatud │ —              │
└───┴────┴──────────┴──────────────┴───────────────┴──────────┴──────────────┴────────────────┘
Rea tegevused: [ Vaata PDF ] [ 📥 Laadi allkirjakonteiner (ASiC-E) ] [ Saada uuesti ] [ Tühista ]
─────────────────────────────────────────────────────────────────────────────────────────────
TAB 2: MALLID (DOCX Template Manager)
[ + Laadi üles uus mall (DOCX) ]
┌─ Mall: Metsakinnistu oksjonileping (MK) ──────────────────────────────────────────────────┐
│ Versioon: v3.1 · ● AKTIIVNE · Loodud: 12.06.2026 (Marit Vain)                            │
│ Kohatäited dokumendis: {{bidder.name}}, {{lot.cadastres}}, {{bid.amount}}, {{fee.total}}  │
│ [ 👁 Testrender näidisandmetega ]   [ 📥 Laadi DOCX ]   [ Ajalugu & versioonid (3) ]      │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

#### Detailed Blocks:
1. **Lepingute tabel (Contracts List):**
   - Veerud: Lepingu number, Tüüp (Raamleping vs Oksjonileping), Kasutaja ja Ettevõte, Seotud oksjon, Kasutatud malli versioon, Olek (Valmistatud / Saadetud / Allkirjastatud / Tühistatud), Allkirjastamise kuupäev.
   - Tegevused:
     - `[ Vaata PDF ]` (avab dokumendi brauseri eelvaates).
     - `[ Laadi allkirjakonteiner ]` (laadib alla digiallkirjastatud `.asice` / `.bdoc` faili).
     - `[ Saada uuesti ]` (saadab uue allkirjastamiskutse kui eelmine aegus).
     - `[ Tühista leping ]` (nõuab kohustuslikku põhjendust).
2. **Mallide haldur (DOCX Template Manager):**
   - Mallide nimekiri lepingutüüpide kaupa: Raamleping, Raieõiguse müügileping, Kinnistu müügileping, Põllumaa leping.
   - Uue versiooni üleslaadimine: DOCX faili valideerimine süsteemi poolt. Tuvastab automaatselt kõik `{{...}}` kohatäited.
   - Kohatäidete kataloog (Sidebar):
     - Ostja andmed: `{{bidder.name}}`, `{{bidder.isikukood}}`, `{{bidder.companyName}}`.
     - Objekti andmed: `{{lot.name}}`, `{{lot.cadastres}}`, `{{lot.area}}`, `{{lot.volume}}`.
     - Tehingu andmed: `{{bid.amount}}`, `{{fee.percent}}`, `{{fee.total}}`.
   - `[ Testrender näidisandmetega ]`: Genereerib koheselt test-PDF-i väljamõeldud andmetega, võimaldades visuaalset kontrolli enne malli aktiveerimist.

---

### Page 09: Juhtlõimed (CRM) — Leads Pipeline
**Route:** `/juhtloid`  
**Views:** `Kanban tahvel` | `Tabelivaade`  
**Access:** Specialist (oma määratud kontaktid), Admin, Superadmin (kõik juhtlõimed + CSV eksport).  
**Purpose:** Triage marketing-site leads (forest sales, valuations, management plans), track contact history, enforce SLAs, and assign specialists.

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ Juhtlõimed   [ ▦ Kanban ] [ ☰ Tabel ]   Filtrid: [ Allikas: Kõik ▾ ] [ Maakond ▾ ] [ Spetsialist ▾]│
│ [ + Uus juhtlõige käsitsi (nt telefonikõnest) ]                          [ 📥 Ekspordi CSV ] │
├──────────────┬──────────────┬──────────────────┬──────────────┬─────────────────────────────┤
│ UUS (6)      │ VÕETUD       │ KVALIFITSEERITUD │ LEPING (4)   │ MITTEKVALIFITSEERITUD (2)   │
│              │ ÜHENDUST (8) │ (9)              │              │                             │
│ ┌──────────┐ │ ┌──────────┐ │ ┌──────────────┐ │ ┌──────────┐ │ ┌─────────────────────────┐ │
│ │Jaan Torn │ │ │Piret Kuusk│ │ │Mikk Tamm     │ │ │Toomas K. │ │ │Oleg V.                  │ │
│ │Pärnu     │ │ │Tartu     │ │ │Harju         │ │ │Saare     │ │ │Ei soovi müüa            │ │
│ │Kava tell.│ │ │Raieõigus │ │ │Kinnistu      │ │ │Raieõigus │ │ └─────────────────────────┘ │
│ │⏱ >26h SLA│ │ │Spets: MV │ │ │Spets: KM     │ │ │Spets: TR │                               │
│ └──────────┘ │ └──────────┘ │ └──────────────┘ │ └──────────┘                               │
└──────────────┴──────────────┴──────────────────┴──────────────┴─────────────────────────────┘
LEAD DETAIL DRAWER (Klõpsates kaardil Jaan Torn #5121):
Nimi: Jaan Torn  Telefon: +372 521 9876 [Helista]  E-post: jaan@torn.ee
Allikas: /teenused/metsa-hindamine (Vorm: hindamisakt-1)  Esitatud: 26.08 kell 09:12
Katastritunnus: 34801:001:0217 (Pärnumaa, Saarde vald) [ Ava kaardil ↗ ]
Nõusolek: Turundusnõusolek antud 26.08 09:12 ✓
─────────────────────────────────────────────────────────────────────────────────────────────
Vastutav spetsialist: [ Marit Vain ▾ ] (Automaatne soovitus: Pärnu piirkond)
Järgmine tegevus:     [ 30.08.2026 📅 ] Helistada ja täpsustada raiesoovi
─────────────────────────────────────────────────────────────────────────────────────────────
MÄRKMETE JA SÜNDMUSTE AJAJOON:
27.08 10:15  Marit Vain: "Helistasin kliendile, ei vastanud. Saatsin tutvustava e-kirja."
26.08 09:12  Süsteem: Juhtlõige laekus veebivormist. Automaatselt määratud piirkond: Pärnumaa.
[ + Lisa uus märkus...                                                           ] [ Salvesta ]
```

#### Detailed Blocks:
1. **Vaadete lüliti:** Kanban tahvel vs standardne DataTable.
2. **Kanban veerud (5 etappi):**
   - `Uus` (käsitlemata kontaktid; kui oodanud >24h, kuvatakse kollane SLA hoiatus, kui >48h, punane).
   - `Võetud ühendust` (kliendiga on suheldud).
   - `Kvalifitseeritud` (kliendil on reaalne müügisoov).
   - `Leping` (edastatud lepingu sõlmimisele / oksjoni ettevalmistusse).
   - `Mittekvalifitseeritud` (keeldus, vale number vms; nõuab põhjendust).
3. **Kaardi anatoomia Kanbanis:**
   - Kliendi nimi, maakond, teenuse tüübi kiip, vastutava spetsialisti avatar, SLA hoiatusbadge, järgmise tegevuse kuupäev.
4. **Juhtlõime detailvaade (Slide-over Drawer):**
   - Kliendi kontaktandmed koos kiirlinkidega (klõpsa helistamiseks `tel:`, klõpsa kirjutamiseks `mailto:`).
   - Katastritunnus koos otselingiga Maa-ameti kaardile.
   - GDPR nõusoleku staatus (kuupäev ja kellaaeg).
   - Vastutava spetsialisti määramine (käsitsi või automaatse ümarlaua soovituse alusel).
   - Järgmise tegevuse meeldetuletuse kuupäev.
   - Kronoloogiline märkmete ajajoon (kõne märkmed, automaatsed staatusemuutused).

---

### Page 10: Päringute suunamine — Service Requests
**Route:** `/paringud`  
**Tabs:** `Päringud (38)` | `Partnerettevõtted (11)`  
**Access:** Admin, Superadmin.  
**Purpose:** Forwarding partner service requests (metsamajanduskavad, hooldusraie, metsa istutamine) to partner companies while minimizing shared personal data.

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ Päringute suunamine   [ Päringud (38) ]   [ Partnerid (11) ]                                │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│ TAB 1: PÄRINGUD   Filtrid: [ Teenus: Metsakava ▾ ] [ Olek: Saadetud ▾ ] [ Maakond: Pärnu ▾ ] │
├───┬──────────────┬──────────────┬──────────────┬──────────────┬──────────────┬──────────────┤
│ID │ Teenuse tüüp │ Klient       │ Maakond      │ Katastritunn.│ Edastatud    │ Olek         │
├───┼──────────────┼──────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
│214│ Metsakava    │ Jaan T.      │ Pärnumaa     │ 34801:001:.. │ 26.08 (2 pt) │ ● Saadetud   │
│213│ Hooldusraie  │ Piret K.     │ Tartumaa     │ 48202:002:.. │ 25.08 (1 pt) │ ○ Vastatud   │
│210│ Istutamine   │ Jüri R.      │ Võrumaa      │ 87101:001:.. │ 20.08 (3 pt) │ ✓ Teostatud  │
└───┴──────────────┴──────────────┴──────────────┴──────────────┴──────────────┴──────────────┘
PÄRINGU DETAIL JA SUUNAMISPANEEL (Päring #214: Metsamajanduskava):
Klient: Jaan Torn (+372 521 9876, jaan@torn.ee) · Soovib kava paberkandjal: Jah
Kinnistu: Saarde vald, kataster 34801:001:0217 (12.4 ha) · Kliendi kommentaar: "Kava aegus 2024"
─────────────────────────────────────────────────────────────────────────────────────────────
VALI PARTNERID EDASTAMISEKS (Pärnumaa kava koostajad):
  ☑ Metsakava OÜ      (Vaba maht: 3 / 5 päringut)  ● Aktiivne partner
  ☑ Pärnu Metsabüroo  (Vaba maht: 1 / 3 päringut)  ● Aktiivne partner
  ☐ Tartu Kavad OÜ    (Ei kata Pärnumaad)
[ Saada valitud partneritele (2) ]
ℹ Partnerile edastatakse vaid teenuseks vajalik info (Nimi, telefon, e-post, kataster).
─────────────────────────────────────────────────────────────────────────────────────────────
EDASTAMISE AJALUGU:
26.08 09:30 Saadetud partnerile Metsakava OÜ (E-kiri avatud 09:45) [ Märgi vastatuks ]
```

#### Detailed Blocks:
1. **Päringute tabel:**
   - Teenuse tüübi kiip: `Metsamajanduskava`, `Hooldusraie`, `Metsa istutamine`.
   - Kliendi nimi, maakond, katastritunnus, edastamise staatus ja partnerite arv.
2. **Suunamise juhtpaneel (Routing Panel):**
   - Kuvab partnerettevõtteid, kelle tegevuspiirkond ja pakutavad teenused kattuvad päringuga.
   - Kuvab partneri hetkekoormust (aktiivsed päringud vs limiit).
   - Andmekaitse hoiatus: Partnerile saadetakse minimaalne andmekomplekt ilma süsteemisiseste märkmeteta.
3. **Partnerite kataloog (Directory Tab):**
   - Partnerettevõtete nimekiri, kontaktisikud, teenused, kaetavad maakonnad, maksimaalne päringute limiit ja aktiivsuse lüliti.

---

### Page 11: Sisuhaldus — CMS Content
**Route:** `/sisu` (alamlehed `/sisu/:kogumik` ja `/sisu/:kogumik/:id`)  
**Access:** Admin, Superadmin.  
**Purpose:** Marketing site CMS. Visual block-builder for landing pages, rich-text article editor with full SEO preview, FAQ manager, media library, redirects, and navigation menus.

```
┌──────────────┬──────────────────────────────────────────────────────────────────────────────┐
│ KOGUMIKUD    │ Lehekülg: /teenused/raieoiguse-muuk   Olek: ● Avaldatud (v2)  [ Eelvaade ↗ ] │
│ ◧ Leheküljed ├──────────────────────────────────────────────────────────────────────────────┤
│ 📄 Artiklid  │ [ Blokid ]  [ SEO seaded ]  [ Versioonide ajalugu ]                          │
│ ? KKK        ├────────────────────────────────────────┬─────────────────────────────────────┤
│ 👤 Spetsial. │ LEHE BLOKKIDE JÄRJEKORD (Lohista)      │ REAALAJAS EELVAADE                  │
│ 💬 Tagasiside│ ┌────────────────────────────────────┐ │ ┌─────────────────────────────────┐ │
│ 🌲 Toetused  │ │ 1. ▤ Hero päis            [⠿ ✎ ✕]  │ │                                   │ │
│ ⚖ Dokumendid │ │    Pealkiri: "Müü raieõigus..."    │ │      Müü raieõigus parima         │ │
│ 🖼 Meedia     │ ├────────────────────────────────────┤ │          hinnaga oksjonil         │ │
│ ⇄ Suunamised │ │ 2. ▤ Tekstiplokk          [⠿ ✎ ✕]  │ │                                   │ │
│ ☰ Menüüd     │ │    "Miks müüa oksjonil?"           │ │   [ Alusta siit ] [ Loe lisa ]    │ │
│              │ ├────────────────────────────────────┤ │                                   │ │
│              │ │ 3. ▤ Oksjonite ticker     [⠿ ✎ ✕]  │ │ ───────────────────────────────── │ │
│              │ │    Tüüp: Raieõigus, 4 kaarti       │ │ (Interaktiivne lehe eelvaade)     │ │
│              │ ├────────────────────────────────────┤ │                                   │ │
│              │ │ 4. ▤ Päringuvorm          [⠿ ✎ ✕]  │ │                                   │ │
│              │ │    Vorm: Hindamisakt               │ │                                   │ │
│              │ └────────────────────────────────────┘ │ └─────────────────────────────────┘ │
│              │ [ + Lisa uus blokk ▾ ]                 │ Seadme vaade: [ 💻 Desktop ] [ 📱 Mob ]│
└──────────────┴────────────────────────────────────────┴─────────────────────────────────────┘
```

#### Detailed Blocks:
1. **Vasak kogumike menüü (Collections Navigation):**
   - Leheküljed (Page builder).
   - Artiklid (Uudised ja blogipostitused).
   - KKK (Korduma kippuvad küsimused kategooriate kaupa).
   - Metsaspetsialistid (Töötajate profiilid ja fotod).
   - Kliendilood ja tagasiside.
   - Toetuste programmid.
   - Juriidilised dokumendid ja tingimused.
   - Meediateek (Fotod, failid).
   - URL suunamised (301 / 302 redirects).
   - Navigatsiooni menüüde ehitaja (Päis ja jalus).
2. **Leheehitaja (Visual Block Builder):**
   - Blokid loendis: Hero, Tekstiplokk, Kaardid (1-3 veergu), Protsessi akordion, Päringuvorm, Oksjonite ticker, Statistika numbrid, CTA ribad, Tagasiside karussell.
   - Blokkide lohistamine järjekorra muutmiseks (`drag-and-drop`).
   - Iga bloki seadete muutmine mugavas külgsahtlis.
   - Seadmevaate lüliti eelvaates (Desktop vs Mobiil).
3. **Artikli redaktor ja SEO paneel:**
   - Rich Text sisu (H2, H3, pildid, tsitaadid, tabelid).
   - SEO eelvaate simulaator: Kuidas artikkel näeb välja Google otsingutulemustes (SERP preview) ja Facebooki/LinkedIni jagamisel (Open Graph kaart).
   - Sümbolite loendurid: SEO pealkiri (kuni 60 märki), meta-kirjeldus (kuni 160 märki).
4. **Meediateek (Media Library):**
   - Fotode üleslaadimine ja automaatne optimeerimine (WebP formaat, erinevad resolutsioonid).
   - **Fookuspunkti määraja (Focal Point Picker):** Võimaldab määrata pildi keskme, et mobiilne kärpimine ei lõikaks olulist objekti välja.
   - **Kohustuslik Alt-tekst:** Ilma kirjelduseta pilte ei lubata avaldada.

---

### Page 12: Statistika — Statistics Dashboard
**Route:** `/statistika`  
**Access:** Admin, Superadmin (täisvaade ja eksport); Specialist (oma objektide statistika).  
**Purpose:** Business intelligence on auction performance, sales volumes, price trends per county/species, and conversion funnels. Curator for public statistics.

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ Statistika   Ajavahemik: [ 01.01.2026 — 31.12.2026 ▾ ]   Objekti tüüp: [ Kõik tüübid ▾ ]    │
│              Maakond:    [ Kõik 15 maakonda ▾ ]          [ 📥 CSV ] [ 📥 XLSX Eksport ]     │
├──────────────┬──────────────┬──────────────────┬──────────────┬─────────────────────────────┤
│ OKSJONEID    │ MÜÜDUD       │ LÄBIMÜÜK KOKKU   │ KESKMINE     │ TEENUSTASU TULU             │
│ 412          │ 318 (77.2%)  │ 2 450 000 €      │ 2 410 € / ha │ 73 500 €                    │
├──────────────┴──────────────┴──────────────────┴──────────────┴─────────────────────────────┤
│ OKSJONITE JAOTUS KUUDE KAUPA (Tulbad: Müüdud roheline, Müümata hall, Tühistatud punane)    │
│ 40 │               █                                                                        │
│ 30 │       █   █   █   █       █                                                            │
│ 20 │   █   █   █   █   █   █   █                                                            │
│ 10 │   █   █   █   █   █   █   █                                                            │
│  0 └───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───                                         │
│       Jaan Veebr Märts Apr Mai Juun Juul Aug Sept Okt Nov Dets                              │
├─────────────────────────────────────────────┬───────────────────────────────────────────────┤
│ KESKMINE HIND (€/ha ja €/m³) MAAKONNITI     │ JUHTLÕIMEDE MÜÜGILEHTER (Funnel)              │
│ ┌─────────────────────────┐ Harju:  2 910 € │ 1. Laekunud päringud:  342 (100%)             │
│ │ EESTI MAAKONNAKAART     │ Tartu:  2 450 € │ 2. Võetud ühendust:    210 (61.4%)            │
│ │ (Kloropleet-kaart:      │ Pärnu:  2 120 € │ 3. Kvalifitseeritud:   96  (28.0%)            │
│ │ tumeroheline = kallim)  │ Saare:  1 980 € │ 4. Sõlmitud leping:    61  (17.8%)            │
│ └─────────────────────────┘ [ Vaata tabelina]│ Keskmine tehinguni jõudmise aeg: 14 päeva     │
├─────────────────────────────────────────────┴───────────────────────────────────────────────┤
│ AVALIKU STATISTIKA KURAATOR (Määra, milliseid koondandmeid kuvatakse portaali avalikul lehel)│
│ ☑ Kuva 2026. aasta keskmised hektarihinnad maakonniti                   [ Salvesta seaded ] │
│ ☑ Kuva raieõiguste läbimüügi edukuse protsent (77%)                                         │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

#### Detailed Blocks:
1. **Filtririba ja eksport:**
   - Perioodi kiirvalikud: See kuu, Eelmine kuu, Kvartal, Käesolev aasta, Kohandatud vahemik.
   - CSV ja mitmelehelise Exceli (XLSX) eksport.
2. **Peamised KPI kaardid:**
   - Oksjonite koguarv.
   - Müüdud oksjonid ja läbimüügi % (sell-through rate).
   - Tehingute kogumaht (€).
   - Keskmine hektarihind ja tihumeetri hind.
   - Teenustasude tulu.
3. **Oksjonite mahud kuude lõikes:**
   - Virnastatud tulpdiagramm (Stacked Bar Chart): Roheline (müüdud), hall (müümata), punane (tühistatud).
4. **Hinnatasemed maakonniti:**
   - Interaktiivne Eesti kloropleet-kaart: Maakonnad on toonitud rohelise skaala intensiivsuse järgi vastavalt keskmisele hinnale.
   - Klõps maakonnale avab detailse tabeli puuliikide ja raieliikide lõikes.
   - Alternatiivvaade: Standardne andmetabel ligipääsetavuse tagamiseks.
5. **Juhtlõimede müügilehter (Conversion Funnel):**
   - Horisontaalne lehtergraafik: Päringud → Ühendust võetud → Kvalifitseeritud → Leping. Konversioonimäärad iga etapi vahel.
6. **Avaliku statistika kuraator:**
   - Administraatori lülitid, millega määratakse, millised agregeeritud numbrid jõuavad portaali avalikule `/statistika` lehele.

---

### Page 13: Seaded — Platform Settings
**Route:** `/seaded`  
**Access:** Superadmin (kõik õigused), Admin (ainult teavituste mallid ja vaatamine).  
**Purpose:** Global configuration: fee percentages, auction rules, notification templates, integration keys, role permissions, and maintenance windows.

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ Seaded   ⚠ Kõik muudatused jõustuvad kohe ja logitakse auditisse                             │
├─────────────────┬───────────────────────────────────────────────────────────────────────────┤
│ § Üldandmed     │ § PLATVORMI TEENUSTASUD JA FINANTS                                        │
│ § Teenustasud ● │ ───────────────────────────────────────────────────────────────────────── │
│ § Oksjonireeglid│ Vaikimisi teenustasu (%):          [ 3.0 % ]                              │
│ § Teavitused    │ Käibemaksumäär (%):                [ 22.0 % ]                             │
│ § Integratsioon │ Kiiroksjoni teenustasu erisus (%): [ 3.0 % ]                              │
│ § Rollid        │ Minimaalne teenustasu põrand (€):  [ 250 €  ] (Valikuline miinimumtasu)   │
│ § Hooldusaken   │ ───────────────────────────────────────────────────────────────────────── │
│ § Funkts. lipud │ REAALAJAS NÄIDISARVUTUS:                                                  │
│                 │ Oksjoni lõpphind: 100 000 €  →  Teenustasu (3%): 3 000 € + KM (22%): 660 €│
│                 │ Arve kogusumma kliendile: 3 660 €                                         │
│                 │ ───────────────────────────────────────────────────────────────────────── │
│                 │ Salvestamise kohustuslik põhjendus:                                       │
│                 │ [ Juhatuse otsus tasumäära kinnitamise kohta...                         ] │
│                 │ [ Salvesta muudatused ⚠ ]                                                 │
└─────────────────┴───────────────────────────────────────────────────────────────────────────┘
```

#### Detailed Blocks per Section:
1. **Üldandmed:** Ettevõtte ärinimi, registrikood, KMKR number, aadress, ametlik alias-domeen (`oksjonid.eametsad.ee`), ametlik klienditoe telefon ja e-post.
2. **Teenustasud:** Vaikimisi tasu %, käibemaksu määr, kiiroksjoni tasu erisus, näidiskalkulaator. Iga salvestus nõuab põhjendust.
3. **Oksjonireeglid:**
   - Anti-snipe vaikimisi minutid (`1–30 min`, vaikimisi 5).
   - Automaatpakkuja (autobidder) globaalne lubamine/keelamine.
   - Alapakkumiste lubamine ja müüja otsustamise tähtaeg päevades (vaikimisi 3 päeva).
   - Minimaalne oksjoni kestus (1 tund).
   - Kahe isiku reegli nõue suletud oksjonite avamisel (Superadmin kohustuslik vs kaks administraatorit).
4. **Teavitused (Notification Templates):**
   - E-posti ja SMS mallide redaktor kõigile süsteemi sündmustele (Uus pakkumine, Ülepakkumine, Võit, Kaotus, Oksjon lõppemas, Leping allkirjastamiseks).
   - Kohatäidete lisamine nupuvajutusega (`{{user.name}}`, `{{lot.name}}`, `{{amount}}`).
   - `[ Saada testkiri endale ]` nupp. SMS tähemärkide ja segmentide loendur.
5. **Integratsioonid:**
   - Kaardid iga välise teenuse kohta: Smart-ID / eID Easy, Äriregister, Mailgun (e-post), Messente (SMS), Maa-ameti kaardiserver.
   - Igal kaardil: Ühenduse staatus (roheline/punane), viimase kontrolli aeg, maskeeritud API võtmed (`sk-live-••••••••4f2a`), nupp `[ Testi ühendust ]` ja võtme uuendamise väli.
6. **Rollide ja õiguste maatriks:**
   - Tabel: Read on süsteemi tegevused (Oksjonite loomine, Käsitsi lõpetamine, Suletud avamine, Lepingute tühistamine, Kasutaja blokeerimine jne) ja veerud on rollid (Spetsialist, Müüja, Haldur, Superadmin). Märkeruudud õiguste määramiseks.
7. **Hooldusrežiim (Maintenance Mode):**
   - Planeeritava hooldusakna määramine (algus ja lõpp).
   - **Konfliktide kontroll:** Süsteem kontrollib reaalajas, kas hooldusakna ajal lõpeb mõni oksjon. Kui jah, blokeeritakse salvestamine hoiatusega: *"Aknasse jääb 2 lõppevat oksjonit — nihuta aega või muuda oksjoni lõppaega"*.
8. **Funktsionaalsuse lipud (Feature Flags):**
   - Lülitid funktsioonide sisse/välja lülitamiseks: `sealed_bids`, `sms_notifications`, `map_view`, `quick_auction`.

---

### Page 14: Auditlogi — Audit Log Viewer
**Route:** `/audit`  
**Access:** Superadmin (täielik ligipääs ja CSV eksport); Admin (ainult enda sooritatud tegevused).  
**Purpose:** Cryptographically hashed, append-only immutable audit trail of all staff actions, data unmasking, settings changes, and auction interventions.

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ Auditlogi   🔒 Kirjed on muutumatud — kustutamine ja muutmine on tehniliselt blokeeritud   │
│ Filtrid: [ Töötaja: Kõik ▾ ] [ Tegevuse tüüp: Vali ▾ ] [ Olem: Vali ▾ ] [ Kuupäev: Vahemik ]│
│          [ 🔍 Otsi ID järgi... ]                              [ 📥 Ekspordi auditlogi CSV ] │
├───┬────────────┬──────────┬────────────────────────┬──────────────┬─────────────┬───────────┤
│ID │ Aeg (ms)   │ Töötaja  │ Tegevus                │ Olem         │ Enne / Nüüd │ Põhjus    │
├───┼────────────┼──────────┼────────────────────────┼──────────────┼─────────────┼───────────┤
│841│14:03:12.102│ M. Vain  │ sealed.winner_confirm  │ Oksjon #4812 │ ▦ Vaata diff│ Kontroll..│
│840│14:02:58.450│ K. Mets  │ sealed.sign_approver   │ Oksjon #4812 │ —           │ Allkiri   │
│839│11:40:03.882│ M. Vain  │ user.right_revoke      │ Kasutaja #82 │ ▦ Vaata diff│ Kehtetu.. │
│838│09:12:44.119│ M. Vain  │ user.identity_view     │ Kasutaja #79 │ —           │ Klienditugi│
└───┴────────────┴──────────┴────────────────────────┴──────────────┴─────────────┴───────────┘
DETAILVAADE JA JSON-DIFF (Kirje #841: sealed.winner_confirm):
Tegija: Marit Vain (Admin) · IP räsi: 8f2e1a... · Sessioon: a1f8...
Tegevuse aeg: 28.08.2026 kell 14:03:12.102 · Olem: Oksjon #4812 (Ööviiuli)
Põhjus: "Pakkumised kontrollitud ja võitja ametlikult kinnitatud."
┌─ ENNE (Vana olek) ──────────────────────┬─ PÄRAST (Uus olek) ─────────────────────────────┐
│ {                                       │ {                                               │
│   "status": "ended",                    │   "status": "contract",                         │
│   "finalPrice": null,                   │   "finalPrice": 61000,                          │
│   "winnerBidId": null                   │   "winnerBidId": 1948                           │
│ }                                       │ }                                               │
└─────────────────────────────────────────┴─────────────────────────────────────────────────┘
Ahela tervikluse kontroll: ✓ Merkle puu kontrollitud täna kell 04:00 (Kõik kirjed rikkumata)
```

#### Detailed Blocks:
1. **Muutumatuse ja säilitamise päis:**
   - Püsiv teavitus: *"Kirjed on muutumatud. Andmeid säilitatakse 7 aastat."*
   - Merkle ahela tervikluse roheline indikaator.
2. **Filtririba:**
   - Töötaja valik (rippmenüü).
   - Tegevuse kategooriad:
     - *Kasutajad ja õigused:* `user.identity_view`, `user.right_grant`, `user.right_revoke`, `user.suspend`, `user.ban`, `user.impersonate`.
     - *Oksjonid:* `auction.create`, `auction.publish`, `auction.end_manual`, `auction.relist`.
     - *Suletud avamine:* `sealed.sign_opener`, `sealed.sign_approver`, `sealed.reveal`, `sealed.winner_confirm`, `sealed.void`.
     - *Lepingud ja seaded:* `contract.void`, `settings.change`, `maintenance.start`.
3. **DataTable veerud:**
   - Täpne ajatempel millisekundi täpsusega.
   - Töötaja nimi ja rollikiip.
   - Tegevuse kood ja inimkeelne selgitus.
   - Seotud olem (nt Oksjon #4812, link avab objekti).
   - `Enne / Nüüd` indikaator (klõpsatav diff-nupp).
   - Tegevuse põhjendus.
4. **Detailvaate külgsahtel (JSON Diff Viewer):**
   - Kuvab täpse kaheveerulise visuaalse võrdluse vanast ja uuest olekust (roheline lisatud ridadele, punane eemaldatud ridadele).
   - Salajased väljad (nt paroolid, API võtmed, piirhinnad) kuvatakse kujul `"<salajane — muudetud>"`.
   - Täielik tehniline meta: IP räsi, kasutajaagendi perekond, sessiooni unikaalne tunnus.

---

## 3. Global Modals, Drawers & Reusable Component Library

To sketch these pages efficiently in Figma, the designer should build this library of shared components first:

### 3.1 Status Pill Component (`StatusPill`)
- Pill radius (`rounded-full` / `9999px`), height `24px`, padding `2px 10px`.
- 12px Medium font.
- Left-aligned `6px` colored indicator dot.
- Variants: Draft (Grey), Scheduled (Blue), Active (Green), Ending Soon (Amber/Red), Ended (Warm Grey/Amber), Unsold (Red outline), Contract (Emerald), Archived (Muted Grey).

### 3.2 Standard DataTable Component (`AdminTable`)
- Row height: `40px` standard, `32px` compact.
- Header height: `36px`, background `#f4f2ff`, 12px SemiBold uppercase labels, sort arrows.
- Alternating subtle hover state: background `rgba(1, 45, 29, 0.03)`.
- Left column checkbox for bulk selection.
- Right column action trigger (hover revealed or 3-dots dropdown).
- Pagination bar: Page size selector (25 / 50 / 100), item count summary (`"Kuvatakse 1–25 / 4823"`), page jump buttons.

### 3.3 Slide-Over Drawer (`DetailDrawer`)
- Width: `560px` desktop (overlay with semi-transparent backdrop `#181a2e` at 40% opacity).
- Header: Title, subtitle/status, close button (`✕` Esc).
- Scrollable body with tabbed sections.
- Pinned bottom action bar for primary actions.

### 3.4 Destructive Confirmation Modal
- Width: `480px`, rounded `16px`, deep elevation shadow.
- Top icon: Red warning shield or amber exclamation circle.
- Title: Clear statement of consequence (e.g. `"Oksjoni käsitsi lõpetamine on pöördumatu"`).
- Body text explaining immediate effects.
- Input: Mandatory typed keyword (e.g. trüki `"LÕPETA"` või kirjuta põhjendus min 5 tähemärki).
- Buttons: Cancel (ghost) vs Confirm (solid red/amber).

### 3.5 Global Search Modal (`CommandPalette` — ⌘K)
- Centered overlay, width `640px`, top offset `15%`.
- Large search input field (`48px` tall, 18px font) with search icon.
- Grouped results list: Oksjonid, Kasutajad, Juhtlõimed, Lepingud, Seaded.
- Keyboard navigation: `↑` `↓` to navigate, `Enter` to open, `Esc` to dismiss.

---

## 4. Designer Sketching Order & Artboard Priority

To deliver sketches iteratively, design the screens in this recommended three-stage order:

### Phase 1: Core Operations & Daily Workflow (Most Critical)
1. **Global Shell:** 56px left rail, topbar, impersonation warning banner.
2. **Page 01 (Töölaud):** Dashboard KPIs, live ending auctions, action queues.
3. **Page 02 (Oksjonid nimekiri):** Table, filters, status pills, hover actions.
4. **Page 03 (Oksjoni wizard):** 7-step creation form, map picker, media uploads, validation summary.
5. **Page 04 (Pakkumiste monitooring):** Live bid feed, anti-snipe countdown, under-bids approval.

### Phase 2: High-Security & Customer Management
6. **Page 05 (Suletud avamine):** Two-person ceremony, simultaneous decryption table, winner confirm.
7. **Page 06 (Kasutajad & õigused):** User table, identity drawer, rights matrix, suspend/impersonate modals.
8. **Page 07 (Ettevõtte taotlused):** Äriregister verification card, duplicate detection, approval flow.
9. **Page 08 (Lepingud & mallid):** Contracts list, DOCX template placeholder manager.
10. **Page 09 (Juhtlõimed CRM):** Kanban board, lead drawer, timeline notes.

### Phase 3: Content, Analytics & System Administration
11. **Page 10 (Päringute suunamine):** Partner routing panel, directory table.
12. **Page 11 (Sisuhaldus):** Block-builder, article SEO preview, media library.
13. **Page 12 (Statistika):** Charts, choropleth map of Estonia, conversion funnel.
14. **Page 13 (Seaded):** Fee calculator, masked API keys, role matrix, maintenance conflict checker.
15. **Page 14 (Auditlogi):** Immutable event table, side-by-side JSON diff drawer.
