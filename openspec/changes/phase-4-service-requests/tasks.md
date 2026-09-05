# Tasks: phase-4-service-requests

Annotation format: `<!-- agent: <name>.<tier>, depends_on: [<ids>], touches: [<globs>] -->`

## 1. Routing and data layer

- [x] 1.1 Classify `/paringud` and `/paringud/*` as marketing-only paths in `host-areas.ts` (path + prefix lists); portal-host requests 308 to the default host preserving path and query; extend middleware unit tests for the new branches <!-- agent: fullstack-engineer.build, depends_on: [], touches: [apps/platform/src/lib/routing/host-areas.ts, apps/platform/src/middleware.ts, apps/platform/src/middleware.test.ts] -->
- [x] 1.2 Add `service_requests` and `partners` tables (service_requests: type TEXT with CHECK kava|hooldusraie|istutamine, payload TEXT-JSON, attachments TEXT-JSON, routed_to TEXT-JSON, status TEXT with CHECK new|routed, consent_at, form_name, page_slug, ip_hash, timestamps; partners: name, service_types TEXT-JSON, counties TEXT-JSON, capacity, contact email/phone, active) + Drizzle Kit migrations + repositories with registry entries; schema lint clean <!-- agent: fullstack-engineer.build, depends_on: [], touches: [apps/platform/src/lib/data/schema/service-requests.ts, apps/platform/src/lib/data/schema/partners.ts, apps/platform/src/lib/data/schema/index.ts, apps/platform/src/lib/data/repositories/service-requests.ts, apps/platform/src/lib/data/repositories/partners.ts, apps/platform/src/lib/data/repositories/registry.ts] -->
- [x] 1.3 Per-type zod validators in `packages/types`: contact fields (EE phone, email), multi-cadastral input parsing tolerant of commas/spaces with `NNNNN:NNN:NNNN` validation per entry, county reference, per-type service checkbox groups with the at-least-one rule (hooldusraie: hooldamine|valgusraie; istutamine: maapinna_ettevalmistus|istikud|istutamine), provisions, paper_copy <!-- agent: fullstack-engineer.build, depends_on: [], touches: [packages/types/src/] -->
- [x] 1.4 Ingestion + routing services in `lib/service-requests/`: honeypot check, per-type payload normalization, duplicate throttle (same phone + cadastral unit within 10 minutes), partner selection (active AND service type AND county; kava matches all counties), routed_to[] persistence, routedCount + zero-match fallback result <!-- agent: fullstack-engineer.build, depends_on: [1.2, 1.3], touches: [apps/platform/src/lib/service-requests/ingestion.ts, apps/platform/src/lib/service-requests/routing.ts, apps/platform/src/lib/service-requests/__tests__/] -->

## 2. Submission API

- [x] 2.1 `POST /api/v1/service-requests`: JSON bodies for kava/istutamine, multipart/form-data for hooldusraie with one PDF/JPG/PNG file up to 10 MB stored in R2 under `service-requests/` (reuse the media upload validation helpers), IP rate limit 5/min, honeypot neutral success, 422 per-field errors, 409 duplicate throttle, 201 with routedCount; unit tests for the validation matrix, throttle, routing selection, and file rules <!-- agent: fullstack-engineer.build, depends_on: [1.4], touches: [apps/platform/src/app/api/v1/service-requests/route.ts, apps/platform/src/app/api/v1/service-requests/__tests__/] -->

## 3. Hub page

- [x] 3.1 `/paringud` hub per spec 09: hero with the 7-day promise, three service cards (grey "Hetkel pole saadaval" state when a service has no active partners), three-step how-it-works block, anonymized active-partner counts per service read server-side from the partners table with `revalidate = 3600`, ItemList + BreadcrumbList JSON-LD, no LeadForm, hidden `/liitu` link <!-- agent: fullstack-engineer.build, depends_on: [1.2], touches: [apps/platform/src/app/(marketing)/paringud/page.tsx, apps/platform/src/app/(marketing)/paringud/_components/ServiceCards.tsx] -->

## 4. Form pages

- [x] 4.1 Shared request-form kit: `ServiceRequestForm` shell (FormInput contacts, multi-cadastral input with inline errors, county FormSelect, provisions, per-type fieldset+legend checkbox groups, comment, ConsentCheck with forwarding wording, honeypot `company_website`, submit lock, Toast), localStorage draft 24 h that never stores the consent checkbox or file and clears on success, `PromiseBand`, `RequestTabs` (real links with active state), success EmptyState with routedCount copy and the zero-partner fallback, network-error retry state <!-- agent: fullstack-engineer.build, depends_on: [2.1], touches: [apps/platform/src/app/(marketing)/paringud/_components/ServiceRequestForm.tsx, apps/platform/src/app/(marketing)/paringud/_components/PromiseBand.tsx, apps/platform/src/app/(marketing)/paringud/_components/RequestTabs.tsx, apps/platform/src/app/(marketing)/paringud/_lib/use-request-draft.ts] -->
- [x] 4.2 `/paringud/metsamajanduskava` per spec 10: content column (mis on metsamajanduskava, ajakava), form with cadastres required, paper_copy checkbox, no county/provisions fields, FAQ links in the promise band, Service + BreadcrumbList JSON-LD, analytics events (tab_switch, service_request_start, service_request_validation_error, service_request_complete with routed_count_bucket) <!-- agent: fullstack-engineer.build, depends_on: [4.1, 3.1], touches: [apps/platform/src/app/(marketing)/paringud/metsamajanduskava/page.tsx] -->
- [x] 4.3 `/paringud/hooldusraie` per spec 11: county + cadastres + provisions required, hooldamine/valgusraie checkbox group with at-least-one error, FormFile (PDF/JPG/PNG, max 10 MB, single file, client type/size check, accessible file button), multipart submit with in-button progress + aria-live, draft persists without the file, server file-failure retry state <!-- agent: fullstack-engineer.build, depends_on: [4.1], touches: [apps/platform/src/app/(marketing)/paringud/hooldusraie/page.tsx] -->
- [x] 4.4 `/paringud/metsa-istutamine` per spec 12: restoration-deadline content column, three service-part checkboxes in a fieldset (maapinna_ettevalmust/istikud/istutamine, at least one), comment hint with area in hectares, form_name `metsa-istutamine-1`, cross-link to `/paringud/hooldusraie` <!-- agent: fullstack-engineer.build, depends_on: [4.1], touches: [apps/platform/src/app/(marketing)/paringud/metsa-istutamine/page.tsx] -->

## 5. Seed

- [x] 5.1 Seed demo partners (two or three per service type across demo counties, including one inactive partner) and sample service_requests covering every type and status so hub counts and the future admin routing screen have data; extend `seed:reset` <!-- agent: fullstack-engineer.build, depends_on: [1.2], touches: [apps/platform/src/lib/data/seed/, apps/platform/src/payload/seed/] -->

## 6. SEO, sitemap, analytics

- [x] 6.1 Metadata (title/desc/OG/canonical) for the four pages via the shared seo helpers, sitemap entries for `/paringud` and the three form routes, `track()` wiring for the spec'd event names, cache tiers: hub `revalidate = 3600`, form pages static shells <!-- agent: fullstack-engineer.fast, depends_on: [3.1, 4.2, 4.3, 4.4], touches: [apps/platform/src/app/sitemap.ts, apps/platform/src/app/(marketing)/paringud/] -->

## 7. Tests and verification

- [x] 7.1 Component and route tests: hub partner counts + disabled card state, draft persistence excluding consent and file, checkbox-group validation, success/zero-partner/network-error states (extends 1.1 middleware tests and 2.1 API tests) <!-- agent: fullstack-engineer.build, depends_on: [4.2, 4.3, 4.4], touches: [apps/platform/src/app/(marketing)/paringud/_components/__tests__/] -->
- [ ] 7.2 Run lint, typecheck, build, and the full test suite; fix fallout <!-- agent: fullstack-engineer.fast, depends_on: [2.1, 5.1, 6.1, 7.1], touches: [] -->
