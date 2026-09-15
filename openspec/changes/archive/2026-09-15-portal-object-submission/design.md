## Design

### Context

Explore mode traced the current flow and the codebase facts that constrain it:

- The CTA is a plain cross-subdomain link (`marketingUrl('/teenused/raieoiguse-muuk')`) in `objects-client.tsx`; no session context travels with it.
- The marketing LeadForm POSTs anonymously to `/api/leads`; `ingestLead` stores a `leads` row with `status: 'new'` and no user link.
- `auctions.seller_id` exists in the schema and `seller-data.ts` lists auctions by `seller = session.userId`, but nothing in the runtime writes `seller_id` (seed only).
- Portal `my-auctions` actions (request-review, relist, underbid approve/reject) check `sellerId === payload.userId` with an admin-role fallback, no portal role gate.
- The objects page already renders a Mustandid chip, `DraftPreviewModal`, and a draft "Saada spetsialistile" review action.
- Publish readiness gates (`collectPublishReadinessFailures`) require specialist, area, and lead time; they do not check price.
- `minBidCents` is NOT NULL; the check constraint allows 0.
- Portal writes go through `requirePortalWriteSession`; service-request attachments already upload to R2.
- Middleware routes portal paths via an allowlist; unlisted paths fall through to the default (marketing) host.

### Goals

- A logged-in user offers an object without leaving the portal and without re-typing contact data.
- The submission itself places the object under the account; no manual step is needed for ownership.
- Staff keep their existing workflows: Leads kanban for sales, Päringud queue for services, auction wizard for completion and publishing.

### Non-goals

- No change to the anonymous marketing LeadForm or `/api/leads` contract.
- No user-facing publishing, pricing, or scheduling: pricing, mechanics changes, and publication stay admin/DO driven.
- No partner-inbox delivery changes for service requests (Phase 5.5 concern).

### Decisions

#### D1. The form creates a draft auction, not a new submission entity

A separate `object_submissions` table would duplicate auction fields and need its own admin UI and conversion step. A draft auction row (`status: 'draft'`, `seller_id` set, `minBidCents: 0` placeholder) reuses the existing wizard for completion, the existing Mustandid chip and `DraftPreviewModal` for display, and existing publish gates for safety. The explore session compared three options (linked lead only, draft auction, new entity); draft auction scored highest on automation and lowest on schema/admin work.

#### D2. One wizard route, branch after service selection

`/user/objects/paku` renders a client-side multi-step wizard. Step 1 selects one of five services. Sale branches then show: location (cadastres, auto county via `deriveCountyCodeFromCadastre`, optional address), object data (area ha, species, logging types, optional volume), files, description, contact confirmation (prefilled from the active profile), summary. Service branches show the `service-request` field set for their type. Steps share layout primitives; validation is the shared zod schema (D5) on client and server.

#### D3. Portal sale submissions also create a CRM lead

The Leads kanban is the staff pipeline for sales. The sale branch creates both the draft auction and a `leads` row (`source: 'portal'`, `user_id` set, auction reference stored) with the county round-robin auto-assignment. Service submissions skip the lead: the service request itself is the admin work item, so no duplicate record.

#### D4. Specialists auto-assign at submission

Reuse `countyRoundRobinPick` (task 8.2 lead assignment) for the portal lead and for the auction draft's `specialistId`. Auto-assignment also feeds the existing publish gate that requires a specialist. Admin can reassign; the round-robin is a suggestion mechanism, not a constraint.

#### D5. Shared zod schemas for both branches

`apps/platform/src/lib/object-submission/` holds the submission payload schemas. Portal-safe by construction: no pricing, mechanics, schedule, or specialist fields. The admin wizard keeps its own superset schema. Both wizard client validation and API route validation consume the shared schema, so field rules cannot drift.

#### D6. Placeholder price plus a new publish gate

User drafts carry `minBidCents: 0` because the column is NOT NULL and pricing belongs to the specialist. Publish readiness gains a `minBidCents > 0` gate so a placeholder can never reach `scheduled`. This is the one admin-behavior change; it is additive and fails closed.

#### D7. Mechanics default by object type

Kinnistu müük drafts default `type: 'sealed'`, raieõiguse müük drafts default `type: 'open'`, matching the product narratives on the two marketing pages. The admin wizard can change mechanics during completion; the default just removes a decision the user should not make.

#### D8. Service requests become visible in the portal in v1

A Teenused section on `/user/objects` lists the user's own service requests (type label, status pill, created date), fed by the new `user_id` column. This closes the loop for non-sale submissions, which otherwise have no user-facing trace.

### Risks / Trade-offs

- **Registry mapping gap**: a missing `user_id` mapping in `repositories/registry.ts` silently yields empty results. Dedicated repository tests cover both new columns.
- **Upload abuse**: multi-file sale uploads enforce count (10) and per-file size (10 MB) server-side before the R2 write, not only in the client.
- **Role confusion**: none expected. Portal roles (`private`, `company`) never grant admin scope; ownership actions key off `seller_id`.
- **Lead duplication**: a portal submission and a marketing lead with the same phone/email within 30 days exist in parallel. The kanban duplicate heuristic already surfaces this; merging stays a manual admin action.
- **Cross-subdomain sessions**: out of scope. The marketing form stays anonymous; a future change could detect an existing portal session there.

### Migration plan

1. Add nullable columns (`service_requests.user_id`, `leads.user_id`, `leads.auction_id`) via Drizzle migration; nullable columns keep the anonymous funnel working unchanged.
2. Ship backend routes, then the wizard, then the CTA swap. The marketing redirect keeps working until 3.4 flips it.

### Open Questions

None. All decisions were resolved interactively during explore/propose (submission target, wizard depth, CRM linkage, service scope, portal visibility, auto-assignment, file caps).
