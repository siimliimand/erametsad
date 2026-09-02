# Erametsad — Development Time Estimate
**Scope:** All design documents 
**Estimate for:** 1 full-stack developer
**Tech stack:** Next.js 15 App Router · Cloudflare Workers/D1/Durable Objects · Drizzle ORM · React SPA · TypeScript

> [!NOTE]
> These estimates assume a **senior full-stack developer** comfortable with the full stack (Next.js, Cloudflare platform, Drizzle ORM, eID integrations, real-time SSE). A mid-level developer should add **~30–40%** to every category. Estimates include: implementation, unit tests for critical paths, local verification, and code review prep — but **not** design/Figma work, content writing, or DevOps setup.

---

## Summary Table

| Area | Screens / Items | Hours |
|---|---|---:|
| **Foundation & Infrastructure** | Monorepo, DB schema, auth, SSE, shared components | **80** |
| **Marketing Site** (`erametsad.ee`) | 17 pages + global shell + CMS content model | **120** |
| **Auction Portal** (`oksjonid.erametsad.ee`) | 13 screens incl. realtime bidding | **130** |
| **Admin Panel** (`admin.erametsad.ee`) | 14 screens incl. sealed-bid ceremony, audit log | **160** |
| **Association Subsite** (`metsauhistu.erametsad.ee`) | 7 pages (Phase 5) | **55** |
| **Integration & QA** | eID, contracts, email/SMS, end-to-end tests | **65** |
| **TOTAL** | | **~610 h** |

---

## 1. Foundation & Infrastructure — 80 h

These are horizontal concerns that every surface depends on. They must be built first.

| Task | h |
|---|---:|
| Monorepo setup: Turborepo, shared `packages/config`, `packages/types`, `packages/ui` skeleton | 8 |
| Cloudflare Workers / OpenNext deployment pipeline; D1 database provisioning; wrangler config | 8 |
| Drizzle ORM schema: all tables (auctions, lots, bids, users, profiles, companies, contracts, leads, notifications, audit_log, cms_*) | 14 |
| Auth system: JWT access + rotating refresh, httpOnly cookies, Smart-ID/Mobile-ID/ID-card via eID Easy, password fallback | 16 |
| `AuctionDO` Durable Object: bid admission, anti-snipe alarm, end-transition, SSE event hub | 12 |
| `RateLimiterDO` Durable Object + Cloudflare Queue (background jobs, DLQ, cron sweep) | 6 |
| Design system: CSS tokens (colors, typography, spacing, motion), Lucide icon set, `Btn`, `Card`, `Modal`, `Toast`, `Drawer`, `Tabs`, `Accordion`, `Steps`, `EmptyState` base components | 10 |
| Form components: `FormInput`, `FormSelect`, `FormCheck`, `FormFile`, `FormRange`, `ConsentCheck`, `LeadForm`, honeypot + rate-limit | 6 |
| **Total** | **80** |

---

## 2. Marketing Site (`erametsad.ee`) — 120 h

### 2.1 Global Shell — 14 h

| Task | h |
|---|---:|
| Sticky header (72→60px scroll shrink), mega-nav with dropdowns, external links, keyboard / touch support, skip link | 6 |
| 5-column footer (dark), mobile accordion footer | 3 |
| `ContactBand` (pre-footer, every page) | 1 |
| `CookieBanner`: 3-button + granular modal, GA4/Plausible consent gating, `POST /api/consent` | 3 |
| 404 / 500 error pages | 1 |
| **Total** | **14** |

### 2.2 Marketing Pages — 106 h

| File | Page | h |
|---|---|---:|
| Avaleht — hero, live auction ticker, stats, process, articles, testimonials, 2× LeadForm | 12 |
| Raieõiguse müük — 9-step accordion, fee section | 6 |
| Kinnistu müük — sealed-bid explainer variant | 5 |
| Metsa hindamine — long-form SEO article | 5 |
| Metsateatise juhend — screenshot tutorial, sidebar | 6 |
| Hindamisaktid — sticky numbered side-nav, pricing | 5 |
| Kiiroksjon — 5-step how-it-works, checklist, house backup offer | 6 |
| KKK hub + 7 category pages, chip-nav, accordion | 8 |
| Päringud hub — 3 service cards | 3 |
| Metsakava form | 4 |
| Hooldusraie form + file upload | 5 |
| Istutamise form + service checkboxes | 4 |
| Meist — company block, CEO quote, LeadForm | 5 |
| Spetsialistid — 6 contact cards + profile template | 6 |
| Artiklid hub + article detail template | 7 |
| Lepingud — document downloads | 3 |
| Kontakt — map, company details, LeadForm | 4 |
| `POST /api/leads` endpoint — validation, honeypot, rate-limit, specialist assignment, email notify | 6 |
| SEO metadata, Open Graph, structured data, sitemap.xml, robots.txt | 6 |
| **Total** | **106** |

---

## 3. Auction Portal (`oksjonid.erametsad.ee`) — 130 h

| File | Screen | h |
|---|---|---:|
| Listing — tabs (4 types), filter panel, `MapEstonia` (Leaflet + Maa-amet WMS), `LotCard` grid, saved search subscription | 18 |
| Open auction — lot data, `BidPanel` (autobidder, ± step, confirm modal), live SSE countdown, anti-snipe extension animation, bid history table | 20 |
| Sealed-bid — single encrypted submission form, "already submitted" guard | 10 |
| Oksjonite ajalugu — archive filter by year/type, final price sort | 6 |
| Login — Smart-ID, Mobile-ID, ID-card, password fallback, polling for eID response | 10 |
| Registreerimine — private + company profile, Äriregister lookup | 10 |
| Profiili valik — profile switcher | 3 |
| Parooli muutmine / reset | 4 |
| 🔒 Minu pakkumised — tabs (active/leading/outbid/past), autobidder management | 12 |
| 🔒 Minu müügid — seller's lots, view/bid counts, under-bid approval workflow | 10 |
| 🔒 Teavitused — notification history, preferences, saved search management | 10 |
| 🔒 Minu profiil — personal data, eID binding, GDPR export/delete | 10 |
| 🔒 Lepingute allkirjastamine — framework + per-auction signing via eIDEasy | 7 |
| **Total** | **130** |

---

## 4. Admin Panel (`admin.erametsad.ee`) — 160 h

This is the most complex surface. Every screen has multiple states, role-gating, and audit hooks.

### 4.1 Global Admin Shell — 12 h

| Task | h |
|---|---:|
| 56px icon rail (13 items, tooltips, badge dots, active indicator) | 4 |
| 64px topbar (env badge, global `⌘K` command palette, notification popover, user menu) | 5 |
| Impersonation warning banner (amber strip, session timer, write-lock) | 3 |
| **Total** | **12** |

### 4.2 Admin Pages — 148 h

| File | Screen | h |
|---|---|---:|
| Töölaud — 7 KPI cards (sparkline), live SSE table (ending today), action queues, system health, recent leads | 14 |
| Oksjonid — `DataTable` with 11 columns, 6-tab type filter, multi-select filter bar, hover row actions, bulk action bar, "Lõpeta käsitsi" destructive modal | 16 |
| Oksjoni koostamine — 7-step wizard: type/mechanic selector (4 object types, sealed-bid auto-lock), map picker, cadastral repeater + Maa-amet validation, tree species multi-select (24 codes), pricing (masked reserve price), rich-text + focal-point media upload, package table editor, diff review + validation gates | 28 |
| Pakkumiste jälgimine — SSE live bid feed, shill-bid heuristics panel (IP cluster, new-account burst, rapid flip), under-bid approval queue, anti-snipe extension log | 16 |
| Suletud avamine — two-person ceremony (pre-flight checklist, dual signature with `AVAN` keyword, 30-min expiry), simultaneous reveal table, reserve-price comparison, winner confirmation with contract generation trigger | 16 |
| Kasutajad — DataTable, masked identity (audit-logged unmask), rights matrix (4 types), 7-tab detail drawer (identity, profiles, rights, contracts, bids, notifications, GDPR), impersonation modal, suspend/ban modals | 16 |
| Ettevõtte taotlused — Äriregister auto-lookup, board-member cross-check, duplicate detection, approve/reject/hold workflow | 10 |
| Lepingud — lifecycle table (prepared/sent/signed/voided), ASiC-E download, DOCX template manager (placeholder catalog, test-render, version history) | 12 |
| Juhtlõimed — Kanban (5 columns, SLA timers) + table toggle, lead detail slide-over (contact quicklinks, cadastre map link, GDPR consent, specialist assignment, notes timeline) | 12 |
| Päringute suunamine — routing panel (partner capacity, data-minimization notice), partner directory with region/capacity config | 8 |
| Sisuhaldus — visual block-builder (9 block types, drag-reorder), article rich-text editor + SERP/OG preview, SEO char counters, media library (focal point picker, mandatory alt-text gate) | 14 |
| Statistika — KPI cards, stacked bar chart (monthly), choropleth map (Estonia counties), funnel chart, public-stats curator toggles, CSV/XLSX export | 10 |
| Seaded — 8 sections: fee calculator (live preview), anti-snipe defaults, notification template editor (SMS char counter, test-send), masked API key cards (6 integrations), role permissions matrix, maintenance conflict checker, feature flags | 12 |
| Auditlogi — immutable append-only table (ms timestamps), Merkle-chain integrity indicator, JSON diff side-by-side drawer, masked secrets in diffs, CSV export | 10 |
| **Total (pages)** | | **148** |

---

## 5. Association Subsite (`metsauhistu.erametsad.ee`) — 55 h
*Phase 5 — distinct brand tokens, separate nav, MTÜ context.*

| File | Page | h |
|---|---|---:|
| Global shell — subsite header, dark footer (4 columns), ContactBand | 8 |
| Avaleht — subsidy teaser grid, service chips, join CTA | 8 |
| Teenused — single-page scroll of 9 services with descriptions | 6 |
| Toetused — sidebar nav, status-pill filtered list | 8 |
| Toetuse detail — deadline pill, amounts table, eligibility, how-to-apply, fee | 7 |
| PEFC sertifitseerimine — document library | 5 |
| Liitu — benefits list, join form (+ GDPR consent) | 7 |
| Kontakt — staff cards, office locations, contact form | 6 |
| **Total** | | **55** |

---

## 6. Integration & QA — 65 h

| Task | h |
|---|---:|
| eID Easy integration (Smart-ID, Mobile-ID, ID-card): full flow with polling + timeout | 10 |
| eIDEasy contract signing (framework contract + per-auction), ASiC-E download | 8 |
| Äriregister API integration (company lookup, board-member validation) | 6 |
| Mailgun email pipeline (all transactional templates via `packages/emails`) | 6 |
| Messente SMS pipeline (outbid, ending, OTP) | 4 |
| Maa-amet WMS / cadastral validation API | 4 |
| `POST /api/consent` (cookie consent audit logging) | 2 |
| End-to-end tests for critical flows: bid placement, anti-snipe, sealed reveal, contract signing, impersonation, GDPR export | 14 |
| Performance audit (Core Web Vitals, SSE reconnect, D1 query tuning) | 6 |
| Security review: CORS, rate-limit coverage, audit-log tamper test, impersonation write-lock | 5 |
| **Total** | | **65** |

---

## Phase Breakdown (Project Timeline)

> [!IMPORTANT]
> The project plan defines 5 phases. Phases 1–4 cover the auction platform + marketing site + admin. Phase 5 is the association subsite.

| Phase | Scope | Estimated Hours | Weeks @ 40h/wk |
|---|---|---:|---:|
| **Phase 1** | Foundation + Core backend + Admin shell + Auth | 80 | ~2 |
| **Phase 2** | Admin all 14 screens + Auction portal all 13 screens | 290 | ~7.5 |
| **Phase 3** | Marketing site all 17 pages + global shell | 120 | ~3 |
| **Phase 4** | Integration (eID, contracts, email/SMS) + QA | 65 | ~1.5 |
| **Phase 5** | Association subsite | 55 | ~1.5 |
| **TOTAL** | | **610 h** | **~15.5 weeks** |

## What Is NOT Included

- Client photography and media assets
- User acceptance testing (UAT) with real forest owners
- Legal review of contract templates and GDPR notices
- Post-launch monitoring, bug fixes, and Phase 2 content production (~20 SEO landing pages)


## Estonian Market Cost Estimates (2026)

> [!NOTE]
> Rates below are sourced from Estonian market data (lemon.io, palgad.ee, devico.io, 2025–2026). All figures in **EUR**. Hourly rates for freelancers are net of VAT — if the developer is VAT-registered (typical above €40k/yr revenue), add 22% KM on top for the buyer.

### Rate Reference Points

| Hiring model | Mid-level | Senior | Notes |
|---|---:|---:|---|
| **Freelancer (käsundusleping / FIE)** | €30–40/h | €40–55/h | You manage, you own the risk |
| **Agency / arendusfirma** | €55–75/h | €75–100/h | Includes PM, QA overhead |
| **Employed developer (full cost to employer)** | ~€38/h | ~€55/h | Gross salary + 33% social tax + unemployment |

### Total Project Cost Scenarios

Based on **~630 hours** (risk-adjusted estimate):

| Scenario | Rate | Total cost | What you get |
|---|---:|---:|---|
| 🟢 **Estonian freelancer, mid-level** | €35/h | **~€22 000** | Cheaper but needs your oversight; mid-level may need more hours |
| 🟡 **Estonian freelancer, senior** | €48/h | **~€30 000** | Best value/quality ratio; one experienced person owns the whole stack |
| 🟠 **Small Estonian agency (2–3 devs)** | €70/h | **~€44 000** | Faster delivery, built-in PM, more reliable on complex integrations |
| 🔴 **Mid-size Estonian agency** | €85/h | **~€53 500** | Full team, guaranteed SLA, code review, infra support |


### Phase-by-Phase Budget if Spread Over Contracts

| Phase | Hours | @ €48/h senior freelancer | Notes |
|---|---:|---:|---|
| Phase 1 — Foundation | 80h | €3 840 | Can start immediately |
| Phase 2 — Admin + Portal | 290h | €13 920 | Largest spend |
| Phase 3 — Marketing site | 120h | €5 760 | Could partially overlap Phase 2 |
| Phase 4 — Integrations + QA | 65h | €3 120 | eID testing needs test environment access |
| Phase 5 — Association subsite | 55h | €2 640 | Decoupled, can be delayed |
| **TOTAL** | **610h** | **~€29 300** | |

### What Is Not In This Budget

| Additional cost | Rough estimate |
|---|---:|
| eID Easy integration licence / setup fee | €500–2 000/yr |
| Cloudflare Workers + D1 (production) | €50–200/mo |
| Domain (.ee registration) | €15/yr |
| Mailgun / Messente (email+SMS) | €50–150/mo |
| Legal review (GDPR, contract templates) | €1 000–3 000 |
| **Additional realistic total** | **~€2 500–7 000** |
