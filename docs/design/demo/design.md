# Erametsad — Global design tokens

Extracted from `docs/design/README.md` — colors, type, spacing, layout, motion, imagery, icons only.

---

## Colour palette

The system is rooted in the Estonian forest — spruce green, fresh moss, dark soil, golden birch.

| Token | Value | Role |
|---|---|---|
| `--primary` | `#2E6B4F` | Primary buttons, links, accents, active states |
| `--primary-hover` | `#25573F` | Hover/pressed states of primary elements |
| `--primary-dark` | `#16382A` | Hero overlays, footer background, section headings |
| `--primary-light` | `#E9F0EC` | Subtle section backgrounds, info banners, selected states |
| `--accent` | `#58B368` | Success states, highlights, active indicators, fresh-growth green |
| `--cta` | `#F2A93B` | Main CTA buttons, price highlights, important notices |
| `--cta-hover` | `#D98F1F` | Hover/pressed CTA states |
| `--ink` | `#1B211D` | Body text, headings (off-black — softer on eyes) |
| `--ink-muted` | `#6B7570` | Secondary text, captions, metadata, ended/archived states |
| `--ink-inverse` | `#FFFFFF` | Text on dark backgrounds |
| `--bg-page` | `#FFFFFF` | Default page background |
| `--bg-mist` | `#F1F5F2` | Alternating section backgrounds, card backgrounds |
| `--border` | `#E3E7E4` | Field borders, dividers, subtle separators |
| `--danger` | `#B3261E` | Errors, destructive actions, critical alerts |
| `--danger-light` | `#FBEAE9` | Error backgrounds, inline validation |
| `--info` | `#2D6FA8` | Information banners, help tips |
| `--info-light` | `#E9F1F7` | Info backgrounds |

**Status colours** (auction pills, badges):

- Active: `#2E9E5B`
- Ending soon (< 1 h): `--cta` (#F2A93B)
- Critical (< 5 min): `--danger` (#B3261E)
- Ended / archived: `#6B7570`
- Draft: `#9E9E9E`
- Scheduled: `--info` (#2D6FA8)

---

## Typography

| Role | Family | Weights | Notes |
|---|---|---|---|
| Headings | **Manrope** (sans-serif) | 700, 800 | Geometric, warm, highly legible at large sizes. H1–H4 across all sites. |
| Body & UI | **Inter** (sans-serif) | 400, 500, 600 | All body text, labels, inputs, tables, admin. Excellent Estonian diacritic support. |
| Mono | **JetBrains Mono** | 400, 500 | Price figures, countdowns, data tables (`font-feature-settings: "tnum"`). |

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
- H4: 700 (Bold) — `letter-spacing: 0.02em`

---

## Spacing & rhythm

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

**Vertical rhythm:** sections alternate between `--space-xl` and `--space-2xl` on desktop. On mobile (≤768px) all drop one level: 64px and 80px.

---

## Layout

| Property | Value |
|---|---|
| Grid | 12-column, CSS Grid |
| Max container | 1280px (`--container-max`) |
| Gutters | 24px (`--gutter`) |
| Content (narrow) | 720px (long-form articles, FAQ answers) |
| Content (standard) | 1280px (listings, grids, forms) |
| Sidebar | 280px (filters, admin nav) |
| Radius | 14px cards · 10px buttons/inputs · 16px hero images/modals · 999px pills |
| Shadows | Cards: `0 2px 12px rgba(22,56,42,.08)` · Hover: `0 2px 8px rgba(22,56,42,.12), 0 8px 24px rgba(22,56,42,.08)` · Modals: `0 4px 16px rgba(22,56,42,.12), 0 16px 48px rgba(22,56,42,.10)` |

---

## Motion

Calm, not frantic. Transitions are subtle and purposeful.

| Context | Duration | Easing | Notes |
|---|---|---|---|
| Hover states | 150ms | `ease-out` | Background, border, shadow |
| Element reveal | 300ms | `cubic-bezier(.22,.61,.36,1)` | Cards/sections on scroll (Intersection Observer) |
| Dropdown / expand | 200ms | `cubic-bezier(.4,0,.2,1)` | Menus, accordions |
| Modal entry | 200ms | `cubic-bezier(0,0,.2,1)` | Fade + scale(0.96→1) |
| Toast entry | 300ms | `cubic-bezier(.22,.61,.36,1)` | Slide up from bottom |
| Page transition | 250ms | `cubic-bezier(.4,0,.2,1)` | Fade between routes (SPA only) |
| Countdown < 1h | 80ms | `ease` (pulse) | Amber pulse on timer digits |
| Anti-snipe extension | 500ms | `cubic-bezier(.22,.61,.36,1)` | Countdown extends, row flashes green |

**Principles:**

- No motion for motion's sake — every animation earns its place.
- Respect `prefers-reduced-motion` — animations disabled or reduced to 0ms fades.
- Staggered list reveals: 50ms delay between items, max 6 items staggered.

---

## Imagery

| Rule | Detail |
|---|---|
| **Subject** | Real Estonian forest — birch/spruce stands, morning light, mist, snow, field work, bark/needle/moss close-ups. No generic stock, no tropical, no urban. |
| **Aspect ratio** | Heroes: 16:10. Cards: 16:10 (thumbnails), 4:3 (portrait specialist photos). |
| **Treatment** | Hero gradient overlay: `linear-gradient(90deg, rgba(22,56,42,.85), rgba(22,56,42,.35))` left→transparent right. Section images clean, no filter. |
| **Colour** | Natural, slightly desaturated (−5 saturation), warm white balance. No over-processed HDR. |
| **Source** | Client photography preferred; curated Estonian forestry photographers as fallback. |
| **Alt text** | Descriptive Estonian alt text on every image. No exceptions. |

---

## Icons

**Lucide React** — clean, consistent, tree-shakeable.

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
| Menu | `Menu` |
| Facebook | `Facebook` (or SVG) |
| Instagram | `Instagram` (or SVG) |
| YouTube | `Youtube` (or SVG) |
