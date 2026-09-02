# metsauhistu.timber.ee — Structural & Functional Map

> **In brief (for the client):** this maps the reference's forest-owners' association site — an optional later phase for Erametsad. It confirms a content-heavy subsidies module (deadlines, €/ha rates, eligibility) drives the value. One flaw we will not repeat: the reference uses hidden, pre-ticked consent checkboxes, which is a GDPR risk we fix everywhere.


Scraped 2026-08-27. Stack: **Gatsby 5.16.1** static site, Tailwind CSS (theme color `#4ABB5D` green), no client-side framework for content (all markup server-rendered). Language: Estonian only, `lang="et"`.

## 1. Site purpose & relationship to timber.ee / oksjonid.timber.ee

The site is the marketing/lead-gen presence of **Timber.ee Metsaühistu MTÜ** (non-profit forest owners' association, registry code 80109128, Tallinn). Tagline/H1: **"Metsaühistu. Õigesti."**; meta description: *"Eesti kõige kiiremini kasvav metsaühistu!"* ("Estonia's fastest-growing forest association — we help forest owners find answers to all questions that come with owning forest").

Three-site family:
- **timber.ee** — main corporate site (linked in header as `Timber.ee`; footer links out to `timber.ee/lepingud` and `timber.ee/artiklid/kasutustingimused`).
- **oksjonid.timber.ee** — auction environment (header CTA button "Oksjonikeskkond", green pill; also cross-sold from the Teenused page: timber auctions are run there, described as aggregating "Estonia's best forest companies as cutting buyers and private/institutional large landowners as property buyers").
- **metsauhistu.timber.ee** — this site: association services, subsidy application help, PEFC group certification, join funnel. Lead capture is the primary conversion (forms POST to `form-name` handlers, i.e. Gatsby/Netlify-style form handling with hidden `form-name` field; no visible API endpoint in HTML).

Legal: footer copyright "© 2026 Timber.ee Metsaühistu MTÜ", address Peterburi tee 2 (T1 Keskus, 3. korrus), Tallinn 11415. Documents: association statute (`Põhikiri`) served as `/static/pohikiri-<hash>.pdf`; contracts/terms live on timber.ee.

## 2. Global header & footer

**Header (identical on all pages):** logo (Timber Yhistu SVG, two variants incl. white for dark hero), then nav: `Avaleht` (/), `Teenused`, `Toetused`, `Kontakt`, `Sertifitseerimine`, plus two cross-site buttons/links: `Timber.ee` → https://timber.ee and `Oksjonikeskkond` (green CTA, appears twice in markup — desktop + mobile) → https://oksjonid.timber.ee. No login/member area anywhere — pure marketing site.

**Footer:** three columns + contact block:
- `Teenused`: Nõustamine, Enampakkumised, Kavad (→ /toetused/metsamajandamiskava)
- `Toetused`: Metsa uuendamine, Metsameede, Natura metsa toetus
- `Kasulik teada`: Põhikiri (local PDF), Lepingud (→ timber.ee/lepingud), Tingimused (→ timber.ee/artiklid/kasutatingimused)
- `Jälgi meid`: Facebook (facebook.com/TimberEE), Youtube, Instagram
- Contact: +372 503 2122, metsauhistu@timber.ee, address; `Privaatsuspoliitika` link; copyright line.

Branding vs main timber.ee: same Timber family identity and green palette but its own logo ("Timber Yhistu"), own title "Metsaühistu. Õigesti." (sertifitseerimine/kontakt use "...| Timber.ee metsaühistu"), no e-commerce or login — simpler brochure + forms.

**Sitemap:** `/sitemap.xml` is a 404-HTML fallback; real one at `/sitemap-index.xml` → `sitemap-0.xml` with **21 URLs**: `/`, `/kontakt`, `/liitu`, `/sertifitseerimine`, `/teenused`, `/toetused`, and 15 subsidy pages under `/toetused/<slug>` (mixed slug styles: `hooldusraie`, `metsa_uuendamine`, `natura2000`, `metsameede-*` sub-programs, URL-encoded `metsamaaparandust%C3%B6%C3%B6d`).

## 3. Per-page breakdown

### 3.1 Home `/`
- Title "Metsaühistu. Õigesti." Meta desc as above. **H1:** `Metsaühistu. Õigesti.`
- **Hero:** dark hero with H1, subtitle ("Eesti kõige kiiremini kasvav metsaühistu! Aitame metsaomanikel leida vastase kõigile metsa omamisega kaasnevatele küsimustele" — help with all forest-ownership questions), and embedded **join-request form** (see §4, form `contactForm metsayhistu-0`). Hero contains 5 `<img>` (3 retrieved files are SVG logos).
- **H2 "Metsandustoetuste taotlemine"** — subsidy teaser grid styled as a CSS-grid "table" (not `<table>`): columns `Tähtaeg` / `Toetuse suurus`, white rounded card rows (`rounded-xl`, hover border) per program, each with a `Taotle` button linking to the /toetused/<slug> page. Rows: Hooldusraie 11-30 aastases metsas (07.04–23.04.2026, Kuni 356 €/ha); Metsameede (sügis/talv 2026, Kuni 1719 €/ha); Natura metsa toetus (04.04–30.04.2026, Kuni 160 €); Metsa uuendamise toetus (16.06–28.06.2026, Kuni 400 €/ha); Pärandkultuuri säilitamise toetus (16.06–02.07.2026, Kuni 3196 €); Metsamajandamiskava toetus ("Uus taotlusvoor ilmselt 2026.aasta lõpus", "Selgub"). Footer CTA `Vaata kõiki toetused` → /toetused.
- **H2 "Teenused"** — 9-chip/pill tag cloud (Istutamine, Hooldusraied, Metsataimede tellimine, Metsaomanike nõustamine, Taimekaitsevahendid, Metsamajandamiskavad, Metsataimede hooldamine, Maapinna ettevalmistus, **Oksjonid** → oksjonid.timber.ee), linking to /teenused anchors.
- **H2 "Toetused"** — "Aitame sind toetuste taotlemisel" + 5 program cards (same list as teaser).
- **Global contact band** (repeated on every page): `Helista meile +372 503 2122` / `Saada email metsauhistu@timber.ee` / `Jäta enda kontaktid` (scroll-to-form button). Footer.

### 3.2 `/teenused` (Services)
- H2 `Teenused`, intro: association helps with forestry services, many partly/fully compensable via subsidies. Same 9-item chip nav (anchors down the page).
- Long single-page scroll with H2 per service: `Istutamine` (ordered steps: order site prep → order seedlings (bare-root/pot) → find planters or DIY w/ tools; "ühistu organizes start-to-finish"); `Hooldusraied` (H4 "Miks teha oma metsas hooldusraiet?" long educational copy + bullet list of goals; H5 `Hind` — "depends on location, density, area; ask consultant 5032122 / email"); `Metsataimede tellimine` (bulk seedling ordering with grower contracts, better prices; list: pot spruce/birch/pine/alder, open-root spruce/birch); `Metsandusalane nõustamine` (certified consultant, link to kutseregister.ee qualification standard; H4 list of 11 advisory themes: alustav omanik, dokumendid, kava, uuendamine, hooldamine, raiete põhimõtted, tööde kvaliteet, metsakahjustused, ökonoomika/kalkulatsioonid, toetused sh pindade määramine, Natura 2000; inline note: office visits require pre-registration, Narva mnt 36 Tallinn, E-R 9–17); `Taimekaitsevahendid ja ulukitõrje` (Repellent **Trico** — natural deer repellent, water+lanolin, 6–10 l/ha, ~6 months; **Cervacol Extra** — blue paste for leader shoots); `Metsamajandamiskavad` ("metsa pass", 10-year plan, takseerkirjeldus/inventory data explained); `Metsataimede hooldamine` (weeding/mowing young stands); `Maapinna ettevalmistus` (site prep after felling); `Kinnistute ja raieõiguste enampakkumine` (auctions cross-sell → oksjonid.timber.ee).
- Contact band + footer. No forms except the implicit contact CTA (no inline form on this page).

### 3.3 `/toetused` (Subsidies index)
- No headings; layout = `grid grid-cols-12` with **left sidebar nav** (`lg:col-span-3`, `<ul>` of full-width border-bottom links, bold, chevron) listing all subsidy programs, main area presumably shows selected/first program content. Sidebar list (from this page): Metsamaaparandustööde toetus, Metsameede (+ sub-items on child pages: hooldusraie kuni 10-aastases metsas, taimehaiguste ennetamine, ulukikahjustuste ennetamine, kahjustatud metsa taastamine), Looduskaitseliste piirangute toetus, Metsa uuendamise toetus, Pärandkultuuri säilitamise toetus, Metsamajandamiskava toetus, Üraskikahjustuste ennetamise toetus. Child pages additionally expose: Hooldusraie 11-30 aastases metsas, maapinna mineraliseerimise, metsataimede istutamise, metsauuenduse hooldamise toetus.
- Contact band + footer.

### 3.4 `/toetused/hooldusraie` (subsidy detail template — the key content model)
- H2 `Hooldusraie 11-30 aastases metsas` + deadline badge `07.04 - 23.04`.
- **Inline join form** (H2 `Saada metsaühistuga liitumise soov`, form `contactForm metsayhistu-1`-style instance) — same fields as hero form.
- **H3 `Kui suur on toetus?`** — amount cards: **356 €/ha** (works on natural person / FIE / association natural-person-member forest land) and **297 €/ha** (legal person / association / legal-person member land).
- **H3 `Olulisemad tingimused`** — eligibility bullet list with inline highlighted values: min stand size **0,1 ha**; forest must be inventoried with valid inventory data; valid `metsateatis` (forest notification) if thinning > 20 m³ per property; minimum **1 ha**/year of tending cut (via association only **0,1 ha**); max **30 ha** per private owner per year; subsidy paid only once per same forest land.
- **H2 `Kuidas taotlust esitada?`** — applications only via **e-PRIA portal** or **through the association** (submits a joint application on owners' behalf); Excel upload template (external link: `eramets.ee/wp-content/uploads/2026/03/Kliimakindla-metsa-kujundamise-exceli-import.xlsx`); submit in e-PRIA under "Esita taotlus KIK-ile → Kliimakindla metsa kujundamine".
- **H2 `Teenustasu`** — service fee **7%** of received subsidy.
- **H2 `Taotluse esitamine`** — 2 steps: fill application and email to metsauhistu@timber.ee; submit work report to same email.
- Repeated join form, contact band, footer.
- **Content model for /toetused/<slug> pages:** { title, deadline window, amount(s) with payer-type conditions[], eligibility conditions[] (with emphasized numeric params), submission channels (e-PRIA / via association), external document links (Excel/PDF), service fee %, process steps, CTA form }. No JSON-LD anywhere on the site; no calculators; no accordions (pure headings + lists + cards).

### 3.5 `/sertifitseerimine` (Certification)
- Title "Sertifitseerimine | Timber.ee metsaühistu". H2 `Sertifitseerimine` + document download list (all external PDFs):
  - `PEFC jätkusuutliku metsamajandamise standard (PEFC EST 1003)` → erametsaliit.ee PDF
  - `Kommenteeritud versioon – selgitustega` → erametsaliit.ee PDF
  - `Metsamajandamise grupisertifitseerimise nõuded (PEFC EST 1002)` → erametsaliit.ee PDF
  - `PEFC Kaubamärkide reeglid – nõuded (PEFC ST 2001)` → erametsaliit.ee PDF
  - `Timber.ee PEFC Grupi põhimõtted` → oksjonid.timber.ee/wp-content/.../Timber.ee-PEFC-Grupi-pohimotted.pdf
- Contact band + footer. (i.e. the association runs a PEFC group certification scheme; standards borrowed from Erametsaliit.)

### 3.6 Bonus: `/liitu` (Join) and `/kontakt`
- **/liitu** — Title "Astu Timber.ee Metsaühistu liikmeks". Benefits pitch: joining and membership fee = **TASUTA (free)**; benefits list (11 items): Koolitused ja personaalne nõustamine, Metsatoetuste taotlemine, Raieõiguste oksjonid, Metsakinnistute oksjonid, Metsauuendustööd, Maapinna ettevalmistus, Metsakultuuri hooldamine, Metsavara kaitsmine, Metsaomaniku õigusalane kaitse, Metsanduslik seadusnõustamine, Abistame metsatulude deklareerimisel. Then join form (see §4). No online payment, no member login — lead form only.
- **/kontakt** — H1 `Võta ühendust!`, org intro, join-request form, then **staff cards** (H2 per person, name → role → email → phone → `Tööpiirkond:` regions): Enari Lumi (tegevjuht, metsakonsulent, üle Eesti, 503 2122); Marcel Lahe (atesteeritud metsakonsulet, W-Estonia counties); Eero Jesmin (atesteeritud konsulent + kavad); Henrik Leibur (metsanduskonsulent). Org block with Registrikood 80109128, Tallinn HQ (T1 Keskus, 3. korrus, E-R 09–17, pre-registered visits) and **Elva kontor** (Käärdi, Torni 11, visits by appointment only). Contact band, footer.

## 4. Forms inventory

All forms are identical in pattern — Gatsby static forms, `method="post"`, hidden `form-name` field (Netlify/Gatsby-function style handling; no action attribute, no API URL visible), Tailwind 2-col grid, floating labels, underline-style inputs (`border-b`), all `type="text"` (no email/tel validation types), no selects/radios, no client-side `required` attributes.

1. **Join-request / contact form** (`name="contactForm metsayhistu-0"` on home, instance on hooldusraie & kontakt):
   - `name` — "Sinu nimi/firma nimi" — text
   - `phone` — "Telefoninumber" — text
   - `email` — "E-mail" — text
   - `personalCode` — "Isikukood/reg.number" — text (national ID / business registry number)
   - `agreement` — checkbox, **hidden and pre-checked** (visually styled as toggle), label: "Olen nõus, et Timber.ee Metsaühistu MTÜ vaatab minu andmeid ja võtab minuga ühendust." (consent to data processing & contact)
   - Submit: `SAADA` (green full-width button `bg-primary`)
2. **Join form** on /liitu (`name="liitu"`): `name`, `personalCode`, `location` ("Elukoht/postiaadress"), `phone`, `email` (email field name is `email` though label "E-post"), same hidden checked `agreement` ("Olen nõus, et AS Timber vaatab minu andmeid ja võtab minuga ühendust." — note: consent names AS Timber, not the MTÜ), submit `Liitu`.

Note: pre-checked hidden consent checkbox is a GDPR red flag — a clone should make it a visible, unchecked, required checkbox.

## 5. Membership / join mechanics

- Funnel: every page's hero/contact band pushes **"Saada metsauhistuga liitumise soov"** form; dedicated `/liitu` page with benefits list and form. Joining + membership fee stated as **free** ("Ühistuga liitumine ja liikmemaks sulle: TASUTA") — monetization is via services (7% subsidy service fee, seedling sales margin, auction fees on oksjonid.timber.ee). No online signup, payment, or member portal/login anywhere — staff follow up by phone/email. Statute (Põhikiri) PDF downloadable from footer; contracts (Lepingud) hosted on timber.ee.

## 6. Content model notes (toetused)

15 subsidy pages, two program families: standalone measures (hooldusraie, metsa uuendamine, natura2000, pärandkultuuri, metsamajandamiskava, metsamaaparandustööd, üraskikahjustuste ennetamine, looduskaitseliste piirangute, maapinna mineraliseerimine, metsataimede istutamine, metsauuenduse hooldamine) and the **Metsameede** program with 4 sub-pages (`metsameede-hooldusraie`, `-taimehaiguste-ennetamine`, `-ulukikahjustuste-ennetamine`, `-kahjustatud-metsa-taastamine`). Detail-page fields: title, deadline (date window or vague "autumn/winter 2026"), max amount (€/ha or flat €, sometimes "Selgub"), differentiated rates by applicant type (physical/FIE vs legal entity), eligibility rules (min/max ha, inventory/forest-notice prerequisites, once-per-land limits), submission channel (e-PRIA or joint application via association, Excel import template), service fee (7%), process steps (email application + work report to metsauhistu@timber.ee). Home page renders a deadline+amount summary grid of the top 6 programs — the deadlines/amounts are duplicated content between home and detail pages (single source of truth would be an improvement in a rebuild).

## 7. Integrations & design notes

- **No third-party JS at all**: no GA/GTM/analytics scripts, no tag manager, no chat widgets, no cookie banner (only base64-embedded "fbq"-like string in inlined Gatsby page-data, no actual pixel script loaded; external social links only). All assets self-hosted under `/static/` with content hashes; PWA `manifest.webmanifest`; theme-color `#4ABB5D`.
- External content dependencies: **erametsaliit.ee** (PEFC standard PDFs), **eramets.ee** (e-PRIA Excel import template), **oksjonid.timber.ee** (PEFC group principles PDF + auction environment), **timber.ee** (contracts, terms), **kutseregister.ee** (consultant qualification standard).
- Design system: Tailwind utility classes, green palette (`text-green`, `bg-primary`, `border-light-green`), 12-column grid container layout, rounded-xl white cards on very-light-gray bands for the pseudo-table, underline inputs, repeated "contact band" component (call / email / leave contacts) above footer on every page, sidebar-nav layout for /toetused section.
- No JSON-LD, no `<table>` elements, no accordions (uses sidebar + heading sections instead), no interactive calculators, no image galleries (hero SVGs only), no i18n.
