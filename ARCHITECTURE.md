# Eametsad — Architecture

Eametsad is an Estonian forest-transaction platform that lets forest owners sell cutting rights and forest properties by auction, and lets vetted buyers bid on them. The system has three deployment units: a public marketing site, a customer-facing auction portal, and an admin backend, all served by a shared API.

<!-- TOC -->

- [1. Project Structure](#1-project-structure)
- [2. High-Level System Diagram](#2-high-level-system-diagram)
- [3. Core Components](#3-core-components)
  - [3.1 Marketing Site](#31-marketing-site)
  - [3.2 Auction Portal](#32-auction-portal)
  - [3.3 Core Backend & API](#33-core-backend--api)
  - [3.4 Admin Backend](#34-admin-backend)
- [4. Data Flow](#4-data-flow)
- [5. Data Stores](#5-data-stores)
- [6. External Integrations](#6-external-integrations)
- [7. Key Technologies](#7-key-technologies)
- [8. Deployment & Infrastructure](#8-deployment--infrastructure)
- [9. Security Architecture](#9-security-architecture)
- [10. Monitoring & Observability](#10-monitoring--observability)
- [11. Performance & Scalability](#11-performance--scalability)
- [12. Development Workflow](#12-development-workflow)
- [13. Testing Strategy](#13-testing-strategy)
- [14. Architectural Decisions & Rationale](#14-architectural-decisions--rationale)
- [15. Constraints, Risks, and Technical Debt](#15-constraints-risks-and-technical-debt)
- [16. Future Considerations](#16-future-considerations)
- [17. Project Identification](#17-project-identification)
- [18. Glossary](#18-glossary)

<!-- /TOC -->

---

## 1. Project Structure

```
eametsad/
├── .agents/              # Agent skills and infrastructure
├── .codegraph/           # Code intelligence index
├── .opencode/            # OpenCode configuration, harness, agents, plugins
├── docs/
│   ├── README.md         # Plain-language project overview for all audiences
│   ├── EAMETSAD-PLAN.md  # Master build plan: features, architecture, data model, timeline
│   ├── design/
│   │   ├── README.md     # Design system: colors, typography, spacing, components
│   │   ├── 00-global-shell.md
│   │   ├── marketing/    # Page specs for eametsad.ee (17 pages)
│   │   ├── portal/       # Page specs for oksjonid.eametsad.ee (13 screens)
│   │   ├── admin/        # Page specs for admin.eametsad.ee (14 screens)
│   │   └── uhistu/       # Page specs for metsauhistu.eametsad.ee (Phase 5)
│   └── research/         # Competitive analysis of timber.ee
├── openspec/             # OpenSpec change management
├── AGENTS.md             # Agent operating guide
├── ARCHITECTURE.md       # This file
├── DESIGN.md             # Design tokens and system documentation
├── opencode.jsonc        # OpenCode configuration
└── skills-lock.json      # Installed agent skills manifest
```

The project is in pre-implementation state. No source code directories exist yet. Source directories will be added per the delivery phases defined in `docs/EAMETSAD-PLAN.md`.

---

## 2. High-Level System Diagram

```
                      ┌──────────────────────────────────────────────┐
                      │           eametsad.ee (public)               │
                      │  Marketing site: SSG/ISR + lead forms        │
                      │  (Next.js - static where possible)           │
                      └──────────────┬───────────────────────────────┘
                                     │ shared API
         ┌───────────────────────────┼───────────────────────────────┐
         ▼                           ▼                               ▼
┌──────────────────┐      ┌──────────────────────────┐     ┌──────────────────────┐
│ oksjonid.eametsad│      │  api.eametsad.ee (core)   │     │ admin.eametsad.ee    │
│ .ee — SPA portal │────▶│  Auction engine, auth,    │◀────│ Admin panel          │
│ Bids, my pages   │      │  contracts, notifications │     │ (role-gated same API)│
│ Map, filters     │      │  users, leads, CMS content│     │                      │
└──────────────────┘      └────────────┬──────────────┘     └──────────────────────┘
                                        │
          ┌─────────────┬───────────────┼────────────────┬──────────────┐
          ▼             ▼               ▼                ▼              ▼
     PostgreSQL    eID provider    e-signing         E-mail/SMS     Maps/geo
     (+Redis)      Smart-ID/M-ID   (contracts)       provider       Leaflet+LMV
                   ID-card         Dokobit/eIDEasy   Mailgun+SMS    or Google Maps
```

**Three deployment units, one backend:**

| Deployment | Role | Tech (recommended) |
|---|---|---|
| `eametsad.ee` | Public marketing & SEO site | Next.js 15 (SSG/ISR), static where possible |
| `oksjonid.eametsad.ee` | Auction portal SPA | React SPA or Next.js client-heavy routes |
| `api.eametsad.ee` + `admin.eametsad.ee` | Core backend + role-gated admin | Payload CMS 3 (embeds into Next.js) |

---

## 3. Core Components

### 3.1 Marketing Site

| Attribute | Value |
|---|---|
| **URL** | `eametsad.ee` |
| **Audience** | Forest owners, buyers (public, no auth) |
| **Stack** | Next.js 15 App Router, SSG/ISR |
| **Content** | Pages, articles, FAQ categories, specialists, testimonials, partner services — all from Payload CMS collections |
| **Dynamic elements** | Live auction ticker (client-side fetch + refresh), lead forms, newsletter subscription |
| **Key routes** | `/`, `/teenused/*`, `/metsateatis`, `/kiiroksjon`, `/hindamisaktid`, `/kkk/*`, `/paringud/*`, `/meist/*`, `/artiklid/*`, `/lepingud`, `/kontakt` |

All marketing-site content is managed via Payload CMS collections. The site generates statically where possible and hydrates live data client-side.

### 3.2 Auction Portal

| Attribute | Value |
|---|---|
| **URL** | `oksjonid.eametsad.ee` |
| **Audience** | Bidders & sellers (public browse + authenticated customer area) |
| **Stack** | React SPA or Next.js client-heavy routes |
| **Key public pages** | Listing (`/`), lot detail open/sealed (`/oksjon/:id`), archive (`/ajalugu`), login, register, select-profile |
| **Key authenticated pages** | My bids, my sales, notifications, profile, contract signing |
| **Realtime** | Server-Sent Events (SSE) for bid/countdown updates |
| **Auth** | Short-lived JWT access + rotating refresh, httpOnly cookies on portal origin |

### 3.3 Core Backend & API

| Attribute | Value |
|---|---|
| **URL** | `api.eametsad.ee` |
| **Stack** | Payload CMS 3 (TypeScript, REST API, built on Next.js) |
| **Primary storage** | PostgreSQL 16 |
| **Cache/sessions** | Redis |
| **Background jobs** | BullMQ (auction ending worker, notifications, digests, PDF generation) |
| **Realtime** | SSE for live bid/countdown updates |

**API endpoints (summary):**

| Area | Endpoints |
|---|---|
| Public content | `GET /api/v1/auctions`, `/auctions/:id`, `/auctions/:id/bids`, `/counties`, `/statistics` |
| Auth | `POST /api/v1/auth/{smartid\|mobileid\|idcard}/start\|status\|complete`, `/login` |
| Portal | `GET /api/v1/my-auctions`, `/bids/create`, `/auto-bidders`, `/profiles` |
| Contracts | `POST /api/v1/contracts/framework/prepare\|complete`, `/contracts/auction/prepare\|complete` |
| Admin CRUD | Full CRUD for auctions, users, rights, CMS content, sealed-bid opening |
| Forms | `POST /api/v1/leads`, `/service-requests`, `/newsletter` |

### 3.4 Admin Backend

| Attribute | Value |
|---|---|
| **URL** | `admin.eametsad.ee` |
| **Audience** | Eametsad staff (role-gated) |
| **Stack** | Payload CMS 3 built-in admin panel (role-gated) |
| **Modules** | Dashboard, auction management, bid monitoring, users & rights, contracts, CRM (leads), service request routing, CMS content, statistics, settings, audit log |

The admin is the same Payload CMS instance as the core API, with role-based access control.

---

## 4. Data Flow

### Key user journey: forest owner sells cutting rights

1. Owner lands on `eametsad.ee`, reads service page, submits lead form.
2. Lead POSTs to `POST /api/v1/leads` → stored in PostgreSQL → notification sent to assigned specialist.
3. Specialist contacts owner, prepares forest data, creates auction lot via admin.
4. Lot published → status `draft → scheduled → active`.
5. Buyers browse on `oksjonid.eametsad.ee`, place bids.
6. Anti-sniping extends end time if bid within last 5 minutes.
7. At end time, worker transitions `active → ended` → computes outcome.
8. Winner invited to sign contract via eID provider → contract stored.
9. Status moves `ended → contract → completed → archived`.
10. Statistics snapshot written.

### Bid lifecycle (open auction)

```
Buyer submits bid
  → Server validates: auth, active auction, type right, amount ≥ leading + step
  → Row lock on auction row
  → Anti-snipe check: extends endTime if within window
  → Bid appended to bids table (append-only)
  → AutoBidder engine runs: resolves next leading bid
  → SSE broadcast: update bid panel + countdown
  → Notification: outbid e-mail/SMS to previous leader
```

---

## 5. Data Stores

| Store | Type | Purpose |
|---|---|---|
| PostgreSQL 16 | Relational (primary) | All transactional data: users, profiles, auctions, bids, contracts, leads, CMS content, audit log. JSONB for flexible lot attributes. |
| Redis | Key-value cache | Session store, rate limiting counters, SSE pub/sub channels, BullMQ job queue backing. |

### Core entities

`User`, `Profile` (private/company), `CompanyAccessRequest`, `AuctionRight`, `Auction` (with full field model: location, forest data, pricing, content, packages), `Bid` (append-only), `AutoBidder`, `Contract`, `ContractTemplate`, `Lead`, `ServiceRequest`, `NewsletterSubscriber`, `Specialist`, CMS collections (`Page`, `Article`, `FAQItem`, `Testimonial`, etc.), `County`, `Parish`, `Notification`, `AuditEntry`, `StatisticsSnapshot`.

See `docs/EAMETSAD-PLAN.md` §8 for the complete data model.

---

## 6. External Integrations

| Integration | Purpose | Method | Notes |
|---|---|---|---|
| eID (Smart-ID, Mobile-ID, ID-card) | Authentication | Aggregator API (eID Easy or Signicat) | Phase 0 decision |
| e-signing (same provider) | Contract signing | Aggregator API | Wraps Smart-ID/M-ID/ID-card signing |
| Äriregister (e-Business Register) | Company registry lookup | REST API / X-Road | Validates registrikood on company registration |
| Maa-amet (Land Board) WMS/orthophoto | Map tiles | Leaflet + WMS | Free, local — primary map provider |
| Google Maps (fallback) | Map tiles | JS API | Fallback only |
| Mailgun (SendGrid) | Transactional e-mail | REST API / SMTP | Phase 2 — notification templates |
| SMS provider (Messente/CM.com) | Bid/auction-critical SMS | REST API | Phase 2 — outbid + ending alerts |
| Gotenberg or Puppeteer | PDF generation | HTTP API | Self-hosted — contract PDFs |
| Plausible or GA4 | Analytics | JS snippet + API | Phase 1 — GDPR consent gated |

---

## 7. Key Technologies

| Layer | Technology | Architectural relevance |
|---|---|---|
| **Runtime** | Node.js (via Next.js) | Server-rendered React + API routes |
| **Framework** | Next.js 15 (App Router) | SSG/ISR for marketing, API routes for backend |
| **CMS/Admin** | Payload CMS 3 | Gives admin panel, collections, REST/GraphQL, auth, media, localization — embedded into Next.js |
| **Frontend** | React, TypeScript, Tailwind CSS | Component library shared across marketing site, portal, admin |
| **Database** | PostgreSQL 16 | Primary store — JSONB for flexible attributes, relational integrity for bids/contracts |
| **Cache** | Redis | Sessions, pub/sub, BullMQ queue backing, rate limiting |
| **Queue** | BullMQ | Background jobs (auction ending, notifications, digest, PDF generation) |
| **Realtime** | SSE | Live bid and countdown updates |
| **Maps** | Leaflet + Maa-amet WMS | Free, local — primary map rendering |
| **Icons** | Lucide React | Clean, tree-shakeable icon library |
| **Design** | Tailwind CSS | Utility-first CSS for all sites |
| **Maps GeoJSON** | Estonia county boundaries | Filter panel and map overlays |

---

## 8. Deployment & Infrastructure

Not yet implemented. Phase 0 will establish hosting. Key requirements:

- **Hosting region:** EU (Hetzner, CyberCloud, or Suppcloud recommended)
- **Database:** Dedicated PostgreSQL 16 instance — auction timing demands isolation
- **Build system:** Turborepo + pnpm monorepo
- **CI/CD:** GitHub Actions (recommended)
- **Environment config:** `.env` files (not committed), secrets in vault/secret store
- **Containers:** Docker recommended for background workers (BullMQ, Gotenberg)

Not evident from the repository: hosting provider, domain registration, SSL certificate management, container registry, Kubernetes/ECS configuration.

---

## 9. Security Architecture

| Concern | Approach |
|---|---|
| **Authentication** | eID (Smart-ID, Mobile-ID, ID-card) via aggregator + fallback password login with rate limiting |
| **Authorization** | Role-based: guest, registered (private/company), seller, specialist, admin, superadmin |
| **Bid integrity** | Bids in serializable transaction with row lock; append-only audit table |
| **Sealed bids** | Encrypted at rest until admin opening ceremony (two-person rule recommended) |
| **Rate limiting** | Auth endpoints, bid submission, form submissions — backed by Redis |
| **CSP** | Content Security Policy on all responses |
| **Honeypot fields** | Invisible form fields to block bots on all forms |
| **GDPR** | Explicit consents (no pre-checked boxes), data export/erasure self-service, retention schedules |
| **Audit log** | Immutable log of all admin actions touching users/bids/contracts |
| **Anti-sniping** | Time extension mechanism to prevent last-second bid sniping |

Security posture targets OWASP ASVS Level 2 with penetration testing before launch.

---

## 10. Monitoring & Observability

Not yet implemented. Planned for Phase 1 and onwards:

- **Error tracking:** Sentry
- **Uptime monitoring:** UptimeRobot or equivalent
- **Analytics:** Plausible (GDPR-light) or Google Analytics 4 with consent gate
- **Audit log:** In-application immutable audit log for compliance

Not evident from the repository: APM tooling, structured logging framework, health check endpoints.

---

## 11. Performance & Scalability

| Concern | Approach |
|---|---|
| **Page load** | SSG/ISR for marketing site — static delivery with live data hydration |
| **Auction listing** | Server-side pagination (cursor or page-based) |
| **Lot caching** | Lot pages cached until first bid |
| **Concurrent viewers** | Target 10,000 concurrent viewers, 500 concurrent bidders |
| **Timing correctness** | Server-authoritative clocks; end-of-auction processed by queue worker with row locks — never by client |
| **Idempotency** | All background jobs idempotent and retryable |
| **LCP target** | < 2.5s on 3G |
| **Accessibility** | WCAG 2.1 AA target |

---

## 12. Development Workflow

The project is in pre-implementation state. Build tooling will be set up in Phase 0.

| Command | Purpose |
|---|---|
| `pnpm install` | Install dependencies (upon setup) |
| `pnpm dev` | Start development servers |
| `pnpm build` | Build all packages |
| `pnpm lint` | Lint check |
| `pnpm typecheck` | TypeScript type check |
| `pnpm test` | Run tests |

Not yet established: ESLint/Prettier/Biome configuration, pre-commit hooks, commit message convention.

---

## 13. Testing Strategy

Not yet defined. Recommended approach based on specification:

| Layer | Framework | Scope |
|---|---|---|
| **Unit** | Vitest | Utility functions, validators, bid engine rules |
| **Integration** | Supertest + test DB | API endpoints, auction lifecycle, auth flows |
| **E2E** | Playwright | Critical user journeys: register → bid → win → sign |
| **Visual** | Playwright (pc-ops-evidence) | UI snapshot testing in CI |

---

## 14. Architectural Decisions & Rationale

| Decision | Rationale |
|---|---|
| **Monorepo (Turborepo/pnpm)** | Mirrors reference architecture proven for this exact product class; shared types and components across three sites |
| **Next.js + Payload CMS 3** | Payload embeds into Next.js — one framework for marketing, API, and admin; TypeScript throughout; localization built in |
| **PostgreSQL over document DB** | Bids, contracts, and financial data need relational integrity; JSONB for flexible lot attributes gives best of both |
| **SSE over WebSockets** | Lower complexity for server-to-client bid/countdown updates; WebSocket overhead not justified until chat/multiplayer features added |
| **BullMQ for background jobs** | Queue-backed, idempotent, retryable — critical for auction-ending correctness |
| **Server-authoritative timing** | Auction end processed by queue worker with row locks; never trusted from client — prevents manipulation |
| **Leaflet + Maa-amet over Google Maps** | Free, local, works offline; Estonian Land Board data is authoritative for cadastral information |
| **Subdomain strategy** | Matches proven reference pattern; clear SEO and mental model separation |

---

## 15. Constraints, Risks, and Technical Debt

| Item | Type | Impact |
|---|---|---|
| **No code written yet** | Status | All architecture is pre-implementation — subject to refinement during build |
| **Client legal entity not confirmed** | External dependency | Contracts, T&C, and fee invoices blocked |
| **eID provider not contracted** | External dependency | Auth and e-signing integration gated |
| **Buyer network not established** | Business risk | Auction liquidity is the make-or-break factor |
| **Estonian-only at launch** | Scope | Architecture ready for i18n, but not active |
| **WCAG 2.1 AA target** | Ongoing effort | Accessible by design from day one — but adds development time |
| **Phase 5 (association) optional** | Scope | Affects data model extensibility — design for it but defer implementation |

---

## 16. Future Considerations

| Item | Phase | Recommendation |
|---|---|---|
| **Association subsite** | Phase 5 | Design subsidy content model now to avoid retrofitting; defer implementation |
| **i18n (EN/RU)** | Post-launch | Architecture should handle it (Payload has built-in localization); Estonian-only for Phase 1-4 |
| **Mobile app** | Post-launch | Progressive Web App (PWA) covers most needs initially |
| **AI forest valuation** | Future | Planned for data-rich future — uses transaction comparison + own auction results |
| **Partner marketplace automation** | Future | Auto-routing of service requests to partner companies with SLAs |

---

## 17. Project Identification

| Attribute | Value |
|---|---|
| **Name** | Eametsad |
| **Type** | Greenfield — Estonian forest-transaction auction platform |
| **Primary language** | TypeScript/JavaScript (Next.js, Payload CMS, React) |
| **Database** | PostgreSQL 16 |
| **Runtime** | Node.js |
| **Date of review** | 2026-08-27 |
| **Maintainer** | Not yet assigned |

---

## 18. Glossary

| Term | Estonian | Meaning |
|---|---|---|
| Cutting rights | Raieõigus | The right to harvest timber on a specified area |
| Forest property | Metsakinnistu | A registered forest estate (cadastral unit) |
| Quick auction | Kiiroksjon | 48-hour accelerated auction with house backup offer |
| Sealed bid | Pimepakkumine / Suletud pakkumine | All bids submitted secret, opened simultaneously after end |
| Under-bid | Alapakkumine | A bid below the minimum starting price, requiring seller approval |
| Auction step | Pakkumise samm | The minimum increment for each new bid in an open auction |
| Valuation report | Hindamisakt | Professional forest valuation document (from €480) |
| Framework contract | Raamleping | One-time pre-bidding agreement signed before participating in open auctions |
| Auto-bidder | Automaatpakkuja | Proxy system that bids on the user's behalf up to a max amount |
| Lead | Päring (muud)/Juhtlõim (CRM) | A form submission or contact enquiry |
| Service request | Päring (teenus) | A request forwarded to a partner company for services |
| Forest notification | Metsateatis | A logging notification filed with the state environmental board |
| Specialist | Metsaspetsialist | An Eametsad staff member who manages forest owner relationships |
| Association | Metsaühistu | Forest owners' cooperative (optional Phase 5) |

<!-- Last updated: 2026-08-27 -->
