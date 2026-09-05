# Proposal: phase-5-admin-backend

## Why

Phases 0-4 delivered the design system, the D1 data layer with the real
bidding engine, the auction portal, and the marketing site. The admin that
exists today is the minimal single-operator CRUD UI from the Cloudflare
migration: a 4-count dashboard, a flat auction form, a table-level company
request review, and no staff-role access (only admin/superadmin can enter).
Demo stories 2-4 from the prototype definition (specialist creates lots in
all object types, an open auction runs live with alapakkumine decisions, a
sealed-bid opening ceremony picks a winner) are not operable without the
full role-gated admin described in `docs/design/admin/01-14`. Phase 5
closes that gap.

## What Changes

- **Staff-role access**: specialist (own lots, own leads; no manual-end,
  export, or fee override) and seller (own lots read-only plus
  alapakkumine decisions) get scoped admin access. Module visibility is
  role-gated per the roles matrix.
- **AdminShell**: 56px icon sidebar with 13 modules and tooltips, topbar
  with environment badge and notification bell, Estonian labels, mobile
  fallback.
- **Auction management**: list gains type tabs with counts, URL-shareable
  filters, a countdown column, and lifecycle actions (end-manual with
  reason and outcome, archive with reason, re-list/clone). The flat form
  becomes the 7-step wizard with forced-sealed object rules, kiiroksjon
  defaults, anti-snipe settings, write-only masked reserve, package table
  editor with CSV paste, a cross-step validation gate, and the media
  pipeline (renditions, alt-text publish gate). Bulk schedule and CSV
  export ship as [S].
- **Bid operations**: per-auction live monitor (SSE feed with source and
  status chips, anti-snipe extension log, `?since=` backfill), per-auction
  plus global alapakkumine queues with SLA badges and audited
  approve/reject (reason, notify), audited identity reveal, and the full
  sealed-opening ceremony (precondition checklist, typed-keyword dual
  signatures, one-shot simultaneous reveal ranked desc with tie by
  earliest, winner confirm against reserve, sold/unsold/kiiroksjon
  house-backup and void paths, step-up re-auth).
- **People**: users & rights (masked isikukood with logged reveal, detail
  tabs, per-objectType rights matrix grant/revoke with mandatory reason
  and notify, suspend that cancels active autobidders) and company
  approvals (registry fixture panel, board-member cross-check,
  duplicate-regcode warning, approve with default-rights checklist,
  reject with reason, hold, history tab).
- **Commerce ops**: contracts & templates (stuck-ambers, PDF view, logged
  container download, throttled resend, void with reason and outcome;
  DOCX upload with placeholder-catalogue validation, version lifecycle
  with one active per type, test-render drawer). Leads CRM becomes a
  5-column Kanban with drag-and-drop and status-transition exit guards,
  SLA badges, a detail drawer with consent record and notes timeline,
  round-robin assign suggestion, and next-action reminders. [S]
  service-request routing with the partner directory completes the
  phase-4 loop.
- **Governance [S]**: audit log viewer with before/after JSON diff,
  settings subset with reason-required audited saves, and CMS
  draft/publish/scheduled verification.

## Capabilities

### New Capabilities

- `admin-shell`: staff-role access layer, AdminShell chrome, role-gated
  module visibility, environment badge, notification bell.
- `admin-auction-management`: auctions list operations, 7-step editor
  wizard, editor validation and publish rules, media pipeline in the
  editor, bulk schedule and CSV export.
- `admin-bid-operations`: live bid monitoring, alapakkumine queues and
  decisions, identity reveal auditing, sealed-opening ceremony.
- `admin-people`: users, rights matrix, enforcement (suspend), and
  company access approvals.
- `admin-commerce-ops`: contract and template management, leads CRM
  pipeline, service-request routing and partner directory.
- `admin-governance`: audit log viewer, settings with audited saves, CMS
  draft/publish/scheduled behaviour.

### Modified Capabilities

- `admin-ui`: the role-guard requirement is extended to name the
  specialist and seller scopes (own lots, own leads, underbid decisions)
  and the server-side enforcement of their deny-list.

## Impact

- Almost all work lives in `apps/platform/src/app/(admin)/`: the
  `_lib/` guard and a new `_lib/permissions.ts`, `_actions/` server
  actions, `_components/`, and the page trees for auctions, bids,
  users, requests, audit.
- `AuctionDO` is a consumer, not a target: admin feeds subscribe to the
  existing SSE stream with admin-scope auth. No changes to bid
  admission, alarms, or the ending worker.
- `docs/design/admin/01-14` remain the page-level truth. Route segments
  stay English (`/admin/...`) with Estonian labels, matching the shipped
  admin instead of the spec's Estonian URL suggestions.
- Audit coverage grows through the existing append-only audit repository;
  new action keys follow the registry in `docs/design/admin/14`.
- New admin pages: `/admin/bids` (global alapakkumine queue), `/admin/requests`
  (+ `/admin/requests/partners`) [S], `/admin/audit` [S].
- Deferred [L], accepted in writing: global search, impersonation,
  ban/force-logout/GDPR tools, anomaly heuristics, publish diff view,
  statistics admin screens, Merkle integrity job, contract generation
  queue UI, duplicate merge, metsaühistu subsite.
