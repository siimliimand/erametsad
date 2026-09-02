# Erametsad — Design system

One design spec per page or screen, covering **the marketing site, the auction portal (public and customer area), the admin backend, and the optional association subsite**.

```
docs/design/
├── README.md            ← you are here: shared design system + index
├── 00-global-shell.md   ← header, footer, contact band, cookie banner, error pages
├── marketing/           ← erametsad.ee (public)
├── portal/              ← oksjonid.erametsad.ee (public + logged-in customer pages)
├── admin/               ← admin.erametsad.ee (staff only, role-gated)
└── uhistu/              ← metsauhistu.erametsad.ee (association subsite, Phase 5)
```

Sources: `../ERAMETSAD-PLAN.md` (master plan), `../research/*.md` (reference-site analysis).
⚠️ Reference sites were analyzed for **functionality only** — all Erametsad layouts, copy and brand assets below are original drafts.

---

## Design philosophy

| Principle | What it means in practice |
|---|---|
| **Calm, not cluttered** | Generous white space, breathing room between sections, one clear call to action per block. |
| **Estonian, authentic** | The forest isn't a stock-photo cliché — it's real Estonian woodland. Natural light, unfiltered texture, honest photography. |
| **Trustworthy** | Nothing hidden. Consent checkboxes visible and unchecked. Fees stated upfront. Privacy by design. |
| **Fast** | Server-rendered first paint, progressive enhancement, zero layout shift. |
| **Accessible** | WCAG 2.1 AA from day one — the reference competitor doesn't bother, but institutional and public-sector buyers notice. |

---

## Brand foundation

### Colour palette

The system is rooted in the Estonian forest — spruce green, fresh moss, dark soil, golden birch.

| Token | Value | Swatch | Role |
|---|---|---|---|
| `--primary` | `#2E6B4F` | ████ | Primary buttons, links, accents, active states |
| `--primary-hover` | `#25573F` | ████ | Hover/pressed states of primary elements |
| `--primary-dark` | `#16382A` | ████ | Hero overlays, footer background, section headings |
| `--primary-light` | `#E9F0EC` | ████ | Subtle section backgrounds, info banners, selected states |
| `--accent` | `#58B368` | ████ | Success states, highlights, active indicators, fresh-growth green |
| `--cta` | `#F2A93B` | ████ | Main CTA buttons, price highlights, important notices |
| `--cta-hover` | `#D98F1F` | ████ | Hover/pressed CTA states |
| `--ink` | `#1B211D` | ████ | Body text, headings (off-black, not pure black — softer on eyes) |
| `--ink-muted` | `#6B7570` | ████ | Secondary text, captions, metadata, ended/archived states |
| `--ink-inverse` | `#FFFFFF` | ████ | Text on dark backgrounds |
| `--bg-page` | `#FFFFFF` | ████ | Default page background |
| `--bg-mist` | `#F1F5F2` | ████ | Alternating section backgrounds, card backgrounds |
| `--border` | `#E3E7E4` | ████ | Field borders, dividers, subtle separators |
| `--danger` | `#B3261E` | ████ | Errors, destructive actions, critical alerts |
| `--danger-light` | `#FBEAE9` | ████ | Error backgrounds, inline validation |
| `--info` | `#2D6FA8` | ████ | Information banners, help tips |
| `--info-light` | `#E9F1F7` | ████ | Info backgrounds |

**Status colours** (auction pills, badges):
- Active: `#2E9E5B`
- Ending soon (< 1 h): `--cta` (#F2A93B)
- Critical (< 5 min): `--danger` (#B3261E)
- Ended / archived: `#6B7570`
- Draft: `#9E9E9E`
- Scheduled: `--info` (#2D6FA8)

### Typography

| Role | Family | Weights | Notes |
|---|---|---|---|
| Headings | **Manrope** (sans-serif) | 700, 800 | Geometric, warm and highly legible at large sizes — a clean, modern display face. Serves H1–H4 across all sites. |
| Body & UI | **Inter** (sans-serif) | 400, 500, 600 | Clean, highly readable, excellent Estonian diacritic support. All body text, labels, inputs, tables, admin. |
| Mono | **JetBrains Mono** | 400, 500 | Price figures, countdowns, data tables (CSS `font-feature-settings: "tnum"` for tabular numbers). |

**Type scale:**
| Step | Size / line-height | Use |
|---|---|---|
| H1 | 3rem/1.15 (48px) | Marketing page heros |
| H2 | 2.25rem/1.2 (36px) | Section headings |
| H3 | 1.5rem/1.25 (24px) | Card titles, sub-headings |
| H4 | 1.125rem/1.35 (18px) | Minor headings |
| Body | 1rem/1.6 (16px) | Paragraphs, list items |
| Body-sm | 0.875rem/1.5 (14px) | Captions, metadata, footer |
| Label | 0.8125rem/1.4 (13px) | Form labels, table headers, badges |
| Count | 2rem/1.1 (32px) | KPI numbers, statistics, timer digits |

**Manrope heading weight rules:**
- H1: 800 (ExtraBold)
- H2: 700 (Bold)
- H3: 700 (Bold)
- H4: 700 (Bold) — `letter-spacing: 0.02em` for clarity at small sizes

### Spacing & rhythm

| Token | Value | Use |
|---|---|---|
| `--space-2xs` | 4px | Tight icon gaps, badge padding |
| `--space-xs` | 8px | Field gaps, icon-text spacing |
| `--space-sm` | 12px | Compact card padding, chip gaps |
| `--space-md` | 24px | Standard card padding, section gap |
| `--space-lg` | 40px | Section padding (mobile) |
| `--space-xl` | 64px | Section padding (desktop) |
| `--space-2xl` | 96px | Major section separation |
| `--space-3xl` | 128px | Hero-to-content transition |

**Vertical rhythm:** sections alternate between `--space-xl` (96px) and `--space-2xl` (128px) on desktop. On mobile (≤768px), all drop one level: 64px and 80px.

### Layout

| Property | Value |
|---|---|
| Grid | 12-column, CSS Grid |
| Max container | 1280px (`--container-max`) |
| Gutters | 24px (`--gutter`) |
| Content (narrow) | 720px (for long-form articles, FAQ answers) |
| Content (standard) | 1280px (for listings, grids, forms) |
| Sidebar | 280px (filters, admin nav) |
| Radius | 14px (cards), 10px (buttons, inputs), 16px (hero images, modals), 999px (pills) |
| Shadows | Cards: `0 2px 12px rgba(22,56,42,.08)`; hover: `0 2px 8px rgba(22,56,42,.12), 0 8px 24px rgba(22,56,42,.08)`; modals: `0 4px 16px rgba(22,56,42,.12), 0 16px 48px rgba(22,56,42,.10)` |

### Motion

Erametsad is calm, not frantic. Transitions are subtle and purposeful.

| Context | Duration | Easing | Notes |
|---|---|---|---|
| Hover states | 150ms | `ease-out` | Background, border, shadow transitions |
| Element reveal | 300ms | `cubic-bezier(.22,.61,.36,1)` | Cards, sections appearing on scroll (Intersection Observer) |
| Dropdown / expand | 200ms | `cubic-bezier(.4,0,.2,1)` | Menu dropdowns, accordion opens |
| Modal entry | 200ms | `cubic-bezier(0,0,.2,1)` | Fade + scale(0.96→1) |
| Toast entry | 300ms | `cubic-bezier(.22,.61,.36,1)` | Slide up from bottom |
| Page transition | 250ms | `cubic-bezier(.4,0,.2,1)` | Fade between routes (SPA only) |
| Countdown `< 1h` | 80ms | `ease` (pulse) | Amber pulse on timer digits |
| Anti-snipe extension | 500ms | `cubic-bezier(.22,.61,.36,1)` | Countdown visually extends, row flashes green |

**Principles:**
- No motion for motion's sake. Every animation earns its place.
- Respect `prefers-reduced-motion` — all animations disabled or reduced to 0ms fades.
- Staggered list reveals (cards, articles) have a 50ms delay between items, maximum 6 items staggered.

### Imagery

The photography does more work than the colour palette — it is the brand's emotional anchor.

| Rule | Detail |
|---|---|
| **Subject** | Real Estonian forest — birch and spruce stands, early-morning light, mist, snow, field work, close-ups of bark/needles/moss. No generic stock, no tropical imagery, no urban backdrops. |
| **Aspect ratio** | Hero images: 16:10 (matches landscape photography). Cards: 16:10 (thumbnails), 4:3 (portrait specialist photos). |
| **Treatment** | Hero images carry a gradient overlay: `linear-gradient(90deg, rgba(22,56,42,.85), rgba(22,56,42,.35))` on the left fading to transparent on the right. Section images are clean, no filter, natural colour. |
| **Colour** | Natural, slightly desaturated (−5 saturation), warm white balance. Avoid over-processed HDR looks. |
| **Source** | Client-provided photography preferred. Stock only as fallback — from a curated set of Estonian forestry photographers. |
| **Alt text** | Every image has descriptive alt text in Estonian. No exceptions. |

### Icons

**Lucide React** — clean, consistent, tree-shakeable. Key icons:

| Use | Icon |
|---|---|
| Cutting rights | `TreePine` |
| Property | `MapPinHouse` |
| Field | `Wheat` |
| Package | `Package` |
| Quick auction | `Zap` |
| Filter | `SlidersHorizontal` |
| Map | `Map` |
| Calendar | `Calendar` |
| Search | `Search` |
| Close | `X` |
| Arrow | `ChevronRight`, `ChevronDown` |
| External link | `ExternalLink` |
| Bell | `Bell` |
| User | `User` |
| Download | `Download` |
| PDF | `FileText` |
| Phone | `Phone` |
| Mail | `Mail` |
| Check | `Check`, `CheckCircle` |
| Alert | `AlertTriangle`, `AlertCircle` |
| Info | `Info` |
| Help | `HelpCircle` |
| Timer | `Clock` |
| Bid | `Gavel` |
| Settings | `Settings` |
| Logout | `LogOut` |
| Menu | `Menu` (hamburger) |
| Facebook | `Facebook` (or SVG) |
| Instagram | `Instagram` (or SVG) |
| YouTube | `Youtube` (or SVG) |

---

## Brand voice (Estonian)

The product is in Estonian. The voice should be:

| Trait | Description |
|---|---|
| **Selge** (clear) | Short sentences, no jargon, no marketing fluff. A forest owner with a basic education should understand everything. |
| **Aus** (honest) | Fees stated upfront, no hidden conditions. "Konsultatsioon on tasuta ja kohustusteta" — and it genuinely is. |
| **Asjalik** (matter-of-fact) | Friendly but not chatty. Respectful of the reader's time. |
| **Inimlik** (human) | Real specialists, real names, real phone numbers. The tone should feel like a conversation with a trusted forester, not a corporation. |

**Examples:**
- Heading: "Sinu mets, õigem hind" (not "Maksimeerime teie metsa väärtust läbi innovaatilise oksjoniprotsessi")
- CTA: "Jäta kontakt — helistame homme" (not "Esitage päring meie spetsialistidele")
- Error: "Midagi läks valesti. Proovi uuesti või helista +372 XXXX XXXX" (not "Süsteemi viga K102")

---

## Component library

All components are referenced by page specs using their `<ComponentName>` shorthand. Every component is built once and shared across all three sites.

### Core interactive

| Component | Description |
|---|---|
| `Btn` | Solid primary (green), solid CTA (amber), outline secondary, ghost tertiary. Sizes: `lg` (48px), `md` (40px), `sm` (32px). Full-width on mobile. |
| `Card` | Rounded container with optional shadow, hover lift (2px), image slot, content slot, action slot. |
| `LotCard` | `Card` variant for auction lots: image, name, price, county, area, countdown, status pill. |
| `FilterPanel` | Collapsible sidebar filter panel with chip selects, range sliders, "Tühjenda" and active-count badge. |
| `MapEstonia` | Leaflet map with Maa-amet orthophoto WMS, county GeoJSON outlines, pin clustering, popup cards. |
| `Countdown` | Server-synced countdown timer. Format: "Aega jäänud Xp XXh XXm XXs". Colour phases: neutral → amber (<1h) → red (<5min) with gentle pulse. |
| `StatusPill` | Small badge: Aktiivne / Lõppenud / Kiiroksjon / Mustand / Plaanitud. |
| `BidPanel` | Bidding widget: current lead, bid input with ± step buttons, autobidder toggle, submit, confirm dialog. |
| `DataTable` | Sortable, filterable, paginated table. 40px rows, 13px labels, colour-coded cells. |
| `Accordion` | Single-open, smooth expand, chevron icon. Used for FAQ, process steps, footer on mobile. |
| `Tabs` | Horizontal tab bar with counter badges, underline indicator, responsive overflow into scroll. |
| `Steps` | Numbered vertical or horizontal steps. Used for process explainers and multi-step forms. |
| `EmptyState` | Illustration + heading + description + optional CTA button. |
| `Toast` | Bottom-right notification, auto-dismiss 5s, success/error/info variants. |
| `Modal` | Centred overlay, backdrop click to close, ESC to close, focus trap. |
| `Drawer` | Right-sliding panel, used for mobile nav and mobile filters. |

### Form

| Component | Description |
|---|---|
| `FormInput` | Text input with floating label, inline error, hint text. |
| `FormSelect` | Native select or custom searchable dropdown for long lists. |
| `FormCheck` | Checkbox with visible label, unchecked by default for consent fields. |
| `FormFile` | Drag-and-drop file upload zone, progress bar, accepted filetypes badge. |
| `ConsentCheck` | Visible, unchecked, required GDPR checkbox. Never pre-checked. |
| `LeadForm` | Reusable lead-capture form: name, phone, email, optional cadastre, consent, honeypot. Rendered as a white card. |
| `FormRange` | Min–max range slider with numeric inputs (used for area, volume, price filters). |

### Content

| Component | Description |
|---|---|
| `SpecialistCard` | Photo, name, role, direct phone, direct email, bio. Mini variant (homepage): photo + name + role only. |
| `AuctionTicker` | Horizontal scrollable row of 4 `LotCard`s, with smooth snap scroll. |
| `ContactBand` | Pre‑footer strip: phone (tel: link), email (mailto:), "Jäta enda kontaktid" anchor link to the page's lead form. |
| `CookieBanner` | Bottom-anchored banner, non-modal. Three buttons: accept all, only necessary, customise. Triggers a modal for granular consent. |
| `Testimonial` | Quote block: quotation text, name, county. No star ratings. |
| `ArticleCard` | Date, category chip, title, thumbnail 16:10. |
| `SubsidyCard` | Deadline badge, amount, conditions summary, CTA. |
| `DocumentLink` | PDF icon + filename + file size. |

---

## File template (every page file follows this exactly)

```markdown
# <Page title (Estonian)> — <English name>

> **In brief:** <one plain-language sentence — who lands here and what they can do>

| Area | marketing / portal / admin / uhistu |
|---|---|
| **Route** | URL pattern |
| **Access** | public / authed (which roles) / admin (which roles) |
| **In nav** | where this page is reached from |

## Purpose & user goals
(1–3 sentences: who lands here, what they must achieve)

## Wireframe (desktop)
(ASCII wireframe of the main layout; note mobile collapse below)

## Block-by-block spec
(numbered blocks top→bottom: content, components, behavior)

## Interactions & edge cases
(hover/click/keyboard behaviors, validation, confirmations)

## Data & API
(fields shown, endpoints, realtime updates, caching)

## States
(empty / loading / error / success / no-permission variants)

## Copy (Estonian, draft)
(H1, key labels, CTAs, error messages — draft strings)

## SEO & analytics   ← public pages only
(title/desc pattern, structured data, events)

## Open questions
```

---

## Page index

### 00 Global
- [00-global-shell.md](00-global-shell.md) — Header, footer, contact band, cookie banner, 404/500

### Marketing — `erametsad.ee`

| File | Page | In brief |
|---|---|---|
| [01-home.md](marketing/01-home.md) | Avaleht | The landing page: hero, live auction ticker, trust stats, process, articles, testimonials, lead forms. |
| [02-teenused-raieoiguse-muuk.md](marketing/02-teenused-raieoiguse-muuk.md) | Raieõiguse müük | How cutting-right auctions work. The 9-step process, the fee model, buyer vetting. |
| [03-teenused-kinnistu-muuk.md](marketing/03-teenused-kinnistu-muuk.md) | Kinnistu müük | How property auctions work. Sealed-bid explanation, same 9-step skeleton. |
| [04-teenused-metsa-hindamine.md](marketing/04-teenused-metsa-hindamine.md) | Metsa hindamine | Long-form SEO article: what determines forest value, how to price correctly, pitfalls to avoid. |
| [05-metsateatis.md](marketing/05-metsateatis.md) | Metsateatise juhend | Step-by-step screenshot tutorial of the state portal. |
| [06-hindamisaktid.md](marketing/06-hindamisaktid.md) | Hindamisaktid | Valuation report service: methodology, pricing from €480, how to order. |
| [07-kiiroksjon.md](marketing/07-kiiroksjon.md) | Kiiroksjon | 48-hour quick auction: how it works, benefits, suitability checklist, house backup offer. |
| [08-kkk.md](marketing/08-kkk.md) | KKK | FAQ hub with 7 category pages, chip nav, accordion items. |
| [09-paringud-hub.md](marketing/09-paringud-hub.md) | Päringud hub | Service marketplace: three service cards, each forwarding requests to partner companies. |
| [10-paringud-metsamajanduskava.md](marketing/10-paringud-metsamajanduskava.md) | Kava päring | Management-plan request form. |
| [11-paringud-hooldusraie.md](marketing/11-paringud-hooldusraie.md) | Hooldusraie päring | Tending-cut request form with file upload. |
| [12-paringud-metsa-istutamine.md](marketing/12-paringud-metsa-istutamine.md) | Istutamise päring | Planting request form with service checkboxes. |
| [13-meist.md](marketing/13-meist.md) | Meist | Company block, mission, CEO quote, origin story, lead form. |
| [14-meist-metsaspetsialistid.md](marketing/14-meist-metsaspetsialistid.md) | Metsaspetsialistid | Specialist contact cards + individual profile template. |
| [15-artiklid.md](marketing/15-artiklid.md) | Artiklid | Articles hub (news, customer stories) + article detail template. |
| [16-lepingud.md](marketing/16-lepingud.md) | Lepingud | Contract template downloads. |
| [17-kontakt.md](marketing/17-kontakt.md) | Kontakt | Contact page: company details, map, lead form. |

### Auction portal — `oksjonid.erametsad.ee`

| File | Page | In brief |
|---|---|---|
| [01-listing.md](portal/01-listing.md) | Avaleht: tabs + map + filters | Browse active auctions by type, filter by region/species/price, view on map, subscribe to alerts. |
| [02-lot-detail-open.md](portal/02-lot-detail-open.md) | Avatud oksjon | Open ascending auction: full lot data, bidding panel, autobidder, anti-snipe, bid history. |
| [03-lot-detail-sealed.md](portal/03-lot-detail-sealed.md) | Suletud pakkumine | Sealed-bid auction: single submission form, encrypted until opening. |
| [04-ajalugu.md](portal/04-ajalugu.md) | Oksjonite ajalugu | Archive: past auctions by type, filter by year, sort by final price. |
| [05-login.md](portal/05-login.md) | Logi sisse | Login: Smart-ID, Mobile-ID, ID-card, password fallback. |
| [06-register.md](portal/06-register.md) | Registreerimine | Registration: private profile or company profile with business-registry lookup. |
| [07-select-profile.md](portal/07-select-profile.md) | Profiili valik | Switch between personal and company profiles. |
| [08-update-password.md](portal/08-update-password.md) | Parooli muutmine | Set/reset/change password. |
| [09-user-bids.md](portal/09-user-bids.md) | 🔒 Minu pakkumised | My bids: active, leading, outbid, past — with autobidder management. |
| [10-user-objects.md](portal/10-user-objects.md) | 🔒 Minu müügid | My sales: seller's lots, view counts, bid counts, under-bid approvals, results. |
| [11-user-notifications.md](portal/11-user-notifications.md) | 🔒 Teavitused | Notification history, preferences, saved searches. |
| [12-user-profile.md](portal/12-user-profile.md) | 🔒 Minu profiil | Profile data, rights, security, GDPR export/delete. |
| [13-contract-signing.md](portal/13-contract-signing.md) | 🔒 Lepingute allkirjastamine | Framework contract and per-auction contract signing via eID. |

### Admin — `admin.erametsad.ee`

| File | Screen | In brief |
|---|---|---|
| [01-dashboard.md](admin/01-dashboard.md) | Töölaud | KPI cards, auctions ending today, action queues, system health, recent leads. |
| [02-auctions-list.md](admin/02-auctions-list.md) | Oksjonid | Auction list with filters, quick actions, status management. |
| [03-auction-editor.md](admin/03-auction-editor.md) | Oksjoni koostamine | Full auction creation wizard with all object-type fields, media uploads, preview. |
| [04-bids-monitoring.md](admin/04-bids-monitoring.md) | Pakkumiste jälgimine | Live bid feeds, under-bid approval queue, anomaly flags. |
| [05-sealed-opening.md](admin/05-sealed-opening.md) | Suletud pakkumiste avamine | Sealed-bid opening ceremony: freeze, reveal, winner confirmation. |
| [06-users.md](admin/06-users.md) | Kasutajad & õigused | User search, bidding-rights grants, company approvals, impersonation. |
| [07-company-approvals.md](admin/07-company-approvals.md) | Ettevõtte taotlused | Company access request queue with approve/reject workflow. |
| [08-contracts.md](admin/08-contracts.md) | Lepingud & mallid | Contract templates, generation queue, signature status tracking. |
| [09-leads-crm.md](admin/09-leads-crm.md) | Juhtlõimed | Lead pipeline: statuses, assignment, notes, export. |
| [10-service-requests.md](admin/10-service-requests.md) | Päringute suunamine | Service-request routing to partner companies, status tracking. |
| [11-cms-content.md](admin/11-cms-content.md) | Sisuhaldus | CMS for pages, articles, FAQ, redirects, SEO fields. |
| [12-statistics.md](admin/12-statistics.md) | Statistika | Auction outcomes, sell-through rates, funnel analytics, export. |
| [13-settings.md](admin/13-settings.md) | Seaded | Fee configuration, anti-snipe defaults, notification templates, maintenance mode. |
| [14-audit-log.md](admin/14-audit-log.md) | Auditlogi | Immutable audit log viewer with filters and export. |

### Association — `metsauhistu.erametsad.ee` (Phase 5)

| File | Page | In brief |
|---|---|---|
| [01-home.md](uhistu/01-home.md) | Avaleht | Association landing: subsidy teaser grid, service chips, join CTA. |
| [02-teenused.md](uhistu/02-teenused.md) | Teenused | Single-page scroll of all 9 services with detailed descriptions. |
| [03-toetused-list.md](uhistu/03-toetused-list.md) | Toetused | Subsidy index with sidebar navigation. |
| [04-toetused-detail.md](uhistu/04-toetused-detail.md) | Toetuse lehekülg | Subsidy program detail: deadline, amounts, eligibility, how to apply, service fee. |
| [05-sertifitseerimine.md](uhistu/05-sertifitseerimine.md) | Sertifitseerimine | PEFC group certification document library. |
| [06-liitu.md](uhistu/06-liitu.md) | Liitu | Join the association: benefits list, free membership, join form. |
| [07-kontakt.md](uhistu/07-kontakt.md) | Kontakt | Staff cards, office locations, contact form. |