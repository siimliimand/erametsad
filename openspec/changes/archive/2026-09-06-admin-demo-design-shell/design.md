# Design: admin-demo-design-shell

## Context

Three layers define the admin design: `docs/design/admin/ADMIN-DESIGN-SPEC.md`
(canonical spec), `docs/design/admin/01-14-*.md` (per-screen specs), and
`docs/design/demo/admin/*.html` (pixel-real prototypes). The deployed admin at
`apps/platform/src/app/(admin)/` follows the same information architecture but
renders with marketing-scale tokens and a dark rail.

`packages/ui/src/styles/tokens.css` serves marketing, portal, and admin at
once. The Tailwind config maps colors to these vars but hardcodes radii, text
sizes, spacing, and container widths. The demo admin uses a denser scale than
the marketing design.

## Goals

- Admin renders like the demo at shell and shared-component level.
- Public marketing/portal rendering stays pixel-identical.
- One Tailwind config; no forked admin theme.

## Decisions

### D1: Cascade-scoped tokens (chosen)

The `(admin)` shell renders a scope class; `apps/platform/src/app/(admin)/admin.css`
redefines the CSS variables inside that scope. Tailwind utilities already
resolve colors through vars (`bg-bgPage` → `var(--color-bg-page)`), so colors
restyle with zero component edits.

Alternatives rejected:

- *Change shared tokens globally*: shifts marketing/portal rendering. The
  user explicitly keeps the public design separate.
- *Forked admin Tailwind theme/preset*: two configs drift; the cascade does
  the same job with one config.

### D2: Var indirection for hardcoded Tailwind keys

Keys the admin needs to override are switched to var references. Root
defaults in `tokens.css` equal today's rendered values, so public output is
unchanged:

| Key | Today (hardcoded) | Root default (new) | Admin scope |
|---|---|---|---|
| `borderRadius.card` | `14px` | `14px`¹ | `8px` |
| `borderRadius.button` | `10px` | `10px` | `8px` |
| `borderRadius.input` | `10px` | `10px` | `8px` |
| `fontSize.h4` | `18px/1.35` | `18px/1.35` | `16px/22px` (demo H3) |
| `fontSize.body` | `16px/1.6` | `16px/1.6` | `14px/20px` |
| `fontSize.bodySm` | `14px/1.5` | `14px/1.5` | `14px/20px` |
| `fontSize.label` | `13px/1.4` | `13px/1.4` | `12px/16px` |
| `fontSize.count` | `32px/1.1` | `32px/1.1` | `32px/36px` (KPI) |
| `maxWidth.container-xl` | `1280px` | `1280px` | `1400px` |
| `spacing.md` | `24px` | `24px` | `16px` |
| `spacing.lg` | `40px` | `40px` | `24px` |

¹ `tokens.css` already declares `--radius-card: 8px` while the config renders
`14px` — a latent contradiction. The root default becomes `14px` (today's
actual rendering) and the contradiction is resolved in favor of the rendered
truth. Marketing keeps rendering 14px.

New var names follow the existing pattern: `--radius-card`, `--font-size-h4`
(with `--line-height-*` companions where the config carries line heights),
`--space-md`, `--layout-container-xl`.

`PageHeader` sets its 28px/34px demo page title directly (it is an
admin-only component); the marketing `text-h1` (48px) is never used in admin
and needs no indirection.

### D3: Admin token values

`admin.css` copies the demo `:root` block (`docs/design/demo/admin/index.html`
lines 14–43), translated onto the shared var names: density scale above,
status triads (`--st-*` per status: text, bg, dot), tints
(`--tint-primary`, `--tint-primary-strong`), `--glow-active`, rail/topbar
dimensions, and the demo card/hover/pop shadows. Status color pairs from the
spec §1.2 status palette:

| Status | Text | Background | Dot |
|---|---|---|---|
| mustand | `#414844` | `#EBEBEB` | `#6B7570` |
| ajastatud | `#1F4E79` | `#E9F1F7` | `#2D6FA8` |
| aktiivne | `#1B6338` | `#E8F6ED` | `#2E9E5B` |
| lõppenud | `#8F590A` | `#FEF5E7` | `#F2A93B` |
| müümata | `#B3261E` | transparent | — (outline border) |
| leping | `#236B3B` | `#EBF7F0` | `#58B368` |
| arhiivis | `#414844` | `#ECEEEB` | `#6B7570` |

### D4: Shell restyle mapping

- Rail (`AdminShell` aside): `bg-bgPage` (white surface), right border
  `--color-border`, logo chip on `--color-bg-mist` with primary icon. Replaces
  `bg-primaryDark` + white/10 tints.
- `AdminNav` vertical: item text `text-inkMuted`; hover `--tint-primary` +
  `text-primary`; active `--tint-primary-strong` + `text-primary` + 3px
  primary left indicator (replaces the white indicator); tooltip keeps the
  dark badge styling. Horizontal mobile pills keep pill shape, adopt demo
  tints.
- Topbar: `sticky top-0 z-90 h-16 bg-bgPage border-b border-border`; left
  brand title "Erametsad haldus" (font-heading 600 15px) + env badge; right
  bell + operator name + role chip (primary-light bg, primary text) + user
  menu. Env badge colors: Arendus → danger red style, Test → amber
  (`--st-ended` pair); prod stays hidden.
- Search stub: new `TopbarSearch` client-free presentational component —
  disabled input, `Search` icon, placeholder "Otsi oksjoneid, kasutajaid,
  juhtlõimi...", `⌘K` kbd badge. `disabled` + `aria-` labels so it is not a
  dead affordance; real endpoint deferred.
- Container: `max-w-container-xl` now resolves to 1400px inside the admin
  scope, 1280px outside.

### D5: StatusChip

New `_components/StatusChip.tsx` (server-compatible, no state): maps auction
status → triad classes from D3 vars, renders dot + label, `müümata` renders
outline style. Adopted first in auctions list and bids list; other screens
migrate when their per-screen walkthrough happens.

## Testing

- Public regression (task 4.1): screenshot a marketing page and a portal page
  before the change lands; after, compare — must be identical. Admin
  dashboard/list screenshots compared against the demo HTML.
- Existing vitest suites must pass untouched (no logic changes expected);
  lint, typecheck, build run at the end.

## Risks

- **Density ripple**: overriding `--space-md/lg` inside the admin scope
  tightens every admin screen at once — intended, but screens with
  hand-tuned px paddings may need spot fixes; catch via screenshots.
- **Fixed-height elements**: components assuming 16px body text may clip at
  14px; sweep during verification.
- **Sticky topbar stacking**: existing dropdowns (user menu z-20, bell
  popover) must render above the sticky header (z-90); the dropdowns live
  inside the header, so stacking context is shared — verify visually.
