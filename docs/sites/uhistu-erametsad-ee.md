# uhistu.erametsad.ee — the forest-owners' association subsite

> Analysis of the association subsite: what the MTÜ site offers, all 7 pages, the subsidy module that drives its value, and how a forest owner uses it.
> Sources: `docs/ERAMETSAD-PLAN.md` (§2.3, §13 Phase 5), `docs/design/uhistu/UHISTU-DESIGN-SPEC.md`, `docs/design/uhistu/*.md`, `docs/research/metsauhistu-map.md`.

> **Naming note.** The master plan and design specs call this site `metsauhistu.erametsad.ee`. This document uses the requested name `uhistu.erametsad.ee`. It is the same product: the association subsite. The header link on the marketing site points to whichever hostname is chosen at launch.

---

## 1. What this site is

`uhistu.erametsad.ee` is the public site of **Erametsad Metsaühistu MTÜ**, a non-profit forest-owners' association. It is a content and lead site, like `erametsad.ee`, but with its own mission: help private forest owners with everything that comes with owning forest. There is no login and no member portal. Membership is free. A staff member follows up on every join request by phone or e-mail.

The subsite is planned as **Phase 5** of the delivery plan, after the marketing site, portal, and admin are live. It reuses the shared design system and the same CMS, with its own header, wordmark, and tone: community and education rather than sales.

### 1.1 How the association earns (and why the site is free)

- Membership and the membership fee are **100% free** ("Liitumine ja liikmelisus on TASUTA").
- Revenue comes from a **7% service fee on received subsidies** (charged only after the subsidy is paid out), seedling sales margins through bulk ordering, and referrals into the auction environment.
- The auction environment link ("Oksjonikeskkond" ↗) sends members with timber to sell to the portal.

### 1.2 Who visits, and why

| Visitor | Goal |
|---|---|
| Forest owner | Join for free, get help with subsidies, order forestry services |
| Forest owner with a deadline | Check subsidy windows, rates, and how to apply |
| Member | Download PEFC certification documents, order seedlings or services |
| Curious reader | Learn (services, consultant topics), then join |

## 2. Global frame

- **Header (own nav, 5 items):** Avaleht, Teenused, Toetused, Sertifitseerimine, Kontakt. Right side: external link "Oksjonikeskkond" ↗ and the amber CTA button **"LIITU ÜHISTUGA"** → `/liitu`.
- **ContactBand** on every page: association phone, `metsauhistu@erametsad.ee`, and "Jäta enda kontaktid".
- **Footer (dark, 4 columns):** the MTÜ with registry data, services, subsidies and documents (statute PDF, terms), and links to the auction environment and the main site.
- Shares the Erametsad color tokens and type, with mint highlights for subsidy pills and the amber CTA. Estonian only at launch.

## 3. Page-by-page analysis (7 pages)

### 3.1 Avaleht (`/`)

Block order:

1. **Hero** (forest photo, dark overlay): H1 "Sinu mets. Meie nõusanne.", subtitle about free membership, two CTAs, and a **JoinCard** form on the right (name, phone, e-mail, consent, "LIITU ÜHISTUGA").
2. **Subsidy table** "Metsandustoetuste taotlemine": the top 6 programs as rows with a deadline status pill (Avatud / Varsti / Suletud), the date window, the maximum rate in €/ha, and a "Taotle →" button. A footer line notes that deadlines and rates are checked against the official PRIA application calendar.
3. **Service chips band**: 9 chips (istutamine, hooldusraied, seedling orders, consulting, plant protection, management plans, young-stand care, ground preparation, plus the external "Oksjonikeskkond ↗" chip).
4. **3 featured subsidy cards** with status, one-line pitch, and the rate in large figures.
5. ContactBand.

### 3.2 Teenused (`/teenused`)

One long scrolling page with 9 anchored sections and a sticky chip navigation that highlights the current section while scrolling:

1. **Istutamine** — a 3-step flow: ground preparation → seedling order → planting.
2. **Hooldusraied** — why tending cuts matter, goals, and pricing note (depends on location, density, volume).
3. **Metsataimede tellimine** — bulk seedling orders at contract prices (spruce, pine, birch, alder, as pot or bare-root plants).
4. **Nõustamine** — certified consultants (kutseregister.ee) and 11 advisory topics in a two-column checklist, from "first steps as an owner" to "Natura 2000 restrictions".
5. **Taimekaitse ja ulukitõrje** — two product cards (Trico repellent and Cervacol Extra leader-shoot paste) with usage rates.
6. **Metsamajandamiskavad** — the 10-year "forest passport".
7. **Taimede hooldus** — care of young stands.
8. **Maapinna ettevalmistus** — site preparation after felling.
9. **Enampakkumised** — a highlighted band linking to the auction environment.

Every section has a "Soovin päringut" button that opens a **service inquiry drawer** (service preselected, contact fields, optional cadastre, message, consent) and a phone CTA to the consultant.

### 3.3 Toetused (`/toetused`) — the subsidy hub

- Left sidebar tree (3 groups): standalone grants (Metsauuenduse toetus, Noorendike hooldus, Metsakava, Natura 2000, Pärandkultuur and more), the **Metsameede** family with its sub-programs, and other grants (Üraskikahjustuste ennetamine, Ulukikahjustuste ennetamine and more).
- Main area: a grouped table of all programs with name, deadline pill, maximum rate, and an arrow to the detail page. Sortable by deadline or alphabetically. On mobile the table becomes stacked cards.
- An explainer strip: "Vali toetus → Saada meile andmed → Ühistu esitab ühistaotluse", with the 7% success-fee notice.

### 3.4 Toetuse detail (`/toetused/:slug`) — the content workhorse

Each of the ~15 subsidy programs gets a detail page with a fixed structure:

- Breadcrumbs, H1, and a live status pill with the date window.
- **"Kui suur on toetus?"**: a rates table by applicant type (private person / FIE, legal entity, association member under joint application).
- **"Olulisemad tingimused"**: an eligibility checklist with the numbers highlighted (minimum stand size, valid management plan, forest notification thresholds, per-year limits, once-per-land rule).
- **"Kuidas taotlust esitada?"**: two tabs. Tab 1, **Ühistu kaudu** (recommended): leave contacts → the consultant checks eligibility → the association files the joint application in e-PRIA. Tab 2, **e-PRIAs ise**: self-service path with the menu path and the Excel import template download.
- **Teenustasu**: a clear statement that the 7% fee applies only after the subsidy is paid out.
- A **sticky right-side form** ("Taotle toetust ühistuga"). When the window is closed, the same card switches to "Teavita mind järgmisest taotlusvoorust" and stores a notification contact instead.
- Related subsidies links.

### 3.5 Sertifitseerimine (`/sertifitseerimine`)

PEFC group certification:

- The pitch: certified timber earns a price premium, and a group certificate shares audit costs so small owners benefit.
- **Document library**: PEFC EST 1003 (sustainable forest management standard), PEFC EST 1002 (group certification requirements), PEFC ST 2001 (trademark rules), plus the association's own group principles PDF, each with file size and download.
- **Member obligations card**: follow PEFC principles and Estonian law, base management on a valid plan, allow access for sample audits, notify the association of significant cuts.
- A 3-step join path: become a member → sign the principles → the forest is added to the group certificate. An inquiry drawer button serves questions.

### 3.6 Liitu (`/liitu`)

The membership conversion page:

- Amber banner: membership is 100% free. The association earns from services, not from members.
- **11 numbered benefits**: personal consulting, subsidy applications handled for you, cutting-right and property auctions, renewal and planting work, ground preparation, young-stand care, forest protection from game, legal protection in disputes, law and tax consulting, help declaring forest income.
- **Join form** with strict validation: full name, isikukood (11 digits with checksum), home/postal address (required for the statutory member list), phone, e-mail, visible-unchecked consent, big amber "ASTU LIIKMEKS" button.
- A 4-step "what happens next" timeline: contact within 1 working day → membership confirmed and materials sent → the owner's forest needs mapped → subsidy work can start immediately.
- A link to the statute (Põhikiri PDF).

### 3.7 Kontakt (`/kontakt`)

- **Specialist cards** (2×2 grid): photo, name, title with certificate number, direct phone and e-mail, coverage region.
- **Association details card**: MTÜ name, registry code, VAT number, legal address, offices and hours (Tallinn E–R 09–17 with pre-registered visits, other offices by agreement), and an info notice asking visitors to book office visits in advance because consultants are often in the forest.
- **General contact form**: name, e-mail, phone, topic select (membership / subsidies / services / certification / other), message, consent.
- Map with an office pin and a "open in Google Maps" link.

## 4. The subsidy content model (what makes this site valuable)

Each subsidy program is a structured CMS record, not a free-text page:

| Field | Content |
|---|---|
| Title + slug | Official program name |
| Deadline window | Date range, "autumn 2026" style, or "TBD". The window drives the status pill |
| Rates | €/ha or flat €, one value per applicant type (private / legal entity / member) |
| Eligibility | Checklist items with key numbers (min ha, plan and notification requirements, annual caps, once-per-land) |
| Submission channels | e-PRIA self-service path and/or joint application via the association, with document links (Excel/PDF) |
| Service fee | 7% of the received subsidy |
| Process steps | Application and work-report steps with the association e-mail |

The homepage table, hub table, and detail pages all read from these records, so deadlines update in one place. (The reference site duplicated this content between home and detail pages. The Erametsad version keeps a single source.) The same records are also managed in `admin.erametsad.ee` → Sisuhaldus / Toetused, and the subsidy module is shared with the main site's association phase.

## 5. How a forest owner uses the site (journeys)

### Journey A: join the association

1. Arrives from the main site's header link or from search.
2. Reads the free-membership banner on the homepage and clicks "LIITU ÜHISTUGA".
3. Fills the join form (identity code validated) and consents.
4. A consultant calls within 1 working day, confirms membership, and maps the owner's needs.

### Journey B: apply for a subsidy with help

1. Opens Toetused, checks the table for open windows (green "Avatud" pills).
2. Opens the program page, confirms the rate for their applicant type and the eligibility checklist.
3. Leaves contacts in the sticky form ("Taotle toetust ühistuga").
4. The consultant checks the property and files the joint application in e-PRIA on the owner's behalf.
5. When PRIA pays out, the association invoices the 7% service fee. If the application fails, there is no fee.

### Journey C: apply alone (self-service)

1. Opens the same program page, switches to the "e-PRIAs ise" tab.
2. Follows the menu path, downloads the Excel import template, and files alone. The site still works as the reference hub for deadlines and rules.

### Journey D: get PEFC certified

1. Opens Sertifitseerimine, reads the pitch and obligations, downloads the standards.
2. Joins the association (Journey A) and signs the group principles.
3. The forest is added to the group certificate. The audit happens once for the whole group.

### Journey E: order a service

1. Browses Teenused (or lands on a section from search).
2. Clicks "Soovin päringut" in the relevant section. The drawer opens with the service preselected.
3. Sends the request. A consultant calls back. Cross-sell: the auctions band points owners with saleable timber to the portal.

## 6. Deliberate improvements over the reference (metsauhistu.timber.ee)

| Reference practice | Erametsad practice |
|---|---|
| Consent checkbox hidden and pre-checked | Visible, unchecked, required consent everywhere |
| Deadline/rate content duplicated between pages | One structured record per program, reused everywhere |
| No status pills on subsidy lists | Avatud / Varsti / Suletud pills computed from windows |
| Text pages for application paths | Tabbed "with us" vs "self in e-PRIA" paths with document links |

## 7. Relationship to the other sites

- **erametsad.ee** links here from the header ("Metsaühistu") and footer. FAQ category `/kkk/metsauhistu` answers questions.
- **portal.erametsad.ee** receives members with timber to sell (the "Oksjonikeskkond ↗" link and the auctions band).
- **admin.erametsad.ee** manages this site's content (subsidy programs, pages) and receives its join requests and inquiries as leads. The subsidy module is listed in the plan's admin modules (Phase 5).

## 8. Open items before launch

1. Association legal data: registry code, VAT number, addresses, real consultant photos and contacts.
2. PRIA calendar ownership: who updates subsidy windows and rates, and how often they are verified against official sources.
3. Whether the PEFC group scheme is launched with the subsite or later (document library is static and safe to launch first).
4. Which hostname ships: `uhistu.` or `metsauhistu.` (all links point to one canonical name).
5. Estonian-only at launch. The i18n scaffolding stays ready for later languages.
