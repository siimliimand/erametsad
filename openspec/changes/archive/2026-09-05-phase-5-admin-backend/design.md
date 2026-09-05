# Design: phase-5-admin-backend

## Context

The admin exists as a route group at `apps/platform/src/app/(admin)/`
built during the Cloudflare migration: server components plus server
actions over the repository layer, a `requireAdminRepositories()` guard
that accepts only admin/superadmin, a basic AdminNav sidebar, auction
CRUD with a flat form, a bid monitor page, a sealed-ceremony flow with
opener/approver/confirm/void actions, users with grant/revoke rights,
a company-request table, contracts and templates, leads, content CRUD,
a media library, and a settings form. Audit entries are already written
append-only by the actions. Staff roles `specialist` and `seller` exist
in `users.role` but have no admin access.

Page-level truth is `docs/design/admin/01-14`. The platform runs Next.js
15 App Router on Cloudflare Workers via OpenNext with D1 + Drizzle,
AuctionDO/RateLimiterDO, Cloudflare queues, R2 media, and the existing
SSE hubs. Admin screens speak Estonian; code identifiers stay English.

## Goals / Non-Goals

**Goals:**

- Specialist and seller work in the admin with server-enforced scoping
  (own lots, own leads, underbid decisions) and role-gated module
  visibility.
- Demo stories 2-4 operable end to end: lot creation in all object
  types through the 7-step wizard, live open-auction oversight with
  alapakkumine decisions, and the sealed-opening ceremony with full
  audit.
- Every consequential action audit-logged with reason and before/after
  per the action registry in `docs/design/admin/14`.
- Sealed amounts and the reserve price stay secret until the ceremony;
  isikukood reveals are logged.

**Non-Goals:**

- Impersonation, ban, force-logout, GDPR export/delete jobs, anomaly
  heuristics, statistics admin screens, Merkle job, contract generation
  queue UI, duplicate merge, global search (all [L]).
- Changes to bid admission, the ending worker, DO alarms, or the portal.
- The metsaühistu subsite.
- Estonian admin URL segments; the shipped English routes stay.

## Decisions

### D1: Permission layer beside the existing guard

Keep `requireAdminRepositories()` as the session entry point and add
`_lib/permissions.ts`: a role-permission map plus scope helpers
(`auctionScope(role, userId)`, `leadScope(...)`, deny-lists for
manual-end/export/fee-override). Each page and action re-checks
permissions server-side; the sidebar map only hides modules. Rejected
write actions return an explicit error, never a silent no-op.
Alternative considered: per-route middleware. Rejected because actions,
not routes, carry the writes.

### D2: Server actions over REST admin APIs

The design specs show indicative REST shapes (`/api/admin/...`). The
shipped admin uses server actions over the repository layer; new
operations follow that pattern. Two exceptions keep their routes:
SSE subscriptions (monitor feed, via the existing AuctionDO stream with
admin-scope auth) and file/CSV downloads.

### D3: Admin feeds reuse the AuctionDO SSE hub

The bid monitor subscribes to the same auction stream the portal uses,
authenticated with the admin session. Reconnect backfill uses the
repository (`?since=` on bid ids/timestamps). No new event hub, no
WebSocket.

### D4: Ceremony extends the existing sealed-ceremony actions

`startSealedCeremonyAction`, `approveSealedCeremonyAction`,
`confirmSealedWinnerAction`, and `voidSealedCeremonyAction` already
implement two-person signing and winner confirmation. The upgrade adds
the precondition checklist, typed-keyword confirmation, 30-minute
signature validity, one-shot simultaneous reveal with tie-by-earliest
ordering and invalid-bid greying, reserve comparison branches
(sold/unsold/kiiroksjon house-backup), and step-up re-auth. Ceremony
state lives on the auction row plus audit entries; no new table.

### D5: Secrets stay write-only

The reserve price is accepted on write, never returned by queries or
props (masked placeholder after first save; change requires full
re-entry). Isikukood renders masked; a click-to-reveal writes a
`user.identity_view` audit entry before the value is included in the
response. Audit diffs mask secret fields as `<salajane>`.

### D6: Media pipeline grows the existing R2 upload

`media-upload.ts` gains rendition generation (hero 1600x1000,
gallery 1200x750, thumb 350x175) and validation (jpg/png/webp, 15 MB,
min 1200px; PDF-only files with tag select). Alt text is required at
publish, not at upload, so drafts stay editable.

### D7: Audit keys follow the spec-14 registry

New action keys (`auction.end_manual`, `auction.archive`, `auction.relist`,
`user.identity_view`, `user.right_grant`, `user.right_revoke`,
`user.suspend`, `bid.approve`, `bid.reject`, `sealed.*`,
`company.approve`, `company.reject`, `lead.*`, `request.forward`,
`settings.change`, `contract.void`, `contract.resend`,
`template.*`) match `docs/design/admin/14` so the audit viewer can
group them. Reason-required actions reject submission without a reason
of at least 5 characters.

### D8: Lead pipeline guards live in the action layer

Kanban drag submits the target status to a server action that enforces
the exit guards (specialist assigned; note for Kvalifitseeritud; reason
for Mittekvalifitseeritud) before persisting. The board renders
optimistically and reverts on rejection. Round-robin assignment is a
suggestion chip computed from active specialists and county coverage;
manual override always wins.

## Risks / Trade-offs

- [Wizard complexity] The 7-step editor is the densest form in the
  system. → Ship it as one schema plus presentational step components;
  the validation gate lists every failure with a jump link so partial
  saves never lose data.
- [D1 scoping mistakes could leak other sellers' lots] → Scope helpers
  are the single place that builds `where` clauses; permission tests in
  task 7.1 cover each role against foreign resources.
- [Ceremony races (two admins, refresh mid-ceremony)] → Server-side
  state transitions are idempotent and one-shot; the UI re-reads state
  on every render and renders read-only for non-participants.
- [Spec drift] Design specs assume Redis/BullMQ and Payload-style APIs.
  → This design records the platform mappings (D2-D4); implementers
  follow the specs for UX and this design for plumbing.

## Migration Plan

All changes are additive to the `(admin)` route group. No portal,
marketing, or API surface changes; no data migrations except optional
settings keys. Deploy behind the existing staff-role guard; rollback is
a revert of the route group.

## Open Questions

- Anti-snipe default: Settings (13) versus per-lot editor default - the
  spec paths disagree on the number; both read the same Settings key.
- Should accepted alapakkumised trigger autobidder evaluation?
- Ceremony protocol PDF export (signed record of the reveal) - defer
  unless trivial on top of the audit chain.
