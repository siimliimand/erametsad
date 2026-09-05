# Proposal: phase-4-service-requests

## Why

Phase 4 delivered the marketing site, but the Päringud vertical was deferred
in writing: the service-request hub, the three request forms, and the backend
they depend on. The marketing header already advertises a "Päringud" dropdown
with three subpages, and those routes do not exist yet. This change covers the
remaining Phase 4 scope from `docs/tasks.md` (section 4.2 Päringud [S]) plus
the deferred Phase 2 pieces it was blocked on (2.4 ServiceRequest + Partner
directory, 2.8 `POST /api/service-requests` + routing engine). It opens the
second lead funnel: forest-owner service requests recorded and matched to
partner companies.

## What Changes

- **Data**: two additive D1 tables through Drizzle Kit migrations —
  `service_requests` (type kava | hooldusraie | istutamine, per-type payload
  as TEXT-JSON, attachments as TEXT-JSON, routed_to as TEXT-JSON, status with
  CHECK constraint, consent_at, form_name, ip_hash) and `partners` (name,
  service_types, counties, capacity, contact, active) — plus repositories
  registered in the repository registry.
- **Submission API**: `POST /api/v1/service-requests`. JSON bodies for kava
  and istutamine, multipart/form-data for hooldusraie with one PDF/JPG/PNG
  file up to 10 MB stored in R2 under `service-requests/`. Honeypot, IP rate
  limit 5/min, consent required, 422 field errors, duplicate throttle (same
  phone + cadastral within 10 minutes returns 409).
- **Routing engine**: at submission the service selects active partners that
  match the service type and county and records them in `routed_to[]`. The
  API returns `routedCount`; zero routes to the fallback copy "Päring
  salvestati, võtame ise ühendust".
- **Marketing pages**: `/paringud` hub plus `/paringud/metsamajanduskava`,
  `/paringud/hooldusraie`, and `/paringud/metsa-istutamine` per design specs
  09–12. Tabs are real links. Forms share one kit: contact fields,
  multi-cadastral input with tolerant parsing, county select, per-type
  service checkbox groups in a fieldset, consent with forwarding wording,
  honeypot, submit lock, localStorage draft for 24 hours (never the consent
  checkbox or the file), success state with routed count, retry on network
  error. Hooldusraie adds the existing `FormFile` component with upload
  progress.
- **Middleware**: `/paringud` and `/paringud/*` join the marketing-only
  path list; the portal host 308s them to the default host.
- **Seed**: demo partners for every service type across demo counties (one
  inactive) and sample service requests in every type and status.

## Capabilities

### New Capabilities

- `service-requests`: request submission per type, duplicate throttle,
  attachment upload, routing record, hub page, three form pages with drafts
  and success states, disabled-service state.

### Modified Capabilities

- `cloudflare-deployment`: the marketing-only path list gains `/paringud`
  and `/paringud/*` for the cross-host 308 rule.

## Impact

- New files: `schema/service-requests.ts`, `schema/partners.ts`, two
  repositories, `api/v1/service-requests/route.ts`,
  `lib/service-requests/{ingestion,routing}.ts`, per-type validators in
  `packages/types`, four page trees under `(marketing)/paringud/`, shared
  form components, seed additions, `host-areas.ts` edit, middleware tests.
- No changes to the portal, admin, bidding engine, or SSE servers.
- `packages/ui` is a consumer only: `FormFile`, `FormInput`, `FormSelect`,
  `FormCheck`, and `ConsentCheck` already ship in Phase 1.
- The existing `partner_services` CMS table stays untouched. Hub partner
  counts come from the `partners` table instead of a CMS counter field
  (spec 09 offered both; there is no admin UI to update a CMS counter, and
  the partners table is the source of truth).

## Deferred (accepted in writing)

- Admin service-request routing screen (request table, payload viewer,
  routing panel, partner directory CRUD) — Phase 5.5 [S]. Requests are
  recorded with their routing result, but delivery to partner inboxes
  (minimized payload, 14-day signed links, partner notification emails)
  happens there.
- `/liitu` provider signup page (Phase 5). The hub link stays hidden.
- ~20 long-tail SEO instances of the Metsa hindamine template [L].
- Real analytics provider (Plausible/GA4) [S]; the existing `track()`
  skeleton carries the new events.

## Notes

- Only `fullstack-engineer` exists in `.opencode/agents/`, so every task is
  annotated with it plus a `.build` or `.fast` tier. A forms/UX specialist
  would fit this phase; create one with `/make-engineer` if wanted.
- Design specs 09–12 are drafts; copy uses their Estonian draft text.
- Design spec 10 makes the county select optional for kava (cadastre-based),
  so the county field appears only on hooldusraie and istutamine.
