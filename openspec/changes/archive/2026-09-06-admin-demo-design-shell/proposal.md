# Proposal: admin-demo-design-shell

## Why

The deployed admin implements the demo's information architecture — 13
role-gated modules, a 56px icon rail, a topbar with env badge, bell, and user
menu — but drifted visually from the approved prototypes in
`docs/design/demo/admin` (the pixel-real HTML implementation of
`docs/design/admin/ADMIN-DESIGN-SPEC.md`). Differences today:

- Rail renders dark green (`primaryDark`) with white icons; the demo and spec
  define a white surface rail with muted icons, tint hover/active states, and
  a 3px primary active indicator.
- Topbar is not sticky, lacks the brand title, the visible operator name +
  role chip, and the global search bar.
- Shared tokens render at marketing density (16px body, 24px `md` spacing,
  14px card radius, 1280px container) instead of the demo's admin density
  (14px body, 13px tables, 16px `md` spacing, 8px radius, 1400px container).
- Status chips lack the demo's semantic text/background/dot triads.

The user confirmed the demo look as the target for the admin. Public
marketing and portal pages use a different design and must stay visually
unchanged.

## What Changes

- **Admin-scoped token layer**: the `(admin)` route group overrides design
  tokens (density scale, radii, container width, status triads, tints,
  shadows) through a scoped CSS variable layer. Values outside the scope keep
  their root defaults. Tailwind theme keys that are currently hardcoded
  (radii, text sizes, container width, spacing) become var-based with root
  defaults matching today's public rendering.
- **White rail**: `AdminShell` aside and `AdminNav` restyled to the demo
  (white surface, right border, tint hover, tint-strong active + 3px primary
  indicator, dark tooltip). Mobile horizontal pill nav restyled to match.
- **Sticky topbar**: 64px sticky header with brand title "Erametsad haldus",
  semantic env badge (DEV red, STAGE amber, prod hidden), operator name +
  role chip visible, notification bell, and a stubbed global search bar
  (visual only, ⌘K hint, no backend).
- **Shared component restyle**: `DataTable`, `PageHeader`, `FormField`,
  `ErrorNotice` adopt demo density; new shared `StatusChip` with the demo's
  per-status triads, adopted by the auctions and bids lists.
- **Public regression guard**: before/after screenshots of a marketing and a
  portal page must be identical.

## Non-goals (deferred)

- Per-screen walkthrough of the 14 demo screens (KPI strips, live tables,
  ceremony view, kanban) — later change(s).
- Working global search endpoint and ⌘K wiring — stub only.
- Impersonation warning banner.
- Live rail badge pills (pending company approvals, sealed bids awaiting
  opening).
- Dark rail variant — rejected; demo and spec both define the white rail.

## Impact

- **Specs**: `admin-shell` (MODIFIED AdminShell chrome, ADDED admin-scoped
  design tokens), `admin-ui` (ADDED demo density for shared components,
  ADDED status chip triads).
- **Code**: `apps/platform/tailwind.config.ts`,
  `packages/ui/src/styles/tokens.css` (root defaults only),
  `apps/platform/src/app/(admin)/**` shell and shared components. No data
  layer, API, or auth changes.
- **Risk**: the var-indirection step touches shared config; public pages are
  protected by keeping root defaults equal to today's rendered values and by
  the screenshot regression check.
