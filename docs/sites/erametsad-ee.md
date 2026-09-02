# erametsad.ee — marketing and sales site

> Analysis of the public website: what it is for, what each page does, and how a visitor uses it.
> Sources: `docs/ERAMETSAD-PLAN.md` (§4), `docs/design/00-global-shell.md`, `docs/design/marketing/*.md`, `docs/research/main-site-map.md`.

---

## 1. What this site is

`erametsad.ee` is the public shop window of the Erametsad service. It explains how a forest owner sells cutting rights (_raieõigus_) or forest property (_metsakinnistu_) by auction, answers questions, and collects enquiries. It carries no login, no bidding, and no personal accounts. Its single job is to turn a visitor into a booked consultation.

The site is written in Estonian. The tone is plain and honest: fees are stated upfront, and the promise is that the consultation is free and without obligation.

### 1.1 Role in the four-site ecosystem

| Site | Relationship |
|---|---|
| `erametsad.ee` (this site) | Explains and sells. Captures leads. Links to the auction environment and the association site. |
| `portal.erametsad.ee` (plan name: `oksjonid.`) | Where the actual auctions run. Reached from the header CTA "Oksjonikeskkond", from auction cards, and from every "Vaata oksjoneid" button. |
| `admin.erametsad.ee` | Staff tool. Every form submission on this site lands there in the Leads CRM. |
| `uhistu.erametsad.ee` (plan name: `metsauhistu.`) | Association subsite. Linked as an external item in the header. |

### 1.2 Who visits, and why

| Visitor | Goal | Main path |
|---|---|---|
| Forest owner | Sell forest or cutting rights | Service pages → lead form → consultation |
| Forest owner (in a hurry) | Fast sale | `/kiiroksjon` → lead form → 48h auction |
| Property owner | Sell whole land | `/teenused/kinnistu-muuk` → lead form |
| Buyer | Find auctions | Header CTA → portal |
| Plan/works provider partner | Receive requests | `/paringud/*` forms are routed to partners |
| Curious reader | Learn (SEO traffic) | Articles, FAQ, guides → forms |

### 1.3 How the company earns, as shown on the site

- Success fee of **3% + VAT** on the final price, charged only when the auction completes. If the lot does not sell, the owner pays nothing.
- **Valuation reports** (_hindamisakt_) from **€480 + VAT**.
- **Kiiroksjon**: a 48-hour quick auction where Erametsad itself makes a purchase offer if no buyer bids.
- **Päringud**: service requests forwarded to partner companies (a lead marketplace, not a direct fee line on this site).

---

## 2. Global frame (present on every page)

Specified in `design/00-global-shell.md`.

### 2.1 Header

- Sticky, white, 72 px on desktop (shrinks to 60 px on scroll), 56 px on mobile.
- Menu items with dropdowns:
  - **Metsa müümine** → 5 sub-pages: raieõiguse müük, kinnistu müük, metsa hindamine, metsateatis, hindamisaktid.
  - **KKK** → the FAQ hub plus a dropdown of its 7 category pages.
  - **Kiiroksjonid** → `/kiiroksjon`.
  - **Päringud** → hub plus 3 request forms.
  - **Uudised** → `/artiklid`.
  - **Meist** → company page plus specialists page.
- External links: **Metsaühistu** → `uhistu.erametsad.ee` (marked with an external-link icon), and the CTA button **"Oksjonikeskkond"** → the portal.
- The active page is underlined in green. A skip link ("Otse sisuni") serves keyboard users.
- Mobile: hamburger opens a full-screen drawer with the menu groups as accordions.

### 2.2 Footer (5 columns, dark green)

1. **Aktiivsed oksjonid** — links into the portal by lot type (raieõigused, kinnistud, paketid, põllumaa).
2. **Oksjonite ajalugu** — the same four types into the portal archive.
3. **Artiklid** — news and customer stories.
4. **Kasulik teada** — user manual PDF, contract templates, terms, privacy policy.
5. **Jälgi meid** — Facebook, Instagram, YouTube.

A bottom row below the columns carries © Erametsad OÜ, registry code, VAT number, privacy policy, and a cookie settings link.

### 2.3 ContactBand

A pre-footer strip on every page with three items: phone (`tel:` link), e-mail (`mailto:`), and the anchor button "Jäta enda kontaktid" that scrolls to the page's lead form.

### 2.4 Cookie banner

- Appears at the bottom, does not block content.
- Three buttons: "Nõustun kõigiga", "Ainult vajalikud", "Sätete muutmine" (opens a granular modal).
- Analytics load only after consent. Consent is logged server-side via `POST /api/consent`.

### 2.5 Error pages

- 404: forest photo, heading, a simple search over CMS articles, and a button to the homepage.
- 500: neutral message, phone and e-mail, automatic error report.

---

## 3. Page-by-page analysis (17 pages)

### 3.1 Avaleht (homepage, `/`)

Block order:

1. Hero: H1, intro, two CTA buttons, and the first lead form card.
2. Band "Plaanis metsa müük?" with a link to the auction history.
3. Live auction ticker: 4 auction cards (cadastral number, area, countdown, price) that refresh about every 60 seconds and deep-link into the portal.
4. Team intro (mini specialist cards).
5. Trust stats pulled from the statistics API (vetted buyers, sales totals). Hidden if the API fails.
6. Three-column process explainer: **Eeltöö / Oksjon / Tulemus**, each step deep-linked to the service pages.
7. Latest 3 articles.
8. Newsletter form (double opt-in).
9. Testimonials (quote, name, county, no star ratings).
10. Closing lead form.

### 3.2 Raieõiguse müük (`/teenused/raieoiguse-muuk`)

The core sales page for cutting rights:

- Hero with dual CTAs into the portal (cutting-right auctions, property auctions).
- Lead form right after the hero.
- The **9-step process accordion**, grouped as Eeltöö (steps 1–3), Oksjon (4–6), Tulemus (7–9), each step with its own anchor.
- Fees and liability section: 3% + VAT success fee, 0 € if the lot does not sell, Erametsad answers for the correctness of the work.
- Buyer-vetting trust section.

### 3.3 Kinnistu müük (`/teenused/kinnistu-muuk`)

Same skeleton as 3.2, adapted to whole-property sales, plus:

- A sealed-bid explainer ("pimepakkumine"): a diagram and a comparison table of open vs sealed auctions.
- A band about package auctions (kinnistute paketid).

### 3.4 Metsa hindamine (`/teenused/metsa-hindamine`)

A long-form SEO article on what determines forest value (location, timber composition, harvesting costs, common contract mistakes, timing). Layout: hero → auction ticker → lead form near the top → article with a sticky table of contents → free-consultation CTA band → second form. This page doubles as the template for about 20 future long-tail SEO landing pages.

### 3.5 Metsateatis (`/metsateatis`)

A step-by-step screenshot tutorial for filing a forest notification in the state portal (`register.metsad.ee`): screenshots open in a lightbox, a sidebar links to related guides, and a sticky lead form plus phone CTA serve people who want help instead of instructions. Carries HowTo structured data.

### 3.6 Hindamisaktid (`/hindamisaktid`)

Sells valuation reports:

- Methodology (transaction comparison using state data plus Erametsad's own auction results).
- Price factors and data sources (inventory data, cadastral maps, orthophotos).
- Price: from €480 + VAT, depending on property size and count.
- Ordering by e-mail with cadastral numbers.
- A sticky numbered side navigation with scroll highlighting.

### 3.7 Kiiroksjon (`/kiiroksjon`)

The 48-hour quick auction product page:

- Dark hero: "48 tunniga reaalsed pakkumised", with a lead form.
- 5-step explainer: contact → owner sets a secret reserve price (piirhind) → 48 hours of bidding from a €1 start → notarial deal if the reserve is met (fee 3% + VAT) → **house backup offer from Erametsad if no bids arrive** (emphasized step).
- Benefits checklist and a suitability checklist ("kui sobib sulle").
- Second lead form at the bottom.

### 3.8 KKK (`/kkk` + 7 category pages)

FAQ hub with categories: oksjonid, müük, hind, tulumaks, metsaandmed, raie, metsauhistu. Category chip navigation, searchable accordions with teaser text and "Loe edasi…" expanders, deep links by anchor, and FAQPage structured data for search engines. FAQ pages carry no lead forms.

### 3.9–3.12 Päringud (`/paringud` + 3 forms)

A service-request marketplace. The hub shows three cards. Each leads to its own form:

| Form | Special fields |
|---|---|
| `/paringud/metsamajanduskava` | cadastral numbers (several allowed), checkbox for a paper copy, comment |
| `/paringud/hooldusraie` | county, cadastre, compartments, checkboxes (tending, release cut), **file upload** (optional plan file), comment |
| `/paringud/metsa-istutamine` | county, cadastre, compartments, checkboxes (ground preparation, seedlings, planting), comment |

Behavior: forms keep a draft in browser storage for 24 hours, throttle duplicates, and confirm with the number of partner companies the request was routed to. Partner companies quote the owner within about 7 days.

### 3.13 Meist (`/meist`)

Company block (legal name, registry code, VAT number, address), mission, CEO quote, origin story, and a lead form.

### 3.14 Metsaspetsialistid (`/meist/metsaspetsialistid`)

Six specialist contact cards (photo, name, role, direct phone, direct e-mail, bio), each linking to a profile page. The profile template shows the bio, the specialist's active auctions, their articles, and a lead form pre-assigned to them.

### 3.15 Artiklid (`/artiklid`)

Articles hub with chip navigation, a featured article, 9 articles per page, and a newsletter form. The article template includes author link, table of contents, a CMS-defined CTA band, and related articles.

### 3.16 Lepingud (`/lepingud`)

Versioned contract template downloads. No e-mail gate. A version-notification signup tells visitors when a template changes.

### 3.17 Kontakt (`/kontakt`)

Company details, direct phone numbers, three specialist cards, a full lead form, and a map with a static fallback image.

---

## 4. The lead form (the conversion engine)

One reusable `LeadForm` component appears 1–3 times per page (about 20 instances site-wide). Fields:

- **nimi** — required, 2–70 characters.
- **telefon** — required, Estonian format `+372…`, validated on the client.
- **e-mail** — required, RFC format.
- **katastrinumber** — optional, with a hint (for example `77901:003:0410`).
- **ConsentCheck** — visible, unchecked by default, required. This deliberately fixes the pre-checked consent boxes found on the reference site.
- Hidden **honeypot** field `company_website`: if a bot fills it, the submission silently "succeeds" but no lead is stored.
- Hidden `form_name` = page slug + occurrence index (for example `avaleht-2`), so the CRM knows exactly which form converted.

Submission: `POST /api/leads`, rate-limited (5 per minute per IP). Success shows "Aitäh! Võtame ühendust 1 tööpäeva jooksul." and resets the form. The button locks while sending.

Every lead arrives in `admin.erametsad.ee` → Juhtlõimed (Leads CRM) with its source, consent timestamp, and a status pipeline (new → contacted → qualified → contract / rejected), assigned to a specialist.

---

## 5. How a visitor uses the site (journeys)

### Journey A: forest owner sells cutting rights (main funnel)

1. Finds `erametsad.ee` through search or a referral, lands on the homepage or a service page.
2. Reads the 9-step process on `/teenused/raieoiguse-muuk`. Learns: valid management plan and forest notification are needed. The auction runs on the portal. The fee is 3% + VAT only on success.
3. Leaves contacts in the lead form (or calls the specialist shown on the page).
4. A specialist calls back within 1 working day, consults for free, and prepares the forest for sale.
5. The lot is published on the portal (open ascending auction).
6. After the auction, the owner follows the result. The fee is invoiced on success.

### Journey B: fast sale (kiiroksjon)

1. Owner opens `/kiiroksjon` and reads the 5 steps.
2. Leaves contacts. A specialist agrees on a secret reserve price.
3. The lot runs 48 hours with a €1 start. If the reserve is met, the deal closes at a notary. If not, Erametsad itself makes a purchase offer.

### Journey C: buyer

1. Visitor clicks "Oksjonikeskkond" in the header (or an auction card) and continues on the portal. The marketing site only pre-sells trust.

### Journey D: service request (päringud)

1. Owner needs a management plan, tending cut, or planting.
2. Fills the matching form at `/paringud/*` (uploads a plan file if relevant).
3. Erametsad forwards the request to matching partner companies, who send quotes within about 7 days.

### Journey E: reader → subscriber

1. Lands on an SEO article or FAQ page from search.
2. Reads, then subscribes to the newsletter (double opt-in) or leaves contacts.

---

## 6. SEO, performance, and analytics

- Per-page metadata (title, description, Open Graph, canonical), `sitemap.xml`, `robots.txt`.
- Structured data: Organization, Service, Breadcrumb, FAQPage (FAQ), HowTo (metsateatis tutorial).
- Caching tiers: content pages 1 hour, auction ticker 60 seconds, statistics 24 hours (ISR on the static build).
- Analytics is consent-gated. Consent events themselves are always logged server-side. Tracked events include `cookie_consent`, `nav_click`, `outbound_click` (portal / uhistu), and `error_404`.
- Accessibility target WCAG 2.1 AA: alt text on every image, keyboard navigation, visible focus, `prefers-reduced-motion` respected.

## 7. Content operations

All copy lives in the CMS (managed in `admin.erametsad.ee` → Sisuhaldus):

- `Page` built from blocks (hero, text, cards, accordion, steps, forms, ticker, stats, CTA, testimonials).
- `Article`, `FAQCategory` + `FAQItem`, `Specialist`, `Testimonial`, `PartnerService`, `LegalDocument`, `Redirect`, per-page SEO settings.
- The menu builder controls header and footer. Redirects keep old URLs alive.

## 8. Deliberate improvements over the reference (timber.ee)

| Reference practice | Erametsad practice |
|---|---|
| No analytics at all | Consent-gated analytics with a proper cookie banner |
| Fine print on fees | Fees stated upfront on every service page |
| Long generic headings | Plain headings ("Sinu mets, õigem hind") |
| SEO-only page for "calculator" | Real content only. No fake tools |

## 9. Open items before launch

1. Final logo, phone numbers, e-mail addresses (placeholders everywhere).
2. Legal entity data (registry code, VAT number) for the footer and contact pages.
3. Real Estonian forest photography (client-provided preferred).
4. Legal review of terms, privacy policy, and contract templates.
5. The ~20 long-tail SEO landing pages: template first, content production later.
