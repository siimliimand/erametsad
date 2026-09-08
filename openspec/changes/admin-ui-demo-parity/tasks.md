## 1. Shared primitives and tokens

- [x] 1.1 Extend `admin.css`: overlay token, keyframes (cd-blink, row-flash, live-pulse, save-ping, modal-in), z-scale documentation, focus ring parity with the demo core <!-- agent: fullstack-engineer.build, depends_on: [], touches: [apps/platform/src/app/(admin)/admin.css] -->
- [x] 1.2 Modal primitive: 480/720 sizes, backdrop, Esc close, focus trap and restore, body scroll lock, mobile full-width <!-- agent: fullstack-engineer.build, depends_on: [1.1], touches: [apps/platform/src/app/(admin)/_components/ui/Modal.tsx] -->
- [x] 1.3 Drawer primitive: right slide-over with 460/560/680/720 size props, full-width below 768px, Esc/backdrop close, focus restore <!-- agent: fullstack-engineer.build, depends_on: [1.1], touches: [apps/platform/src/app/(admin)/_components/ui/Drawer.tsx] -->
- [x] 1.4 ToastProvider and ConfirmDialog (reason min 5 chars and typed keyword variants) wired into AdminShell <!-- agent: fullstack-engineer.build, depends_on: [1.2], touches: [apps/platform/src/app/(admin)/_components/ui/Toast.tsx, apps/platform/src/app/(admin)/_components/ui/ConfirmDialog.tsx, apps/platform/src/app/(admin)/_components/AdminShell.tsx] -->
- [x] 1.5 Small primitives: Switch, TabBar (pill tabs with counts, roving tabindex), FilterChip, EmptyRow, KpiCard <!-- agent: fullstack-engineer.build, depends_on: [1.1], touches: [apps/platform/src/app/(admin)/_components/ui/**] -->
- [x] 1.6 Collapse StatusChip and StatusPill into one component with the full demo variant set (auction triads, user states, contract glyphs, lead and content variants) <!-- agent: fullstack-engineer.build, depends_on: [], touches: [apps/platform/src/app/(admin)/_components/StatusChip.tsx, apps/platform/src/app/(admin)/_lib/labels.tsx] -->
- [x] 1.7 AdminNav badge support (amber dot, red count) fed by server pending counts <!-- agent: fullstack-engineer.build, depends_on: [], touches: [apps/platform/src/app/(admin)/_components/AdminNav.tsx, apps/platform/src/app/(admin)/_components/AdminShell.tsx, apps/platform/src/app/(admin)/layout.tsx] -->
- [x] 1.8 Wire Cmd/Ctrl+K in TopbarSearch: grouped route-jump palette (auctions, users, leads, contracts, settings) <!-- agent: fullstack-engineer.build, depends_on: [], touches: [apps/platform/src/app/(admin)/_components/TopbarSearch.tsx] -->
- [x] 1.9 Tests for all primitives (overlay focus, Esc, drawer widths, toast timing, pill variants) <!-- agent: fullstack-engineer.build, depends_on: [1.4, 1.5, 1.6], touches: [apps/platform/src/app/(admin)/_components/**/__tests__/**] -->

## 2. Navigation and route repairs

- [x] 2.1 Create /admin/companies (move company approvals from leads/requests) with a redirect from the old path <!-- agent: fullstack-engineer.fast, depends_on: [], touches: [apps/platform/src/app/(admin)/admin/companies/**, apps/platform/src/app/(admin)/admin/leads/requests/**] -->
- [x] 2.2 Create /admin/inquiries (move requests) and /admin/inquiries/partners with redirects <!-- agent: fullstack-engineer.fast, depends_on: [], touches: [apps/platform/src/app/(admin)/admin/inquiries/**, apps/platform/src/app/(admin)/admin/requests/**] -->
- [x] 2.3 Create /admin/settings (move content/settings) with a redirect <!-- agent: fullstack-engineer.fast, depends_on: [], touches: [apps/platform/src/app/(admin)/admin/settings/**, apps/platform/src/app/(admin)/admin/content/settings/**] -->
- [x] 2.4 Create /admin/sealed-opening index: sealed and ended auctions awaiting ceremony, links into per-auction ceremony <!-- agent: fullstack-engineer.build, depends_on: [], touches: [apps/platform/src/app/(admin)/admin/sealed-opening/page.tsx] -->
- [x] 2.5 Create /admin/notifications read-only list; repoint the bell footer link <!-- agent: fullstack-engineer.fast, depends_on: [], touches: [apps/platform/src/app/(admin)/admin/notifications/page.tsx, apps/platform/src/app/(admin)/_components/NotificationBell.tsx] -->
- [x] 2.6 Route tests: all 13 module hrefs resolve, old paths redirect, role gating intact per module <!-- agent: fullstack-engineer.build, depends_on: [2.1, 2.2, 2.3, 2.4, 2.5], touches: [apps/platform/src/app/(admin)/**/__tests__/**] -->

## 3. Workspace (Töölaud)

- [x] 3.1 _lib/workspace.ts: aggregations for 7 KPIs, ending-today auctions, queue counts, recent leads <!-- agent: fullstack-engineer.build, depends_on: [2.6], touches: [apps/platform/src/app/(admin)/admin/_lib/workspace.ts] -->
- [x] 3.2 KPI strip: 7 cards, alert badge, sparkline SVG, trend sublines, card links <!-- agent: fullstack-engineer.build, depends_on: [3.1, 1.5], touches: [apps/platform/src/app/(admin)/admin/page.tsx] -->
- [x] 3.3 "Lõpevad täna" live table: countdown cells with critical blink, type chips, Monitor/Ava buttons <!-- agent: fullstack-engineer.build, depends_on: [3.1], touches: [apps/platform/src/app/(admin)/admin/page.tsx, apps/platform/src/app/(admin)/admin/_components/EndingToday.tsx] -->
- [x] 3.4 "Süsteemi tervis", "Kiire tegevus", "Viimased juhtlõimed" cards <!-- agent: fullstack-engineer.build, depends_on: [3.1], touches: [apps/platform/src/app/(admin)/admin/page.tsx, apps/platform/src/app/(admin)/admin/_components/**] -->
- [x] 3.5 Workspace tests (aggregations, empty states, role-scoped counts) <!-- agent: fullstack-engineer.build, depends_on: [3.2, 3.3, 3.4], touches: [apps/platform/src/app/(admin)/admin/_lib/__tests__/**] -->

## 4. Auctions list parity

- [x] 4.1 Column chooser ("Veerud") with localStorage persistence over AuctionsTable <!-- agent: fullstack-engineer.build, depends_on: [1.9], touches: [apps/platform/src/app/(admin)/admin/auctions/_components/AuctionsTable.tsx] -->
- [x] 4.2 Visual parity: selected-row mint tint, tab-count inversion, global ⌘N listener, status glyphs via the unified chip <!-- agent: fullstack-engineer.build, depends_on: [1.6], touches: [apps/platform/src/app/(admin)/admin/auctions/page.tsx, apps/platform/src/app/(admin)/admin/auctions/_components/AuctionsTable.tsx] -->
- [x] 4.3 Tests: chooser persistence, selection tint, keyboard shortcut <!-- agent: fullstack-engineer.build, depends_on: [4.1, 4.2], touches: [apps/platform/src/app/(admin)/admin/auctions/_components/__tests__/**] -->

## 5. Wizard chrome and autosave

- [x] 5.1 Editor bar: title with mono id, status pill, autosave indicator with ping, Eelvaade link <!-- agent: fullstack-engineer.build, depends_on: [1.9], touches: [apps/platform/src/app/(admin)/admin/auctions/_components/AuctionWizard.tsx] -->
- [x] 5.2 Step rail marks: done/current/todo/disabled from existing per-step validation, "N puudust" footer <!-- agent: fullstack-engineer.build, depends_on: [5.1], touches: [apps/platform/src/app/(admin)/admin/auctions/_components/AuctionWizard.tsx, apps/platform/src/app/(admin)/admin/auctions/_components/wizard-model.ts] -->
- [x] 5.3 Client draft autosave to localStorage with restore prompt and beforeunload guard <!-- agent: fullstack-engineer.build, depends_on: [5.1], touches: [apps/platform/src/app/(admin)/admin/auctions/auction-form.tsx, apps/platform/src/app/(admin)/admin/auctions/_components/AuctionWizard.tsx] -->
- [x] 5.4 Tests: mark computation, autosave restore, guard <!-- agent: fullstack-engineer.build, depends_on: [5.2, 5.3], touches: [apps/platform/src/app/(admin)/admin/auctions/_components/__tests__/**] -->

## 6. Bid monitor parity

- [x] 6.1 Monitor-head strip: timer-xl, anti-snipe chip, leading-bid line, action buttons <!-- agent: fullstack-engineer.build, depends_on: [1.9], touches: [apps/platform/src/app/(admin)/admin/auctions/[id]/monitor/bid-monitor.tsx] -->
- [x] 6.2 Autobidder duel collapse: group rapid autobid bursts behind an expandable row <!-- agent: fullstack-engineer.build, depends_on: [6.1], touches: [apps/platform/src/app/(admin)/admin/auctions/[id]/monitor/bid-monitor.tsx] -->
- [x] 6.3 Bidder reveal chips in the live feed, reusing the audited identity unmask action <!-- agent: fullstack-engineer.build, depends_on: [6.1], touches: [apps/platform/src/app/(admin)/admin/auctions/[id]/monitor/bid-monitor.tsx, apps/platform/src/app/(admin)/admin/bids/_actions/**] -->
- [x] 6.4 Anomalies panel: heuristics module (new-account burst, rapid overtake), internal-review audit flag, shill card UI <!-- agent: fullstack-engineer.build, depends_on: [6.1], touches: [apps/platform/src/app/(admin)/admin/auctions/[id]/monitor/_lib/anomalies.ts, apps/platform/src/app/(admin)/admin/auctions/[id]/monitor/bid-monitor.tsx] -->
- [x] 6.5 Tests: duel grouping, heuristic thresholds, reveal audit entry <!-- agent: fullstack-engineer.build, depends_on: [6.2, 6.3, 6.4], touches: [apps/platform/src/app/(admin)/admin/auctions/[id]/monitor/__tests__/**] -->

## 7. Ceremony visuals

- [x] 7.1 Amber audit banner, toast adoption, dark danger button parity <!-- agent: fullstack-engineer.build, depends_on: [1.4], touches: [apps/platform/src/app/(admin)/admin/auctions/[id]/ceremony/**] -->
- [x] 7.2 Reveal presentation: blurred table with veil before reveal, staggered row reveal, reduced-motion fallback <!-- agent: fullstack-engineer.build, depends_on: [7.1], touches: [apps/platform/src/app/(admin)/admin/auctions/[id]/ceremony/reveal-panel.tsx] -->
- [x] 7.3 Live audit strip: sealed-event audit lines for the auction, refreshed on SSE events <!-- agent: fullstack-engineer.build, depends_on: [7.1], touches: [apps/platform/src/app/(admin)/admin/auctions/[id]/ceremony/ceremony-checklist.tsx, apps/platform/src/app/(admin)/admin/auctions/[id]/ceremony/_lib/**] -->
- [x] 7.4 Ceremony tests <!-- agent: fullstack-engineer.build, depends_on: [7.2, 7.3], touches: [apps/platform/src/app/(admin)/admin/auctions/[id]/ceremony/__tests__/**] -->

## 8. Users, rights, impersonation, GDPR

- [x] 8.1 User drawer shell on the list: 720px, 7 tabs, row deep link preserved to the detail page <!-- agent: fullstack-engineer.build, depends_on: [1.3, 1.9], touches: [apps/platform/src/app/(admin)/admin/users/page.tsx, apps/platform/src/app/(admin)/admin/users/_components/UserDrawer.tsx] -->
- [x] 8.2 Tab content reuse: move the 5 detail tab panels into shared components consumed by page and drawer; add the Teavitused tab <!-- agent: fullstack-engineer.build, depends_on: [8.1], touches: [apps/platform/src/app/(admin)/admin/users/_components/**, apps/platform/src/app/(admin)/admin/users/[id]/page.tsx] -->
- [x] 8.3 Impersonation backend: audited start/stop, impersonation session binding, portal write actions reject while impersonating <!-- agent: fullstack-engineer.build, depends_on: [], touches: [apps/platform/src/app/(admin)/_actions/users.ts, apps/platform/src/lib/auth/**, apps/platform/src/app/(portal)/**/_actions/**] -->
- [x] 8.4 Impersonation UI: reason modal, sticky amber banner with LÕPETA VAATLUS; ban action with isikukood-level registration guard <!-- agent: fullstack-engineer.build, depends_on: [8.1, 8.3], touches: [apps/platform/src/app/(admin)/admin/users/_components/UserDrawer.tsx, apps/platform/src/app/(admin)/_actions/users.ts, apps/platform/src/app/(portal)/_actions/register/**] -->
- [x] 8.5 GDPR: export ZIP stream and anonymize-with-retention action, both audited, wired into the GDPR tab <!-- agent: fullstack-engineer.build, depends_on: [8.2], touches: [apps/platform/src/app/(admin)/_actions/users.ts, apps/platform/src/app/(admin)/admin/users/_components/**] -->
- [x] 8.6 Tests: impersonation guards, ban registration block, anonymize retention, drawer tabs <!-- agent: fullstack-engineer.build, depends_on: [8.4, 8.5], touches: [apps/platform/src/app/(admin)/_actions/__tests__/**, apps/platform/src/app/(admin)/admin/users/**/__tests__/**] -->

## 9. Companies approvals polish

- [x] 9.1 Demo card layout on /admin/companies: two-panel comparison, wait badges, decision notes, rights-selection modal via primitives <!-- agent: fullstack-engineer.build, depends_on: [2.1, 1.4], touches: [apps/platform/src/app/(admin)/admin/companies/**] -->
- [x] 9.2 Tests: decision flow, badge countdown, modal rights capture <!-- agent: fullstack-engineer.build, depends_on: [9.1], touches: [apps/platform/src/app/(admin)/admin/companies/__tests__/**] -->

## 10. Contracts visuals

- [x] 10.1 Template card grid: version chips, expandable version history, active/draft pills <!-- agent: fullstack-engineer.build, depends_on: [1.6], touches: [apps/platform/src/app/(admin)/admin/contracts/templates/page.tsx] -->
- [x] 10.2 Editor modal: clickable placeholder chips inserting at cursor for HTML/TXT templates, test-render button reusing HtmlPreviewDrawer <!-- agent: fullstack-engineer.build, depends_on: [1.2, 10.1], touches: [apps/platform/src/app/(admin)/admin/contracts/_components/**] -->
- [x] 10.3 Contract list glyph pills and status parity via the unified chip <!-- agent: fullstack-engineer.fast, depends_on: [1.6], touches: [apps/platform/src/app/(admin)/admin/contracts/page.tsx] -->
- [x] 10.4 Tests <!-- agent: fullstack-engineer.build, depends_on: [10.2, 10.3], touches: [apps/platform/src/app/(admin)/admin/contracts/_components/__tests__/**] -->

## 11. Service requests and leads polish

- [x] 11.1 Requests: 7-day-rule info strip, expired-row tint, response-tracking table in the routing drawer <!-- agent: fullstack-engineer.build, depends_on: [2.2], touches: [apps/platform/src/app/(admin)/admin/inquiries/**] -->
- [x] 11.2 Leads: keyboard move menu, card menu, demo-parity card metadata <!-- agent: fullstack-engineer.build, depends_on: [1.9], touches: [apps/platform/src/app/(admin)/admin/leads/_components/LeadsKanban.tsx] -->
- [x] 11.3 Tests <!-- agent: fullstack-engineer.build, depends_on: [11.1, 11.2], touches: [apps/platform/src/app/(admin)/admin/leads/**/__tests__/**, apps/platform/src/app/(admin)/admin/inquiries/**/__tests__/**] -->

## 12. CMS block builder

- [x] 12.1 Schema and repository: page_blocks (pageId, type, ordinal, configJson) and page_versions snapshots, migration <!-- agent: fullstack-engineer.build, depends_on: [], touches: [apps/platform/src/lib/data/schema/**, apps/platform/src/lib/data/repositories/**] -->
- [x] 12.2 Block type registry with zod configs: hero, text, cards, accordion, form, ticker, stats, cta, testimonials, faq <!-- agent: fullstack-engineer.build, depends_on: [12.1], touches: [apps/platform/src/lib/content/blocks/**] -->
- [x] 12.3 Builder UI on the page editor: ordered block list, add-block menu, per-block settings drawer, delete with confirm <!-- agent: fullstack-engineer.build, depends_on: [12.2, 1.3, 1.5], touches: [apps/platform/src/app/(admin)/admin/content/pages/_components/**] -->
- [x] 12.4 Live preview pane: read-only block rendering with desktop/mobile width toggle <!-- agent: fullstack-engineer.build, depends_on: [12.3], touches: [apps/platform/src/app/(admin)/admin/content/pages/_components/BlockPreview.tsx] -->
- [x] 12.5 Versions: publish creates a snapshot, versions drawer with two-column diff, restore action <!-- agent: fullstack-engineer.build, depends_on: [12.3, 1.3], touches: [apps/platform/src/app/(admin)/admin/content/pages/_components/VersionsDrawer.tsx, apps/platform/src/app/(admin)/_actions/content.ts] -->
- [x] 12.6 Marketing renderer: PageBlocks renderer component adopted by the CMS pages route <!-- agent: fullstack-engineer.build, depends_on: [12.2], touches: [packages/ui/src/components/content/**, apps/platform/src/app/(marketing)/**] -->
- [x] 12.7 Tests: registry validation, ordinal integrity, snapshot diff, renderer <!-- agent: fullstack-engineer.build, depends_on: [12.4, 12.5, 12.6], touches: [apps/platform/src/lib/content/**/__tests__/**, apps/platform/src/app/(admin)/admin/content/pages/**/__tests__/**] -->

## 13. Statistics dashboard

- [x] 13.1 _lib/statistics.ts: period aggregations (30/90/365) from auctions, bids, snapshots <!-- agent: fullstack-engineer.build, depends_on: [2.6], touches: [apps/platform/src/app/(admin)/admin/statistics/_lib/statistics.ts] -->
- [x] 13.2 Server-rendered SVG charts: grouped monthly bars, type donut, 30-day trend (no chart dependency) <!-- agent: fullstack-engineer.build, depends_on: [], touches: [apps/platform/src/app/(admin)/admin/statistics/_components/Charts.tsx] -->
- [x] 13.3 Page assembly: 6 KPIs, charts, Top-5 table, county table, CSV export link <!-- agent: fullstack-engineer.build, depends_on: [13.1, 13.2], touches: [apps/platform/src/app/(admin)/admin/statistics/page.tsx] -->
- [x] 13.4 Tests: aggregation math, chart data shapes, period switch <!-- agent: fullstack-engineer.build, depends_on: [13.3], touches: [apps/platform/src/app/(admin)/admin/statistics/_lib/__tests__/**] -->

## 14. Settings

- [x] 14.1 Two-pane layout: sticky section nav and 6 demo sections remapping existing fields <!-- agent: fullstack-engineer.build, depends_on: [2.3], touches: [apps/platform/src/app/(admin)/admin/settings/**] -->
- [x] 14.2 Switch components, save toasts with audit subline, reason-on-save kept <!-- agent: fullstack-engineer.build, depends_on: [14.1, 1.4, 1.5], touches: [apps/platform/src/app/(admin)/admin/settings/_components/SettingsForm.tsx] -->
- [x] 14.3 Role matrix: read-only view generated from permissions.ts, locked Superadmin column, note on code-defined permissions <!-- agent: fullstack-engineer.build, depends_on: [14.1], touches: [apps/platform/src/app/(admin)/admin/settings/_components/RoleMatrix.tsx] -->
- [x] 14.4 Maintenance mode: settings field, typed HOOLDUS confirm modal, middleware gate with admin bypass, audit start/end <!-- agent: fullstack-engineer.build, depends_on: [14.1], touches: [apps/platform/src/lib/data/schema/**, apps/platform/src/middleware.ts, apps/platform/src/app/(admin)/admin/settings/**] -->
- [x] 14.5 Integration key cards: masked env-backed values, audited reveal action, status dots <!-- agent: fullstack-engineer.build, depends_on: [14.1], touches: [apps/platform/src/app/(admin)/admin/settings/_components/IntegrationKeys.tsx, apps/platform/src/app/(admin)/_actions/settings.ts] -->
- [x] 14.6 Tests: maintenance gate, reveal audit, matrix rendering <!-- agent: fullstack-engineer.build, depends_on: [14.3, 14.4, 14.5], touches: [apps/platform/src/app/(admin)/admin/settings/**/__tests__/**] -->

## 15. Audit log chain and drawer

- [x] 15.1 Hash chain: prevHash/hash columns, migration, Web Crypto chaining in the audit write path <!-- agent: fullstack-engineer.build, depends_on: [], touches: [apps/platform/src/lib/data/schema/**, apps/platform/src/lib/data/repositories/**] -->
- [x] 15.2 Backfill script for existing entries plus a chain-verification method and footer indicator (label: "Ahela kontroll: OK") <!-- agent: fullstack-engineer.build, depends_on: [15.1], touches: [apps/platform/scripts/**, apps/platform/src/app/(admin)/admin/audit/page.tsx] -->
- [x] 15.3 Detail drawer 680px: payload JSON box, AuditDiff, related entries, result chip <!-- agent: fullstack-engineer.build, depends_on: [1.3], touches: [apps/platform/src/app/(admin)/admin/audit/_components/AuditDrawer.tsx, apps/platform/src/app/(admin)/admin/audit/page.tsx] -->
- [x] 15.4 CSV and JSON export routes, scoped like list reads <!-- agent: fullstack-engineer.build, depends_on: [15.1], touches: [apps/platform/src/app/api/v1/admin/audit/**] -->
- [x] 15.5 Tests: tamper detection, backfill determinism, export scoping <!-- agent: fullstack-engineer.build, depends_on: [15.2, 15.3, 15.4], touches: [apps/platform/src/lib/data/repositories/__tests__/**] -->

## 16. Cross-cutting and verification

- [x] 16.1 Responsive sweep: drawers full-width below 768px, table scroll, kanban scroll, topbar collapse <!-- agent: fullstack-engineer.build, depends_on: [8.1, 12.3, 14.1], touches: [apps/platform/src/app/(admin)/**] -->
- [x] 16.2 Accessibility pass: overlay focus, aria on tabs and dialogs, reduced motion honored everywhere <!-- agent: fullstack-engineer.build, depends_on: [16.1], touches: [apps/platform/src/app/(admin)/**] -->
- [x] 16.3 Update DESIGN.md and ARCHITECTURE.md to the new admin reality <!-- agent: fullstack-engineer.fast, depends_on: [12.6, 13.3, 14.4, 15.2], touches: [DESIGN.md, ARCHITECTURE.md] -->
- [ ] 16.4 Run pnpm lint, pnpm typecheck, pnpm test, pnpm build; fix fallout; report results <!-- agent: fullstack-engineer.fast, depends_on: [16.2, 16.3], touches: [] -->
