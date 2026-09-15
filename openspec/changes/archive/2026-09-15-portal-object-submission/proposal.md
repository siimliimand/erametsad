## Why

The "Paku oma objekti" button on `/user/objects` redirects a logged-in user to the anonymous marketing lead form on `erametsad.ww0.dev`. The submission lands as an unowned CRM lead: no user id, no auction, and nothing in the runtime ever sets `auctions.seller_id` (only the seed script does). An admin then builds the lot by hand from lead contact data, and the object still never appears under the submitter's account. The flow loses the login context, forces the user to re-type contact data, and ends in a manual pipeline.

## What Changes

- Add an in-portal multi-step submission wizard at `/user/objects/paku`, registered in the portal host allowlist. Step 1 picks the service; the wizard branches:
  - Sale branches (raieõiguse müük, kinnistu müük): location (cadastres with derived county), object data (area, species, logging types), multi-file uploads (images plus PDFs, max 10 files, 10 MB each), description, prefilled contact from the profile, summary.
  - Service branches (metsamajanduskava, hooldusraie, metsa istutamine): the service-request field set (services, county, provisions, paper copy, comment) with the existing single 10 MB file rule.
- Sale submission creates a draft auction with `seller_id` = submitter, `minBidCents` placeholder 0, mechanics defaulted by type (kinnistu → `sealed`, raieõigus → `open`), county derived from cadastre, generated title/slug and alias email; plus a linked lead row (`source: 'portal'`, `user_id`, auction reference) so the admin Leads kanban stays the single pipeline.
- Service submission reuses `POST /api/v1/service-requests`, stamped with `user_id` when a portal session exists. Validation, rate limits, consent, and the anonymous marketing funnel stay unchanged.
- Specialists auto-assign at submission via the existing county round-robin (lead and auction draft), reassignable in admin; notification templates cover submission-received (user) and new-submission (specialist).
- Publish readiness gains a `minBidCents > 0` gate so a placeholder price can never publish. Status transitions stay admin/DO driven; users cannot publish.
- Minu objektid: the CTA routes to the in-portal wizard, submitted drafts appear under Mustandid immediately, and a new Teenused section lists the user's own service requests with status pills.
- Schema: nullable `user_id` on `service_requests` and `leads`, nullable `auction_id` reference on `leads`, registry mappings, one Drizzle migration. The marketing LeadForm stays as is for anonymous visitors.

## Capabilities

### New Capabilities

- `portal-object-submission`: the in-portal wizard, branch behavior, ownership rules, publish safety, auto-assignment, and notifications.

### Modified Capabilities

- `portal-customer-area`: the Minu müügid CTA routes in-portal and submitted drafts surface under Mustandid; new Minu päringud (Teenused) requirement lists own service requests.
- `service-requests`: new requirement for portal-authenticated submissions stamped with `user_id`.
- `d1-data-layer`: new requirement for submission ownership columns and registry mappings.

## Impact

- Code: `apps/platform/src/lib/data/schema/**` (two columns plus lead auction reference), `apps/platform/drizzle/**` (one migration), `apps/platform/src/lib/data/repositories/registry.ts`, new `apps/platform/src/lib/object-submission/**`, `apps/platform/src/app/api/v1/object-submissions/**` (new), `apps/platform/src/app/api/v1/service-requests/route.ts`, `apps/platform/src/lib/service-requests/ingestion.ts`, `apps/platform/src/app/(portal)/user/objects/**`, `apps/platform/src/lib/routing/host-areas.ts` + `apps/platform/src/middleware.ts` (portal allowlist), `apps/platform/src/app/(admin)/admin/auctions/_lib/auction-schema.ts` (publish gate), `apps/platform/src/app/(admin)/admin/leads/[id]/page.tsx` (auction reference display), `apps/platform/src/lib/notifications/**` + seed templates.
- No dependency changes. CSP unchanged. Marketing and admin surfaces otherwise unchanged.
- Known risks: registry mapping gaps silently return empty query results (dedicated tests required); upload caps must be enforced server-side before the R2 write; `my-auctions` actions already key off `seller_id === userId` (verified, no role gate), so private/company submitters gain full owner actions with no permission work.
- Verification: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
