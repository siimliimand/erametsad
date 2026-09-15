# Tasks

## 1. Data layer

- [ ] 1.1 Add nullable `user_id` to `service_requests` and `leads`, nullable `auction_id` reference to `leads`, update registry mappings, generate Drizzle migration, add repository tests for filtering by each new column <!-- agent: fullstack-engineer.build, depends_on: [], touches: [apps/platform/src/lib/data/schema/**, apps/platform/src/lib/data/repositories/registry.ts, apps/platform/drizzle/**] -->
- [ ] 1.2 Create shared zod submission schemas for sale and service branches (portal-safe: no pricing, mechanics, schedule, or specialist fields) with unit tests <!-- agent: fullstack-engineer.build, depends_on: [], touches: [apps/platform/src/lib/object-submission/**] -->

## 2. Submission backend

- [ ] 2.1 Sale branch: POST /api/v1/object-submissions creates the owned draft auction (seller_id, minBidCents 0, kinnistu→sealed and raieõigus→open defaults, derived county, generated title/slug/aliasEmail), the linked portal lead (source, user_id, auction reference), county round-robin specialist assignment on both, audit entries; route tests <!-- agent: fullstack-engineer.build, depends_on: [1.1, 1.2], touches: [apps/platform/src/app/api/v1/object-submissions/route.ts, apps/platform/src/lib/object-submission/sale-branch.ts, apps/platform/src/lib/leads/ingestion.ts] -->
- [ ] 2.2 Service branch: stamp session user_id on authenticated POST /api/v1/service-requests, keeping validation, consent, rate limits, and the single-file rule; route tests <!-- agent: fullstack-engineer.build, depends_on: [1.1, 1.2], touches: [apps/platform/src/app/api/v1/service-requests/route.ts, apps/platform/src/lib/service-requests/ingestion.ts] -->
- [ ] 2.3 Multi-file upload endpoint for sale drafts in R2 (max 10 files, 10 MB each, enforced server-side before the write), reusing media bucket helpers; tests <!-- agent: fullstack-engineer.build, depends_on: [1.2], touches: [apps/platform/src/lib/object-submission/uploads.ts, apps/platform/src/app/api/v1/object-submissions/files/route.ts] -->
- [ ] 2.4 Add `minBidCents > 0` to publish readiness gates with a gate test <!-- agent: fullstack-engineer.build, depends_on: [], touches: [apps/platform/src/app/(admin)/admin/auctions/_lib/auction-schema.ts] -->
- [ ] 2.5 Notification templates for submission-received (submitter) and new-submission (assigned specialist) plus dispatcher wiring <!-- agent: fullstack-engineer.build, depends_on: [2.1, 2.2], touches: [apps/platform/src/lib/notifications/**, apps/platform/src/lib/data/seed/**] -->
- [ ] 2.6 Lead detail page shows the linked auction reference with a link to the admin auction <!-- agent: fullstack-engineer.fast, depends_on: [1.1], touches: [apps/platform/src/app/(admin)/admin/leads/[id]/page.tsx] -->

## 3. Portal wizard

- [ ] 3.1 Create the /user/objects/paku route with page shell and session guard; register the route in the portal host allowlist (host-areas + middleware) <!-- agent: fullstack-engineer.build, depends_on: [], touches: [apps/platform/src/app/(portal)/user/objects/paku/page.tsx, apps/platform/src/lib/routing/host-areas.ts, apps/platform/src/middleware.ts] -->
- [ ] 3.2 Build the wizard step components: service selector, location (cadastres, auto county), sale object data, service-branch details, file uploads, description with prefilled contact, summary; client-side validation against the shared schema <!-- agent: fullstack-engineer.build, depends_on: [1.2, 3.1], touches: [apps/platform/src/app/(portal)/user/objects/paku/_components/**] -->
- [ ] 3.3 Wire submission: sale branch posts to /api/v1/object-submissions with uploaded file keys, service branch posts to /api/v1/service-requests; success redirects to /user/objects <!-- agent: fullstack-engineer.build, depends_on: [2.1, 2.2, 2.3, 3.2], touches: [apps/platform/src/app/(portal)/user/objects/paku/_components/**] -->
- [ ] 3.4 Swap the "Paku oma objekti" CTA href from marketingUrl to the internal route and update the objects-client tests <!-- agent: fullstack-engineer.fast, depends_on: [3.1], touches: [apps/platform/src/app/(portal)/user/objects/_components/objects-client.tsx, apps/platform/src/app/(portal)/user/objects/_components/__tests__/objects-client.test.tsx] -->

## 4. Portal lists

- [ ] 4.1 Add the Teenused section to /user/objects listing the user's own service requests (type label, status pill, created date) with an empty state <!-- agent: fullstack-engineer.build, depends_on: [1.1], touches: [apps/platform/src/app/(portal)/user/objects/page.tsx, apps/platform/src/app/(portal)/user/objects/_components/service-requests-section.tsx] -->

## 5. Verification

- [ ] 5.1 Run pnpm lint, typecheck, test, build; fix fallout <!-- agent: fullstack-engineer.fast, depends_on: [2.5, 2.6, 3.3, 3.4, 4.1], touches: [] -->
