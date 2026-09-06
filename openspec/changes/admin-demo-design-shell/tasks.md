# Tasks: admin-demo-design-shell

## 1. Token infrastructure

- [x] 1.1 Make hardcoded Tailwind theme keys var-based with root defaults matching today's rendering: borderRadius card/button/input, fontSize h4/body/bodySm/label/count (with line-height companions), maxWidth container-xl, spacing 2xs-lg; add the root values to packages/ui tokens.css (note: root --radius-card becomes 14px, today's rendered value, resolving the 8px contradiction) <!-- agent: fullstack-engineer.build, depends_on: [], touches: [apps/platform/tailwind.config.ts, packages/ui/src/styles/tokens.css] -->
- [x] 1.2 Add the admin token scope: create apps/platform/src/app/(admin)/admin.css with the demo :root overrides (density scale, 8px radii, 1400px container, status triads, tints, shadows, rail/topbar dims), import it from the (admin) layout, and render the scope class on the AdminShell root element <!-- agent: fullstack-engineer.build, depends_on: [1.1], touches: [apps/platform/src/app/(admin)/admin.css, apps/platform/src/app/(admin)/layout.tsx, apps/platform/src/app/(admin)/_components/AdminShell.tsx] -->

## 2. Shell restyle

- [x] 2.1 Restyle the rail to the demo: white surface bg, right border, mist logo chip with primary icon; drop the primaryDark/white-10 treatment <!-- agent: fullstack-engineer.build, depends_on: [1.2], touches: [apps/platform/src/app/(admin)/_components/AdminShell.tsx] -->
- [x] 2.2 Restyle AdminNav states: muted icons, tint hover, strong-tint active + 3px primary left indicator, dark tooltip badge; restyle the horizontal mobile pills with demo tints <!-- agent: fullstack-engineer.build, depends_on: [1.2], touches: [apps/platform/src/app/(admin)/_components/AdminNav.tsx] -->
- [x] 2.3 Make the topbar sticky 64px with brand title "Erametsad haldus" + semantic env badge (Arendus red, Test amber, prod hidden) and show operator name + role chip inline <!-- agent: fullstack-engineer.build, depends_on: [2.1], touches: [apps/platform/src/app/(admin)/_components/AdminShell.tsx] -->
- [x] 2.4 Add the TopbarSearch stub component (disabled input, Search icon, placeholder "Otsi oksjoneid, kasutajaid, juhtlõimi...", ⌘K kbd badge) and mount it centered in the topbar <!-- agent: fullstack-engineer.fast, depends_on: [2.3], touches: [apps/platform/src/app/(admin)/_components/TopbarSearch.tsx, apps/platform/src/app/(admin)/_components/AdminShell.tsx] -->

## 3. Shared components

- [x] 3.1 Restyle DataTable to demo density: mist header row at label size, 13px/18px body cells, hover row highlight, edge-cell padding <!-- agent: fullstack-engineer.build, depends_on: [1.2], touches: [apps/platform/src/app/(admin)/_components/DataTable.tsx] -->
- [x] 3.2 Restyle PageHeader: breadcrumb line, 28px/34px font-heading 700 title, right-aligned action slot <!-- agent: fullstack-engineer.build, depends_on: [1.2], touches: [apps/platform/src/app/(admin)/_components/PageHeader.tsx] -->
- [x] 3.3 Restyle FormField and ErrorNotice to the admin token scale (label 12px, input radius/border, danger banner styling) <!-- agent: fullstack-engineer.build, depends_on: [1.2], touches: [apps/platform/src/app/(admin)/_components/FormField.tsx, apps/platform/src/app/(admin)/_components/ErrorNotice.tsx] -->
- [x] 3.4 Create shared StatusChip with the demo triads (mustand, ajastatud, aktiivne, lõppenud, müümata outline, leping, arhiivis) and adopt it in the auctions list and bids list <!-- agent: fullstack-engineer.build, depends_on: [1.2], touches: [apps/platform/src/app/(admin)/_components/StatusChip.tsx, apps/platform/src/app/(admin)/admin/auctions/page.tsx, apps/platform/src/app/(admin)/admin/bids/page.tsx] -->

## 4. Verification

- [x] 4.1 Visual regression: capture before/after screenshots of a marketing page and a portal page (must be identical) and of the admin dashboard plus auctions list (compare against docs/design/demo/admin/01-dashboard.html and 02-auctions-list.html); fix any fixed-height clipping or stacking issues the density change exposes <!-- agent: fullstack-engineer.fast, depends_on: [2.4, 3.1, 3.2, 3.3, 3.4], touches: [] -->
- [x] 4.2 Run lint, typecheck, build, and vitest across the workspace and fix findings <!-- agent: fullstack-engineer.fast, depends_on: [4.1], touches: [] -->
