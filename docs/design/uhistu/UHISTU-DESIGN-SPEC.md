# Erametsad Metsaühistu — Comprehensive UI/UX Design Specification for Designers

> **Purpose:** This document provides a complete, screen-by-screen design specification for sketching and prototyping all pages of the **Erametsad Metsaühistu subsite** (`metsauhistu.erametsad.ee`). It details every wireframe layout, component hierarchy, form field, subsidy table, responsive breakpoint, micro-copy, and interaction state so a designer can create complete sketches in Figma, Sketch, or Penpot.

---

## 1. Global Shell & Association Brand Architecture

### 1.1 Canvas & Grid Specs
- **Default Desktop Canvas:** `1440 × 900 px` (Standard design artboard; fluid up to 1920px).
- **Tablet Canvas:** `768 × 1024 px` (iPad vertical reference).
- **Mobile Canvas:** `390 × 844 px` (iPhone 14/15 standard).
- **Grid Layout:** 
  - Desktop: 12-column grid, max-width container `1200 px`, gutters `24 px`, outer margin auto.
  - Tablet: 8-column grid, gutters `16 px`, padding `24 px`.
  - Mobile: 4-column grid, gutters `12 px`, padding `16 px`.
- **Vertical Spacing Scale:** 4px base (`4`, `8`, `12`, `16`, `24`, `32`, `40`, `48`, `64`, `96`, `128 px`).

---

### 1.2 Association Brand Tokens

The association shares the core aesthetic tokens of the Erametsad design system while expressing a distinct community and educational tone:

| Token | Hex / Value | Usage on Metsaühistu Subsite |
|---|---|---|
| `--primary` | `#012d1d` | Deep spruce green; links, active chips, headers, primary buttons |
| `--primary-hover` | `#1b4332` | Primary button hover, navigation item hover |
| `--primary-dark` | `#16382A` | Hero background overlay, dark pre-footer / footer bands |
| `--primary-light` | `#c1ecd4` | Mint highlight for count pills, selected state pills, tag backgrounds |
| `--accent` | `#58B368` | Forest green accent; open subsidy pills (`Avatud`), success checks |
| `--cta` | `#F2A93B` | Warm amber CTA; "LIITU" buttons, primary forms, urgent deadlines |
| `--cta-hover` | `#D98F1F` | CTA button hover state |
| `--ink` | `#181a2e` | Blue-black body text, table headers, dark titles |
| `--ink-muted` | `#414844` | Secondary text, subtitles, table metadata, form helper notes |
| `--ink-inverse` | `#FFFFFF` | Text on dark buttons, hero text, card background |
| `--bg-page` | `#fbf8ff` | Lavender-tinted warm paper surface (main page background) |
| `--bg-mist` | `#f4f2ff` | Soft lavender mist for alternating bands, cards, and step blocks |
| `--border` | `#c1c8c2` | Card borders, input field outlines, table row dividers |
| `--danger` | `#B3261E` | Error messages, urgent deadline warnings (<7d) |
| `--danger-light` | `#FBEAE9` | Danger alert backgrounds |
| `--info` | `#2D6FA8` | Information banners, pre-booking appointment notices |
| `--info-light` | `#E9F1F7` | Notice card background |

#### Status Badge Colors (Subsidy & Program Deadlines)
- **Open / Active (`Avatud`):** Pill background `#E8F6ED`, text `#1B6338`, indicator dot `#2E9E5B`.
- **Upcoming Soon (`Varsti`):** Pill background `#FEF5E7`, text `#8F590A`, indicator dot `#F2A93B`.
- **Closed / Past Deadline (`Suletud`):** Pill background `#ECEEEB`, text `#6B7570`, indicator dot `#9E9E9E`.
- **Date TBD (`Aeg täpsustub`):** Pill background `#F4F2FF`, text `#414844`, indicator dot `#6B7570`.

#### Typography
- **Brand Wordmark:** `Public Sans` / `Manrope`, weight `800` (Bold uppercase label: `"ERAMETSAD METSAÜHISTU"`).
- **Headings (`--font-heading`):** `Public Sans`, weights `600` (SemiBold) and `700` (Bold).
- **Body & Forms (`--font-body`):** `Inter`, weights `400` (Regular), `500` (Medium), `600` (SemiBold). Latin-ext subset.
- **Numbers, Rates & Dates (`--font-mono`):** `JetBrains Mono`, weights `500`, tabular numbers (`tnum`).

---

### 1.3 Subsite Header & Navigation

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ 🌲 ERAMETSAD METSAÜHISTU   Avaleht   Teenused   Toetused   Sertifitseerimine   Kontakt      │
│                                                   [ Oksjonikeskkond ↗ ]   [ LIITU ÜHISTUGA ]│
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

- **Height:** `72 px` desktop (shrinks to `60 px` on scroll), `56 px` mobile. Sticky at `top-0`, white background `#FFFFFF`, subtle bottom border `rgba(27, 33, 29, 0.08)`.
- **Left:** Logo mark (Spruce icon) + Brand Title `"Erametsad Metsaühistu"` (Public Sans 700, 18px, `--primary-dark`).
- **Center Menu:**
  - `Avaleht` → `/`
  - `Teenused` → `/teenused`
  - `Toetused` → `/toetused`
  - `Sertifitseerimine` → `/sertifitseerimine`
  - `Kontakt` → `/kontakt`
  - Active item: `--primary` color with 2px bottom border indicator.
- **Right Action Items:**
  - External portal link: `"Oksjonikeskkond"` + `ExternalLink` icon ↗ (links to `oksjonid.erametsad.ee`, opens in new tab).
  - Primary CTA button: `[ LIITU ÜHISTUGA ]` (solid amber pill button `#F2A93B`, 40px height, links to `/liitu`).
- **Mobile (<768px):** Hamburger menu triggers full-screen `Drawer` sliding in from right with grouped links, external auction link, and pinned "Liitu" button at the bottom.

---

### 1.4 Global Pre-Footer & Footer

#### 1. ContactBand (Pre-footer on every page)
- Light card container (`--bg-mist`), padding `40 px`, radius `12 px`.
- 3 columns on desktop (stacked on mobile):
  1. *Telefon:* `☎ +372 XXX XXXX` (`tel:` link, icon `Phone`).
  2. *E-post:* `✉ metsauhistu@erametsad.ee` (`mailto:` link, icon `Mail`).
  3. *CTA-nupp:* `[ Jäta enda kontaktid → ]` (smooth scrolls to the page's lead form).

#### 2. Association Footer (Dark Background `--primary-dark`)
- Background `#16382A`, text `#FFFFFF` / `rgba(255, 255, 255, 0.75)`.
- 4 Columns:
  1. *Metsaühistu:* MTÜ Erametsad Metsaühistu, reg kood, lühitutvustus, kontaktid.
  2. *Teenused:* Istutamine, Hooldusraied, Metsakavad, Nõustamine, Ulukitõrje.
  3. *Toetused & Info:* Käimasolevad toetused, PEFC sertifitseerimine, Põhikiri (PDF), Kasutustingimused.
  4. *Oksjonid & Partnerid:* Oksjonikeskkond (`oksjonid.erametsad.ee`), Erametsad pealeht (`erametsad.ee`).
- Bottom bar: `© Erametsad Metsaühistu MTÜ · Kõik õigused kaitstud · Privaatsuspoliitika · Küpsiste seaded`.

---

## 2. Page-by-Page Detailed Sketching Specifications

---

### Page 01: Avaleht — Association Home
**Route:** `/`  
**Access:** Public  
**Purpose:** Primary landing page for forest owners. Within 5 seconds, communicate that membership is free, showcase current subsidy deadlines, list service chips, and capture leads via the hero join card.

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ HERO SECTION (Forest photo background with dark spruce gradient overlay)                    │
│ ┌──────────────────────────────────────────────┬──────────────────────────────────────────┐ │
│ │ ERAMETSAD METSAÜHISTU                        │ JOIN CARD (White card, radius 12, shadow)│ │
│ │ H1: Sinu mets. Meie nõusanne.                │ ┌──────────────────────────────────────┐ │ │
│ │ Subtitle: Erametsaomanike ühistu, kus        │ │ Astu liikmeks — liitumine on tasuta  │ │ │
│ │ liitumine on tasuta ja toetused taotleme     │ │ Ees- ja perekonnanimi*: [          ] │ │ │
│ │ sinu eest.                                   │ │ Telefoni number*:       [          ] │ │ │
│ │                                              │ │ E-posti aadress*:       [          ] │ │ │
│ │ [ Vaata teenuseid ]  [ Toetuste tähtajad → ] │ │ ☐ Nõustun andmete töötlemisega...   │ │ │
│ │                                              │ │ [ LIITU ÜHISTUGA (CTA Amber) ]       │ │ │
│ │                                              │ └──────────────────────────────────────┘ │ │
│ └──────────────────────────────────────────────┴──────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│ H2: Metsandustoetuste taotlemine                            [ Vaata kõiki toetusi (15) → ]  │
│ ┌─────────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ Toetus                       │ Tähtaeg          │ Toetuse suurus       │ Tegevus        │ │
│ ├──────────────────────────────┼──────────────────┼──────────────────────┼────────────────┤ │
│ │ Metsa uuendamise toetus      │ ● 07.04–23.04.26 │ Kuni 356 € / ha      │ [ Taotle → ]   │ │
│ │ Noorendike hooldamise toetus │ ● 07.04–23.04.26 │ 180 € / ha           │ [ Taotle → ]   │ │
│ │ Metsamajandamiskava toetus   │ ● Avatud aastar. │ Kuni 1.50 € / ha     │ [ Taotle → ]   │ │
│ │ Metsameede: kahjustuste kõrval│ ◐ Sügis 2026    │ Kuni 1 200 € / ha    │ [ Taotle → ]   │ │
│ │ Natura 2000 erametsas        │ ◐ Mai 2026       │ 60–110 € / ha        │ [ Taotle → ]   │ │
│ │ Pärandkultuuri säilitamine   │ ○ Suletud        │ Selgub               │ [ Vaata ]      │ │
│ └─────────────────────────────────────────────────────────────────────────────────────────┘ │
│ ℹ Tähtajad ja määrad kontrollitakse PRIA ametlikust taotlusvoorude kalendrist.              │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│ H2: Teenused metsaomanikule (Misty lavender band)                                           │
│ [ Istutamine ] [ Hooldusraied ] [ Metsataimede tellimine ] [ Nõustamine ]                  │
│ [ Taimekaitse & ulukitõrje ] [ Metsakavad ] [ Taimede hooldus ] [ Pinnapreparaat ]         │
│ [ ⚡ Oksjonikeskkond ↗ ]                                                                    │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│ H2: Toetused, mida aitame taotleda                                                          │
│ ┌─ CARD 1 ───────────────────┐ ┌─ CARD 2 ───────────────────┐ ┌─ CARD 3 ───────────────────┐│
│ │ ● AVATUD · kuni 23. aprill │ │ ● AVATUD · aastaringselt   │ │ ◐ VARSTI · Sügis 2026      ││
│ │ Metsauuenduse toetus       │ │ Metsakava toetus           │ │ Metsameede                 ││
│ │ Taimede soetamine ja istutus│ │ Telli kehtiv metsapass     │ │ Metsa taastamistööd        ││
│ │ Kuni 356 € / ha            │ │ Kuni 1.50 € / ha           │ │ Kuni 1 200 € / ha          ││
│ │ [ Loe lähemalt → ]         │ │ [ Loe lähemalt → ]         │ │ [ Loe lähemalt → ]         ││
│ └────────────────────────────┘ └────────────────────────────┘ └────────────────────────────┘│
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│ <ContactBand> (Telefon · E-post · "Jäta enda kontaktid")                                     │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

#### Detailed Section Breakdown:
1. **Hero Section (7/5 desktop split):**
   - *Left Column (7 cols):*
     - Small brand uppercase kicker: `"ERAMETSAD METSAÜHISTU"` (Manrope/Public Sans 800, 13px, letter-spacing 1px, text light mint `#c1ecd4`).
     - H1 Heading: `"Sinu mets. Meie nõusanne."` (Public Sans 700, 44px, line-height 1.15, text white).
     - Subtitle: `"Erametsaomanike ühistu, kus liitumine on tasuta ja toetused taotleme sinu eest."` (Inter 400, 18px, text white/85%).
     - Dual CTA buttons: Secondary ghost pill `[ Vaata teenuseid ]` (white border, smooth scroll to services) and solid Amber pill `[ Toetuste tähtajad → ]` (links to table).
   - *Right Column (5 cols):*
     - Floating white Join Card (`JoinCard`): Background white, 14px radius, 24px padding, elevation shadow.
     - Title: `"Astu liikmeks — liitumine on tasuta"` (Public Sans 600, 18px).
     - Fields:
       - Nimi (Ees- ja perekonnanimi)
       - Telefon (Eesti vormingus, nt `+372 5...`)
       - E-post
       - `ConsentCheck`: `"Olen nõus, et Erametsad Metsaühistu MTÜ töötleb mu andmeid ja võtab ühendust."` (Visible, unchecked, mandatory).
       - Submit Button: `[ LIITU ÜHISTUGA ]` (Amber CTA, full width, 48px height).
2. **Metsandustoetuste taotlemine (Subsidy Table):**
   - Semantic `<table>` showing top 6 subsidy programs, sorted with active/open programs first, then by deadline date.
   - Header: H2 `"Metsandustoetuste taotlemine"` + Right link `"Vaata kõiki toetusi (15) →"`.
   - Columns:
     - `Toetus`: Programmi ametlik nimi (link to `/toetused/:slug`).
     - `Tähtaeg`: Värviline `StatusPill` (`Avatud`, `Varsti`, `Suletud`) + kuupäevavahemik (`07.04–23.04.2026`).
     - `Toetuse suurus`: Maksimaalne määr (€/ha või €/tükk, `JetBrains Mono`).
     - `Tegevus`: Nupp `[ Taotle → ]` (väike outline pill).
   - Jalus: Teavitus *"Tähtajad ja määrad kontrollitakse PRIA ametlikust taotlusvoorude kalendrist."*
3. **Teenused (Service Chips Band):**
   - Background `--bg-mist` band across full width.
   - H2 Heading: `"Teenused metsaomanikule"`.
   - 9 interaktiivset kiipi (`chips`): Istutamine, Hooldusraied, Metsataimede tellimine, Nõustamine, Taimekaitse & ulukitõrje, Metsakavad, Taimede hooldus, Maapinna ettevalmistus, ja spetsiaalne väline kiip `[ ⚡ Oksjonikeskkond ↗ ]`.
   - Iga kiip viib ankruga lehele `/teenused#ankur`.
4. **Toetused Cards (3 Featured Cards):**
   - 3 prominent programs (nt Metsauuendus, Metsakava, Metsameede).
   - Igal kaardil staatuse pill päises, programmi nimi, 1-lauseline tutvustus, maksimaalne toetuse määr suures kirjas (`JetBrains Mono`, 24px) ja link detaillehele.
5. **ContactBand:**
   - Standardne kontaktiriba lehe allosas.

---

### Page 02: Teenused — Services Single-Page Scroll
**Route:** `/teenused` (ankrud `#istutamine`, `#hooldusraied`, `#taimede-tellimine`, `#noustamine`, `#taimekaitse`, `#kavad`, `#taimede-hooldus`, `#maapind`, `#oksjonid`)  
**Access:** Public  
**Purpose:** Educational overview of all 9 association services on one clean scrolling page. Forest owners can read detailed forestry explanations, check requirements, and open an inline service inquiry drawer.

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ HEADER BAND (Misty lavender): H1: Teenused metsaomanikule                                   │
│ Subtitle: Teeme metsatööd algusest lõpuni — ja suur osa teenustest on toetustega kaetud.    │
│ [ 🔗 Vaata toetuste võimalusi ]                                                             │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│ STICKY CHIP NAV (Sticky top-18, horizontal scroll):                                         │
│ [ Istutamine ] [ Hooldusraied ] [ Taimede tellimine ] [ Nõustamine ] [ Taimekaitse ]       │
│ [ Metsakavad ] [ Taimede hooldus ] [ Maapind ] [ Oksjonikeskkond ↗ ]                        │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. #istutamine — Metsa istutamine ja uuendamine                                             │
│    Intro: Korraldame kvaliteetse metsauuenduse alates taimede valikust kuni istutuseni...   │
│    3-SAMMULINE PROTSESS:                                                                    │
│    [ 1. Maapinna ettevalmistus ] ──> [ 2. Taimede tellimine ] ──> [ 3. Istutustööd ]        │
│    Nupud: [ Soovin päringut (Avab drawer) ]   [ Helista nõustajale 📞 ]                     │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│ 2. #hooldusraied — Valgustus- ja harvendusraied                                             │
│    "Miks teha hooldusraiet?" Eesmärgid: valgus juurdekasvuks, puistu sanitaarne seisund... │
│    Päringu info: Hind sõltub asukohast, tihedusest ja mahust.                               │
│    Nupud: [ Soovin päringut ]   [ Küsi nõu ]                                                │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│ 3. #taimede-tellimine — Metsataimede tellimine                                              │
│    Ühistu kaudu hulgitellimisel soodsamad lepinguhinnad tunnustatud taimlatest.              │
│    Puuliikide nimekiri: Kuusk (potitaim / paljasjuurne), Mänd, Kask, Sanglepp.              │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│ 4. #noustamine — Metsandusalane nõustamine (11 põhiteemat)                                  │
│    2-VEERULINE KONTROLL-LOEND:                                                              │
│    ✓ Alustav metsaomanik ja esimesed sammud      ✓ Raieprintsiibid ja optimaalne aeg        │
│    ✓ Dokumendid, load ja metsateatised           ✓ Metsa- ja ulukikahjustuste hindamine     │
│    ✓ Metsamajandamiskava ja takseerandmed        ✓ Majanduslik tasuvus ja kalkulatsioonid   │
│    ✓ Metsa uuendamise ja istutuse nõuded         ✓ Riiklikud toetused ja PRIA reeglid       │
│    ✓ Noorendike hooldamise parim praktika        ✓ Natura 2000 erametsa piirangud           │
│    ✓ Teostatud tööde kvaliteedi kontroll                                                    │
│    Konsulendi kvalifikatsioon: Kutsetunnistusega metsakonsulendid (kutseregister.ee).       │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│ 5. #taimekaitse — Taimekaitse ja ulukitõrjevahendid                                         │
│    ┌─ TOODE 1: TRICO ──────────────┐ ┌─ TOODE 2: CERVACOL EXTRA ───────┐                   │
│    │ Looduslik lambarasval põhinev │ │ Valge määre latvade kaitseks    │                   │
│    │ hirve- ja kitselõhnapeleti.   │ │ põdrakahjustuste vastu.         │                   │
│    │ Kulu: 6–10 l/ha · Mõju: 6 kuud│ │ Kulu: 2–4 kg/1000 taime         │                   │
│    │ [ Telli ühistu kaudu → ]      │ │ [ Telli ühistu kaudu → ]        │                   │
│    └───────────────────────────────┘ └─────────────────────────────────┘                   │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│ 6. #kavad — Metsamajandamiskavad (Metsa pass 10 aastaks)                                    │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│ 7. #taimede-hooldus — Noorendike hooldus ja rohimine                                        │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│ 8. #maapind — Maapinna ettevalmistus ketasadraga                                            │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│ 9. #oksjonid — Raieõiguste ja kinnistute enampakkumised (Eraldiseisev esiletõstetud riba)   │
│    Müü oma raieõigus või kinnistu läbi Eesti juhtiva oksjonikeskkonna parima hinnaga.       │
│    [ Ava oksjonikeskkond: oksjonid.erametsad.ee ↗ ]                                          │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

#### Detailed Blocks:
1. **Header & Sticky Chip Navigation:**
   - H1 `"Teenused metsaomanikule"` + viide metsandustoetustele.
   - Kleepuv kiipnavigatsioon (`Sticky Chip Nav`): Jääb lehte alla kerides ekraani ülaossa (päise alla). Aktiivne jaotis tõstetakse esile rohelise äärisega vastavalt vaateaknale (`IntersectionObserver`).
2. **Teenuste jaotised (Sections 1–9):**
   - Iga jaotis algab H2 pealkirjaga (ankur-ID'ga) ja sisaldab 2–4 lauselist sissejuhatust.
   - *Istutamine:* 3 sammuga horisontaalne voog (`Steps`: ettevalmistus → taimed → istutus).
   - *Nõustamine:* 2-veeruline visuaalne ruudustik 11 ametliku nõustamisteemaga + viide kutseregistrile.
   - *Taimekaitse:* 2 toote kaarti (`Trico` ja `Cervacol Extra`) koos kulumäärade ja toimeajaga.
   - *Enampakkumised:* Tume spetsiaalne reklaamriba portaali `oksjonid.erametsad.ee` tutvustusega.
3. **Teenusepäringu külgsahtel (Inline Enquiry Drawer):**
   - Nupu `[ Soovin päringut ]` vajutamisel avaneb paremalt 480px laiune sahtel:
     - Päis: `"Teenusepäring: <Teenuse nimi>"`
     - Rippmenüü: Teenuse valik (automaatselt eeltäidetud vastavalt klikitud sektsioonile).
     - Väljad: Nimi, Telefon, E-post, Metsa asukoht / katastritunnus (valikuline), Vabas vormis soov/kommentaar.
     - `ConsentCheck`: Nõusolek andmete töötlemiseks.
     - Nupp: `[ SAADA PÄRING ]` (Amber CTA).

---

### Page 03: Toetused (List) — Subsidies Hub
**Route:** `/toetused`  
**Access:** Public  
**Purpose:** Central catalog of all Estonian forestry subsidies (Erametsakeskus / KIK / PRIA). Allows owners to compare deadlines, grant rates, and application channels (self in e-PRIA vs via association joint application).

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ H1: Metsatoetused 2026 — Tähtajad, nõuded ja taotlemine                                     │
│ Intro: Aitame erametsaomanikel taotleda kõiki metsandustoetusi. Esitame taotluse sinu eest │
│ ühistaotlusena (teenustasu 7% laekunud toetusest) või anname nõu iseseisvaks esitamiseks.  │
├───────────────────────────────┬─────────────────────────────────────────────────────────────┤
│ VASAK FILTER-NAV (3 veergu)   │ PÕHILISTING JA TABEL (9 veergu)                             │
│ ┌───────────────────────────┐ │ STAATUSTE LEGEND:                                           │
│ │ KÕIK TOETUSED (15)        │ │ ● Avatud taotlusvoor   ◐ Taotlusvoor tulekul   ○ Suletud    │
│ │                           │ ├───────────────────────────────────────────────────────────┤
│ │ ERALDISTOETUSED           │ │ TÄIELIK METSATOETUSTE TABEL:                              │
│ │ • Metsauuenduse toetus    │ │ ┌───────────────────────────────────────────────────────┐ │
│ │ • Noorendike hooldus      │ │ │ Toetuse nimetus    │ Tähtaeg         │ Toetuse määr   │   │ │
│ │ • Metsakava koostamine    │ │ ├────────────────────┼─────────────────┼────────────────┼───┤ │
│ │ • Natura 2000 hüvitis     │ │ │ Rühm: Eraldistoetused                                 │   │ │
│ │ • Pärandkultuuri säil.    │ │ │ Metsa uuendamine   │ ● 07.04–23.04.26│ Kuni 356 €/ha  │[→]│ │
│ │                           │ │ │ Noorendike hooldus │ ● 07.04–23.04.26│ 180 €/ha       │[→]│ │
│ │ METSAMEEDE (KIK) ▸        │ │ │ Metsakava toetus   │ ● Aastaringne   │ 1.50 €/ha      │[→]│ │
│ │   • Hooldusraie ≤10a      │ │ │ Natura 2000 toetus │ ◐ Mai 2026      │ Kuni 110 €/ha  │[→]│ │
│ │   • Tormikahjustused      │ │ ├────────────────────┼─────────────────┼────────────────┼───┤ │
│ │   • Taimehaigused         │ │ │ Rühm: Metsameede (KIK alusmeetmed)                    │   │ │
│ │   • Metsataristu          │ │ │ Metsameede: hooldus│ ◐ Sügis 2026    │ Kuni 1 200 €/ha│[→]│ │
│ │                           │ │ │ Metsameede: kahjust│ ○ Suletud       │ Kuni 1 000 €/ha│[→]│ │
│ │ MUUD TOETUSED             │ │ └────────────────────┴─────────────────┴────────────────┴───┘ │
│ │ • Üraskikahjustused       │ ├───────────────────────────────────────────────────────────┤
│ │ • Ulukikahjustuste ennet. │ │ KUIDAS TAOTLEMINE KÄIB? (3-etapiline selgitusriba)        │
│ └───────────────────────────┘ │ 1. Vali toetus ──> 2. Saada meile andmed ──> 3. Taotleme    │
│                               │ Teenustasu 7% rakendub ainult eduka toetuse laekumisel!     │
└───────────────────────────────┴─────────────────────────────────────────────────────────────┘
```

#### Detailed Blocks:
1. **Päis ja sissejuhatus:**
   - H1 `"Metsatoetused 2026"` + selgitus ühistaotluse ja e-PRIA isetaotlemise kohta.
2. **Vasak programmide puu-navigatsioon (3 veergu desktopil):**
   - Eraldistoetused (eraldi taotletavad toetused).
   - Metsameede (KIK metsameetme alamtegevused trepp-struktuurina).
   - Muud toetused (looduskaitselised, üraskitõrje jne).
   - Klõps nimekirjas viib otse vastava toetuse detaillehele `/toetused/:slug`.
3. **Täielik toetuste koondtabel:**
   - Rühmitatud tabel (`Eraldistoetused`, `Metsameede`, `Muud toetused`).
   - Igal real: Toetuse ametlik nimi, Tähtaja staatuspill (`Avatud` roheline, `Varsti` kollane, `Suletud` hall), Maksimaalne toetuse määr, ja noolenupp detaillehele liikumiseks.
   - Sorteerimise võimalus: Kuupäeva järgi (avatud voorud eespool) või tähestiku järgi.
4. **Mobiilne kohaldus:**
   - Mobiilis (<768px) muutub tabel kaartide nimekirjaks, kus igal kaardil on programmi nimi, tähtaeg ja määr eraldi ridadel, et vältida horisontaalset kerimist.
5. **Kuidas taotleda selgitusriba:**
   - 3 visuaalset sammu: Vali toetus → Saada meile andmed → Ühistu esitab ühistaotluse. Selge märge 7% eduka teenustasu kohta.

---

### Page 04: Toetuse detailleht — Subsidy Program Detail
**Route:** `/toetused/:slug` (nt `/toetused/hooldusraie`, `/toetused/metsauuendamine`)  
**Access:** Public  
**Purpose:** Deep-dive into a single subsidy program: financial rates, eligibility criteria, step-by-step application instructions via association or self-service, and immediate lead conversion.

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ Breadcrumb: Avaleht / Toetused / Metsa uuendamise toetus      [ ● AVATUD · 07.04–23.04.2026 ]│
├──────────────────────────────────────────────────────────────┬──────────────────────────────┤
│ H1: Metsa uuendamise toetus (2026)                           │ KÜLGPAIGALDUSEGA VORM        │
│ Intro: Toetus aitab katta metsauuendamisega seotud kulud:    │ ┌──────────────────────────┐ │
│ metsataimede soetamise, maapinna ettevalmistamise ja istutuse│ │ Taotle toetust ühistuga  │ │
│                                                              │ │ Ees- ja perekonnanimi*:  │ │
│ H2: Kui suur on toetus?                                      │ │ [                      ] │ │
│ ┌──────────────────────────────────────────────────────────┐ │ │ Telefoni number*:        │ │
│ │ Taotleja sihtgrupp               │ Toetuse piirmäär      │ │ │ [                      ] │ │
│ ├──────────────────────────────────┼───────────────────────┤ │ │ E-posti aadress*:        │ │
│ │ Füüsiline isik ja FIE            │ Kuni 356 € / ha       │ │ │ [                      ] │ │
│ │ Juriidiline isik (ettevõte)      │ Kuni 297 € / ha       │ │ │ Metsa asukoht / pindala: │ │
│ │ Ühistu liige (ühistaotlus)       │ Täismäär + nõustamine │ │ │ [                      ] │ │
│ └──────────────────────────────────┴───────────────────────┘ │ │ ☐ Nõustun tingimustega... │ │
│                                                              │ │ [ ESITA TAOTLUS (Amber) ]│ │
│ H2: Olulisemad tingimused taotlejale                         │ └──────────────────────────┘ │
│ • Toetust saab taotleda vähemalt 0,1 ha suurusele lannale.   │                              │
│ • Metsakinnistul peab olema kehtiv metsamajandamiskava.      │ TEENUSTASU SELGITUS:         │
│ • Metsataimed peavad omama päritolutunnistust.               │ Ühistu teenustasu on 7%      │
│                                                              │ laekunud toetusest.          │
│ H2: Kuidas taotlust esitada?                                 │ Rakendub alles pärast toetuse│
│ [ Vaheleht: Ühistu kaudu (Soovitatav) ] [ Vaheleht: e-PRIAs ise ]│ väljamaksmist!           │
│ ┌──────────────────────────────────────────────────────────┐ │                              │
│ │ 1. Esita kontaktid siin lehel või kirjuta meile.         │ │ SEOTUD TOETUSED:           │
│ │ 2. Meie konsulent kontrollib kinnistu kõlblikkust.       │ │ • Noorendike hooldus       │
│ │ 3. Ühistu koostab ja esitab e-PRIAs ühistaotluse.        │ │ • Metsakava koostamine     │
│ └──────────────────────────────────────────────────────────┘ │                              │
└──────────────────────────────────────────────────────────────┴──────────────────────────────┘
```

#### Detailed Blocks:
1. **Päis ja navigatsioon:**
   - Leivapuru rada (`Breadcrumbs`).
   - H1 Pealkiri + Reaalajas staatuse `StatusPill` kuupäevavahemikuga.
2. **Parempoolne kleepuv taotlusvorm (Sticky Form Card, 5 veergu):**
   - Pealkiri: `"Taotle toetust ühistu kaudu"`.
   - Väljad: Nimi, Telefon, E-post, Metsa asukoht / katastritunnus ja ligikaudne pindala.
   - `ConsentCheck`: Nõusolek andmete töötlemiseks.
   - Nupp: `[ ESITA TAOTLUS ]`.
   - *Kui taotlusvoor on suletud:* Vormi pealkirjaks muutub `"Teavita mind järgmisest taotlusvoorust"` ja nupp salvestab kontakti automaatseks teavitamiseks.
3. **Kui suur on toetus? (Toetusmäärade tabel):**
   - Määrad taotleja tüübi järgi (Eraisik, Ettevõte, Ühistu liige).
   - Summad esitatud selgelt eurodes hektari kohta (`JetBrains Mono`).
4. **Olulisemad tingimused (Nõuete nimekiri):**
   - Kontroll-loend tingimustest koos numbriliste parameetrite esiletõstmisega (paks kiri / kollane taust nt `0,1 ha`, `kehtiv metsamajandamiskava`).
5. **Kuidas taotlust esitada? (Vahelehed Tabs):**
   - *Tab 1: Ühistu kaudu (Vaikimisi aktiivne):* Selgitab ühistaotluse samme (ühistu teeb paberitöö, kontrollib kaarte, suhtleb PRIA-ga).
   - *Tab 2: e-PRIAs ise:* Juhend iseseisvaks esitamiseks (menüütee e-PRIAs, Exceli impordifaili allalaadimislink).
6. **Teenustasu info ja vajalike dokumentide loend:**
   - Selge kinnitus: Ühistu võtab 7% teenustasu alles siis, kui PRIA on toetuse välja maksnud.
   - Vajalikud dokumendid: Metsateatis, arved taimede ostu kohta, takseerandmed.

---

### Page 05: Sertifitseerimine — PEFC Group Certification
**Route:** `/sertifitseerimine`  
**Access:** Public  
**Purpose:** Present the PEFC group certification scheme for private forest owners. Explain price advantages of certified timber, provide official standard downloads, and list member obligations.

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ H1: PEFC grupisertifitseerimine erametsaomanikule                                           │
│ Intro: Ühiselt sertifitseerides jõuab sertifitseeritud puidu hinnapreemiani ka väikeomanik │
│ — ühe ühise auditiga ja jagatud kuludega.                                                   │
├──────────────────────────────────────────────┬──────────────────────────────────────────────┤
│ DOKUMENDIKOGU JA STANDARDID (7 veergu)       │ LIIKME KOHUSTUSED (5 veergu, Card)           │
│ ┌──────────────────────────────────────────┐ │ ┌──────────────────────────────────────────┐ │
│ │ PEFC EESTI STANDARDID:                   │ │ │ Mida sertifikaat metsaomanikult nõuab?   │ │
│ │                                          │ │ │                                          │ │
│ │ 📄 PEFC EST 1003:2020            [ PDF ↗]│ │ │ ✓ Järgid PEFC säästliku metsanduse       │ │
│ │    Kestliku metsamajandamise standard    │ │ │   põhimõtteid ja Eesti seadusi           │ │
│ │    Suurus: 1.2 MB · Uuendatud 2024       │ │ │ ✓ Metsamajandamine põhineb kehtival      │ │
│ │                                          │ │ │   metsamajandamiskaval                   │ │
│ │ 📄 PEFC EST 1002:2020            [ PDF ↗]│ │ │ ✓ Tagad audiitorile vajadusel ligipääsu │ │
│ │    Grupisertifitseerimise nõuded         │ │ │   metsakinnistule pisteliseks auditiks   │ │
│ │    Suurus: 840 KB                        │ │ │ ✓ Teavitad ühistut olulistest raietest   │ │
│ │                                          │ │ ├──────────────────────────────────────────┤ │
│ │ 📄 PEFC ST 2001:2020             [ PDF ↗]│ │ │ Soovid sertifikaadiga liituda?           │ │
│ │    Kaubamärkide kasutamise reeglid       │ │ │ [ Küsi sertifitseerimisest (Drawer) ]    │ │
│ │                                          │ │ └──────────────────────────────────────────┘ │
│ │ ÜHISTU SISEDOKUMENDID:                   │ └──────────────────────────────────────────────┘
│ │ 📄 Erametsad Metsaühistu PEFC      [ ↓ ] │                                                │
│ │    grupisertifitseerimise põhimõtted     │                                                │
│ │    Meie ühistu ametlik juhend (PDF)      │                                                │
│ └──────────────────────────────────────────┘                                                │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│ H2: Kuidas liituda PEFC grupiga? (3 sammu)                                                  │
│ [ 1. Astu ühistu liikmeks ] ──> [ 2. Allkirjasta põhimõtted ] ──> [ 3. Mets sertifitseeritud]│
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

#### Detailed Blocks:
1. **Päis:**
   - H1 `"PEFC grupisertifitseerimine erametsaomanikule"`.
   - Selgitus: Sertifitseeritud puit annab kokkuostus kõrgemat hinda ja tagab ligipääsu suurematele puidutöötlejatele. Ühistu kaudu on auditeerimine kordades soodsam kui individuaalselt.
2. **Dokumendikogu (Document Library):**
   - Standardite loend allalaaditavate PDF failidega:
     - `PEFC EST 1003` (Kestliku metsanduse standard).
     - `PEFC EST 1002` (Grupisertifitseerimise nõuded).
     - `PEFC ST 2001` (Kaubamärgi reeglid).
     - `Erametsad Metsaühistu grupisertifitseerimise põhimõtted` (Ühistu enda ametlik dokument).
   - Igal real faili suurus, ikoon ja allalaadimise nupp.
3. **Liikme kohustused (Obligations Card):**
   - 4 selget põhireeglit (kava olemasolu, säästlik majandamine, auditi lubamine, raietest teatamine).
   - Nupp `[ Küsi sertifitseerimisest ]` (avab päringusahtli).
4. **Liitumise 3 sammu:**
   - 1. Astu liikmeks → 2. Allkirjasta ühinemisavaldus → 3. Mets kantakse grupisertifikaadi nimekirja.

---

### Page 06: Liitu — Join the Association
**Route:** `/liitu`  
**Access:** Public  
**Purpose:** Primary membership conversion page. Emphasizes that membership is 100% free, lists 11 concrete member benefits, and provides the validated membership form.

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ H1: Astu Erametsad Metsaühistu liikmeks                                                     │
│ ┌─ TASUTA LIIKMELISUSE BANNER (Amber tint background) ────────────────────────────────────┐ │
│ │ 🌲 Liitumine ja liikmelisus on 100% TASUTA!                                             │ │
│ │ Me ei võta liikmemaksu — ühistu teenib tulu osutatud teenustasudest, mitte liikmetelt.   │ │
│ └─────────────────────────────────────────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────┬──────────────────────────────────────────────┤
│ MIKS LIITUDA ÜHISTUGA? (7 veergu)            │ LIITUMISAVALDUSE VORM (5 veergu, Valge kaart)│
│ 11 konkreetset hüve metsaomanikule:          │ ┌──────────────────────────────────────────┐ │
│                                              │ │ Liitumisavaldus                          │ │
│ ✓ 1. Isiklik nõustamine ja metsaülevaatus   │ │ Ees- ja perekonnanimi*:                  │ │
│ ✓ 2. Metsatoetuste taotlemine sinu eest     │ │ [                                      ] │ │
│ ✓ 3. Raieõiguste müük oksjonil parima hinnaga│ │ Isikukood* (11 numbrit):                 │ │
│ ✓ 4. Metsakinnistute ja põllumaa enampakkum. │ │ [ 38705162718                          ] │ │
│ ✓ 5. Metsauuendus- ja istutustööd algusest lõp│ │ Elukoht / postiaadress*:                 │ │
│ ✓ 6. Maapinna ettevalmistus metsamasinaga    │ │ [ Pärnu mnt 10, Saarde vald            ] │ │
│ ✓ 7. Noorendike ja kultuuride hooldus        │ │ Telefoni number*:                        │ │
│ ✓ 8. Metsavara kaitsmine ulukite eest        │ │ [ +372 521 9876                        ] │ │
│ ✓ 9. Õigusabi metsaomandi vaidlustes         │ │ E-posti aadress*:                        │ │
│ ✓ 10. Seadusandluse ja maksunõustamine       │ │ [ jaan@torn.ee                         ] │ │
│ ✓ 11. Abi metsatulu deklareerimisel tuludekl.│ │                                          │ │
│                                              │ │ ☑ Nõustun, et Erametsad Metsaühistu MTÜ │ │
│ [ 📄 Loe ühistu põhikirja (PDF) ↗ ]          │ │   töötleb mu andmeid liitumise          │ │
│                                              │ │   läbiviimiseks ja võtab ühendust.*      │ │
│                                              │ │                                          │ │
│                                              │ │ [ ASTU LIIKMEKS (Suur Amber CTA) ]       │ │
│                                              │ └──────────────────────────────────────────┘ │
├──────────────────────────────────────────────┴──────────────────────────────────────────────┤
│ H2: Mis saab pärast avalduse esitamist? (4 sammu)                                           │
│ 1. Võtame 1 tööpäeva jooksul ühendust  ──>  2. Kinnitame liikmelisuse ja saadame materjalid │
│ 3. Kaardistame sinu metsa vajadused   ──>  4. Alustame vajadusel kohe toetuse taotlemisega│
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

#### Detailed Blocks:
1. **Tasuta liikmelisuse bänner:**
   - Tugev visuaalne esiletõst lehe ülaosas: `"Liitumine ja liikmelisus on tasuta"`. Selgitus, et ühistu ei küsi aastamaksu ega sisseastumistasu.
2. **11 liikmehüve nimekiri (7 veergu):**
   - 11 nummerdatud ja kontrollmärgiga (`✓`) hüve, mis katavad nõustamise, toetused, oksjonid, istutuse, juriidilise abi ja tuludeklaratsiooni.
   - Otselink põhikirjale: `[ Loe ühistu põhikirja (PDF) ↗ ]`.
3. **Liitumisavalduse vorm (5 veergu, valge kaart):**
   - Väljad range kliendipoolse valideerimisega:
     - Ees- ja perekonnanimi (kohustuslik).
     - Isikukood (11 numbrit, kontrollkoodi kontroll Eesti standardi järgi).
     - Elukoht / postiaadress (kohustuslik MTÜ liikmete nimekirja seadusjärgseks pidamiseks).
     - Telefoninumber ja E-posti aadress.
     - `ConsentCheck`: Nõusolek andmete töötlemiseks (nähtav, vaikimisi märkimata, kohustuslik).
   - Nupp: `[ ASTU LIIKMEKS ]` (48px kõrge merevaigukollane nupp).
4. **"Mis edasi saab?" (4-sammuline ajajoon):**
   - Selgitus, et avalduse saatmise järel võtab konsulent 1 tööpäeva jooksul ühendust ja tutvustab esimesi samme.

---

### Page 07: Kontakt — Contact & Staff
**Route:** `/kontakt`  
**Access:** Public  
**Purpose:** Help owners connect with real local forestry consultants, view office locations and visiting hours, and submit open inquiries.

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ H1: Võta meiega ühendust                                                                    │
│ Intro: Kirjuta, helista või tule külla. Kontorisse tulles palume aja eelnevalt broneerida. │
├──────────────────────────────────────────────┬──────────────────────────────────────────────┤
│ MEIE METSAKONSULENDID (7 veergu)             │ ÜHISTU ÜLDANDMED JA KONTOR (5 veergu, Card) │
│ ┌─ SPETSIALISTI KAART ─────────────────────┐ │ ┌──────────────────────────────────────────┐ │
│ │ [Foto 80px]  Marit Vain                  │ │ │ MTÜ Erametsad Metsaühistu                │ │
│ │              Tegevjuht / Metsakonsulent  │ │ │ Registrikood: 80XXXXXX                   │ │
│ │              Kutsetunnistus nr 184291    │ │ │ KMKR: EE10XXXXXXXX                       │ │
│ │              📞 +372 521 9876            │ │ │ Juriidiline aadress: Metsa 12, Pärnu     │ │
│ │              ✉ marit.vain@erametsad.ee    │ │ │                                          │ │
│ │              Tööpiirkond: Pärnu, Saare   │ │ │ KONTORID JA LAHTIOLEKUAJAD:              │ │
│ └──────────────────────────────────────────┘ │ │ • Tallinn: E–R 09:00–17:00               │ │
│ ┌─ SPETSIALISTI KAART ─────────────────────┐ │ │   (Eelregistreeritud külastused)         │ │
│ │ [Foto 80px]  Kaire Mets                  │ │ │ • Pärnu: Kokkuleppel                     │ │
│ │              Metsandusspetsialist        │ │ ├──────────────────────────────────────────┤ │
│ │              📞 +372 514 2345            │ │ │ ℹ TÄHELEPANU KÜLASTAJALE:               │ │
│ │              ✉ kaire.mets@erametsad.ee    │ │ │ Kuna konsulendid viibivad sageli metsas, │ │
│ │              Tööpiirkond: Tartu, Võru    │ │ │ palume kontorikülastus eelnevalt telefoni│ │
│ └──────────────────────────────────────────┘ │ │ või e-posti teel kokku leppida!          │ │
│ (2×2 ruudustik spetsialistide kaartidest)    │ └──────────────────────────────────────────┘ │
├──────────────────────────────────────────────┴──────────────────────────────────────────────┤
│ KIRJUTA MEILE (Üldine kontaktivorm)                                                         │
│ ┌─────────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ Nimi*:        [                      ]   E-post*:   [                                 ] │ │
│ │ Telefon:      [                      ]   Teema*:    [ Vali teema: Toetused / Liitumine▾]│ │
│ │ Sõnum*:       [ Kirjuta oma küsimus või kinnistu andmed siia...                       ] │ │
│ │ ☑ Nõustun andmete töötlemisega vastavalt privaatsustingimustele.*                        │ │
│ │ [ SAADA SÕNUM (CTA Nupp) ]                                                              │ │
│ └─────────────────────────────────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│ ASUKOHAKAART: Interaktiivne kaart Tallinna ja Pärnu kontori asukohaga [ Ava Google Mapsis ↗]│
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

#### Detailed Blocks:
1. **Spetsialistide kaardid (Specialist Cards Grid):**
   - 2×2 ruudustik kohalikest nõustajatest:
     - Foto (80px ümarfoto).
     - Nimi ja ametinimetus (nt Atesteeritud metsakonsulent, kutsetunnistuse number).
     - Otsetelefon (`tel:` link) ja e-posti aadress (`mailto:` link).
     - Tööpiirkond (nt Pärnumaa, Lõuna-Eesti, Saared).
2. **Ühistu ametlik info ja külastuste reegel:**
   - Juriidilised andmed: Registrikood, KMKR, juriidiline aadress.
   - Lahtiolekuajad (E–R 09–17).
   - Informatiivne hoiatuskast (`--info` taustal): Palve broneerida kontorikülastus ette, kuna konsulendid on tihti välitöödel ja lankidel.
3. **Üldine kontaktivorm:**
   - 2-veeruline vorm: Nimi, E-post, Telefon, Teema valik (rippmenüü: Liikmelisus, Toetused, Teenused, Sertifitseerimine, Muu), Pikem sõnumiväli ja GDPR nõusoleku märkeruut.
4. **Asukohakaart (MapEstonia):**
   - Kaardipilt kontori asukoha nõelaga + otselink Google Mapsi teejuhistele.

---

## 3. Reusable UI Components Checklist for Figma

Before sketching individual pages, the designer should establish these shared subsite components in the design system:

### 1. `JoinCard` (Hero & CTA Join Component)
- White card surface, `14 px` radius, elevation shadow.
- Standard form inputs with `8 px` radius, floating or clear top labels.
- Unchecked, visible `ConsentCheck` with terms link.
- Pill CTA button (Amber `#F2A93B`, 48px height).

### 2. `SubsidyTable` (Semantic Grouped Subsidy Table)
- Clean table rows (height `52 px`), subtle bottom borders `#c1c8c2`.
- Hover row state: background `#f4f2ff`.
- Columns: Name, Deadline pill, Rate (`JetBrains Mono`), Action button (`[ Taotle → ]`).
- Mobile variant: Transforms from table rows to vertically stacked cards.

### 3. `StatusPill` (Deadlines & Availability Badge)
- Rounded full pill (`9999 px`), height `24 px`, padding `2px 10px`.
- 12px Medium font + 6px colored status dot.
- Variants: `Avatud` (Green), `Varsti` (Amber), `Suletud` (Muted Grey), `Aeg täpsustub` (Lavender).

### 4. `ChipNav` (Sticky Anchor Bar)
- Horizontal row of pill chips, height `36 px`.
- Inactive: Border `#c1c8c2`, background white, text `#181a2e`.
- Active: Background `#012d1d`, text white, smooth transition on scroll.

### 5. `SpecialistCard`
- White card, 12px radius, subtle border.
- 80px circular photo, consultant name, official certificate number, direct phone and email links, coverage county chip.

### 6. `ServiceDrawer` (Inline Service Request)
- 480px slide-over drawer from the right.
- Service type selector, contact inputs, message, consent check, and submit button.

---

## 4. Recommended Sketching Order for the Designer

1. **Global Shell:** Header with wordmark and "Liitu" CTA, pre-footer `ContactBand`, dark footer.
2. **Page 01 (Avaleht):** Hero split with `JoinCard`, top-6 subsidy table, service chips band, featured cards.
3. **Page 03 (Toetused List):** 3-col sidebar tree, grouped subsidy table, "Kuidas taotleda" 3-step banner.
4. **Page 04 (Toetuse detailleht):** Rates table, eligibility criteria, application tabs, sticky right form.
5. **Page 06 (Liitu):** "Tasuta" banner, 11 benefits checklist, membership application form.
6. **Page 02 (Teenused):** Sticky chip nav, 9 service sections, service inquiry drawer.
7. **Page 05 (Sertifitseerimine):** Document library, member obligations card, 3-step timeline.
8. **Page 07 (Kontakt):** Specialist cards grid, office hours & visit notice, contact form, map.
