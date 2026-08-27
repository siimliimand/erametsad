# EAMETSAD — Full Project Build Plan

**Estonian forest-transaction platform: marketing site + auction environment + owner services, with customer portal and admin backend**

- Version: 1.0 (draft for client review)
- Date: 2026-08-27
- Based on: competitive structural analysis of timber.ee ecosystem (3 sites, 23 pages mapped + reverse-engineered platform APIs) — see `research/*.md`
- Language of the product: **Estonian** (terms below kept in Estonian where they are domain labels)

> ⚖️ **Legal posture:** this plan replicates *functionality and structure*, not content, branding, or visual design. All copy, imagery, layout and brand assets for Eametsad must be created fresh. Auction terms & conditions, contracts and privacy documents need review by Estonian legal counsel before launch.

---

## Client overview — in plain language

> For the forest-owner client, the buyer, and anyone who wants the "what and why" without the technical detail. The rest of this document is the full build plan.

**What Eametsad is.** A place to sell Estonian forest — cutting rights (_raieõigus_) and forest properties (_metsakinnistu_) — by auction, and for vetted buyers to bid on it. The promise to the owner is simple: the auction finds the market price, and you only pay if the sale succeeds.

**What we build:**

| Product | In one sentence |
|---|---|
| `eametsad.ee` | The public website — explains the service, answers questions, collects enquiries. |
| `oksjonid.eametsad.ee` | The auction platform — browse lots on a map, place bids, sell your own forest, sign contracts. |
| `admin.eametsad.ee` | The staff control room — manage auctions, bidders, leads, contracts and content. |

**How Eametsad earns money:** a **3% + VAT success fee** on the final price, paid only when the auction completes. Secondary income comes from **valuation reports** (from €480 + VAT) and **48-hour quick auctions** (_kiiroksjon_) where Eametsad itself backs the lot with a purchase offer if no buyer wins.

**The experience for a forest owner:**
1. Leave your details on the website → a free consultation, no obligation.
2. A specialist prepares the forest for sale.
3. The lot goes live — cutting rights sell by open ascending auction, properties by sealed "closed-envelope" bid.
4. The winner signs electronically (Smart-ID / Mobile-ID / ID-card) and the deal completes.

**The experience for a buyer:** register, get bidding rights, sign a framework agreement once, then bid with an optional auto-bidder and anti-sniping rules keeping it fair. Bid history is anonymised; only the winning price is ever public.

**Timeline:** a sellable version (website + open auctions + admin) in **~10–12 weeks**; full scope in **~20–28 weeks**.

**What we need from you** — the ten open questions at the end of this document, most importantly: the legal entity, confirmation of the fee model, and the buyer network that will make auctions liquid.

---

## 1. Executive summary

The reference (AS Timber / timber.ee) runs a three-property ecosystem:

| Property | Role | Stack (reference) | Eametsad equivalent |
|---|---|---|---|
| `timber.ee` | Marketing + SEO + lead-gen (256 URLs) | Gatsby + Contentful | `eametsad.ee` — marketing site |
| `oksjonid.timber.ee` | Auction platform (2,660 lots run to date; 36 active) | React SPA + **Payload CMS** backend (`backend.timber.ee`) | `oksjonid.eametsad.ee` — auction environment |
| `metsauhistu.timber.ee` | Forest-owners' association (MTÜ) subsite (21 URLs) | Gatsby + Contentful | `metsauhistu.eametsad.ee` — association subsite (optional Phase 5) |

**Business model being replicated:** free consultation for forest owners → sell cutting rights (`raieõigus`) / forest property (`metsakinnistu`) / packages via auction → **success fee 3% + VAT** of final price; side revenue from valuation reports (`hindamisakt`, from €480), 48h quick auctions (`kiiroksjon`) with house backup offer, and a service-request marketplace (`päringud`) forwarding leads to partner companies.

**What the client asked for beyond the reference's public face:** a customer area where users log in and place offers (`pakkumised`), and an admin backend. Both exist in the reference (hidden behind login) and their mechanics were reconstructed from the platform's APIs — they are fully specified below.

**Recommended delivery:** 5 phases, ~20–28 weeks full scope; ~10–12 weeks to a sellable MVP (marketing site + open auctions + admin).

---

## 2. What the reference does (summary of findings)

### 2.1 Main site (`timber.ee`)
- 256 URLs: 14 core pages + 202 SEO articles + 9 about/team + 7 FAQ categories + service pages + ~25 long-tail SEO landing pages (calculators-as-articles, guides).
- Conversion machinery: a universal lead form (**nimi, telefon, e-mail, katastrinumber (valikuline), nõusoleku checkbox → "SAADA"**) repeated 1–3× per page; newsletter form; three specialized inquiry forms (`päringud`) forwarded to partner companies; specialist contact cards.
- Key content components: 9-step sell-process accordion ("Eeltöö / Oksjon / Tulemus"), FAQ accordions, live auction cards embedded in the static build, testimonial blocks, trust stats ("200 vetted buyers / 1000 property buyers"), screenshot tutorials (metsateatis in state portal).
- Headless CMS: Contentful; forms via serverless functions; zero analytics visible (unusual — we will add analytics).

### 2.2 Auction platform (`oksjonid.timber.ee` + `backend.timber.ee`)
- Thin WordPress shell hosting a React SPA; real backend is **Payload CMS** with open REST API — full data model extracted (§6).
- **Object types:** `forest` (raieõigus), `property` (metsakinnistu), `field` (põllumaa), `package` (kinnistute pakett) + `isQuickAuction` flag.
- **Auction types:** `open` (ascending, with `bidStep`) and `sealed` (pimepakkumine — all property/field/package lots).
- **Bidding mechanics observed:** login wall → eID-verified identity; per-auction-type bidding rights (admin-granted); framework contract signing before open bidding; per-auction contract after winning; autobidder (proxy to max sum); anti-sniping (last-5-min bid extends end by 5 min); under-start bids (`alapakkumine`) with minus-button UI, seller acceptance required; anonymized bid lists to guests (no amounts, no bidders); no deposit anywhere.
- **Archive:** per-type tabs, filters incl. end-year, only `finalPrice` public — no winner identity, no bid history.
- **Auth:** Smart-ID / Mobile-ID / ID-card / isikukood+password; private vs company profiles (äriregistri kood lookup); company registrations go through an admin approval queue.
- Scale achieved: 2,660 auctions, €56M cutting rights + €68M property sold via archive stats endpoints.

### 2.3 Association site (`metsauhistu.timber.ee`)
- 21 URLs; free membership; monetization via 7% subsidy-application service fee, seedling sales, auction referrals.
- Content-heavy **toetused (subsidies) module**: 15 program pages with deadline windows, €/ha rates by applicant type, eligibility conditions, submission channel (e-PRIA vs joint application), external document links.
- PEFC group-certification document library.
- ⚠️ Defect to avoid: hidden, pre-checked GDPR consent checkboxes.

---

## 3. Eametsad system architecture

```
                    ┌──────────────────────────────────────────────┐
                    │              eametsad.ee (public)             │
                    │  Marketing + SEO + lead forms + articles      │
                    │  (SSG/ISR — no dynamic state)                 │
                    └───────────────┬──────────────────────────────┘
                                    │ shared design system, shared CMS
        ┌───────────────────────────┼───────────────────────────┐
        ▼                           ▼                           ▼
┌───────────────────┐   ┌───────────────────────────┐  ┌────────────────────┐
│ oksjonid.eametsad │   │   api.eametsad.ee (core)   │  │ admin.eametsad.ee  │
│ .ee — SPA portal  │──▶│  auction engine, auth,     │◀─│ admin panel        │
│ bids, my pages    │   │  contracts, notifications, │  │ (same backend,     │
│ map, filters      │   │  users, leads, CMS content │  │  role-gated)       │
└───────────────────┘   └─────────────┬─────────────┘  └────────────────────┘
                                      │
        ┌─────────────┬───────────────┼────────────────┬──────────────┐
        ▼             ▼               ▼                ▼              ▼
   PostgreSQL    eID provider    e-signing        E-mail/SMS      Maps/geo
   (+Redis)      Smart-ID/M-ID   (contracts)      provider        (Leaflet+LMV
                 ID-card         Dokobit/eIDEasy  Mailgun+Messente or Google)
```

**Three deployment units, one monorepo:**
1. **Marketing site** — statically generated where possible; embeds live auction cards (build-time + client-side refresh).
2. **Auction portal (SPA)** — the customer area: browse, bid, my bids, my sales, profile, notifications.
3. **Core backend + admin** — one API serving both public site content and portal; admin panel role-gated.

**Subdomain strategy mirrors the reference** (proven SEO + clear mental model): main site, `oksjonid.`, `api.`, `admin.`, optional `metsauhistu.`.

---

## 4. Marketing site — page-by-page spec

### 4.1 Information architecture (sitemap)

```
/                                  Avaleht
/teenused/raieoiguse-muuk          Raieõiguse müük oksjonil
/teenused/metsa-hindamine          Metsa väärtuse hindamine (SEO article)
/teenused/kinnistu-muuk            Kinnistu müük oksjonil
/metsateatis                       Metsateatise esitamine (guide + screenshots)
/hindamisaktid                     Hindamisaktide koostamine (from €480)
/kiiroksjon                        48h kiire oksjon
/kkk                               FAQ hub + 7 category pages
    /kkk/oksjonid /myyk /hind /tulumaks /metsaandmed /raie /metsauhistu
/paringud                          Service-request hub (3 cards)
    /paringud/metsamajanduskava    Forest management plan request
    /paringud/hooldusraie          Tending-cut request
    /paringud/metsa-istutamine     Planting request
/meist                             About (company block, registry data)
    /meist/metsaspetsialistid      Specialist contact cards
    /meist/<nimi>                  6 specialist profile pages
/artiklid                          Articles hub
    /artiklid/uudised, /artiklid/klientide-lood, /artiklid/kasutustingimused
/lepingud                          Contract templates
/kontakt                           Contact
/liitu                             (if association phase) join page
+ ~20 long-tail SEO landing pages (Phase 2 content production)
```

### 4.2 Global layout
- **Header nav** (dropdowns): *Metsa müümine* (5 sub-items) · *KKK* · *Kiiroksjonid* · *Päringud* (3 sub) · *Uudised* · *Meist* (2 sub) · *Metsaühistu* (external) · CTA button **"Oksjonikeskkond"** → `oksjonid.eametsad.ee`.
- **Footer** (5 columns): Aktiivsed oksjonid (by type) · Oksjonite ajalugu (by type) · Artiklid · Kasulik teada (kasutusjuhend PDF, lepingud, kasutustingimused, privaatsuspoliitika) · Jälgi meid (FB/IG/YT).
- **Pre-footer contact band on every page:** phone, e-mail, "Jäta enda kontaktid" anchor → page's lead form.
- Cookie banner + explicit analytics consent (reference has none — we do it properly).

### 4.3 Page specs (block order per template)

**Homepage:** hero (H1 + intro + 2 CTAs + lead form card) → "Plaanis metsa müük?" band → **live auction ticker** (4 cards: cadastral no, area ha, countdown, link into portal) → team intro → trust stats (vetted buyers count / properties sold — real numbers from DB) → 3-column process (Eeltöö/Oksjon/Tulemus, deep links) → latest articles (3) → newsletter form → testimonials → closing lead form.

**Service pages** (`raieoiguse-muuk`, `kinnistu-muuk`): hero + dual CTA → lead form → **9-step expandable process accordion** grouped Eeltöö (1–3) / Oksjon (4–6) / Tulemus (7–9) → fees & liability section → buyer-vetting trust section. Kinnistu page adds sealed-bid explainer.

**SEO article pages** (`metsa-hindamine` etc.): hero + auction ticker + lead form near top → long-form article (H2 sections) → "Konsultatsioon on tasuta" CTA + second form.

**`/metsateatis`:** guide + step-by-step screenshot tutorial of the state portal (register.metsad.ee) → sidebar "Vaata lisaks" (metsateatise-muutmine, kahjustusest-teatamine) → lead form + phone CTA.

**`/kiiroksjon`:** hero "48 tunniga reaalsed pakkumised" → form → how-it-works (5 steps: contact → set secret reserve → 48h €1-start bidding → notarial deal (fee 3% + VAT) → **house backup offer if no bids**) → benefits checklist → suitability checklist → closing form.

**`/hindamisaktid`:** methodology (transaction comparison + own auction results), price factors, data sources (takseer, Maa-amet, AI forest inventory) → price "from €480 + VAT" → order-by-email CTA → sticky numbered side-nav.

**FAQ:** hub + 7 category pages, category chip-nav, accordion items with "Loe edasi…" expanders. Content model: category → questions (question, teaser, full answer, sort).

**`/paringud` hub + 3 forms** (lead marketplace — requests forwarded to partner companies who quote within 7 days):
| Form | Fields |
|---|---|
| metsamajanduskava | name, phone, email, katastritunnus(ed), ☐ soovin kava paberkandjal, comment |
| hooldusraie | name, phone, email, maakond, katastritunnus, eraldis(ed), ☐ kultuuride hoindamine ☐ valgusraie, **file upload** (kava fail, valikuline), comment |
| metsa-istutamine | name, phone, email, maakond, katastritunnus, eraldis(ed), ☐ maapinna ettevalmistus ☐ istikud ☐ istutamine, comment |

**About/team:** company block (legal name, registrikood, KMKR, address), mission, CEO quote; specialists page = 6 contact cards (photo, name, role, direct phone, direct e-mail, bio) → profile pages.

### 4.4 Forms handling (all sites)
- All forms POST to the core API (`POST /api/leads`), honeypot + rate-limit + server validation; consent checkbox **visible, unchecked, required** (fixes the reference's GDPR flaw).
- Every lead: source tracking (form name + page slug + occurrence index — the reference's `form-name` convention is worth keeping), status pipeline (new → contacted → qualified → converted/rejected), assignment to a specialist, notes timeline, e-mail + (optional) SMS notification to the assigned specialist.
- Newsletter: double opt-in, unsubscribe link, stored separately with consent timestamp.

### 4.5 Content model (CMS collections for marketing)
`Page` (flexible block builder: hero/text/cards/accordion/forms/ticker/stats/CTA/testimonials), `Article`, `FAQCategory`, `FAQItem`, `Specialist`, `Testimonial`, `PartnerService` (the 3 päringud types + form schema), `LegalDocument`, `Media`, `Redirect` (for SEO moves), `SEOSettings` per page (title, description, OG image, canonical, robots).

---

## 5. Auction environment — functional spec (the core)

### 5.1 Roles & permissions

| Role | Capabilities |
|---|---|
| Guest | browse listings/detail/archive, subscribe to notifications, register |
| Registered — private | bid (if bidding rights granted), autobidder, my bids, my profile, notifications |
| Registered — company | same, under company profile; requires admin approval (access-request queue) |
| Seller (metsaomanik) | view own lots ("Minu müügid"), approve/reject alapakkumine, see own results |
| Specialist (metsaspetsialist) | create/edit own lots, manage leads, view bids on own lots |
| Admin | everything: users, rights, lots lifecycle, sealed-bid opening, contracts, CMS, stats |
| Superadmin | role assignment, audit log, settings (fees, anti-snipe config) |

Bidding rights are **granted per auction type** (forest/property/field/package) by admin — replicated from reference ("Sul puuduvad õigused teha vastava oksjoni tüübi juures pakkumisi").

### 5.2 Auction lifecycle & statuses

```
draft → scheduled → active → ended → appraisal(seller accepts top bid or alapakkumine)
                                   ↘ unsold (no bids / below reserve → re-list or kiiroksjon fallback)
                            → contract (winner) → completed → archived
```
- Clock: **server time only** (client shows countdown from server-issued deadline; NTP-synced).
- Anti-sniping: bid within last N minutes (default 5, configurable per auction) extends end by N minutes; toggleable per auction (`antiSnipingEnabled`).

### 5.3 Object types & auction types

| Object type | Estonian | Auction type | Notes |
|---|---|---|---|
| `forest` | Raieõigus | open (ascending) or sealed | volume m³, species, compartments |
| `property` | Metsakinnistu | sealed ("pimepakkumine") | cadastral registry numbers |
| `field` | Põllumaa | sealed | |
| `package` | Kinnistute pakett | sealed | propertyCount + package table |

Quick auction (`kiiroksjon`): flag on any lot — 48h duration, €1 start, secret reserve (piirhind), if no bids ≥ reserve → house backup offer from Eametsad OÜ itself.

### 5.4 Lot (auction) — complete data model

Field inventory (matches everything the reference exposes, organized):

**Identity & status:** `id`, `name`, `objectType`, `auctionType`, `auctionStatus`, `isQuickAuction`, `startTime`, `endTime`, `endYear` (archive bucket), `externalUrl`, `specialist` → Specialist.

**Location:** `county` (15 counties ref-table), `parish` (vald ref-table), `address`, `coordinates` (map pin), external links to kataster map (`ky.kataster.ee`) and Metsaregister (`register.metsad.ee`).

**Land / forest data:** `area` (ha), `volume` (m³), `cadastres[]` (katastritunnused), `registryNumbers[]`, `forestType[]` (species codes), `loggingType[]` (raieliigid: AR,HL,HR,KR,LR,RD,SR,TR,VE,VR), `loggingCompartments[]` (eraldised), `forestNotifications[]` (metsateatise nr), `loggingDeadline`, `removalDeadline`, `storageLocationApproval`, `removalRoads`, `hasRentalAgreement`, `rentalAgreementDeadline`.

**Pricing:** `minBid` (alghind), `bidStep` (pakkumise samm, open auctions), `finalPrice` (lõpphind, after end), `reservePrice` (secret, kiiroksjon), fee config (default 3% + VAT of final price — global setting, overridable).

**Content:** `extraInfo`, `secondaryInfo` (rich text: raietähtaeg, eraldised, ladustamiskohad, väljaveoteed, seemne- ja säilikpuud, muud piirangud), `email` (per-lot anonymized alias → forwards to specialist inbox), `image` (hero), `images[]`, `files[]` (takseer PDF, metsateatised PDF).

**Packages:** `propertyCount`, `packageDescription`, `packageTable` (structured rows).

**Bids:** `bids[]` (subcollection), computed `leadingBidAmount` (authed users only), `bidCount`.

### 5.5 Listing page (`/`)
- **Tabs per object type with counters** + summary sentence ("Hetkel on aktiivseid raieõiguste oksjoneid N, kokku X ha raiutavat mahtu Y m³ ja Z € väärtuses").
- **Estonia map view** (county GeoJSON, pins from `coordinates`, popups: area/price/registry nr/end date). Recommendation: **Leaflet + Estonian Land Board orthophoto/WMS** (free, local) — Google Maps as fallback.
- **Filters** (collapsible, "Tühjenda", active-count badge): maakond, vald, puuliigid, raieliigid, pindala/raiemahu vahemik, hind, aasta (archive), endYear (archive).
- **Sorting:** alghind/lõpphind asc-desc, varem/hiljem lõppevad.
- Server-side pagination (cursor or page-based).
- **"Telli teavitus"** — notification subscription from the filter panel (saved search → e-mail when new matching lot published).
- Cards: image, name, alghind, county, area, volume, countdown ("Aega jäänud"), status badge.

### 5.6 Lot detail page (`/oksjon/:id`)
- Hero: name, status badge, countdown, image gallery, map, cadastral block, **complete field table** (§5.4), rich-text info blocks, download files, specialist card, per-lot anonymized contact e-mail.
- **Bidding panel:**
  - Guests: "Logi sisse pakkumise tegemiseks".
  - Authed without rights: message to contact admin for auction-type rights.
  - Open auction: current leading bid (if permitted to see), bid input with +/- step buttons, **under-start bidding enabled toggle** (alapakkumine — clearly marked "requires seller approval"), autobidder max-sum input, submit → **contract-signing gate** (framework contract once, then per-auction contract for the winning bid).
  - Sealed auction: single form — amount + bidder identity fields (name, isikukood/registrikood 11/8 digits, address, e-mail, phone); explanation "Kõik pakkumised avatakse üheaegselt peale lõppemist".
  - "Teenustasu rakendub vaid oksjoni võitmise korral" notice.
- **Bid list:** authed users see amounts + relative times with anonymized bidder labels (Pakkuja #1, #2…); guests see count + timestamps only. Never expose identities.
- Outbid UX: banner "Sinu pakkumine pakuti üle. Tee uus pakkumine." (portal + e-mail/SMS).

### 5.7 Bidding engine rules (implementation-critical)

**Open auctions:**
1. Validation chain: authed → active auction → not ended → auction-type right → amount ≥ current+step (or approved alapakkumine flow) → contract prerequisites met.
2. Autobidder: proxy system bids the minimum needed to lead, up to each autobidder's max; ties broken by earlier autobidder creation; autobidder vs autobidder resolves to (second-max + step).
3. Anti-snipe: on accepted bid with `now > endTime − N min` → `endTime += N min`; persisted and broadcast.
4. Alapakkumine: bid < minBid allowed when enabled → status `pending_seller_approval`; seller approves → becomes leading; rejected → bidder notified.
5. Atomicity: bids in a serializable transaction with row lock on the auction; every bid appended to an append-only audit table.

**Sealed auctions:**
1. One bid per user (or configurable N revisions before end); amount + identity fields stored encrypted-at-rest until opening.
2. At `endTime`: system freezes, admin opens (two-person rule recommended), winner = highest valid bid; tie → earliest submission; `finalPrice` published; losers get "ei võitnud" e-mail, winner gets contract invitation.
3. Reserve (piirhind): if top bid < reserve → `unsold`, seller decides re-list; kiiroksjon → house backup offer workflow.

**Ending:** status worker (queue, idempotent) transitions `active → ended`, computes outcomes, fires notifications, writes archive stats snapshot.

### 5.8 Contracts & e-signing
- Two-step, as in the reference: (a) **framework contract** (`raamleping`) signed once before first open bid — stored per user; (b) **per-auction contract** generated from template with lot + bid data, signed by winner after end.
- Flow: `prepare` (server renders PDF from template + bidder/lot data) → user reviews → **e-sign via eID provider** (Smart-ID/Mobile-ID/ID-card) → `complete` (signature container stored, hash audit-logged).
- Provider options: **eID Easy** (aggregator, simplest), Dokobit, Signicat — decide in Phase 0 with client (pricing per signature differs).
- Contract templates managed in admin (DOCX/PDF templates with placeholder fields) — new versions without redeploy.

### 5.9 Notifications
- Events: new matching lot (saved searches), outbid, auction won/lost, auction ending in 24h (opt-in), alapakkumine decision, company access approved/rejected, contract ready for signature, kiiroksjon result.
- Channels: e-mail (transactional provider w/ templates) + SMS (bid/auction-critical only); both with per-user preferences + consent records.
- Digest option: daily/weekly new-lot digest per saved search.

### 5.10 Archive & statistics (`/ajalugu`)
- Tabs per type, all listing filters + `endYear`, sortable by lõpphind; server pagination.
- Public data: finalPrice only — no winner identity, no bid counts (replicates reference privacy posture).
- Public statistics endpoint/page: totals per type (count, ha, m³, €) — strong trust signal, cheap to build from archive snapshots.

### 5.11 Customer portal ("Minu keskkond")
- **`/user/bids` (Minu pakkumised):** active bids with current status (leading/outbid/pending approval), past bids with outcomes, autobidder management.
- **`/user/objects` (Minu müügid):** seller's lots — status, view counts, bid counts (authed), alapakkumine approvals queue, final results, contract status.
- **`/user/notifications` (Teavitused):** notification history + preferences, saved searches.
- **`/user/profile`:** private/company data, company äriregistri lookup, password change, eID re-link, GDPR data export/delete requests.
- **`/select-profile`:** switch between personal and company profiles.

---

## 6. Auth & identity

- **Primary: eID** — Smart-ID, Mobile-ID, ID-card (via aggregator: eID Easy or Signicat; direct SK integration possible but heavier). Identifies by isikukood → account.
- **Fallback:** isikukood + password (as reference) with rate-limited login + optional 2FA (TOTP) for company accounts.
- Password reset by e-mail; session = short-lived JWT access + rotating refresh; httpOnly cookies on portal origin.
- **Company profiles:** user enters registrikood → validated against Äriregister (e-Business Register API / X-Road; fallback: manual entry) → request lands in admin approval queue ("Sinu taotlus on ülevaatamisel") → approved → company profile active.
- GDPR: explicit consents, data-minimal profiles, full audit log of admin views of personal data, self-service export/erasure.

---

## 7. Admin backend

Access via `admin.eametsad.ee` (role-gated screens on the same core API).

### 7.1 Modules
1. **Dashboard:** active auctions ending today, bids today, pending approvals (companies, alapakkumised), new leads, signed contracts, revenue (fees) MTD.
2. **Auction management:** lot CRUD with the full field model (§5.4), media & PDF uploads, draft preview, schedule/publish, end manually, re-list; bulk operations for packages.
3. **Bid monitoring:** live bid feeds per auction, autobidder visibility, alapakkumine approval queue, sealed-bid **opening ceremony screen** (frozen → reveal → winner confirm), anomaly flags (shill-bid heuristics: same-IP clusters, new-account bursts).
4. **Users & rights:** search by isikukood/e-mail/company; grant/revoke auction-type bidding rights; company access-request queue; suspend/ban; impersonate-for-support (logged).
5. **Contracts:** template management, generation queue, signature status tracking, completed containers download.
6. **Leads/CRM (marketing):** all form submissions, pipeline statuses, assignment to specialists, notes timeline, export CSV.
7. **Päringud marketplace:** partner companies, per-service routing rules, request forwarding log (which partners received which request), quote-tracking (manual status).
8. **Content (CMS):** all marketing-site collections (§4.5), SEO fields, redirects, menu builder.
9. **Subsidies module (Phase 5):** subsidy programs, deadline windows, rates by applicant type, document links — single source for site + association subsite.
10. **Statistics:** auction outcomes (sell-through rate, avg price/ha, price/m³ by county/species — a genuine competitive edge the reference doesn't publish), funnel (leads → contracts).
11. **Settings:** fee %, anti-snipe defaults, notification templates, per-lot e-mail alias domain, maintenance mode.
12. **Audit log:** every admin action touching users/bids/contracts.

---

## 8. Data model (core entities)

```
User(id, isikukood, auth: eid|password, email, phone, status, created_at)
Profile(id, user_id, type: private|company, company_reg_code, company_name, approval_status, ...)
CompanyAccessRequest(id, profile_id, reg_code, status, reviewer_id, decided_at)
AuctionRight(user_id, object_type, granted_by, granted_at, revoked_at)
Auction(id, name, object_type, auction_type, status, is_quick_auction, start_time, end_time,
        county_id, parish_id, address, coordinates, area, volume, cadastres[], registry_numbers[],
        forest_types[], logging_types[], compartments[], forest_notifications[], deadlines...,
        min_bid, bid_step, reserve_price, final_price, anti_snipe_enabled, fee_percent,
        extra_info, secondary_info, alias_email, specialist_id, media..., package fields...,
        seller_profile_id, created_by, timestamps, soft delete)
Bid(id, auction_id, user_id, amount, type: open|sealed, source: manual|autobidder,
    status: active|leading|outbid|won|lost|pending_approval|rejected, is_underbid,
    identity_snapshot{name, id_code, address, email, phone}, submitted_at, ip_hash)
AutoBidder(id, auction_id, user_id, max_amount, status, created_at)
AuctionSubscription(id, user_id|null, email, filter_json, channel, frequency)
Contract(id, type: framework|auction, auction_id, user_id, template_id, pdf, signature_container,
         status: prepared|sent|signed|voided, signed_at)
ContractTemplate(id, type, version, file, placeholders[])
Lead(id, form_name, page_slug, name, phone, email, cadastre, message, attachments[],
     status, assigned_specialist_id, consent_at, source)
ServiceRequest(id, type: kava|hooldusraie|istutamine, payload_json, attachments[],
               routed_to[], status)
NewsletterSubscriber(email, confirmed_at, token, unsubscribed_at)
Specialist(id, name, role, phone, email, photo, bio, active)
Page/Article/FAQItem/Testimonial/SubsidyProgram/Media (CMS collections)
County(id, name_et), Parish(id, county_id, name_et)
Notification(id, user_id, event, channel, payload, sent_at, read_at)
AuditEntry(id, actor_id, action, entity, entity_id, before/after json, at)
StatisticsSnapshot(date, object_type, count, area, volume, eur)
```

**Integrity rules:** bids append-only (corrections via compensating entries); auctions end-time changes only via anti-snipe or admin (logged); sealed amounts encrypted until opening; isikukood stored once, encrypted column + hash index for lookup.

---

## 9. API surface (summary)

Public/content: `GET /api/auctions` (+filters/sort/pagination), `GET /api/auctions/:id`, `GET /api/auctions/:id/bids` (role-shaped response), `GET /api/v1/counties`, `GET /api/v1/statistics`, `GET /api/pages|articles|faq` (marketing).
Auth: `POST /api/v1/auth/{smartid|mobileid|idcard}/start|status|complete`, `POST /api/v1/auth/login`, password reset.
Portal: `GET /api/my-auctions`, `GET /api/with-user-bids`, `POST /api/bids/create`, `GET/POST/DELETE /api/auto-bidders`, `POST /api/auction-subscriptions`, `GET/PATCH /api/profiles`, `POST /api/v1/business/request-access`, `GET /api/v1/company-lookup?regCode=`, contracts: `POST /api/bids/framework-contract/prepare|complete`, `POST /api/bids/contract/prepare|complete`.
Admin: everything above + CRUD, rights, approvals, sealed opening (`POST /api/admin/auctions/:id/open-sealed`), CMS, stats, audit export.
Forms: `POST /api/leads`, `POST /api/service-requests`, `POST /api/newsletter`.

---

## 10. Integrations & external services

| Need | Options | Decision |
|---|---|---|
| eID auth + e-signing | eID Easy, Signicat, Dokobit; direct SK APIs | Phase 0 — recommend eID Easy (one integration covers Smart-ID/M-ID/ID-card + signing, usage-based pricing) |
| Company registry | e-Business Register API (ariregister.rik.ee) / X-Road | Phase 0 |
| Maps | Leaflet + Maa-amet LMV orthophoto/WMS (free) vs Google Maps | Recommend Leaflet+LMV |
| E-mail | Mailgun/SendGrid/Mailgun-EE reseller | Phase 2 |
| SMS | Messente / CM.com | Phase 2 (outbid + ending alerts) |
| PDF generation | Gotenberg / Puppeteer (self-hosted) | Phase 2 |
| Analytics | Plausible (GDPR-light) or GA4 + consent | Phase 1 |
| Error/uptime | Sentry + UptimeRobot | Phase 1 |
| Hosting | EU region (Hetzner/CyberCloud/Suppcloud); auction timing demands dedicated DB | Phase 0 |

---

## 11. Tech stack recommendation

**Recommended — mirrors the reference architecture (proven for exactly this product):**
- **Monorepo (Turborepo/pnpm):** Next.js 15 (App Router) — marketing site (SSG/ISR) + admin (role-gated); React SPA (or Next client-heavy routes) for the auction portal.
- **Payload CMS 3** (TypeScript, embeds into Next) — gives admin panel foundation, collections/REST/GraphQL auth, media handling, localization — the reference built exactly this on Payload.
- **PostgreSQL 16** (JSONB for flexible lot attributes + relational integrity for bids/contracts) + **Redis** (sessions, pub/sub for live bid updates, rate limiting).
- **Realtime:** Server-Sent Events for bid/countdown updates (WebSockets only if chat added later).
- **Background jobs:** BullMQ (auction ending worker, notifications, digests, PDF generation) — queue-backed, idempotent, retryable.

**Alternative (if the dev team is PHP-centric):** Laravel 11 monolith + Filament admin + Inertia/React + MySQL + Horizon queues — one deployable, batteries-included auth/notifications; equally capable, less JS-tooling overhead.

**Not recommended:** WordPress/WooCommerce for the auction core — the reference itself migrated *away* from exactly that (legacy WP REST still visible, abandoned CPTs).

---

## 12. Non-functional requirements

- **Timing correctness:** server-authoritative clocks; countdown drift correction; end-of-auction processed by queue worker with row locks — never by client request; idempotent end processing (double-fire safe).
- **Performance:** listing paged server-side; lot pages cached until first bid; target LCP < 2.5s on 3G; 10k concurrent viewers / 500 concurrent bidders capacity target.
- **Security:** OWASP ASVS L2; rate limiting (auth, bids); honeypots; CSP; signed URLs for media; encryption of sealed bids; pen-test before launch; audit log immutable.
- **GDPR:** explicit consents (no pre-checked boxes), data export/erasure self-service + admin tooling, retention schedule (bids/contracts retained per accounting law 7 years), DPA with providers, DPIA for the auction platform.
- **Availability:** 99.9% during active auctions; maintenance windows scheduled around auction endings; DB backups PITR.
- **Accessibility:** WCAG 2.1 AA target (reference doesn't bother — easy differentiator for institutional clients).
- **i18n:** Estonian first; architecture ready for EN/RU (auction terms in all three is common in EE market).

---

## 13. Delivery plan

| Phase | Scope | Duration | Milestone |
|---|---|---|---|
| **0 — Discovery** ( wk 1–3): legal T&C review, eID/signing provider contracts, design system + key screens (Figma), content plan, hosting setup | 3 wk | approved designs + provider contracts |
| **1 — Marketing site** (wk 4–7): IA, all core pages, CMS, forms → leads CRM, SEO scaffolding, analytics | 4 wk | **site live**, capturing leads |
| **2 — Auction core** (wk 8–15): auth (eID+password), users/rights, lot model + admin CRUD, listing + detail, **open bidding** (step, alapakkumine, anti-snipe, autobidder), notifications (e-mail), archive | 8 wk | **MVP: first real open auction can run** |
| **3 — Sealed bids & contracts** (wk 16–20): sealed auctions + opening workflow, framework/per-auction contracts + e-signing, SMS notifications, company profiles + approval queue | 5 wk | full auction types in production |
| **4 — Portal polish & stats** (wk 21–23): saved searches/digests, map view, public statistics, admin dashboards, pen-test fixes | 3 wk | hardened public launch |
| **5 — Association subsite** (wk 24–26, optional): subsidies module, membership funnel, PEFC library | 3 wk | metsauhistu subsite live |
| **Ongoing:** SEO content production (200-article program is the reference's growth engine), kiiroksjon fallback-offer workflow automation | — | growth |

**Team assumption:** 1 senior full-stack + 1 full-stack/mid + part-time designer + PM oversight. Solo senior: multiply durations ×1.8–2.

---

## 14. Open questions for the client

1. **Company & legal entity** for Eametsad (name OÜ? registrikood, KMKR) — needed for contracts, T&C, fee invoices.
2. **Fee model** — replicate 3% + VAT success fee? Deposits (tagatisraha) instead of/in addition to contracts? (Reference uses contracts only.)
3. **eID/signing provider** preference and budget (per-signature pricing matters at volume).
4. **Buyer acquisition plan** — the reference's moat is 200 vetted buyers; bidding-side liquidity is the make-or-break. Do they bring a buyer network?
5. **Specialists** — who creates lots (admin-only at start vs specialist accounts from day 1)?
6. **Kiiroksjon backup offer** — will Eametsad commit its own capital as buyer of last resort?
7. **Association subsite** in scope now or later?
8. **Languages** — ET only at launch, or ET+EN?
9. **Existing brand assets** for Eametsad (logo, palette) or do we design fresh?
10. Hosting/data-residency requirements (public-sector-adjacent clients often ask for EE/EU hosting).

---

## Appendix A — Research artifacts
- `research/main-site-map.md` — timber.ee full structural map (14 pages, forms, funnels, design tokens)
- `research/oksjonid-map.md` — auction platform: mechanics, complete field inventory, Payload data model, auth flows
- `research/metsauhistu-map.md` — association subsite: subsidies content model, membership mechanics

*Scraped 2026-08-27 for competitive analysis. All Eametsad content, design and copy to be produced original.*
