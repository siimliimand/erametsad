# Proposal: admin-spec-gap-fixes

## Why

A field-level audit (2026-09-08, recorded in
`docs/admin-fields-audit-and-fix-plan.md`) compared every admin page and
content type in `apps/platform/src/app/(admin)/` and
`apps/platform/src/lib/data/schema/` against `docs/sites/admin-erametsad-ee.md`
and `docs/design/admin/01-14`. No module is fully aligned:

- 10 implemented behaviors are wrong (dead redirect paths that lose operator
  messages, export of the filter instead of the selection, missing mandatory
  reasons, fee bounds outside the spec, unenforced ceremony approver role,
  audit registry drift).
- Content types are missing documented fields: articles have no category and
  no SEO columns, FAQ items and testimonials have no publish/active flags,
  redirects have no hit counter or loop validation, media has no alt-text gate
  or focal point, settings lack whole sections (Teavitused, Hooldusaken), the
  service-request status enum has 2 of 6 states, leads have no county, and
  `audit_entries` lacks the reason/session/ip/user-agent columns the audit
  viewer spec requires.
- The pages editor ships as a raw JSON textarea while a complete block
  builder, preview, and versions drawer sit unwired in the codebase.
- 17 documented behaviors conflict with the code by design (routes, object
  types, void outcome, provider names, masking direction) and need a recorded
  decision, usually a documentation fix.

Left unfixed, staff work with screens that silently drop feedback, cannot
reach documented workflows, and an audit log that cannot answer "who did what
and why" — the project's stated security requirement.

## What Changes

- Phase 0 correctness bugs (10): inquiry action redirect paths; settings save
  redirect path; selection-based CSV export; lead status label copy; per-lot
  under-bid reject reason; fee validation 0-10; audit action registry keys;
  audit export UI button + superadmin gate; ceremony approver role
  enforcement; identity-masking decision recorded in docs.
- Shared rich text editor adopted by the auction wizard and CMS forms.
- CMS content types reach their documented field lists: articles (category,
  SEO panel, specialist author), pages (block builder wired in, versions
  drawer, publish buttons), FAQ (active flags, short answer), testimonials
  (status, rating), redirects (hits, validation, delete reason, CSV import),
  media (alt gate, focal point), and the per-block settings from the CMS
  spec.
- Governance: settings sections gain their missing fields and toggles;
  notification templates get storage and an editor with test send and SMS
  segment counter; maintenance windows get a conflict checker; integration
  cards get connection tests; audit entries gain reason/session/ip/UA columns
  without breaking the hash chain; the audit viewer gains the reason column,
  ms timestamps, and per-action labels.
- Auctions: area/volume promoted to real columns (list parity), the two
  missing step-3 fields persisted, publish gates and the three publish
  actions, server autosave with conflict banner, step-7 diff, real media
  upload, and dashboard parity fixes.
- Bids and ceremony: bids CSV export, monitor under-bid block and accept
  confirmation, IP-cluster heuristic with spec thresholds, reveal-table
  identity and margin columns, winner/seller notifications, and the
  pending-company forced choice.
- People: user list filters and columns, GDPR deepening (double confirm,
  pre-check, cooling-off, row pseudonymisation), rights per-profile rows with
  leading-bid warning, impersonation TTL, shill flags, and the company
  approval panel fields with volikiri enforcement.
- Leads and service requests: county on leads with filters and CSV export,
  exit guards, auto-assignment, merge and soft delete; teostatud/suletud
  statuses with closing actions; inquiry filters, confirm modals, and the
  partner form fields.
- Contracts table columns/filters and template version metadata; statistics
  quick wins (outcome chart, type/county filters); shell palette coverage and
  impersonation expiry countdown.
- 17 spec-vs-code conflicts resolved as recorded decisions, mostly by
  updating `docs/design/admin/*` and `docs/sites/admin-erametsad-ee.md`;
  ARCHITECTURE.md and DESIGN.md updated for the schema work.

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `admin-shell`: command palette covers all modules; environment badge gains
  STAGE; nav label corrected; impersonation shows session expiry; the
  dashboard reaches its documented KPI/table semantics.
- `admin-auction-management`: list columns/sort/tabs/archive rules, wizard
  gates and publish actions, persisted land-forest fields, real media
  pipeline, server autosave, step-7 diff.
- `admin-bid-operations`: bids CSV export, under-bid decision UX with
  mandatory reasons, anomaly heuristics and evidence, ceremony reveal table
  identity/margin, winner and seller notifications, approver role.
- `admin-people`: user list parity, GDPR tool depth, rights matrix
  per-profile rows, impersonation TTL, shill flags, company approval panel
  completeness.
- `admin-commerce-ops`: contracts table/filters/void UX, template version
  metadata, leads CRM operations, service-request routing UX.
- `admin-governance`: settings sections and fields, notification templates,
  maintenance windows, integration tests, audit columns and viewer parity,
  settings access tier decision.
- `admin-ui`: block builder wired into the page editor, CMS forms reach their
  field lists, media alt gate, shared rich text editor, statistics quick
  wins.
- `supporting-collections`: schema additions (articles SEO/category, FAQ
  flags, testimonial status, redirect hits, lead county, service-request
  statuses, audit columns, notification templates, maintenance windows,
  auction area/volume).

## Notes

- `.opencode/agents/` contains only `fullstack-engineer.md` as a specialist;
  all tasks are annotated `fullstack-engineer.{build,fast}`. Missing
  specializations (data migrations, frontend components) are covered by the
  fallback worker; create dedicated engineers with `/make-engineer` and
  re-annotate if desired.
- Every schema change is an additive Drizzle migration. The audit hash-chain
  serialization must keep verifying pre-migration rows (mixed-era chain test
  required).
