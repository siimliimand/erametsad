# Erametsad — Prototype Implementation Task List

> Detailed, ordered todo list for building the **first working prototype** of the Erametsad platform:
> marketing site + auction portal + admin backend, with external integrations mocked.
>
> - Version: 0.1 · Created: 2026-08-27
> - Sources: [ERAMETSAD-PLAN.md](ERAMETSAD-PLAN.md) · [design/README.md](design/README.md) (design system + page index) · all page specs in `design/{marketing,portal,admin,uhistu}/`
> - Working language of this file: English (Estonian kept for domain labels), same convention as the rest of `docs/`.

**How to use this file**

- Check off `- [ ]` items as they land; add PR/commit links next to completed items where practical.
- Priority tags on every task:
  - **[M] Must** — the prototype is incomplete without it.
  - **[S] Should** — include in the prototype if time allows; otherwise first iteration after.
  - **[L] Later** — full-build scope (post-prototype); listed here so nothing in the specs gets forgotten.
- Each epic links its design spec(s). Read the spec before implementing — this list is an index, not a replacement.
- Large epics can be spun into OpenSpec changes (`/plan-propose`) when started.

---

## 1. Prototype definition

### 1.1 Goal

A demoable, seeded, resettable system that proves the **full end-to-end story**:

1. Forest owner leaves a lead on the marketing site → it lands in the admin Leads CRM.
2. Specialist/admin creates a lot in the admin auction editor (all object types).
3. Open ascending auction runs live: step validation, autobidder, anti-sniping, alapakkumine (under-start bids with seller approval).
4. Sealed-bid auction runs: encrypted submissions, two-person opening ceremony, winner/unsold outcome.
5. Winner signs the contract (mocked eID ceremony) → lot moves to archive → statistics update.

### 1.2 In scope

- All three products in one codebase: marketing pages, auction portal (guest + authed customer area), admin backend.
- Real bidding engine (transactional, server-authoritative), real CMS, real lead capture, realtime updates via SSE.
- Full design system per [design/README.md](design/README.md) — tokens, components, motion, WCAG 2.1 AA basics.
- Sealed-bid auctions (encrypted submissions, two-person opening) and e-signing (mocked ceremony) — beyond the plan §13 "first open auction" MVP but required for a complete end-to-end demo.
- Seed dataset covering every object type, auction status and role.

### 1.3 Mocked / simplified for prototype (swap-in points designed from day one)

| Concern | Prototype implementation | Production replacement |
|---|---|---|
| eID auth (Smart-ID/Mobiil-ID/ID-kaart) | Demo simulator: control-code screen + status polling, same API shape | eID Easy (or Dokobit/Signicat) — plan §10 |
| e-Signing | Mock ceremony (PIN2 screen, instant "signed", hash logged) | Same provider as auth |
| Äriregister company lookup | Fixture endpoint returning demo companies by regCode | e-Business Register API / X-Road |
| E-mail | SMTP → Mailpit (local catch-all inbox) + stored Notification rows | Mailgun/SendGrid |
| SMS | Log-only stub behind notification service | Messente/CM.com |
| PDF contract rendering | HTML preview + lightweight PDF; template placeholders `{{...}}` still implemented | Gotenberg/Puppeteer worker |
| Maps | Leaflet + Estonian county GeoJSON + Maa-amet WMS orthophoto (free, no key), OSM fallback | Same (already production-grade) |
| Analytics | Consent infrastructure + server-side event log only | Plausible/GA4 after consent |
| Payments | None (reference has none either — success fee is invoiced) | Invoicing, not online payment |
| DB production | Neon serverless Postgres via HTTP (`@neondatabase/serverless`) | Managed PostgreSQL |
| Queue / cache prod | Cloudflare Queues + KV (native Workers platform, no Redis needed in prototype) | Upstash Redis or self-hosted (post-prototype) |
| Media storage | Cloudflare R2 (S3‑compatible, free tier) | Same (production‑grade) |
| Hosting | Cloudflare Pages + Workers via `@cloudflare/next-on-pages` (single deploy, path-prefixed areas) | Subdomain split: `erametsad.ee` / `oksjonid.` / `api.` / `admin.` |

### 1.4 Out of scope for the prototype (tracked as **[L]**)

- Metsaühistu association subsite (plan Phase 5) — see `design/uhistu/` specs.
- Real providers (eID, Äriregister, Mailgun, Messente, Gotenberg, Sentry can stay [S]).
- SEO long-tail content production (~20 landing-page instances of the article template — build the **template**, produce content later).
- Saved-search digests, Web Push, TOTP 2FA, impersonation, anomaly/shill heuristics, GDPR export jobs, Merkle audit chain, admin statistics charts, custom CMS block-builder UI (use Payload's native admin initially).
- Public per-year/county SEO landing pages, EN/RU localization (keep i18n structure ready).

### 1.5 Indicative effort (1–2 devs, caveated)

| Phase | Content | Estimate |
|---|---|---|
| 0 | Foundations | ~1 week |
| 1 | Design system | ~1.5 weeks |
| 2 | Core backend (data, auth, bidding engine, jobs) | ~3 weeks |
| 3 | Auction portal | ~2.5 weeks |
| 4 | Marketing site | ~2 weeks |
| 5 | Admin backend | ~2.5 weeks |
| 6 | Hardening, E2E, demo | ~1 week |
| | **Total** | **~10–14 weeks** (sequential sum ~13.5 wk; compresses to 10–14 with 2 devs overlapping Phases 3–5 — marketing is independent once Phase 2's lead API + CMS exist) |

---

## 2. Technical foundation decisions (locked for prototype)

Follows plan §11 "recommended" stack — the reference was built on exactly this shape:

| Decision | Choice |
|---|---|
| Monorepo | pnpm workspaces + Turborepo |
| Apps | **Single Next.js 15 (App Router) app** `apps/platform` embedding **Payload CMS 3** (mounts REST API + media), with route groups `(marketing)`, `(portal)`, `(admin)`. Subdomain split is a deploy-time concern post-prototype. |
| Shared packages | `packages/ui` (design system), `packages/types` (zod schemas + Estonian validators), `packages/config` (eslint/tsconfig), `packages/emails` (templates) |
| DB | PostgreSQL 16 (+ `pgcrypto` / app-level encryption for sealed bids) |
| Queue / cache | **Local dev:** Redis 7 + BullMQ (ending worker, notifications, snapshots). **Prod:** Cloudflare Queues + KV — abstracted behind a common job/cache interface so the bidding engine is environment-agnostic. |
| Realtime | SSE (`/api/auctions/stream`, `/api/my/stream`) — no WebSockets |
| Styling | Tailwind mapped to CSS-variable design tokens; `next/font` with **`latin-ext` subset** (Estonian diacritics) |
| Local dev | docker-compose: postgres, redis, Mailpit |
| Production deployment | **Cloudflare** — Pages + Workers via `@cloudflare/next-on-pages`; Neon serverless Postgres; Queues + KV for jobs/cache; R2 for media |

---

## Phase 0 — Foundations

### 0.1 Repository & tooling
- [ ] Initialize pnpm workspace + Turborepo; scaffold `apps/platform` (Next 15) with Payload 3 + Postgres adapter **[M]**
- [ ] Create shared packages `ui`, `types`, `config`, `emails` (empty but wired) **[M]**
- [ ] ESLint + Prettier + strict TS config in `packages/config`, applied everywhere **[M]**
- [ ] docker-compose for local dev (postgres 16, redis 7, Mailpit SMTP) + `.env.example` with zod-validated env loading **[M]**
- [ ] CI pipeline: typecheck, lint, build, unit tests on PR **[M]**
- [ ] Root README: dev setup, seed, reset, demo accounts **[M]**
- [ ] Logger + request-id + error boundary conventions **[M]**
- [ ] Turbo remote cache **[L]**

### 0.2 Payload scaffold
- [ ] Payload bootstrap: adapter, auth-disabled default users handling, media collection (local disk for dev, R2 adapter for staging/prod via Payload's S3 plugin) **[M]**
- [ ] Access-control helper layer mapping roles (guest / private / company / seller / specialist / admin / superadmin) — plan §5.1 **[M]**
- [ ] CORS + security headers + API rate-limit middleware skeleton **[M]**
- [ ] Versioning/draft-preview wiring for CMS collections **[S]**

### 0.3 Cloudflare prototype operations
- [ ] Wire `@cloudflare/next-on-pages` build pipeline; validate Pages Functions rewrites for API routes + SSE streams **[M]**
- [ ] Neon serverless Postgres provisioning + pooler connection via `@neondatabase/serverless` (HTTP fetch, no TCP); wrangle `.env` toggles between local PG and Neon **[M]**
- [ ] Cloudflare Queues setup for BullMQ‑like job dispatch (auction-ending, notifications); KV for ephemeral cache + SSE broadcast channel **[M]**
- [ ] R2 bucket for media uploads + signed URLs (replace Payload's local‑disk media adapter) **[M]**
- [ ] wrangler.jsonc with env bindings (Queues, KV, R2, Neon DSN); smoke‑deploy a `/health` route **[M]**
- [ ] CI deploy step: wrangler deploy preview on PR, production on merge to main **[S]**

---

## Phase 1 — Design system (`packages/ui`)

Source of truth: [design/README.md](design/README.md) (tokens, type, motion, components) and [design/00-global-shell.md](design/00-global-shell.md).

### 1.1 Tokens & base styles
- [ ] CSS variables: full colour palette incl. status colours (Active `#2E9E5B`, Ending `<1h` amber, Critical `<5min` red, Ended `#6B7570`, Draft `#9E9E9E`, Scheduled info-blue), spacing scale, radii, shadows, motion durations/easings **[M]**
- [ ] Tailwind theme mapping; 12-col grid, containers (1280 standard / 720 narrow / 280 sidebar) **[M]**
- [ ] Fonts: Manrope (700/800 headings, H4 `letter-spacing .02em`), Inter (400/500/600), JetBrains Mono for figures + `font-feature-settings: "tnum"` on prices/countdowns — self-hosted, `latin-ext` **[M]**
- [ ] `prefers-reduced-motion` handling, focus-visible styles, skip-link pattern **[M]**
- [ ] Colour-contrast audit of token pairs (WCAG AA) **[M]**

### 1.2 Core components
- [ ] `Btn` (primary/CTA-amber/outline/ghost; lg 48 / md 40 / sm 32; full-width mobile) **[M]**
- [ ] `Card` (radius 14, hover lift, image/content/action slots) **[M]**
- [ ] `StatusPill` (Aktiivne / Lõppenud / Kiiroksjon / Mustand / Plaanitud; shared colour map portal+admin) **[M]**
- [ ] `Countdown` — server-synced client component with drift correction; phases neutral → amber `<1h` (pulse) → red `<5min`; "Aega jäänud Xp XXh XXm XXs" format **[M]**
- [ ] `Accordion` (two variants: single-open FAQ, multi-open process with full keyboard/ARIA) **[M]**
- [ ] `Tabs` (counter badges, underline indicator, responsive overflow) **[M]**
- [ ] `Modal` (focus trap, Esc, backdrop), `Drawer` (right slide, mobile nav/filters/detail), `Toast`, `EmptyState` **[M]**
- [ ] `DataTable` (sortable, server-paginated, 40px rows, URL-encoded filters) **[M]**
- [ ] `Steps` (numbered, vertical/horizontal, emphasis variant) **[M]**
- [ ] `ChipNav` **[M]**

### 1.3 Form components
- [ ] `FormInput` / `FormSelect` / `FormCheck` (floating label, inline error, hint) **[M]**
- [ ] `ConsentCheck` — always visible, never pre-checked, required **[M]**
- [ ] `LeadForm` — name/phone(EE)/email/cadastre(optional)/consent/honeypot `company_website` + hidden `form_name` = `<slug>-<occurrence>`; submits `POST /api/leads`; locked button while sending; Toast success **[M]** (spec in [00-global-shell.md §6](design/00-global-shell.md))
- [ ] `FormRange` (min–max sliders + numeric inputs) **[M]**
- [ ] `FormFile` (drag-drop, type/size validation, progress) — needed by hooldusraie form **[S]**
- [ ] Estonian validators in `packages/types`: phone `+372…`, isikukood (11-digit checksum), registrikood (8), cadastral `NNNNN:NNN:NNNN` **[M]**

### 1.4 Content components
- [ ] `LotCard` (image, name, alghind, county, area, countdown, status pill; archive variant with endYear + finalPrice) **[M]**
- [ ] `AuctionTicker` (4 LotCards, snap scroll, 60s client refresh, empty state) **[M]**
- [ ] `SpecialistCard` (+ mini variant) **[M]**
- [ ] `ContactBand`, `Testimonial`, `ArticleCard`, `DocumentLink` (PDF icon + size) **[M]**
- [ ] `FilterPanel` (collapsible, chip selects, range sliders, "Tühjenda", active-count badge; mobile → Drawer) **[M]**
- [ ] `MapEstonia` — Leaflet + Maa-amet WMS orthophoto, county GeoJSON outlines, pins w/ popups, clustering; graceful fallback to OSM tiles; static-image fallback for CDN failure **[M]**
- [ ] Sticky TOC / numbered side-nav with scroll-spy (IntersectionObserver) + mobile chip-bar variant **[M]**
- [ ] `SearchableAccordion` (FAQ: teaser + "Loe edasi…", `#q-slug` deep-link, diacritic-insensitive filter, aria-live results) **[M]**
- [ ] `SubsidyCard` **[L]** (Phase 5)

### 1.5 Verification
- [ ] Styleguide dev route rendering every component + states (empty/loading/error) **[S]**
- [ ] Component unit tests for validators, Countdown math, DataTable sorting/pagination **[S]**

---

## Phase 2 — Core backend: data, auth, bidding engine, jobs

Source: plan §5 (functional spec), §8 (data model), §9 (API surface), §6 (auth); portal/admin specs for endpoint shapes.

**Deferrals (accepted in writing):** ServiceRequest + Partner directory [S], NewsletterSubscriber [S], saved-search matcher + digests [S]/[L], media renditions pipeline [S], TOTP 2FA [L]. BullMQ / Cloudflare Queues stays deferred behind the queue interface; the ending worker runs on a 30-second interval from `instrumentation.ts` in the prototype.

### 2.1 Reference data & taxonomies
- [x] County (15) + Parish ref tables with seed import **[M]**
- [x] Tree-species codes (24) and logging types (AR,HL,HR,KR,LR,RD,SR,TR,VE,VR) enums **[M]**

### 2.2 Identity & access collections
- [x] `User` (isikukood encrypted column + hash index, email, phone, status, auth method) **[M]**
- [x] `Profile` (private | company; company fields + `approval_status`), `CompanyAccessRequest` **[M]**
- [x] `AuctionRight` (user × objectType grant, granted_by, revoke) **[M]**
- [x] Session store (short JWT + rotating refresh, httpOnly cookies), session list & revoke **[M]**

### 2.3 Auction & bidding collections
- [x] `Auction` with the **complete field model** — plan §5.4: identity/status (incl. `isQuickAuction`, `endYear`), location (+coordinates, kataster/Metsaregister links), land/forest data (cadastres[], registryNumbers[], species, logging types, compartments, notifications, deadlines), pricing (minBid, bidStep, reservePrice secret, fee override), content (rich text ×2, alias email, media, files), package fields, specialist, seller profile **[M]**
- [x] Status lifecycle field + transitions guard (draft → scheduled → active → ended → appraised/unsold → contract → completed → archived) **[M]**
- [x] `Bid` — append-only; amount, type open|sealed, source manual|autobidder, status set (leading/outbid/won/lost/pending_approval/rejected), `identity_snapshot`, `ip_hash` (salted) **[M]**
- [x] `AutoBidder` (max_amount, status) **[M]**
- [x] `AuctionSubscription` (filter_json, channel, frequency, unsubscribe token) **[M]**

### 2.4 Supporting collections
- [x] `Contract` + `ContractTemplate` (type, version, placeholders, DOCX file) **[M]**
- [x] `Lead` (form_name, page_slug, contact fields, status pipeline, assigned specialist, consent_at, source) **[M]**
- [ ] `ServiceRequest` (type kava|hooldusraie|istutamine, payload, attachments, routed_to[]) + `Partner` directory **[S]**
- [x] `Notification` (user, event, channel, payload, read_at) **[M]**
- [ ] `NewsletterSubscriber` (double opt-in token, group) **[S]**
- [x] `Specialist` (name, slug, role, phone, email, photo, bio, region, active, featured) **[M]**
- [x] CMS: `Page` (block builder blocks: hero/text/cards/accordion/steps/forms/ticker/stats/CTA/testimonials), `Article`, `FAQCategory`/`FAQItem` (teaser, show_until), `Testimonial`, `PartnerService`, `LegalDocument`, `Redirect`, per-page SEO fields **[M]**
- [x] `Settings` singleton (org data, fee % + VAT, anti-snipe defaults, alapakkumine default, sealed revision cap, feature flags) **[M]**
- [x] `AuditEntry` append-only (actor, action, entity, before/after JSON) **[M]**
- [x] `StatisticsSnapshot` (date × objectType: count, area, volume, eur) **[M]**

### 2.5 Auth flows
- [x] Password login (isikukood + password), rate-limit 5/min/IP, neutral errors **[M]**
- [x] **Demo eID simulator** behind provider interface: `POST /api/v1/auth/{smartid|mobileid|idcard}/start|status|complete`; control-code screen; 2s polling; configurable demo isikukoods; Web-eID detection stub **[M]**
- [x] Registration backend: profiles, consents (3 checkboxes w/ timestamps), `POST /api/v1/business/request-access` **[M]**
- [x] Company lookup mock `GET /api/v1/company-lookup?regCode=` (fixtures) **[M]**
- [x] Password reset (2h tokens, single-use, revoke other sessions) + change **[M]**
- [x] Profile selection (session carries active profile; everything profile-scoped) **[M]**
- [ ] TOTP 2FA for company accounts **[L]**

### 2.6 Bidding engine (implementation-critical — plan §5.7)
- [x] `placeBid` service: serializable transaction + row lock on auction; validation chain (authed → active → not ended → objectType right → amount ≥ current+step → contract prerequisites); append-only audit trail **[M]**
- [x] Autobidder evaluation: proxy to minimum needed to lead; tie-break by earlier creation; autobidder-vs-autobidder resolves to (second-max + step) **[M]**
- [x] Anti-sniping: accepted bid within last N min (configurable from Settings; default 5, range 1–30) extends endTime by N; persisted + broadcast **[M]**
- [x] Alapakkumine (under-start bid): allowed when enabled → `pending_seller_approval`; seller approve (becomes leading) / reject (notify bidder); race-guard **[M]**
- [x] Sealed bids: one per user (+ configurable revision cap), amount + identity snapshot **encrypted at rest** until opening; double-submit guard w/ idempotency key **[M]**
- [x] Auction-ending worker (BullMQ / Cloudflare Queues): idempotent `active → ended`, server-authoritative; computes open-auction outcome; fires notifications; writes snapshot **[M]**
- [x] Sealed-opening service: two-person rule (opener + approver tokens, server-verified), one-shot simultaneous decrypt, rank by amount desc / tie earliest, winner-confirm publishes finalPrice + queues contract + notifies losers; unsold/void paths **[M]**
- [x] Contract gate for open bidding: signed framework contract (raamleping) required before first bid **[M]**
- [x] Unit tests: every rule above (step math, ties, anti-snipe boundary, alapakkumine, sealed encryption/decrypt ceremony, idempotent ending) **[M]**

### 2.7 Realtime
- [x] `GET /api/auctions/stream` (SSE): `auction:published`, `auction:extended`, `auction:ended`, `bid:created` **[M]**
- [x] `GET /api/my/stream` (authed shell): `bid`, `outbid`, `auction_end`, `notification`, `countdown_sync`; heartbeat 30s; reconnect w/ backoff + full refetch **[M]**

### 2.8 Notifications, contracts, stats, forms
- [x] Notification service: event bus → per-user channel matrix (email via Mailpit, SMS log stub), templates in `packages/emails` **[M]**
- [ ] Saved-search matcher (new lot vs subscriptions) + daily/weekly digests **[S]** / **[L]** (digests)
- [x] Contract service: template placeholder render (`{{...}}` catalogue), HTML preview + simple PDF, prepare/complete endpoints, mock signing session (15-min expiry), hash audit **[M]**
- [x] Statistics aggregation + public `GET /api/v1/statistics` from snapshots **[M]**
- [x] `POST /api/leads` ingestion: honeypot, rate-limit (IP 5/min), consent required, source tracking **[M]**
- [ ] `POST /api/service-requests` + routing engine (partners by service+county, minimized payload, 14-day signed links) **[S]**
- [ ] `POST /api/newsletter` double opt-in **[S]**
- [ ] Media pipeline: image renditions (1600×1000 / 350×175 / 1200×750), PDF uploads, signed URLs **[S]**

### 2.9 Seed & fixtures
- [x] Seed script: taxonomies, 6 specialists, demo users for every role (guest/private/company-pending/seller/specialist/admin/superadmin) with documented credentials **[M]**
- [x] ~30 demo auctions: all 4 object types × open/sealed × statuses (draft/scheduled/active/ending-soon/ended/sold/unsold/archived) incl. kiiroksjon + package w/ table **[M]**
- [x] Bid history fixtures incl. autobidder duel + pending alapakkumine; sealed bids (encrypted) ready for live opening demo **[M]**
- [x] CMS seed: homepage + service pages + FAQ (7 categories) + 6 articles + specialists + legal docs + contract templates (framework + auction) + leads in all pipeline stages **[M]**
- [x] `pnpm seed:reset` — wipe & reseed for repeatable demos **[M]**

---

## Phase 3 — Auction portal (`oksjonid.*`)

Specs: [design/portal/](design/). Route prefix `/` of the portal area in the prototype.

**Deferrals (accepted in writing):** Register email-token verification (double opt-in) — deferred by user decision; the wizard's eID identify path works. CSV exports in Minu pakkumised **[S]** — deferred with the earlier archived phase-3 change, not reopened. Digest jobs, GDPR export/delete jobs, Web Push, TOTP 2FA — remain **[L]**. Host routing covers only `oksjonid.erametsad.ww0.dev`; `api.erametsad.ww0.dev` / `admin.erametsad.ww0.dev` stay an extension point documented in the middleware mapping table. Register address is collected but not persisted (profiles table has no address column yet — needs a migration). Guest subscription email rides inside `filterJson` (`guestEmail`) — the auction-subscriptions API has no dedicated guest-email field yet. SMS notification toggles are display-only until verified phone numbers exist. Minu müügid stats mini-chart **[S]** — not delivered.

### 3.1 Shells
- [x] Public portal header (tabs → listing, Ajalugu, login/register or profile chip) **[M]**
- [x] Logged-in **Portal Shell** per [09-user-bids.md](design/portal/09-user-bids.md): ShellHeader (search, bell w/ unread badge, profile chip), collapsible sidebar, mobile bottom tab bar, breadcrumbs; mounts `/api/my/stream` **[M]**

### 3.2 Listing — [01-listing.md](design/portal/01-listing.md)
- [x] Type tabs with counters + summary sentence ("Hetkel on aktiivseid … N, kokku X ha … Y m³ ja Z € väärtuses") **[M]**
- [x] Map (always visible above grid, no toggle per 2026-08-31 listing redesign) with pin popups (area/price/registry nr/end) **[M]**
- [x] `FilterPanel` wired to URL params: maakond→vald cascade, puuliigid, raieliigid, pindala/mahu vahemik, hind; "Tühjenda" + active-count **[M]**
- [x] Sorting (alghind/lõpphind asc-desc, varem/hiljem lõppevad) + server-side pagination **[M]**
- [x] "Telli teavitus" saved-search subscription (email + consent, frequency) **[S]**
- [x] SSE wiring: published-lot prepend, extension updates, ended-state flip **[M]**

### 3.3 Lot detail (shared dossier) — [02](design/portal/02-lot-detail-open.md) / [03](design/portal/03-lot-detail-sealed.md)
- [x] Header (name, StatusPill, server-synced Countdown), gallery lightbox **[M]**
- [x] `MapEstonia` pin + external links (ky.kataster.ee, register.metsad.ee) **[M]**
- [x] Full field DataTable (§5.4 dossier: cadastres, species, compartments, deadlines, storage, rental…) + package table for pakett **[M]**
- [x] Rich-text cards (extraInfo/secondaryInfo), file downloads (public media route; signed URLs deferred — see Phase 2 media pipeline [S]), SpecialistCard w/ per-lot alias email **[M]**

### 3.4 Open-auction bidding — [02-lot-detail-open.md](design/portal/02-lot-detail-open.md)
- [x] `BidPanel`: leading bid (authed only), bid input with ± step buttons, confirm Modal, "Teenustasu rakendub vaid võitmise korral" notice **[M]**
- [x] Alapakkumine toggle ("nõuab müüja nõusolekut"), pending chip **[M]**
- [x] Autobidder max-sum create/edit/delete **[M]**
- [x] Raamleping gate: no signed framework → redirect `/lepingud/raamleping?next=…` **[M]**
- [x] Guest / no-rights / not-started / ended panel states **[M]**
- [x] Bid list role-shaped: authed = amounts + "Pakkuja #n" labels + autobid marker; guest = count + timestamps only **[M]**
- [x] Outbid banner + live updates via SSE **[M]**

### 3.5 Sealed-bid page — [03-lot-detail-sealed.md](design/portal/03-lot-detail-sealed.md)
- [x] Explanation card ("Kõik pakkumised avatakse üheaegselt peale lõppemist") **[M]**
- [x] Identity snapshot form (prefilled; isikukood/registrikood validation), amount ≥ minBid, confirm Modal ("siduv") **[M]**
- [x] Submitted-bid locked card; bid count only (no amounts/times anywhere); revision resubmit if enabled **[M]**
- [x] Post-opening states: winner (→ contract), loser ("Ei võitnud"), unsold ("Jäi müümata") **[M]**

### 3.6 Archive — [04-ajalugu.md](design/portal/04-ajalugu.md)
- [x] Tabs per type + archived counters; filters + endYear chips; sort by lõpphind desc default; 24/page **[M]**
- [x] Cards show finalPrice or "Müümata jäi" — never winner identity or bid counts; privacy footer line **[M]**
- [x] Statistics band (all-time totals) **[S]**

### 3.7 Auth pages — [05](design/portal/05-login.md) / [06](design/portal/06-register.md) / [07](design/portal/07-select-profile.md) / [08](design/portal/08-update-password.md)
- [x] Login: 3 eID method cards → demo simulator flow; isikukood+password fallback; `?next=` handling; pending-company + suspended banners **[M]**
- [x] Register wizard (4 steps): eID identify (or email token fallback) → profile type (private / company w/ lookup mock + access request dead-end pending screen) → data + 3 consents → done **[M]**
- [x] `/select-profile` radio cards (rights summary, AKTIIVNE chip, pending greyed, "+ Lisa ettevõtte") **[M]**
- [x] Password set/change/reset with strength meter (min 10, classes, ≠ isikukood); reset revokes sessions **[M]**

### 3.8 Customer area (Minu keskkond)
- [x] **Minu pakkumised** [09](design/portal/09-user-bids.md): tabs Aktiivsed/Lõppenud/Automaatpakkuja; leading/outbid/pending states, countdowns, inline autobidder edit; ended tab w/ result + "Allkirjasta leping" link; CSV export **[S]** (deferred — see deferrals); live outbid toast **[M]**
- [x] **Minu müügid** [10](design/portal/10-user-objects.md): lot table (bid counts, leading price; view counts not implemented — column placeholder), alapakkumine approval banner + drawer queue (approve/reject w/ 409 race handling), bid log (anonymized, autobid marker), relist-request **[M]** (stats mini-chart **[S]**, deferred — see deferrals)
- [x] **Teavitused** [11](design/portal/11-user-notifications.md): cursor-paginated inbox w/ category chips + deep links, mark read; preference matrix (8 events × email/SMS); saved-search cards CRUD + token unsubscribe **[M]** (digest scheduling **[L]**)
- [x] **Minu profiil** [12](design/portal/12-user-profile.md): profile data (isikukood locked when eID-verified), company re-lookup, rights matrix + rights request, password modal, sessions list, consents log **[M]** (GDPR export/delete jobs **[L]**)
- [x] **Lepingute allkirjastamine** [13](design/portal/13-contract-signing.md): full-page Steps flow — raamleping (data → review PDF + read-checkbox → mock eID sign w/ PIN2 control code → complete) and oksjonileping (lot data, deadline countdown; fee display not implemented); contracts list; version-bump no-force-resign logic **[M]**

---

## Phase 4 — Marketing site (`erametsad.ee`)

Specs: [design/00-global-shell.md](design/00-global-shell.md) + [design/marketing/](design/marketing/).

### 4.1 Global shell — [00-global-shell.md](design/00-global-shell.md)
- [ ] Header: sticky 72px (56 mobile), dropdown menus (Metsa müümine 5 sub, KKK + 7 categories, Päringud 3 sub, Meist), external links w/ ↗, CTA "Oksjonikeskkond", active-page underline, skip-link; mobile hamburger → Drawer w/ accordions **[M]**
- [ ] Footer 5 columns (active/history auctions by type, articles, useful links, social) + legal bottom row; accordion on mobile **[M]**
- [ ] `ContactBand` pre-footer (tel:, mailto:, anchor to page's LeadForm) **[M]**
- [ ] `CookieBanner`: non-modal, 3 buttons + granular consent Modal; `POST /api/consent` log; analytics load only after consent **[M]**
- [ ] 404 (photo + simple CMS article search + CTA) and 500 pages **[M]**

### 4.2 Core pages
- [ ] **Avaleht** [01](design/marketing/01-home.md): hero + LeadForm → "Plaanis metsa müük?" band → AuctionTicker → team minis → trust stats (from statistics API, hide-on-failure) → 3-col process → latest articles → newsletter → testimonials → closing LeadForm **[M]**
- [ ] **Raieõiguse müük** [02](design/marketing/02-teenused-raieoiguse-muuk.md) & **Kinnistu müük** [03](design/marketing/03-teenused-kinnistu-muuk.md): hero + dual CTA → LeadForm → 9-step accordion grouped Eeltöö/Oksjon/Tulemus with `#anchors` → fee & liability cards (3%+km, 0 € if unsold) → buyer-vetting block; kinnistu adds sealed-bid explainer (SVG diagram + comparison table) + pakettoksjonid band **[M]**
- [ ] **Metsa hindamine** [04](design/marketing/04-teenused-metsa-hindamine.md): SEO-article **template** (hero → ticker → LeadForm → article w/ sticky TOC → CTA band → LeadForm) — build once, instantiate **[M]**; ~20 long-tail instances **[L]**
- [ ] **Metsateatis** [05](design/marketing/05-metsateatis.md): screenshot Steps tutorial + lightbox, sidebar links, sticky LeadForm, HowTo JSON-LD **[S]**
- [ ] **Hindamisaktid** [06](design/marketing/06-hindamisaktid.md): sticky numbered side-nav, 5 sections, price from €480 + km, mailto ordering **[S]**
- [ ] **Kiiroksjon** [07](design/marketing/07-kiiroksjon.md): dark hero "48 H", 5-step process w/ emphasized house-backup step, benefit + suitability checklists, 2 LeadForms **[S]**
- [ ] **KKK** [08](design/marketing/08-kkk.md): hub + 7 category pages, chip nav, SearchableAccordion, FAQPage JSON-LD **[M]**
- [ ] **Päringud** [09](design/marketing/09-paringud-hub.md)–[12](design/marketing/12-paringud-metsa-istutamine.md): hub + 3 request forms — multi-cadastral input, county select, service checkbox groups (≥1), file upload (hooldusraie), localStorage drafts (24h, no consent persisted), duplicate throttle, routed-count success state **[S]**
- [ ] **Meist** [13](design/marketing/13-meist.md) + **Metsaspetsialistid** [14](design/marketing/14-meist-metsaspetsialistid.md): company card from Settings, CEO quote, 6 SpecialistCards w/ direct contacts; profile template (bio, specialist's active lots, articles, prefilled LeadForm) **[M]**
- [ ] **Artiklid** [15](design/marketing/15-artiklid.md): hub (chip nav, featured, 9/page pagination, newsletter) + article template (author link, TOC, CMS CTA band, related) **[M]**
- [ ] **Lepingud** [16](design/marketing/16-lepingud.md): versioned document list, no email gate, version-notification signup **[S]**
- [ ] **Kontakt** [17](design/marketing/17-kontakt.md): company card, direct phones, 3 specialists, full LeadForm, map block w/ static fallback **[M]**

### 4.3 Site-wide
- [ ] Metadata per page (title/desc/OG/canonical), `sitemap.xml`, `robots.txt`, Organization/Service/Breadcrumb JSON-LD **[M]**
- [ ] ISR caching tiers: content 1h, ticker 60s, statistics 24h **[M]**
- [ ] Analytics event skeleton (consent-gated, server-logged) **[S]**

---

## Phase 5 — Admin backend (`admin.*`)

Specs: [design/admin/](design/admin/). Roles: specialist (own lots/leads), seller (own lots, alapakkumine decisions), admin, superadmin — matrix in [13-settings §Rollid](design/admin/13-settings.md).

### 5.1 Shell & navigation — [01-dashboard.md](design/admin/01-dashboard.md)
- [ ] AdminShell: 56px icon sidebar (13 modules), topbar w/ env badge, notification bell; role-gated module visibility **[M]** (⌘K search **[S]**, impersonation banner **[L]**)

### 5.2 Auction management
- [ ] **Auctions list** [02](design/admin/02-auctions-list.md): type tabs w/ counts, URL-shareable filters (status, specialist, county, date range, freetext incl. cadastre), DataTable 25/page w/ countdown column, row actions: end-manually (reason modal + outcome), archive, re-list/clone, bulk schedule **[M]** (bulk **[S]**, CSV export **[S]**)
- [ ] **Auction editor** [03](design/admin/03-auction-editor.md) — 7-step wizard: 1 Tüüp & mehaanika (sealed forced for property/field/package; kiiroksjon → 48h + €1 + secret reserve; anti-snipe toggle; TZ Europe/Tallinn time validation) → 2 Asukoht (county→parish cascade, map pin picker, auto links) → 3 Maa & mets (cadastral repeater w/ regex, species, logging types, deadlines) → 4 Hind (minBid, bidStep, write-only masked reserve, fee override admin-only) → 5 Sisu (name, alias email, rich text ×2, hero+gallery, PDFs) → 6 Pakett (table editor + CSV paste) → 7 Ülevaade (validation gate, guest preview token) **[M]** (autosave + concurrent-edit banner **[S]**, publish diff **[L]**)
- [ ] Media upload pipeline inside editor (renditions, alt-text required) **[M]**

### 5.3 Bids & sealed opening
- [ ] **Bid monitoring** [04](design/admin/04-bids-monitoring.md): header countdown + leading bid; SSE live feed (newest first, source chip manual/auto, statuses); global + per-auction alapakkumine queue w/ SLA badges and approve/reject (reason); identity reveal chip — every reveal audit-logged; anti-snipe extension log; reconnect + `?since=` backfill **[M]** (anomaly flags **[L]**, CSV **[S]**)
- [ ] **Sealed opening ceremony** [05](design/admin/05-sealed-opening.md): precondition checklist (ending worker ran, no pending alapakkumised, template active) → dual signatures (typed keyword "AVAN", 30-min validity, page locked to two sessions) → one-shot simultaneous reveal ranked desc (tie = earliest, invalid greyed) → winner confirm vs reserve (sold / unsold / kiiroksjon house-backup superadmin path) / void path; step-up re-auth; full audit chain **[M]**

### 5.4 Users & companies
- [ ] **Users & rights** [06](design/admin/06-users.md): search (isikukood/email/regcode), masked isikukood reveal (logged), detail tabs; per-objectType rights matrix grant/revoke w/ mandatory reason + notify; suspend **[M]** (ban, force-logout, impersonation, GDPR tools **[L]**)
- [ ] **Company approvals** [07](design/admin/07-company-approvals.md): request cards w/ registry panel (mock), board-member cross-check, duplicate-regcode warning; approve (activates + default-rights checkboxes), reject (reason), hold; history tab **[M]**

### 5.5 Contracts, CRM, requests
- [ ] **Contracts & templates** [08](design/admin/08-contracts.md): contracts table (status prepared→sent→signed→voided, stuck ambers), PDF view, container download (logged), resend/void w/ reason; templates tab: DOCX upload w/ placeholder validation, version lifecycle (one active per type), test-render drawer **[M]** (generation queue UI **[S]**)
- [ ] **Leads CRM** [09](design/admin/09-leads-crm.md): Kanban (Uus → Võetud ühendust → Kvalifitseeritud → Leping → Mittekvalifitseeritud) w/ DnD + exit guards, SLA badges; detail drawer: source slug, contact links, consent record, assign (round-robin suggestion), notes timeline, next-action reminder **[M]** (CSV export **[S]**, duplicate merge **[L]**)
- [ ] **Service requests routing** [10](design/admin/10-service-requests.md): request table w/ payload viewer, attachments, routing panel (partners by service+county+capacity, pre-select top-3), forward w/ minimized payload + 14-day links, forwarding log; partner directory CRUD **[S]**

### 5.6 Content, stats, settings, audit
- [ ] **CMS** [11](design/admin/11-cms-content.md): **decision for prototype — use Payload's native admin panel** (access-gated) for all CMS collections; custom block-builder UI, menu builder, redirect manager, media focal-point UI → post-prototype **[L]**; ensure draft/preview/publish + scheduled publishing works via Payload versions **[M]**
- [ ] **Statistics** [12](design/admin/12-statistics.md): **[L]** (public stats endpoint already exists from Phase 2; charts, chloropleth, exports later)
- [ ] **Settings** [13](design/admin/13-settings.md): subset — Üldine (org data), Tasud (fee %, VAT, live sample calc), Oksjonid (anti-snipe defaults, alapakkumine default, sealed revision cap, two-person approver role), Lipud (feature flags); reason-required saves + audit before/after **[S]**
- [ ] **Audit log** [14](design/admin/14-audit-log.md): filterable viewer (actor, action group, entity, date), detail drawer w/ before/after JSON diff **[S]** (Merkle integrity job, retention, exports **[L]**)

---

## Phase 6 — Hardening, testing, demo readiness

### 6.1 Automated tests
- [ ] Unit: bidding engine rules (Phase 2.6 list), validators, sealed encryption, anti-snipe boundary, idempotent ending worker **[M]**
- [ ] API integration: auth flows, role-shaped bid responses, rate limits, honeypot **[M]**
- [ ] Playwright E2E happy paths:
  - [ ] Lead: marketing form → admin CRM pipeline **[M]**
  - [ ] Buyer journey: register → rights granted (admin) → raamleping → manual bid → autobidder duel → anti-snipe extension → win → oksjonileping → completed **[M]**
  - [ ] Sealed journey: two bidders submit → ceremony open → winner/loser notifications → contract **[M]**
  - [ ] Seller journey: my sales → approve alapakkumine **[M]**
  - [ ] Archive & statistics numbers consistent with seed **[S]**

### 6.2 Ops & demo
- [ ] `seed:reset` + demo script doc (who does what, in which order, expected screen states) **[M]**
- [ ] Staging deploy (Cloudflare Pages preview branch, HTTPS, env badges via Workers), smoke test **[M]**
- [ ] Sentry + uptime check **[S]**
- [ ] Error boundaries, skeleton loaders, empty states across portal/admin **[M]**
- [ ] Lighthouse + keyboard-only walkthrough of listing → detail → bid **[S]**
- [ ] Security self-check: rate limits active, honeypots present, sealed bids unreadable in DB dumps, audit entries written, CSP headers **[M]**
- [ ] Spec-compliance sweep: walk every page spec's "States" & "Interactions" sections against the build; file follow-ups **[S]**

---

## Cross-cutting reference checklists

### API surface (build against this — plan §9 + page specs)

| Group | Endpoints |
|---|---|
| Public content | `GET /api/auctions` (+filters/sort/pagination), `GET /api/auctions/:id`, `GET /api/auctions/:id/bids` (role-shaped), `GET /api/v1/counties`, `GET /api/v1/statistics`, `GET /api/pages|articles|faq|specialists|legal-documents` |
| Realtime | `GET /api/auctions/stream`, `GET /api/my/stream` (SSE) |
| Auth | `POST /api/v1/auth/{smartid|mobileid|idcard}/start|status|complete`, `POST /api/v1/auth/login`, forgot/reset password |
| Portal | `GET /api/auctions/with-user-bids`, `POST /api/bids/create`, `GET/POST/PATCH/DELETE /api/auto-bidders`, `POST /api/auction-subscriptions` (+token unsubscribe), `GET/PATCH /api/profiles`, `POST /api/profiles/:id/select`, `POST /api/v1/business/request-access`, `GET /api/v1/company-lookup`, my-area (`/api/my/...`: notifications, rights-requests, sessions, phone verify) |
| Contracts | `POST /api/bids/framework-contract/prepare|complete`, `POST /api/bids/contract/prepare|complete`, `GET /api/contracts` |
| Seller | `GET /api/auctions/my-auctions`, `POST /api/my-auctions/:id/underbids/:bidId/approve|reject`, `.../relist-request`, `.../request-review`, `GET .../stats` |
| Forms | `POST /api/leads`, `POST /api/service-requests`, `POST /api/newsletter`, `POST /api/consent` |
| Admin | auctions CRUD + `:id/status|end-manual|relist|publish|diff`, `bids/:id/approve|reject`, `:id/open-sealed|confirm-winner|void|mark-unsold`, users `:id/rights|suspend|force-logout`, company-access-requests `:id/approve|reject|hold`, contracts + templates, leads + notes, service-requests + partners, collections, settings, audit |

### Background jobs (local: BullMQ / prod: Cloudflare Queues)

| Job | Trigger | Idempotency note |
|---|---|---|
| Auction ending worker | endTime reached (never client-initiated) | idempotency key per auction; safe double-fire |
| Sealed opening completion | admin ceremony confirm | two-token server verification |
| Notification dispatcher | domain events | per-user+event dedupe |
| Saved-search matcher | lot published | digest variant **[L]** |
| Statistics snapshot writer | daily + auction end | date+type unique |
| Contract generation / PDF render | winner confirm | queue status UI **[S]** |
| Account deletion grace-period | user request **[L]** | 14-day cancel |
| Service-request forwarding | admin send **[S]** | per-partner idempotency |

### Roles matrix (enforce in access layer)

| Role | Portal | Admin |
|---|---|---|
| Guest | browse, subscribe by email | — |
| Registered private | bid (with rights), autobidder, my pages | — |
| Registered company | same, after approval | — |
| Seller (metsaomanik) | + Minu müügid, alapakkumine decisions | own lots read-only + underbid decisions |
| Specialist | + own-lot visibility | own lots (create/edit), own leads; no manual-end/export/fee-override |
| Admin | — | all except roles matrix, settings write, audit export |
| Superadmin | — | everything; sealed-opening approver; role assignment |

---

## Open questions affecting the prototype

From plan §14 and page specs — none block the prototype start, but resolve before production:

1. Legal entity data, phones, e-mails, hero photography (placeholders throughout marketing copy).
2. Fee model confirmation (3% + VAT default wired to Settings) and kiiroksjon house-backup capital commitment.
3. eID/signing provider choice (prototype mocks the eID Easy shape; switching cost is contained to one adapter).
4. Leading-bid visibility: specs lean "all authed users" — confirm.
5. Sealed-bid live count display: specs ask; default **show count only**.
6. Buyer-network / specialist account strategy at launch (admin-only lot creation vs specialist accounts day 1).
7. Uhistu subsite scope & PRIA-calendar content ownership (Phase 5).
8. Languages at launch (ET only; i18n scaffolding ready).
9. Anti-sniping default: plan (§5.2) says 5 minutes; admin editor design says default from Settings = 13 minutes. Resolve before production — both paths are implemented, the default is a one‑line Settings value.
10. Payload `@cloudflare/next-on-pages` compatibility: Payload 3 uses Node.js internals (file system, sharp for image resizing). Verify the `nodejs_compat` flag covers all Payload operations, or isolate Payload's admin panel and media API on a separate Worker with Node.js runtime.

---

## Definition of done (prototype)

- [ ] All **[M]** items checked, all **[S]** items explicitly accepted or deferred in writing.
- [ ] The five demo flows (§1.1) run end-to-end on a fresh `seed:reset` without manual DB touching.
- [ ] E2E suites green; unit suites green; typecheck/lint/build clean in CI.
- [ ] Sealed-bid amounts verified unreadable at rest; audit log captures bid/rights/opening/identity-reveal events.
- [ ] Design-system spot-check against `design/README.md` tokens; keyboard navigation works on listing → detail → bid path.
- [ ] Handover doc: demo accounts, seed data inventory, mocked-integration swap-in points, deferred **[S]/[L]** backlog.
