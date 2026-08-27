# timber.ee (main marketing site) — Structural & Functional Map

> **In brief (for the client):** this maps the reference competitor's public website so we can learn from it without copying it. What it does well — deep SEO content, a simple "leave your details" form repeated on every page, and strong trust signals (vetted-buyer counts) — we adopt. What it lacks — any visitor analytics and proper cookie consent — we deliberately improve on.


Scraped 2026-08-27. Stack: **Gatsby 5.16.1** static site (`<meta name="generator" content="Gatsby 5.16.1">`), Estonian only (`<html lang="et">`), CSS with **Tailwind utilities using `tw-` prefix** (365+ utility classes in homepage HTML), font **Nunito**, images served from **Contentful CDN** (`images.ctfassets.net` / `assets.ctfassets.net`), so headless CMS = **Contentful**. Forms are plain `method="post"` with a hidden `form-name` field and no action URL → serverless-function / Netlify-style form handling baked into the Gatsby build.

No client-side analytics, tag manager, chat widget, or marketing pixel was found in the served HTML of any of the 14 pages (no GTM/GA/fbq/Hotjar/Clarity strings). No JSON-LD structured data on any page. No hreflang/alternate language versions. No `<iframe>` or `<video>` embeds; social links point to YouTube channel but video is not embedded on these pages.

---

## 1. Global header & navigation tree

Top nav is a hover mega/dropdown menu (labels exact, Estonian):

- **Metsa müümine** → `/teenused/raie-muuk` (dropdown group header)
  - Metsa hindamine → `/teenused/metsa-hindamine`
  - Metsateatise esitamine → `/metsateatis`
  - Raieõiguse müümine → `/teenused/raie-muuk`
  - Kinnistu müümine → `/teenused/kinnistu-muuk`
  - Hindamisaktide koostamine → `/hindamisaktide-koostamine`
- **KKK** → `/kkk` (dropdown with category pages)
- **Kiiroksjonid** → `/kiiroksjon`
- **Päringud** → `/paringud` (dropdown)
  - Metsamajandamiskava koostamise päring → `/paringud/metsamajanduskava`
  - Hooldusraiete päring → `/paringud/hooldusraie`
  - Metsa istutamise päring → `/paringud/metsa-istutamine`
- **Uudised** → `/artiklid` (same item also appears as "Kliendid" → `/artiklid/klientide-lood` in the nav markup)
- **Meist** → `/meist` (dropdown)
  - Metsaspetsialistid → `/meist/metsaspetsialistid`
  - Juhtkond → `/meist/juhtkond`
- **Metsaühistu** → external `https://metsauhistu.timber.ee`
- **Oksjonikeskkond** → external `https://oksjonid.timber.ee` (prominent CTA button style)

## Footer (5 columns + legal)

1. **Aktiivsed oksjonid** — Raieõigused / Kinnistud / Paketid → `oksjonid.timber.ee/{raie,kinnistud,paketid}`
2. **Oksjonite ajalugu** — Lõppenud raieõigused / Lõppenud kinnistud / Lõppenud paketid → `oksjonid.timber.ee/ajalugu/...`
3. **Artiklid** — Kliendilood → `/artiklid/klientide-lood`
4. **Kasulik teada** — Kasutusjuhend (PDF on `assets.ctfassets.net`), Lepingud → `/lepingud`, Kasutustingimused → `/artiklid/kasutustingimused`
5. **Jälgi meid** — Facebook (`facebook.com/TimberEE/`), Youtube (channel `UCsvbd2Vt8HMfK04zldWarTw`), Instagram (`instagram.com/timber.ee/`), Privaatsuspoliitika

Every page also carries a **pre-footer contact band**: `+372 666 50 50`, `info@timber.ee`, links "Jäta enda kontaktid, võtame Sinuga ühendust." and "Jäta enda kontaktid" (anchor to the page's form).

## 2. Site graph & sitemap

`/sitemap.xml` is not XML (returns the HTML 404 page). Real sitemap: **`/sitemap-index.xml` → `/sitemap-0.xml`**, total **256 URLs**:
- `/artiklid/...` — 202 (articles/news/SEO landing pages, incl. `/artiklid/klientide-lood`, `/artiklid/uudised`, `/artiklid/kasutustingimused`)
- `/meist/*` — 9 (6 specialist profile pages: `/meist/{kristo-kutt, kristel-asmer, auli-pulk, allan-rajamae, henrik-leibur, marlon-tiik}`, + juhtkond, metsaspetsialistid)
- `/kkk/*` — 7 (`oksjonid, myyk, hind, tulumaks, metsaandmed, raie, metsauhistu`)
- `/paringud/*` — 4; `/teenused/*` — 3
- SEO one-off landing pages at root: `/metsa-hinna-kalkulaator`, `/taksaator`, `/tehingukeskus`, `/metsa-ost`, `/raieoiguse-ost`, `/metsakinnistute-ost`, `/pollumaa-{ost,muuk,hind}`, `/maa-hindamine`, `/lageraie`, `/harvendusraie`, `/metsaraie-korraldaja`, `/metsateatis`, `/metsateatise-juhend`, `/metsateatise-muutmine`, `/kahjustusest-teatamine`, `/liitu`, `/lepingud`, `/metsaomanikule`, `/ise-oksjoni-korraldamine`, `/tingimused-ostjatele`, plus ~10 long-tail guide articles (`/millal-on-vaja-raieluba`, `/mis-on-tihumeeter-...`, etc.)

Three-domain ecosystem: **timber.ee** (marketing) + **oksjonid.timber.ee** (auction platform, routes `/raie/:id`, `/kinnistu/:id`, `/ajalugu/...`) + **metsauhistu.timber.ee** (forest cooperative).

## 3. Per-page breakdown

### 3.1 `/` — Homepage
- **Title:** "Timber.ee metsaoksjon | Metsamaa ja metsa müük oksjonil"
- **H1:** "Metsatehingud. Õigesti." — hero with intro paragraph, quote attribution "Toivo Asmer", CTAs: "Vaata kõiki aktiivseid oksjoneid", "Vaata kõiki lõppenud oksjoneid", "Saame tuttavaks, vajuta siia" (→ form)
- **Lead-capture form #1** (see §Forms, contactForm)
- Section "Plaanis metsa müük?" — text + "Vaata oksjonite ajalugu" CTA
- **Live/ended auction ticker** — 4 auction cards, each with cadastre number(s), area (ha), ending datetime (e.g. kataster `77901:003:0410`, `09.01.2026 14.00`) linking to `oksjonid.timber.ee/raie/:id` and `/kinnistu/:id` — dynamic data rendered into the static build
- "Timber.ee kollektiiv" — team intro + contact links
- **Contact form #2**
- Trust section "Parimad metsafirmad on liitunud Timber.ee oksjonikeskkonnaga." — stats: **200** vetted cutting-right buyers, **1000** property buyers
- **3-column process** "Raieõiguse või metsamaa müük Timber.ee oksjonil": H3 "Eeltöö" / "Oksjon" / "Tulemus", each with 3 bullet steps (deep links to anchors `/teenused/raie-muuk#eeltoo|#oksjon|#tulemus`)
- "Viimatest artiklitest" — 3 latest-article cards + "Vaata kõiki uudiseid"
- **Newsletter form** (see §Forms)
- **Testimonials** — 4 customer-quote blocks (no star ratings markup)
- **Contact form #3** "Soovid konsultatsiooni? Jäta meile enda andmed."
- Footer

### 3.2 `/teenused/raie-muuk` — Raieõiguse müük
- **H1:** "Raieõiguse müük oksjonil"; intro; dual CTAs "Tutvu aktiivsete raiete oksjonitega" / "Tutvu aktiivsete kinnistute oksjonitega" (→ oksjonid.timber.ee)
- **Lead form** right after hero
- **9-step interactive accordion/timeline** grouped under H2s "Eeltöö" (steps 1–3), "Oksjon" (4–6), "Tulemus" (7–9). Steps are `<button>` elements "1Vaatame su metsa üle" … "9Vastutame tööde korrektsuse eest" — click-to-expand accordion revealing H3 + paragraphs each. Key business facts embedded: needs valid metsamajandamiskava + metsateatis; auctions published at oksjonid.timber.ee; buyers notified by e-mail + SMS; classic ascending auction for cutting rights, sealed-bid for properties; winner obligated to buy; **service fee to owner = 3% (+VAT) of final price**; AS Timber liable for work correctness; buyer guarantees (personal guarantees €100k–300k)
- Section on sellable cutting types + buyer vetting
- Contact band + footer. 1 form.

### 3.3 `/teenused/metsa-hindamine` — Metsa hindamine (SEO content page)
- **H1:** "Metsa väärtuse hindamine" + intro; auction ticker cards (same as homepage); lead form near top
- Long SEO article, H2s in order: "Metsamaa hind on mõjutatud kinnistu asukohast" / "Metsa hind tuleneb raiest saadavast metsamaterjalist" / "Metsamaterjali ülestöötamise kulud" / "Väldi vigu tehingu sõlmimisel" (warns against per-m³ and "väljatuleku peale" contracts) / "Ajasta metsa müük õigesti" / "Saavuta kõrgeim metsa hind raieõiguse oksjonil" — ends with CTA to leave details ("Meie konsultatsioon on tasuta!"). 2 forms (top + standard).

### 3.4 `/metsateatis` — Metsateatise guide
- **H1:** "Metsateatise esitamine metsaportaalis". Sidebar "Vaata lisaks": links to `/metsateatise-muutmine`, `/kahjustusest-teatamine`
- Lead form ("Vajad abi metsateteatise täitmisel?" + phone CTA `666 50 50`)
- **Step-by-step screenshot tutorial** for the state portal `register.metsad.ee` (Logi sisse → ID/mobile-ID → "MINU" → select stands by cadastral unit → "sisesta metsateatis" → pre-filled form → address + "+ Salvesta aadress" → checkbox "Avalikustan raiemahu" → "Esita") — screenshot walkthrough pattern, images from Contentful. 2 forms.

### 3.5 `/teenused/kinnistu-muuk` — Kinnistu oksjon
Identical skeleton to 3.2 (same 9-step accordion, same texts adapted for whole-property sales) plus extra section "Metsakinnistu oksjon toimub suletud ümbriku meetodil" explaining sealed-bid ("pimepakkumine") vs live auction, links to "kinnistute pakettide oksjoneid" (package auctions) and metskinnistu pricing page. 1 form.

### 3.6 `/hindamisaktide-koostamine` — Valuation acts
- **H1/H2:** "Hindamisaktide koostamine" / "AS Timber koostab maatulundusmaa hindamisakte metsa- ja põllumaale Eestis."
- Bullet lists: valuation method (transaction-comparison using Maa-amet database + own ended-auction results), price factors (location/access, species composition, timber prices, restrictions, soil fertility), data sources (takseer data from management plans, public map/orthophoto data, **AI-generated forest inventory data**, public field data)
- "Hindamisakti koostamise hind" — pricing: **from €480 + VAT**, depends on property size/count
- "Hindamisakti tellimine" — order by e-mail `info@timber.ee` with cadastral IDs + contact details
- Sticky side-nav anchor links (numbered buttons 1/2/3). 1 form.

### 3.7 `/kkk/oksjonid` — FAQ: auctions
- **H1:** "Korduma kippuvad küsimused"; **category chip/tab nav**: Timber.ee oksjonid / Müük / Hind / Tulumaks / Metsaandmed / Raie / Timber.ee Metsaühistu MTÜ (→ `/kkk/*` subpages)
- **Accordion FAQ items** (question + teaser + "Loe edasi..." expander with full answer). Questions on this page: why choose Timber.ee; how cutting-right auction works; how property auction works; what is a successful auction; what if auction fails (no cost to seller, unlimited retries); why some firms refuse auctions; does seller/buyer location matter (remote notarization notes). No form (FAQ pages don't carry the lead form).

### 3.8 `/kiiroksjon` — 48h quick auction (productized offering)
- **H1:** "Timber.ee kiiroksjon"; hero promise "48 tunniga reaalsed pakkumised"
- Lead form #1 ("Soovid 48 tunniga saada pakkumised oma metsale?")
- "Kuidas kiiroksjon toimib?" — 5 numbered paragraphs: contact → set secret **reserve price** (piirhind) → publish, collect bids 48h at €1 starting price → if reserve exceeded, notarial deal (**fee 3% +VAT**) → **if no bids, Timber AS itself makes a purchase offer** (guaranteed-buyer backstop)
- "Miks on kiiroksjon hea lahendus metsaomanikule?" — checkmark list (✅ Tasuta/Kiire/…)
- "Kiiroksjon sobib sulle, kui:" — 📍 bullet list
- Closing CTA + lead form #2.

### 3.9 `/paringud` — Request hub
- **H1:** "Teenuste päringud". One paragraph lead-matching explanation: choose service, fill form, request auto-forwarded to all registered provider companies who then send quotes.
- "Vali sobiv päring" — **3 service cards** (H3): Metsamajandamiskava / Istutamine / Hooldusraie → subpages. No form on hub itself.

### 3.10 `/paringud/metsamajanduskava` — Management-plan request form
Tabs (Metsamajandamiskava / Istutamine / Hooldusraie) at top. **H1** "Metsamajandamiskava koostamise päring"; SEO intro ("providers answer within 7 päeva jooksul"); **H2** "Saada metsamajandamiskava koostamise päring" + dedicated form (below).

### 3.11 `/paringud/hooldusraie` — Tending-cut request form
Same template; intro re: thinning/lighting/tending cuts, providers respond in 7 days; **H2** "Saada hooldusraiete päring" + form with file upload.

### 3.12 `/paringud/metsa-istutamine` — Planting request form
Same template; legal note: 3-year replanting obligation after regeneration felling; **H2** "Saada metsa istutamise päring" + form.

### 3.13 `/meist` — About
- **H1:** "Sul on metsa majandamist puudutav küsimus?" + lead form
- Company block: Timber AS, Registrikood 12646598, KMKR EE101746108, phone, e-mail, address "T1 Keskus, 3. korrus, Peterburi tee 2, Tallinn, 11415 Eesti"
- "Miks me seda teeme?" mission text (100+ years combined experience), CEO quote (Toivo Asmer). 2 forms.

### 3.14 `/meist/metsaspetsialistid` — Contacts
- Same H1/lead form
- **6 specialist contact cards** (photo, name, role `metsaspetsialist`, direct phone, direct e-mail, bio paragraph): Kristo Kütt, Kristel Asmer, Auli Pulk, Allan Rajamäe, Henrik Leibur, Marlon Tiik — each linking to profile page `/meist/<name>`. Then company block + mission text (shared component). 2 forms.

## Forms (exhaustive)

**A. Universal lead-capture "contactForm"** (appears 1–3× per page, ~20 instances site-wide). `method="post"`, no action, hidden `form-name` value per-instance e.g. `contactForm pealehet-1`, `contactForm teenused/raie-muuk-1` (page-slug + occurrence index — indicates per-form analytics/source tracking). Fields:
- `name` — text — label "Sinu Nimi"
- `phone` — text — label "Telefoninumber"
- `email` — text — label "E-mail"
- `cadastre` — text — label "Katastrinumber Valikuline" (optional cadastral ID)
- `agreement` — checkbox — consent: "Olen nõus, et AS Timber vaatab minu andmeid ja võtab minuga ühendust."
- Submit button: "SAADA"
(required attributes are not rendered server-side; validation presumably client-side)

**B. Newsletter form** (homepage footer area): `email` text, placeholder "Emaili aadress", submit "Liitun uudiskirjaga", form-name `newsletter`.

**C. `/paringud/metsamajanduskava`** form-name `metsamajanduskava`: name/phone/email ("Sinu Nimi"/"Telefoninumber"/"E-mail"), `cadastre` label "Metsamaa katastritunnus(ed)", checkbox `paperCopy` "Soovin lisaks kava paberkandjal", text `comment` "Lisa kommentaar". Submit "SAADA".

**D. `/paringud/hooldusraie`** form-name `hooldusraie`: name/phone/email; `county` "Raielangi maakond"; `cadastre` "Raielangi katastritunnus"; `provision` "Eraldis/Eraldised" (stand(s)); checkboxes `hooldamine` "Kultuuride hooldamist" and `valgusraie` "Valgusraiet"; **file upload** `file` "Lisa kava fail (valikuline)"; `comment` "Lisa kommentaar". Submit "SAADA".

**E. `/paringud/metsa-istutamine`** form-name `metsa-istutamine`: name/phone/email; `county`; `cadastre`; `provision` "Eraldis/Eraldised"; checkboxes `landPreparation` "Maapinna ettevalmistus", `istikud` "Istikud", `istutamine` "Istutamist"; `comment`. Submit "SAADA".

No Formspree/Getform/HubSpot hints — hidden `form-name` + POST is the Netlify/Gatsby-functions convention; submissions presumably go to serverless handlers in the Gatsby build.

## CTAs / interactive components

- Every page: header "Oksjonikeskkond" button → oksjonid.timber.ee; footer contact band with tel/mailto + anchor link to form
- Homepage: auction cards linking into the auction app (deep links `/raie/2775`, `/kinnistu/15851`, `/ajalugu`)
- 9-step expandable accordion (raie-muuk, kinnistu-muuk); FAQ accordions with "Loe edasi..." (all /kkk pages); category chip nav on /kkk; tab-like service switcher on /paringud/* pages; sticky numbered side-nav anchors (hindamisaktide-koostamine)
- **No calculators, maps, sliders, or video embeds** on the marketing site. (A page `/metsa-hinna-kalkulaator` exists but is an SEO article + lead form, not an actual calculator; `/taksaator` and `/tehingukeskus` are similar SEO/feature pages.)

## 4. Integrations

- **Contentful** headless CMS (images/PDFs on ctfassets.net, space id `t6wstbczi0ev`)
- **Gatsby 5.16.1** SSG; Tailwind (prefixed `tw-`); Nunito webfont (self-hosted, no Google Fonts link)
- Outbound links to sister apps: oksjonid.timber.ee (React auction SPA), metsauhistu.timber.ee
- State portal reference: register.metsad.ee (metsaportaal) — external, not integrated
- **No** analytics/GTM/pixels/chat widgets detectable in server-rendered HTML (either genuinely absent or injected post-hydration)

## 5. Design system notes

- **Colors:** primary green `rgb(44 122 75)` (#2c7a4b), deep green `#1c4e30` / `rgb(28 78 48)`, bright green accent `rgb(76 203 127)` / `#4abb5d`, light mint section background `rgb(231 241 233)` / `#e7f1e9`, amber/orange accent `#fda91f` (buttons/highlights), neutrals #fff/#f8f8f8/#080808, red for error states. Gradient hero overlay `linear-gradient(180deg, rgba(197,240,204,.8), …)`.
- **Typography:** Nunito, Arial/sans-serif fallback; large hero H1s; Estonian long-tail titles (SEO-heavy, year injected: "…aastal 2026").
- **Layout patterns:** full-width hero with photo + overlay + form card; alternating text/image sections; 3-column card grids (process, services, articles); 2-col contact-card grid with photos; testimonial quote blocks; pre-footer contact band; dense lead-form repetition (the form follows the user down every page — 2–3 instances/page).
- **Imagery:** photo-heavy (98 `<img>` on homepage), all forestry photography via Contentful; screenshot tutorials for the state portal; no illustrations/icons beyond emoji (✅📍) on kiiroksjon.

## 6. Business model & funnels visible from the site

AS Timber (reg. 12646598) is Estonia's largest **broker of timber-sale auctions**: it aggregates ~200 vetted cutting-right buyers and ~1000 property buyers on oksjonid.timber.ee, and monetizes via a **3% (+VAT) success fee** paid by the forest owner (free consultation, no fee if auction fails). Secondary revenue: valuation acts (from €480 + VAT) and the **kiiroksjon** product where Timber itself guarantees a backup purchase offer. The `/paringud` forms are a lead-gen marketplace: requests are forwarded to partner companies (management-plan authors, tending-cut and planting contractors) who answer within 7 days — presumably provider-side monetization (compare `/liitu`, "join" page for providers).

**Conversion funnels:**
1. Owner browses SEO content → universal lead form (name/phone/email/cadastre+consent) → specialist calls → free consultation → auction contract → auction on oksjonid.timber.ee → 3% fee on deal.
2. Fast path: `/kiiroksjon` form → 48h sealed-bid quick auction → notarial deal or Timber's own offer.
3. Service marketplace: `/paringud/*` form → auto-forwarded to N partner companies → competing quotes to owner within 7 days.
4. Provider funnel: `/liitu`, `/tingimused-ostjatele`, buyer manual PDF — recruiting the buy-side liquidity.
5. Newsletter retention loop on homepage.
