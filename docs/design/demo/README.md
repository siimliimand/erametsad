# Erametsad — Demo design brief

> **In brief:** How Erametsad should **look**. A self-contained visual brief for the person designing the HTML demo pages — you don't need to read the full design system first. Where this document and a page spec (`marketing/*.md`) disagree, the page spec wins.

Sources: [../README.md](../README.md) (full design system), [../00-global-shell.md](../00-global-shell.md), [../marketing/](../marketing/) (per-page specs with wireframes and draft copy).

---

## What the demo is

Static HTML demo pages of the **marketing site (`erametsad.ee`)**, built to validate the visual direction before real implementation.

- **Static** — plain HTML/CSS with minimal JS (accordions, tabs, mobile drawer). Forms, tickers and maps are non-functional mockups with realistic content.
- **Estonian throughout** — use the draft copy from §7 and the page specs. No lorem ipsum anywhere.
- **Light theme only** — the design has no dark mode.
- Demo scope is the marketing site. The auction portal, admin and association subsite reuse the same tokens and components (§12) but are not part of this demo.

**The one-sentence look:** a calm, light site with generous white space — spruce green and off-black text with a single amber CTA accent per block, real Estonian forest photography under dark-green gradient overlays, big geometric Manrope headings over quietly precise Inter body text. More "trusted local forester" than "startup landing page".

**If you remember nothing else:**

1. White background, lots of air. Sections alternate white → mist `#F1F5F2`. Dark spruce `#16382A` appears only in hero overlays, the footer, and 1–2 emphasis bands (stats, CTA).
2. Exactly **one amber CTA per block**. Green does everything else (buttons, links, active states, icons).
3. Photography carries the brand — real Estonian woodland, 16:10, dark-green gradient fading from the left on hero images.
4. Rounded but not bubbly: 14px cards, 10px buttons/inputs, 999px pills.
5. Honest Estonian copy: fees stated upfront, consent checkbox visible and unchecked, real phone numbers (placeholders in demo).

---

## 1. Colour

Rooted in the Estonian forest: spruce green, fresh moss, dark soil, golden birch.

| Token | Value | Role |
|---|---|---|
| `--primary` | `#2E6B4F` | Primary buttons, links, accents, active states |
| `--primary-hover` | `#25573F` | Hover/pressed primary |
| `--primary-dark` | `#16382A` | Hero overlays, footer bg, stat/CTA bands, section headings |
| `--primary-light` | `#E9F0EC` | Subtle section backgrounds, info banners, selected states |
| `--accent` | `#58B368` | Success states, ✓ list icons, focus outline, active indicators |
| `--cta` | `#F2A93B` | The main CTA button, price highlights, important notices |
| `--cta-hover` | `#D98F1F` | Hover/pressed CTA |
| `--ink` | `#1B211D` | Body text and headings (off-black, never `#000`) |
| `--ink-muted` | `#6B7570` | Secondary text, captions, metadata, ended/archived states |
| `--ink-inverse` | `#FFFFFF` | Text on dark surfaces |
| `--bg-page` | `#FFFFFF` | Default page background |
| `--bg-mist` | `#F1F5F2` | Alternating section backgrounds, contact band, cards |
| `--border` | `#E3E7E4` | Field borders, dividers (always faint) |
| `--danger` / `--danger-light` | `#B3261E` / `#FBEAE9` | Errors, destructive actions / error backgrounds |
| `--info` / `--info-light` | `#2D6FA8` / `#E9F1F7` | Info banners / info backgrounds |

**Auction status pills** (small 999px-radius badges):

| State | Colour |
|---|---|
| Aktiivne | `#2E9E5B` |
| Lõpeb varsti (< 1 h) | `--cta` `#F2A93B` |
| Kriitiline (< 5 min) | `--danger` `#B3261E` |
| Lõppenud / arhiiv | `#6B7570` |
| Mustand | `#9E9E9E` |
| Plaanitud | `--info` `#2D6FA8` |

**Rules:**
- Amber is scarce. If two amber buttons are visible at once, the design is wrong. Secondary actions are green solid, green outline or ghost.
- Dark spruce bands are punctuation, not wallpaper: hero overlays, footer, one stats band, one CTA band per page at most.
- Text contrast ≥ 4.5:1 everywhere; hero text sits on the gradient overlay, never on raw photo.
- Focus state on every interactive element: `outline: 2px solid #58B368`.
- Border on the header bottom edge: `rgba(27,33,29,.08)`.

---

## 2. Typography

| Role | Family | Weights | Use |
|---|---|---|---|
| Headings | **Manrope** | 700, 800 | H1–H4 everywhere. Geometric, warm, modern. |
| Body & UI | **Inter** | 400, 500, 600 | Body, labels, inputs, tables, buttons. |
| Numbers | **JetBrains Mono** | 400, 500 | Prices, countdowns, registry codes, data. `font-feature-settings: "tnum"` always. |

**Type scale:**

| Step | Size / line-height | Weight | Use |
|---|---|---|---|
| H1 | 3rem / 1.15 (48px) | Manrope 800 | Page heros |
| H2 | 2.25rem / 1.2 (36px) | Manrope 700 | Section headings |
| H3 | 1.5rem / 1.25 (24px) | Manrope 700 | Card titles, sub-headings |
| H4 | 1.125rem / 1.35 (18px) | Manrope 700 (`letter-spacing: .02em`) | Minor headings |
| Body | 1rem / 1.6 (16px) | Inter 400 | Paragraphs, lists |
| Body-sm | 0.875rem / 1.5 (14px) | Inter 400 | Captions, metadata, footer |
| Label | 0.8125rem / 1.4 (13px) | Inter 500–600 | Form labels, table headers, badges |
| Count | 2rem / 1.1 (32px) | Manrope 800, mono digits | KPI numbers, timer digits |

The homepage stat band runs its numbers larger (48px, white on `--primary-dark`) per its page spec.

**Rules:**
- Estonian diacritics (õ ä ö ü) must render correctly — all three families cover them.
- Prices, areas (ha), countdown digits and registry codes are always JetBrains Mono, never the body face.
- Buttons and nav use Inter 500–600 (nav: 16px, weight 600).

---

## 3. Layout & shape

| Property | Value |
|---|---|
| Grid | 12 columns, CSS Grid |
| Container max | 1280px (24px gutters) |
| Narrow content | 720px — long-form articles, FAQ answers |
| Sidebar | 280px — filters, sticky TOC menus |
| Section padding (desktop) | 64px between sections, 96–128px around major blocks |
| Section padding (mobile ≤768px) | 40px between sections |
| Hero-to-content | 128px |

| Shape | Value |
|---|---|
| Radius — cards | 14px |
| Radius — buttons, inputs | 10px |
| Radius — hero images, modals | 16px |
| Radius — pills, chips | 999px |
| Shadow — card rest | `0 2px 12px rgba(22,56,42,.08)` |
| Shadow — card hover | `0 2px 8px rgba(22,56,42,.12), 0 8px 24px rgba(22,56,42,.08)` + 2px lift |
| Shadow — modal | `0 4px 16px rgba(22,56,42,.12), 0 16px 48px rgba(22,56,42,.10)` |

Shadows are green-tinted and subtle — never grey drop-shadows, never hard edges.

---

## 4. Motion

Calm, not frantic. Every animation earns its place.

| Context | Duration / easing |
|---|---|
| Hover states (bg, border, shadow) | 150ms `ease-out` |
| Card lift on hover | 2px translate + shadow deepen |
| Element reveal on scroll | 300ms `cubic-bezier(.22,.61,.36,1)` |
| Dropdown / accordion | 200ms `cubic-bezier(.4,0,.2,1)` |
| Modal entry | 200ms fade + scale 0.96→1 |
| Staggered list reveal | 50ms delay between cards, max 6 items |

Respect `prefers-reduced-motion` — reduce everything to 0ms fades. In the demo, only hover states and one scroll-reveal pattern need to work; nothing should bounce, parallax or autoplay.

---

## 5. Imagery

The photography does more work than the palette — it is the emotional anchor.

| Rule | Detail |
|---|---|
| Subject | Real Estonian forest: birch and spruce stands, morning mist, snow, field work, bark/needle/moss close-ups. **No** generic stock, tropical or urban imagery. |
| Aspect | Heroes and card thumbnails 16:10; portrait shots 4:3. |
| Hero treatment | Gradient overlay left→right: `linear-gradient(90deg, rgba(22,56,42,.85), rgba(22,56,42,.35))`. All hero text sits on the dark end. |
| Section images | Clean, no filter, natural colour. |
| Grading | Slightly desaturated (−5 saturation), warm white balance. No HDR crunch. |
| Alt text | Descriptive Estonian on every image, no exceptions. |

**Demo placeholders:** use real-looking Estonian forest photos (client-provided set if available, otherwise tasteful stock from Baltic/Nordic forests). Grey labelled boxes are acceptable for screenshots (metsateatis steps) and specialist headshots. Logo is not final — use the wordmark "Erametsad" set in Manrope 800, `--primary-dark`, as an SVG placeholder. Phone numbers `+372 XXX XXXX`, registry codes `[registrikood]`.

---

## 6. Icons

**Lucide** (lucide.dev) — stroke icons, consistent 2px stroke, currentColor. Use `<svg>` inline in the demo; tree-shaken via `lucide-react` in production. **Never emoji.**

Key set: `TreePine` (cutting rights) · `MapPinHouse` (property) · `Wheat` (field) · `Package` (lots) · `Zap` (quick auction) · `SlidersHorizontal` (filter) · `Map` · `Calendar` · `Search` · `X` · `ChevronRight`/`ChevronDown` · `ExternalLink` · `Bell` · `User` · `Download` · `FileText` · `Phone` · `Mail` · `Check`/`CheckCircle` · `AlertTriangle`/`AlertCircle` · `Info` · `HelpCircle` · `Clock` · `Gavel` · `Settings` · `LogOut` · `Menu` · `ShieldCheck` (backup-offer guarantee) · `Landmark` (registry block) · `Facebook`/`Instagram`/`Youtube`.

---

## 7. Voice & copy (Estonian)

Four traits: **selge** (short sentences, zero jargon), **aus** (fees upfront, no hidden conditions), **asjalik** (friendly but not chatty), **inimlik** (real names, real phone numbers). Write like a trusted forester talks — never like marketing.

| Instead of… | Write… |
|---|---|
| "Maksimeerime teie metsa väärtust läbi innovaatilise oksjoniprotsessi" | "Sinu mets, õigem hind" |
| "Esitage päring meie spetsialistidele" | "Jäta kontakt — helistame homme" |
| "Süsteemi viga K102" | "Midagi läks valesti. Proovi uuesti või helista +372 XXXX XXXX" |

**Ready-to-paste draft copy (from the page specs):**

| Where | String |
|---|---|
| Home H1 / intro | "Sinu mets, õigem hind." / "Müü raieõigus või metsakinnistu oksjonil, kus konkureerivad pakkumised tagavad turuhinna. Konsultatsioon on tasuta." |
| Home CTAs | "Vaata aktiivseid oksjoneid" · "Oksjonite ajalugu" |
| Mist band | "Plaanis metsa müük? Räägime läbi, ilma kohustusteta." → btn "Räägime detailsemalt" |
| LeadForm title | "Tasuta konsultatsioon" |
| Raieõigus H1 / CTAs | "Raieõiguse müük oksjonil" / "Tutvu raieõiguste oksjonitega" · "Tutvu kinnistute oksjonitega" |
| Fee card | "Teenustasu on 3% käibemaksuga lõpphinnast. Kui oksjon jääb müümata, ei maksa sa midagi." |
| Kiiroksjon H1 / sub / CTA | "48 tunniga reaalsed pakkumised sinu metsale" / "Kiire, turvaline ja ilma eelkuludeta." / "Alusta — jäta kontakt" |
| Meist H1 / CEO quote | "Sul on metsa majandamist puudutav küsimus?" / "Mets on pikaajaline investeering — meie ülesanne on tagada, et selle võõrandamisel langetaks otsuseid teave, mitte ärevus." |
| Spetsialistid H1 / intro | "Meie metsaspetsialistid" / "Igas maakonnas oma inimene — helista või kirjuta otse." |
| KKK H1 / footer | "Korduma kippuvad küsimused" / "Ei leidnud vastust?" |
| Artiklid H1 / pagination | "Artiklid ja uudised" / "Vanemad artiklid" · "Vaata kõiki uudiseid" |
| Päringud H1 / promise | "Teenuste päringud" / "Pakkujad vastavad 7 päeva jooksul" |
| Hindamisaktid H1 / price | "Hindamisaktid metsa- ja põllumaale" / "alates 480 € + km" |
| Kontakt H1 / intro | "Võta ühendust" / "Kirjuta või helista — vastame 1 tööpäeva jooksul." |
| Form success toast | "Aitäh! Võtame ühendust 1 tööpäeva jooksul." |
| Newsletter toast | "Kontrolli posti — saatsime kinnitussõnumi." |
| 404 | "Kahjuks seda lehekülge ei ole. Proovi otsida või naase avalehele." |
| Cookie banner | "Kasutame küpsiseid …" + buttons "Nõustun kõigiga" · "Ainult vajalikud" · "Sätete muutmine" |
| Skip link / contact band CTA | "Otse sisuni" · "Jäta enda kontaktid" |
| Portal button in header | "Oksjonikeskkond" |

Full per-page copy lives in each `marketing/*.md` spec (section "Copy").

---

## 8. Global shell (present on every demo page)

```
┌────────────────────────────────────────────────────────────────────┐
│ HEADER  logo · Metsa müümine▾ KKK▾ Kiiroksjonid Päringud▾          │
│         Uudised Meist▾ · Metsaühistu↗        [Oksjonikeskkond]     │  72px, sticky, white
├────────────────────────────────────────────────────────────────────┤
│                          (page content)                            │
├────────────────────────────────────────────────────────────────────┤
│ CONTACTBAND  ☎ +372 XXX XXXX · ✉ info@erametsad.ee · Jäta kontakt → │  mist card, 3 cols
├────────────────────────────────────────────────────────────────────┤
│ FOOTER  5 link columns on --primary-dark, white text               │
│         © Erametsad OÜ · registrikood · KMKR · privaatsuspoliitika  │
└────────────────────────────────────────────────────────────────────┘
```

**Header** — sticky, white, 72px tall (shrinks to 60px on scroll), bottom hairline `rgba(27,33,29,.08)`. Logo left; menu in Manrope 600 16px with hover dropdowns (`Metsa müümine` 5 items, `KKK` 7 items, `Päringud` 3 items, `Meist` 2 items); active page link `--primary` with a 2px underline. Right side: text link "Metsaühistu ↗" (external) + amber button "Oksjonikeskkond" → portal. Skip link "Otse sisuni".

**Mobile shell (≤768px)** — header 56px, hamburger → full-screen right `Drawer` with accordion nav groups; external links and the portal CTA pinned in the drawer footer. All buttons full-width. Columns collapse to one; card grids stack; tables become stacked card rows.

**ContactBand** — pre-footer strip on `--bg-mist`, rounded card, 3 columns: phone (`tel:`), email (`mailto:`), link "Jäta enda kontaktid" → `#kontaktvorm`.

**Footer** — `--primary-dark` background, white headings + `rgba(255,255,255,.72)` links, 5 columns: Aktiivsed oksjonid · Oksjonite ajalugu · Artiklid · Kasulik teada · Jälgi meid (FB/IG/YT icons). Bottom row: © Erametsad OÜ · registrikood · KMKR · privacy/cookie-settings links.

**CookieBanner** — bottom-anchored, non-modal white card (never blocks content): short text + "Nõustun kõigiga" (amber), "Ainult vajalikud" (outline), "Sätete muutmine" (ghost → settings modal). Show it on at least one demo page.

**Error pages** — 404: forest photo, H1, short text, search field, button "Avalehele". 500: neutral message + phone/email. Optional in the demo set.

---

## 9. Component visual specs

Built once, reused everywhere. Shorthands match the page specs.

| Component | Look |
|---|---|
| `Btn` | Solid green `--primary`, solid amber `--cta`, outline green, ghost. Heights: lg 48 / md 40 / sm 32px. Radius 10px. Inter 600. Full-width on mobile. Focus: 2px `--accent` outline. |
| `Card` | White or mist, radius 14, green-tinted shadow, 24px padding; hover = 2px lift + deeper shadow. Image slot (16:10), content slot, action slot. |
| `LotCard` | Auction lot card: 16:10 photo, katastrinumber (mono), area ha, price (mono, amber highlight), county, live `Countdown`, `StatusPill`. Links to portal. |
| `Countdown` | "Aega jäänud Xp XXh XXm XXs" in JetBrains Mono digits. Neutral → amber < 1h → red < 5 min with a gentle 80ms pulse. |
| `StatusPill` | 999px badge, 13px label — see colour table in §1. Labels: Aktiivne / Lõppenud / Kiiroksjon / Mustand / Plaanitud. |
| `LeadForm` | White `Card`: nimi · telefon (+372 pattern) · e-post · katastrinumber (optional, hint "nt 77901:003:0410") · visible **unchecked** `ConsentCheck` (required) · amber button "SAADA" (full-width mobile). Hidden honeypot field. Inline errors in `--danger`. |
| `FilterPanel` | 280px collapsible sidebar: chip selects, range sliders, "Tühjenda" + active-count badge. |
| `Accordion` | Rows with numbered green circles (steps) or chevrons (FAQ); question/title in Manrope; smooth 200ms expand; multiple rows may stay open. |
| `Steps` | Numbered steps with Lucide icons, horizontal 3–5 columns desktop, vertical numbered list mobile. |
| `Tabs` | Underlined tab bar, counter badges, horizontally scrollable overflow on mobile. |
| `SpecialistCard` | Photo, name (Manrope 22px), role, direct `tel:` + `mailto:` links, 2-line bio, "Loe lähemalt →". Mini variant: photo + name + role only. |
| `Testimonial` | Quote block: text, name, county. **No star ratings.** |
| `ArticleCard` | Date, category chip, title, 16:10 thumbnail. |
| `AuctionTicker` | Horizontal row of 4 `LotCard`s with snap scroll. |
| `Stats band` | `--primary-dark` full-width band, 3 huge white Manrope numbers (32–48px) with small labels. |
| `ContactBand` | See §8. |
| `DataTable` | 40px rows, 13px labels, mono figures, sortable headers. Mobile: collapses to card rows — never horizontal scroll. |
| `MapEstonia` | Leaflet map, Maa-amet orthophoto, single office marker (Kontakt page). Demo: static mock or grey placeholder box. |
| `Toast` | Bottom-right, radius 10, success/info/error variants, auto-dismiss 5s. |
| `Modal` / `Drawer` | Centred overlay (radius 16, big soft shadow) / right-slide panel 100% height. Focus trap, ESC + backdrop close. |
| `EmptyState` | Illustration + heading + one sentence + optional button. |
| `CookieBanner` | See §8. |

---

## 10. Page blueprints (marketing)

Block order per page — desktop. Mobile always collapses to one column, buttons full-width, nav into the drawer. Full detail: the matching `marketing/*.md` spec.

### 01 · Avaleht — `/`
1. **Hero** — full-bleed forest photo + gradient overlay; left: H1, 2-sentence intro, amber CTA + ghost link; right: white `LeadForm` card "Tasuta konsultatsioon".
2. **Mist band** — "Plaanis metsa müük?" text + green button → form.
3. **Auction ticker** — 4 `LotCard`s, horizontal snap scroll.
4. **Team** — 4 mini `SpecialistCard`s + link to /meist.
5. **Stats band** — dark spruce, 3 big white numbers (ostjad / kinnistud / müüdud €).
6. **Process** — 3 `Card`s: Eeltöö / Oksjon / Tulemus, each heading a deep link.
7. **Articles** — 3 `ArticleCard`s + "Vaata kõiki uudiseid".
8. **Newsletter** — inline email field + "Liitun uudiskirjaga".
9. **Testimonials** — 3–4 quote cards, no stars.
10. **LeadForm #2** — anchor `#kontaktvorm`. Then ContactBand + Footer.

### 02 · Raieõiguse müük — `/teenused/raieoiguse-muuk`
1. **Hero** — photo + overlay, H1, intro, two CTAs (raie / kinnistud portals).
2. **LeadForm #1** — 2 columns: text "Müü raieõigus mõistlikult" + 3 benefits | form.
3. **9-step accordion** — three groups with H2 anchors: Eeltöö (1–3) / Oksjon (4–6) / Tulemus (7–9); numbered green circles.
4. **Fee & liability** — 2 `Card`s ("Mis see maksab?" with the 3% + km copy; "Meie vastutus").
5. **Buyer vetting** — trust block "Kes sinu metsale pakkumist teeb?" + big number of vetted buyers.

### 03 · Kinnistu müük — `/teenused/kinnistu-muuk`
Same skeleton as 02, plus: **sealed-bid explainer** — H2 + 2 columns (simple diagram: sealed envelopes → opening → best offer; text) and a **packages band** (bundle auctions) + portal link.

### 04 · Metsa hindamine — `/teenused/metsa-hindamine`
Long-form SEO article: light hero (mist bg, no photo) → auction ticker → LeadForm → **article body** (8-col text + 4-col sticky TOC sidebar; H2 sections as in spec) → dark CTA band "Konsultatsioon on tasuta" → LeadForm #2. Mobile: TOC hidden.

### 05 · Metsateatis — `/metsateatis`
Screenshot tutorial: hero → `Tabs` (Esitamine / Muutmine) → **8 numbered steps** in the 8-col main column, screenshots alternating white/`--bg-mist` rows, each step clickable to a lightbox; **4-col sidebar** with related links + sticky LeadForm → phone CTA band "Helista, täidame koos". Use grey labelled screenshot placeholders.

### 06 · Hindamisaktid — `/hindamisaktid`
Hero → sticky numbered sidebar menu (①–⑤) + content column: Metoodika / Hinna mõjutegurid (6 icon-card grid) / Andmeallikad / Hind ("alates 480 € + km" price card) / Tellimine (mailto CTA) → LeadForm. Mobile: sidebar becomes a horizontal sticky chip row.

### 07 · Kiiroksjon — `/kiiroksjon`
1. **Dark hero** — solid `--primary-dark` (or photo + heavy overlay), centred; huge "48 H" in Manrope 800 amber; H1; subline; one amber CTA.
2. **LeadForm #1** — `#kontaktvorm`, with 3 reassurance points (same-day reply, auction within 24h, free pre-valuation).
3. **5 `Steps`** — step 5 "Garanteeritud varupakkumine" visually emphasised: amber border + `ShieldCheck` icon (must also read without colour).
4. **Why list** — 2-column ✓ list, Lucide `Check` in `--accent`.
5. **Suitability** — `--bg-mist` section: "Kiiroksjon sobib sulle, kui:" conditions + fallback link to classic auction.
6. **LeadForm #2** — "Räägime täna läbi" + `tel:` link.

### 08 · KKK — `/kkk` (+ 7 category pages)
H1 + search field → chip nav (7 categories; active chip solid `--primary`, others outline) → accordion list: question, 1-sentence teaser always visible, "Loe edasi…" expands the full answer → "Ei leidnud vastust?" → /kontakt link. **No LeadForm on FAQ pages.**

### 09 · Päringud hub — `/paringud`
Hero with the 7-day promise highlighted (accent underline) → 3 service `Card`s (icon, H3, 2 lines, "Esita päring") → 3-step row (saada → pakkumised → leping) → partner-model explainer (no company names).

### 10–12 · Päringu vormid — `/paringud/{metsamajanduskava,hooldusraie,istutamine}`
Simple form pages: small hero → single-centred form card (management-plan fields / tending-cut fields + `FormFile` drag-drop upload / planting service checkboxes) → consent + submit → ContactBand.

### 13 · Meist — `/meist`
Hero (photo + overlay) with H1 + LeadForm right → company info `Card` (registry code, KMKR — mono digits, `Landmark` icon) → mission "Miks me seda teeme?" → big CEO quote (Manrope ~28px, oversized `--accent` quotation marks, photo, name, title) → 3 mini specialist cards + link → LeadForm #2.

### 14 · Metsaspetsialistid — `/meist/metsaspetsialistid`
Hero + narrow LeadForm → **3×2 grid of 6 `SpecialistCard`s** (photo, name, role, direct phone + email, bio, "Loe lähemalt") → company + mission blocks (reuse from 13) → LeadForm #2. Mobile: cards stack; phone/email become big tappable buttons.

### 15 · Artiklid — `/artiklid`
H1 + chip nav (Kõik / Uudised / Kliendilood / Teadmised / Õigusaktid) → one large featured `Card` (half-width, big photo) → 3-column grid of `ArticleCard`s → button pagination "Vanemad artiklid" → newsletter block. Article detail template: narrow 720px body, category chip, H1, images, ending CTA band + LeadForm.

### 16 · Lepingud — `/lepingud`
Hero ("Lepingute mallid", why they are public) → file list/table: tüüp · versioon · kuupäev · formaat · download button (`Download`/`FileText` icons, mono metadata) → newsletter note ("Uue versiooni puhul") → legal notice. Mobile: rows collapse to cards.

### 17 · Kontakt — `/kontakt`
Hero ("Võta ühendust") → 5/7 split: left — company card + two direct phone numbers (Müük / Üldine) + 3 mini specialist cards; right — `LeadForm` → map block (orthophoto, one marker, links to Google Maps / Maa-amet; demo may use a static placeholder) → ContactBand.

---

## 11. Building the demo

### Suggested demo set (priority order)

| Priority | Pages | Why |
|---|---|---|
| P1 | 01 Avaleht · 02 Raieõiguse müük · 07 Kiiroksjon · 17 Kontakt | Covers all hero types (photo, service, dark, plain), the LeadForm, accordion process, ticker, stats band and the full shell. |
| P2 | 08 KKK · 14 Metsaspetsialistid · 15 Artiklid · 05 Metsateatis | Content-heavy layouts: chips, card grids, screenshot steps. |
| P3 | 03, 04, 06, 09, 10–12, 13, 16 + 404 | Variants of established patterns; build on demand. |

### Conventions

- **Files:** `demo/pages/<nn>-<slug>.html` (e.g. `01-avaleht.html`), one shared `demo/assets/css/demo.css`, fonts and icons in `demo/assets/`. Keep each page self-sufficient enough to open directly from disk.
- **Breakpoints:** design desktop at 1440 (content 1280) and mobile at 375–390. Everything ≤768px follows the mobile shell. Both states must exist for every P1/P2 page.
- **Copy:** use §7 and the page specs — real Estonian, no lorem ipsum. Placeholder values only for phones (`+372 XXX XXXX`), registry codes and names marked in the specs.
- **Interactive bits to actually build:** accordion open/close, tabs, mobile drawer, cookie banner buttons (visual), hover states, one scroll-reveal. Forms and maps stay visual mockups.

### Acceptance checklist

- [ ] Estonian diacritics (õ ä ö ü) render correctly in all three families
- [ ] Prices, countdowns and registry numbers in JetBrains Mono with `tnum`
- [ ] Exactly one amber CTA per block; amber never used twice side by side
- [ ] Dark spruce only where the spec puts it (hero overlay, footer, stats/CTA band)
- [ ] Card hover = 2px lift + green-tinted shadow, 150ms; `prefers-reduced-motion` honoured
- [ ] Visible `--accent` focus outline on every interactive element
- [ ] Consent checkbox visible and unchecked; no pre-checked anything
- [ ] Every image has Estonian alt text; hero text sits on the gradient overlay (AA contrast)
- [ ] No horizontal page scroll at 375px; wide content scrolls inside its own container
- [ ] Full shell present: header (sticky), ContactBand, footer; CookieBanner on ≥1 page

---

## 12. Beyond the marketing site (not in this demo)

The same tokens and components extend to the other three surfaces, described in their own specs:

- **Auction portal** (`oksjonid.erametsad.ee`, `portal/`) — light, data-dense: tabs + map + filter sidebar listing, lot detail with `BidPanel` and live countdowns.
- **Admin** (`admin.erametsad.ee`, `admin/`) — functional: 280px sidebar layout, `DataTable` everywhere, KPI cards.
- **Association** (`metsauhistu.erametsad.ee`, `uhistu/`) — friendlier marketing-style pages: subsidy card grids, service chips.
