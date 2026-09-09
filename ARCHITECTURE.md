# Erametsad — Architecture

Erametsad is an Estonian forest-transaction platform that lets forest owners sell cutting rights and forest properties by auction, and lets vetted buyers bid on them. The system has three deployment units: a public marketing site, a customer-facing auction portal, and an admin backend, all served by a shared API.

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
erametsad/
├── .agents/              # Agent skills and infrastructure
├── .codegraph/           # Code intelligence index
├── .opencode/            # OpenCode configuration, harness, agents, plugins
├── apps/
│   └── platform/         # Core backend: Next.js 15 on Cloudflare Workers
│                         # (API, custom admin, bidding engine, auth, SSE,
│                         # Durable Objects, queue, seed data)
├── packages/
│   ├── config/           # Shared ESLint, Prettier, and TypeScript configuration
│   ├── emails/           # Notification e-mail templates (React templates)
│   ├── types/            # Shared TypeScript types and enums
│   └── ui/               # Design-system component library (Phase 1)
├── docs/
│   ├── README.md         # Plain-language project overview for all audiences
│   ├── ERAMETSAD-PLAN.md  # Master build plan: features, architecture, data model, timeline
│   ├── design/
│   │   ├── README.md     # Design system: colors, typography, spacing, components
│   │   ├── 00-global-shell.md
│   │   ├── marketing/    # Page specs for erametsad.ee (17 pages)
│   │   ├── portal/       # Page specs for oksjonid.erametsad.ee (13 screens)
│   │   ├── admin/        # Page specs for admin.erametsad.ee (14 screens)
│   │   └── uhistu/       # Page specs for metsauhistu.erametsad.ee (Phase 5)
│   └── research/         # Competitive analysis of timber.ee
├── openspec/             # OpenSpec change management
├── AGENTS.md             # Agent operating guide
├── ARCHITECTURE.md       # This file
├── DESIGN.md             # Design tokens and system documentation
├── opencode.jsonc        # OpenCode configuration
└── skills-lock.json      # Installed agent skills manifest
```

The monorepo is under active implementation. `apps/platform` holds the core backend: a Next.js 15 App Router application running on Cloudflare Workers via OpenNext, with Cloudflare D1 (SQLite) for storage, Drizzle ORM for the data layer, Durable Objects for bid serialization and rate limiting, a Cloudflare queue for background jobs, and a custom admin UI. Remaining phases are defined in `docs/ERAMETSAD-PLAN.md`.

---

## 2. High-Level System Diagram

```
                      ┌──────────────────────────────────────────────┐
                      │           erametsad.ee (public)               │
                      │  Marketing site: SSG/ISR + lead forms        │
                      │  (Next.js - static where possible)           │
                      └──────────────┬───────────────────────────────┘
                                     │ shared API
         ┌───────────────────────────┼───────────────────────────────┐
         ▼                           ▼                               ▼
┌──────────────────┐      ┌──────────────────────────┐     ┌──────────────────────┐
│ oksjonid.erametsad│      │  api.erametsad.ee (core)   │     │ admin.erametsad.ee    │
│ .ee — SPA portal │────▶│  Auction engine, auth,    │◀────│ Custom admin UI      │
│ Bids, my pages   │      │  contracts, notifications │     │ (role-gated, Next.js)│
│ Map, filters     │      │  users, leads, CMS content│     │                      │
└──────────────────┘      └────────────┬──────────────┘     └──────────────────────┘
                                       │
         ┌─────────────┬───────────────┼────────────────┬──────────────┐
         ▼             ▼               ▼                ▼              ▼
    Cloudflare    eID provider    e-signing        Email Service   Maps/geo
    D1 (SQLite)   Smart-ID/M-ID   (contracts)     (Cloudflare)    Leaflet+LMV
    Durable Obj.  ID-card         eIDEasy          or SMTP fallback
    Queues
```

**Three deployment units, one backend:**

| Deployment | Role | Tech |
|---|---|---|
| `erametsad.ee` | Public marketing & SEO site | Next.js 15 (SSG/ISR), static where possible |
| `oksjonid.erametsad.ee` | Auction portal SPA | React SPA or Next.js client-heavy routes |
| `api.erametsad.ee` + `admin.erametsad.ee` | Core backend + role-gated admin | Next.js on Cloudflare Workers (via OpenNext) |

**Prototype domains (ww0.dev):** Under the `ww0.dev` zone, the prototype runs at `erametsad.ww0.dev`, `oksjonid.erametsad.ww0.dev`, `api.erametsad.ww0.dev`, and `admin.erametsad.ww0.dev`. The production `.ee` cutover is a separate future step.

---

## 3. Core Components

### 3.1 Marketing Site

| Attribute | Value |
|---|---|
| **URL** | `erametsad.ee` |
| **Audience** | Forest owners, buyers (public, no auth) |
| **Stack** | Next.js 15 App Router `(marketing)` route group in the shared platform app. Static content pages use ISR (`revalidate = 3600`); CMS-backed pages render per request until build-time D1 seeding exists |
| **Content** | Pages, articles, FAQ categories, specialists, testimonials, partner services — all from D1-backed CMS content tables |
| **Dynamic elements** | Live auction ticker (server render + 60s client refresh), lead forms, newsletter double opt-in, cookie consent with granular categories, consent-gated analytics events |
| **Key routes** | `/`, `/teenused/*`, `/metsateatis`, `/kiiroksjon`, `/hindamisaktid`, `/kkk/*`, `/paringud/*`, `/meist/*`, `/artiklid/*`, `/lepingud`, `/kontakt` |

All marketing-site content is managed via D1-backed CMS content tables. The site generates statically where possible and hydrates live data client-side.

Host routing lives in `apps/platform/src/lib/routing/host-areas.ts` plus application middleware. The portal host serves the `(portal)` route group; the default host serves `(marketing)` plus `/admin` and `/styleguide`. On the default host, `/` rewrites to `/avaleht` and `/lepingud` to `/lepingud/dokumendid` (the portal keeps the real `/` and `/lepingud` routes on its host). Marketing-only paths 308 to the default host when requested on the portal host, portal paths 308 the reverse way, and `/metsateatise-juhend` 301s to `/metsateatis`. Support APIs `POST /api/v1/consent`, `/api/v1/newsletter` (double opt-in), `/api/v1/events` (consent-gated), and `POST /api/v1/service-requests` (honeypot, 5/min IP limit, duplicate throttle, R2 attachment for hooldusraie, partner routing record) back the cookie banner, newsletter block, analytics skeleton, and the Päringud service-request forms.

### 3.2 Auction Portal

| Attribute | Value |
|---|---|
| **URL** | `oksjonid.erametsad.ee` |
| **Audience** | Bidders & sellers (public browse + authenticated customer area) |
| **Stack** | Next.js 15 App Router `(portal)` route group in the shared platform app (owns `/` and `/lepingud` on its host) |
| **Key public pages** | Listing (`/`), lot detail open/sealed (`/oksjon/:id`), archive (`/ajalugu`), login, register, select-profile |
| **Key authenticated pages** | My bids, my sales, notifications, profile, contract signing |
| **Realtime** | Server-Sent Events (SSE) for bid/countdown updates |
| **Auth** | Short-lived JWT access + rotating refresh, httpOnly cookies on portal origin |

### 3.3 Core Backend & API

| Attribute | Value |
|---|---|
| **URL** | `api.erametsad.ee` |
| **Stack** | Next.js 15 App Router on Cloudflare Workers (via OpenNext) |
| **Primary storage** | Cloudflare D1 (SQLite) via Drizzle ORM |
| **Background jobs** | Cloudflare queue `erametsad-jobs` with DLQ `erametsad-dlq` (max_retries 3). Cron sweep wakes evicted Durable Objects. |
| **Realtime** | SSE for live bid/countdown updates |
| **Bid serialization** | `AuctionDO` (Durable Object, one per auction) owns bid admission, alarms, anti-snipe, end transitions, and SSE event hub |
| **Rate limiting** | `RateLimiterDO` (Durable Object) owns rate-limit counters; in-memory fallback outside Workers |

**API endpoints (summary):**

| Area | Endpoints |
|---|---|
| Auth | `POST /api/v1/auth/login`, `/register`, `/reset-password/:token`, `/{smartid\|mobileid\|idcard}/start\|status` (eID Easy provider + demo fallback) |
| Bidding | `POST /api/v1/bids/create`, `GET/POST /api/v1/auto-bidders` |
| Contracts | `POST /api/v1/bids/contract/{prepare\|complete}`, `/api/v1/bids/framework-contract/{prepare\|complete}` |
| Profiles | `POST /api/v1/profiles/:id/select`, `POST /api/v1/business/request-access` |
| Realtime | `GET /api/v1/auctions/stream` (public SSE), `GET /api/v1/my/stream` (authenticated SSE) |
| Public data | `GET /api/v1/statistics`, `GET /api/v1/company-lookup` (registry fixtures) |
| Admin | `POST /api/v1/admin/auctions/:id/open-sealed`, `/approve-sealed`, `/confirm-winner`, `GET /api/v1/admin/audit/export/{csv,json}`, plus admin CRUD routes |
| Forms | `POST /api/leads` (honeypot + rate-limited) |

### 3.4 Admin Backend

| Attribute | Value |
|---|---|
| **URL** | `admin.erametsad.ee` |
| **Audience** | Erametsad staff (role-gated) |
| **Stack** | Custom Next.js `(admin)/` route group with Estonian labels |
| **Modules** | Töölaud (workspace), auction management (Oksjonid), bid monitoring (Pakkumised), sealed-bid opening (Sul. avamine), users (Kasutajad), company approvals (Ettevõtted), contracts (Lepingud), CRM leads (Juhtlõimed), service requests (Päringud), CMS content (Sisu), statistics, settings, audit log — 13 modules registered in `ADMIN_MODULES` (`(admin)/_lib/permissions.ts`), each role-gated |

The admin is a separate Next.js route group with role-based access control. It is not Payload admin.

**Shared admin UI.** One chrome (56px icon rail, sticky topbar, `AdminShell`) serves all modules. Shared primitives live under `(admin)/_components/ui/`: `Modal` (480/720 widths), `Drawer` (460/560/680/720 widths, full-width below 768px), `ToastProvider` + `ConfirmDialog` (reason and typed-keyword guards), `Switch`, `TabBar`, `FilterChip`, `EmptyRow`, and `KpiCard`. A single `StatusChip` renders every admin status family. The rail shows pending markers (amber dot, red count) fed by server-computed counts, and the topbar search opens a Cmd/Ctrl+K route palette. Relocated routes keep redirects: `/admin/leads/requests` → `/admin/companies`, `/admin/requests` (and `/admin/requests/partners`) → `/admin/inquiries`, `/admin/content/settings` → `/admin/settings`.

**Module internals.** The workspace (Töölaud) aggregates seven role-scoped KPIs and a live ending-today table in `_lib/workspace.ts`. The auction wizard autosaves a client draft to localStorage with a restore prompt; form submit stays the durable save. The bid monitor collapses autobidder duels, reveals bidder identities behind the audited `user.identity_view` action, and runs anomaly heuristics (new-account burst, rapid overtake) that flag entries for internal review. The sealed-opening ceremony streams a live sealed-event audit strip over the AuctionDO SSE feed. Contract templates store an editable source per version: nullable `source_content` and `source_format` (`html` or `txt`). Rendering prefers the stored source: `html` passes through, `txt` is escaped and wrapped, and versions without a source keep the DOCX-derived fallback. The editor modal ("Muuda redaktoris") saves a draft as a new inactive version copying name, type, and placeholders from the head version. The save runs through the audited `template.draft_save` action (`contracts:write`) and requires a version string unique within the template name. Activation stays a separate audited action. Users get a 720px drawer over the list (the detail page stays for deep links), impersonation, and GDPR tools. Statistics renders server-side SVG charts with a semicolon-separated CSV export. Settings provides a read-only role matrix generated from `permissions.ts`, masked env-backed integration keys with audited reveal, a Teavitused section that edits notification templates as versions with a test send and an SMS segment counter, and maintenance windows. Saving settings and templates requires `settings:write`, which only superadmin holds (decision D-6); admin sees the sections read-only.

**Maintenance mode.** When `settings.maintenance_enabled` is on, middleware returns a 503 maintenance page for public page routes on mapped hosts. The flag is cached in the middleware module with a ~2s TTL and fails open when the settings read fails. `/admin`, `/api`, the login and password-reset flow, and shared statics stay reachable, and requests carrying a valid admin access token bypass the gate. Enabling requires a typed `HOOLDUS` confirmation; both directions write `maintenance.start` / `maintenance.end` audit entries. Planned closures are stored as `maintenance_windows` (scope `portal`, `admin`, or `all`) and shown as the "Aknad" table in Seaded; the save action runs a conflict checker that blocks a window whose range contains an auction end unless the operator force-confirms.

**Impersonation.** Admin impersonation ("vaate seanss") stores the real operator id in `sessions.impersonated_by` and the JWT `impersonatedBy` claim. Start and stop are audited. While a session is impersonating, portal write actions reject with a user-facing message (reads stay available) and the portal shows an amber banner with the LÕPETA VAATLUS stop control.

**CMS block pipeline.** Pages are composed of typed blocks. `page_blocks` (pageId, type, ordinal, configJson) stores ordered blocks; `page_versions` stores append-only full-page snapshots for diff and restore. A zod-backed registry (`src/lib/content/blocks/`) defines ten block types: hero, text, cards, accordion, form, ticker, stats, cta, testimonials, faq. The admin page editor wraps them in a block builder, live preview, and versions drawer. The marketing `[...slug]` route renders published pages through the shared `PageBlocks` renderer in `packages/ui`.

**Audit hash chain.** `audit_entries` carries `prev_hash` and `hash` columns plus optional context columns (`reason`, `session_id`, `ip_hash`, `user_agent`). The write path (`src/lib/data/repositories/audit-chain.ts`) chains SHA-256 hashes over canonical entry encodings via Web Crypto; the genesis entry has a null `prev_hash`. The chain is era-safe: entries without any context value hash over the base encoding, entries with one append all four values, so pre-migration rows keep verifying unchanged. A backfill script chains legacy rows, the audit page footer shows a verification indicator ("Ahela kontroll: OK" / "VIGA"), and scoped CSV/JSON exports live at `/api/v1/admin/audit/export/{csv,json}`.

**GDPR tools.** `user.gdpr_export` streams a ZIP of a user's data (archived to R2 under `gdpr-exports/` when a media bucket binds). Anonymize removes or masks personal fields, keeps accounting rows for the 7-year retention, and records the retention deadline in the `user.gdpr_delete` audit entry. Both actions are audited.

---

## 4. Data Flow

### Key user journey: forest owner sells cutting rights

1. Owner lands on `erametsad.ee`, reads service page, submits lead form.
2. Lead POSTs to `POST /api/v1/leads` → stored in D1 → notification sent to assigned specialist.
3. Specialist contacts owner, prepares forest data, creates auction lot via admin.
4. Lot published → status `draft → scheduled → active`.
5. Buyers browse on `oksjonid.erametsad.ee`, place bids.
6. Anti-sniping extends end time if bid within last 5 minutes.
7. At end time, AuctionDO alarm fires → transitions `active → ended` → computes outcome.
8. Winner invited to sign contract via eID provider → contract stored.
9. Status moves `ended → contract → completed → archived`.
10. Statistics snapshot written.

### Bid lifecycle (open auction)

```
Buyer submits bid
  → Server validates: auth, active auction, type right, amount ≥ leading + step
  → AuctionDO serialization (single-threaded per auction)
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
| Cloudflare D1 (SQLite) | Relational (primary) | All transactional data: users, profiles, auctions, bids, contracts, leads, CMS content, audit log, sessions. 39 tables (28 + sessions, password-reset tokens, the three phase-4 support tables `consent_log`, `newsletter_subscribers`, `analytics_events`, the two service-request tables `service_requests`, `partners`, the CMS builder tables `page_blocks`, `page_versions`, and the governance tables `notification_templates`, `maintenance_windows`) defined via Drizzle ORM schema in `apps/platform/src/lib/data/schema/`. |
| Durable Objects | Stateful compute | `AuctionDO`: serialized bid admission, alarms, anti-snipe, end transitions, SSE event hub. `RateLimiterDO`: rate-limit counters. |
| Cloudflare R2 | Object storage | Media uploads (images, documents) |
| Cloudflare KV | Key-value cache | Ephemeral cache where needed |
| Cloudflare queue | Job queue | Background jobs: `erametsad-jobs` producer, `erametsad-dlq` dead-letter queue (max_retries 3). Cron sweep wakes evicted DOs. |

### Core entities

`User`, `Profile` (private/company), `CompanyAccessRequest`, `AuctionRight`, `Auction` (with full field model: location, forest data, pricing, content, packages; `area_ha`/`volume_m3` as real columns), `Bid` (append-only), `Autobidder`, `AuctionSubscription`, `Contract`, `ContractTemplate` (one row per version, nullable stored source `source_content`/`source_format`), `Lead` (with `county_id`), `Notification`, `NotificationTemplate` (versioned e-mail/SMS templates), `AuditEntry` (append-only, hash-chained via `prev_hash`/`hash`, with `reason`/`session_id`/`ip_hash`/`user_agent` context columns), `Settings` (singleton: fees, anti-snipe and alapakkumine defaults, feature flags, maintenance mode), `MaintenanceWindow` (planned closure windows), plus CMS content tables (`Article` (category, SEO title/description, specialist author), `Content`, `Page`, `PageBlock`, `PageVersion`, `FaqCategory`, `FaqItem` (active flag), `Testimonial` (draft/published status, rating), `PartnerService`, `LegalDocument`, `Redirect` (hit counter), `Specialist`, `Media` (alt text, focal point)), and geographic tables (`County`, `Parish`), `StatisticsSnapshot`. Service requests carry the status enum `new → routed → teostatud → suletud`.

Schema source: `apps/platform/src/lib/data/schema/`. The repository layer at `apps/platform/src/lib/data/repositories/` wraps Drizzle queries. Access rules live in `apps/platform/src/lib/data/guards.ts`. Money uses INTEGER cents with EUR conversion at the repository boundary.

---

## 6. External Integrations

| Integration | Purpose | Method | Notes |
|---|---|---|---|
| eID (Smart-ID, Mobile-ID, ID-card) | Authentication | eID Easy REST provider + demo fallback | JWT HS256 via Web Crypto (async canonical). D1-backed sessions with token-family rotation. |
| e-signing (same provider) | Contract signing | eID Easy API | Wraps Smart-ID/M-ID/ID-card signing |
| Äriregister (e-Business Register) | Company registry lookup | REST API / X-Road | Validates registrikood on company registration |
| Maa-amet (Land Board) WMS/orthophoto | Map tiles | Leaflet + WMS | Free, local — primary map provider |
| Google Maps (fallback) | Map tiles | JS API | Fallback only |
| Cloudflare Email Service (beta) | Transactional e-mail | EMAIL binding + REST API, SMTP/Mailpit fallback | Sending subdomain `erametsad.ww0.dev` (prototype). 3,000 emails/month included. |
| Gotenberg or Puppeteer | PDF generation | HTTP API | Self-hosted — contract PDFs |
| Plausible or GA4 | Analytics | JS snippet + API | GDPR consent gated |

---

## 7. Key Technologies

| Layer | Technology | Architectural relevance |
|---|---|---|
| **Runtime** | Cloudflare Workers (via OpenNext) | Serverless edge runtime for the Next.js app |
| **Framework** | Next.js 15 (App Router) | SSG/ISR for marketing, API routes for backend |
| **Database** | Cloudflare D1 (SQLite) | Primary store — Drizzle ORM for schema and queries |
| **ORM** | Drizzle ORM | Schema definition, migrations, type-safe queries. 39 tables in `apps/platform/src/lib/data/schema/`. |
| **Bid serialization** | Durable Objects (`AuctionDO`) | Single-threaded per auction — owns bid admission, alarms, anti-snipe, end transitions, SSE hub |
| **Rate limiting** | Durable Objects (`RateLimiterDO`) | Per-identifier rate-limit counters |
| **Queue** | Cloudflare queues (`erametsad-jobs`) | Background jobs with DLQ (`erametsad-dlq`, max_retries 3). Cron sweep wakes evicted DOs. |
| **Email** | Cloudflare Email Service (beta) | EMAIL binding + REST API. Sending subdomain `erametsad.ww0.dev`. |
| **Frontend** | React, TypeScript, Tailwind CSS | Component library shared across marketing site, portal, admin |
| **Realtime** | SSE | Live bid and countdown updates |
| **Maps** | Leaflet + Maa-amet WMS | Free, local — primary map rendering |
| **Icons** | Lucide React | Clean, tree-shakeable icon library |
| **Design** | Tailwind CSS | Utility-first CSS for all sites |
| **Maps GeoJSON** | Estonia county boundaries | Filter panel and map overlays |

---

## 8. Deployment & Infrastructure

The application runs on Cloudflare Workers via OpenNext. All stateful components are Cloudflare-native.

| Concern | Approach |
|---|---|
| **Runtime** | Cloudflare Workers (nodejs_compat flag) |
| **Database** | Cloudflare D1 (`erametsad-db`) — single writer per database, SQLite dialect |
| **Object storage** | Cloudflare R2 (`erametsad-media`) |
| **Queue** | Cloudflare queues (`erametsad-jobs` → `erametsad-dlq`, max_retries 3) |
| **Durable Objects** | `AuctionDO` (one per auction), `RateLimiterDO` (per-identifier) |
| **Email** | Cloudflare Email Service (beta, sending subdomain `erametsad.ww0.dev`) |
| **Build** | Turborepo + pnpm monorepo |
| **Entry shim** | `src/do/index.ts` re-exports the OpenNext fetch handler plus DO classes and queue consumer |
| **Cron** | Every-minute sweep wakes evicted DOs whose alarms were lost |
| **Prototype domain** | `erametsad.ww0.dev` under zone `ww0.dev`. Production `.ee` cutover is a separate future step (see `docs/runbooks/cutover-cloudflare-only.md`). |

Not yet implemented: production `.ee` domain cutover, eID Easy production contract, DNS migration from `ww0.dev` to `erametsad.ee`.

---

## 9. Security Architecture

| Concern | Approach |
|---|---|
| **Authentication** | eID (Smart-ID, Mobile-ID, ID-card) via eID Easy REST provider + demo fallback. JWT HS256 via Web Crypto (async canonical; node:crypto sync bridges remain temporarily). |
| **Sessions** | D1-backed sessions table with token-family rotation |
| **Authorization** | Role-based: guest, registered (private/company), seller, specialist, admin, superadmin |
| **Bid integrity** | `AuctionDO` serialization (single-threaded per auction); append-only audit table |
| **Sealed bids** | Encrypted at rest until admin opening ceremony (two-person approval enforced at the API level) |
| **Rate limiting** | `RateLimiterDO` on auth endpoints, bid submission, form submissions |
| **CSP** | Content Security Policy on all responses |
| **Honeypot fields** | Invisible form fields to block bots on all forms |
| **GDPR** | Explicit consents (no pre-checked boxes); audited admin-side tools for per-user ZIP export and anonymize with 7-year retention; retention schedules |
| **Audit log** | Immutable, hash-chained log of admin actions touching users/bids/contracts: SHA-256 `prev_hash`/`hash` chain, backfill script, chain-verification indicator, scoped CSV/JSON exports |
| **Impersonation** | Admin "vaate seanss" binds the operator id in the session and JWT; portal write actions reject while impersonating; start/stop audited |
| **Anti-sniping** | Time extension mechanism to prevent last-second bid sniping. AuctionDO alarm-driven with a cron sweep safety net. |

Security posture targets OWASP ASVS Level 2 with penetration testing before launch.

---

## 10. Monitoring & Observability

Not yet implemented. Planned for Phase 1 and onwards:

- **Error tracking:** Sentry
- **Uptime monitoring:** UptimeRobot or equivalent
- **Analytics:** Plausible (GDPR-light) or Google Analytics 4 with consent gate

In place: the in-application audit log (hash-chained, with chain verification and exports) covers the compliance logging role planned for this section.

Not evident from the repository: APM tooling, structured logging framework, health check endpoints.

---

## 11. Performance & Scalability

| Concern | Approach |
|---|---|
| **Page load** | SSG/ISR for marketing site — static delivery with live data hydration |
| **Auction listing** | Server-side pagination (cursor or page-based) |
| **Lot caching** | Lot pages cached until first bid |
| **Concurrent viewers** | Target 10,000 concurrent viewers, 500 concurrent bidders |
| **Timing correctness** | Server-authoritative clocks; end-of-auction processed by AuctionDO alarm with a cron sweep safety net — never by client |
| **Idempotency** | All background jobs idempotent and retryable |
| **LCP target** | < 2.5s on 3G |
| **Accessibility** | WCAG 2.1 AA target |

---

## 12. Development Workflow

Build tooling is established: a pnpm workspace driven by a Turborepo pipeline. ESLint, Prettier, and the shared TypeScript configuration live in `packages/config`. Schema lint (`pnpm lint` chain) bans REAL money columns and enum-like TEXT without CHECK constraints.

| Command | Purpose |
|---|---|
| `pnpm install` | Install dependencies |
| `pnpm dev` | Start development servers |
| `pnpm build` | Build all packages |
| `pnpm lint` | Lint check |
| `pnpm typecheck` | TypeScript type check |
| `pnpm test` | Run tests |

Not yet established: pre-commit hooks, commit message convention.

---

## 13. Testing Strategy

Three test layers are wired into `pnpm test`:

| Layer | Framework | Scope |
|---|---|---|
| **Unit + integration** | Vitest node pool (better-sqlite3) | Repository layer, guards, money handling, JSON fields, hooks, bid engine (rules, autobidder, anti-snipe, sealed-bid), admin modules (primitives, routes, role gating, maintenance gate, audit chain tamper/backfill/export, impersonation guards, GDPR retention, statistics aggregation) |
| **Durable Object** | `@cloudflare/vitest-pool-workers` | AuctionDO (bid admission, alarms, end transitions), RateLimiterDO, queue consumer |
| **Spikes** | Various | Targeted prototypes for specific subsystems |

All suites run under `pnpm test`. Schema lint enforces data conventions (no REAL money columns, CHECK constraints on enum-like TEXT).

---

## 14. Architectural Decisions & Rationale

| Decision | Rationale |
|---|---|
| **Monorepo (Turborepo/pnpm)** | Mirrors reference architecture proven for this exact product class; shared types and components across three sites |
| **Cloudflare Workers via OpenNext** | All stateful components on one platform: D1, Durable Objects, queues, Email Service, R2, KV. No external database or cache vendor. |
| **D1 (SQLite) over PostgreSQL** | Eliminates external Postgres dependency; D1 runs on the same edge as Workers. INTEGER cents, TEXT timestamps, TEXT UUIDs, TEXT-JSON columns. |
| **Drizzle ORM** | Type-safe schema and queries over D1. Replaces Payload CMS collections. 39 tables with repository-layer access rules. |
| **Durable Objects for bid serialization** | `AuctionDO` is single-threaded per auction — replaces `SELECT ... FOR UPDATE` row locks that D1 cannot provide. |
| **SSE over WebSockets** | Lower complexity for server-to-client bid/countdown updates; WebSocket overhead not justified until chat/multiplayer features added |
| **Cloudflare queues over BullMQ** | Queue and DLQ run on the same platform. Cron sweep wakes evicted DOs. |
| **Leaflet + Maa-amet over Google Maps** | Free, local, works offline; Estonian Land Board data is authoritative for cadastral information |
| **Custom admin over Payload admin** | Estonian labels, role-gated, full control over the UI. Payload CMS removed in the migration. |

---

## 15. Constraints, Risks, and Technical Debt

| Item | Type | Impact |
|---|---|---|
| **Client legal entity not confirmed** | External dependency | Contracts, T&C, and fee invoices blocked |
| **eID provider not contracted** | External dependency | Auth and e-signing integration gated |
| **Buyer network not established** | Business risk | Auction liquidity is the make-or-break factor |
| **Estonian-only at launch** | Scope | Architecture ready for i18n, but not active |
| **WCAG 2.1 AA target** | Ongoing effort | Accessible by design from day one — but adds development time |
| **Phase 5 (association) optional** | Scope | Affects data model extensibility — design for it but defer implementation |
| **Production .ee cutover is future** | External dependency | Prototype under `ww0.dev`; DNS, email, and domain migration pending (see `docs/runbooks/cutover-cloudflare-only.md`) |
| **node:crypto sync bridges remain** | Technical debt | `jwt.ts`, `password.ts`, `crypto.ts`, `encryption.ts` still use sync node:crypto. Slated for removal as callers go async to Web Crypto. |
| **Neon/Postgres references in docs** | Technical debt | Legacy references from the old stack. Migration tooling exists at `scripts/migrate-pg-to-d1/` for the data path. |

---

## 16. Future Considerations

| Item | Phase | Recommendation |
|---|---|---|
| **Production .ee domain cutover** | Post-prototype | DNS migration from `ww0.dev` to `erametsad.ee`, email sending domain swap, runbook at `docs/runbooks/cutover-cloudflare-only.md` |
| **eID Easy production contract** | Post-prototype | Replace demo fallback with production eID provider |
| **Association subsite** | Phase 5 | Design subsidy content model now to avoid retrofitting; defer implementation |
| **i18n (EN/RU)** | Post-launch | Architecture should handle it; Estonian-only for Phase 1-4 |
| **Mobile app** | Post-launch | Progressive Web App (PWA) covers most needs initially |
| **AI forest valuation** | Future | Planned for data-rich future — uses transaction comparison + own auction results |
| **Partner marketplace automation** | Future | Auto-routing of service requests to partner companies with SLAs. Phase 4 records the routing match (`routed_to[]`) at submission; delivery to partner inboxes with notifications and SLAs is Phase 5.5 |

---

## 17. Project Identification

| Attribute | Value |
|---|---|
| **Name** | Erametsad |
| **Type** | Greenfield — Estonian forest-transaction auction platform |
| **Primary language** | TypeScript (Next.js, Drizzle ORM, React) |
| **Database** | Cloudflare D1 (SQLite) |
| **Runtime** | Cloudflare Workers (via OpenNext) |
| **Date of review** | 2026-08-30 |
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
| Specialist | Metsaspetsialist | An Erametsad staff member who manages forest owner relationships |
| Association | Metsaühistu | Forest owners' cooperative (optional Phase 5) |

<!-- Last updated: 2026-09-09 -->
