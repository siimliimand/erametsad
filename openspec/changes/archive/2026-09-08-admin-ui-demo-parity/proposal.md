## Why

The admin backend is functionally complete but visually and interactively
behind the approved demo prototypes in `docs/design/demo/admin/` (14 pages,
generated from `docs/design/admin/ADMIN-DESIGN-SPEC.md`). Direct inspection of
both sides confirms:

- The shared chrome (56px rail, topbar, tokens) is already ported to
  `admin.css` and `AdminShell`; the gap is inside the pages.
- The real workspace is 4 plain stat cards; the demo has 7 KPI cards, a live
  ending-today table, system health, action queues, and recent leads.
- 6 navigation targets 404 (`sealed-opening`, `companies`, `inquiries`,
  `statistics`, `settings`, `notifications`), even though the module registry,
  the role system, and the demo all reference them.
- Three modal implementations and two status-pill systems coexist; the demo
  uses one consistent overlay pattern.
- High-security actions the audit registry already anticipates
  (`user.impersonate`, `user.ban`, `user.gdpr_export`, `user.gdpr_delete`,
  `maintenance.start`, `settings.key_reveal`, `audit.export`) have no UI or no
  backend at all.
- The statistics module has a nav entry and a permission but no page; the CMS
  has no block builder; the audit log has no tamper-evident chain.

The demo is the source of truth for design. Where demo and spec disagree
(statistics funnel, settings sections, audit column set), the demo wins and
the deviation is recorded.

## What Changes

- **Shared primitives**: one `Modal` (480/720), one `Drawer`
  (460/560/680/720, full-width on mobile), a `ToastProvider` +
  `ConfirmDialog` (reason-min-5 and typed-keyword variants), `Switch`,
  `TabBar`, `FilterChip`, `EmptyRow`, `KpiCard` under
  `(admin)/_components/ui/`. Demo quirks are normalized: one button radius,
  one toast position (bottom), one drawer scale with size props.
- **Status pills unified**: `StatusChip` absorbs `StatusPill` and gains the
  full demo variant set (auction triads, user states, contract glyphs,
  lead/content variants).
- **Navigation repaired**: real pages at all 13 module hrefs; companies,
  inquiries, and settings move to their registry paths with redirects;
  new sealed-opening index and notifications list; rail badges (amber dot,
  red count); ⌘K route-jump palette in the topbar search.
- **Workspace rebuilt** to the demo: 7 KPI cards with alerts and sparkline,
  live ending-today table with countdowns, system health, action queues,
  recent leads, all fed by a new `_lib/workspace.ts` aggregation layer.
- **Auctions parity**: column chooser, selection tint, tab-count inversion,
  global ⌘N. Wizard gets the demo editor bar, step-rail status marks
  (✓/●/○/—, "N puudust"), and client draft autosave with restore prompt.
- **Bid monitor**: demo monitor-head strip, autobidder duel collapse,
  audited bidder reveal chips in the feed, anomalies panel (new-account
  burst, rapid overtake heuristics + internal-review flag).
- **Ceremony**: amber audit banner, blurred reveal table with veil and
  staggered reveal, toasts, live sealed-event audit strip.
- **Users**: 720px drawer with 7 tabs over the list (detail page preserved
  for deep links), plus impersonation (audited, portal writes blocked),
  ban with isikukood-level registration guard, and GDPR export/anonymize
  with 7-year retention.
- **Companies/contracts/requests/leads polish** to the demo card layouts,
  decision notes, wait badges, glyph pills, template card grid with version
  history, editor placeholder chips, 7-day-rule strip, expired-row tint.
- **CMS block builder**: `page_blocks` and `page_versions` schema, block
  type registry with zod configs, builder UI with ordered blocks and
  settings drawers, live preview with desktop/mobile toggle, version
  snapshots with diff and restore, and a marketing-side `PageBlocks`
  renderer.
- **Statistics dashboard** at `/admin/statistics`: period aggregations and
  server-rendered SVG charts (grouped bars, donut, trend), no chart
  dependency.
- **Settings**: two-pane 6-section layout, switches, save toasts with audit
  subline, read-only role matrix from `permissions.ts`, maintenance mode
  with typed HOOLDUS confirm and middleware gate, env-backed masked
  integration keys with audited reveal.
- **Audit log**: hash chain (`prevHash`/`hash`, Web Crypto) in the write
  path, backfill script, chain verification indicator, 680px detail drawer
  with payload and diff, scoped CSV/JSON exports.

## Deliberate deviations from the demo

- Role matrix is read-only; permissions stay code-defined in
  `permissions.ts`.
- The audit footer says "Ahela kontroll: OK"; no Merkle tree is claimed
  because the implementation is a linear hash chain.
- The demo's maintenance conflict checker is omitted; no data source for
  future auction overlaps exists in the settings scope.
- Demo dead buttons (inert exports, stub modals) become real behavior or
  are omitted, never shipped inert.

## Deferrals

- Merkle-tree proofs over the linear chain (later hardening change).
- Server-side auction draft persistence in the wizard (client localStorage
  autosave only; form submit stays the durable save).
- Marketing-site visual reconciliation with new blocks beyond the pages
  route (separate change if needed).

## Missing specialization

`.opencode/agents/` contains only `build`, `plan`, and
`fullstack-engineer`. No frontend or design-system specialist exists, so all
tasks are annotated `fullstack-engineer` (fallback worker). Consider
`/make-engineer` for a frontend engineer.
