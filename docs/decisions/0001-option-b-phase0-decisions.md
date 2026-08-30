# 0001: Option B Phase 0 decisions

Status: accepted
Date: 2026-08-28
Change: `option-b-cloudflare-only`

## Context

The option-b-cloudflare-only change migrates the platform from Payload CMS on
Postgres to a custom repository layer on Cloudflare D1 and Durable Objects.
Phase 0 produced three spikes and an email investigation. This record signs off
the Payload replacement scope, the integer-cents money rule, and answers the
five open questions from the design doc.

## Decisions

### Full Payload replacement

Replace Payload CMS with a custom repository layer and admin UI. The design
doc lists three sub-options. Sub-option 1 (full replacement) is chosen.

Rationale: consolidation is the goal. Payload has no D1 adapter and needs
native modules that cannot run on Workers. Keeping Payload on an always-on
container reintroduces an external runtime. Waiting for a community adapter
has no timeline.

### Integer-cents money rule

All monetary values use INTEGER cents. No REAL or NUMERIC columns. Convert
at the API boundary. Spike 1.1 confirmed: `typeof(amount_cents)` returns
`integer` end to end through Drizzle, D1, and the batch() path. A schema
lint will enforce this rule.

## Five open questions

### 1. Drafts and versioning

Four collections configure `versions: { drafts: true }`:
- Article (`src/payload/collections/Article.ts:9`)
- LegalDocument (`src/payload/collections/LegalDocument.ts:9`)
- Media (`src/payload/collections/Media.ts:16`)
- Page (`src/payload/collections/Page.ts:9`)

Auction explicitly does not use Payload drafts (`Auction.ts:31-34`). The
comment explains that Payload's auto-generated `_status` enum collides with
the custom auction lifecycle status.

Code search: `_status` is not referenced anywhere outside the Payload
collections config. The `version` field in LegalDocument is a plain text
field, not Payload's versioning system.

Decision: Payload drafts and versioning are configured but not consumed by
application code. The replacement admin will not carry draft/versioning
features. Content collections (Article, Page, LegalDocument) will use a
simple `status` select field. The `version` text field on LegalDocument is
preserved as a user-editable field.

### 2. Launch email volume

The prototype runs under `ww0.dev`. Email Service is not yet enabled (spike
1.3 found that the API token lacks `Email Sending : Edit`, `Email Routing :
Edit`, and `DNS : Read` on `ww0.dev`).

Warm-up plan:
- Enable after token permissions are updated (task 4.2).
- Send initial volume to verified destinations only (quota-exempt under the
  beta terms).
- Monitor `E_DAILY_LIMIT_EXCEEDED` from day one.
- The beta includes 3,000 emails/month. Transactional volume for the
  prototype stays well under that.
- Daily quota ramp on new accounts is the main launch-day risk.

### 3. Production data

No production deployment exists. No zone `erametsad.ee` on the Cloudflare
account. Local dev only. Fresh-seed cutover is the expected path. If
production data appears later, task 8.4's export-transform-import path
applies, using the mapping rules from the design doc.

### 4. Admin user inventory

Initial position: single operator (site owner) with admin or superadmin
role. Specialist role also exists in the access rules. Detailed per-
collection permissions inventory is task 7.1's job. This decision records
that dependency explicitly.

### 5. PDF generation placement

Queue consumer (task 6.1), not in-request. Workers CPU limits make in-
request PDF generation impractical. Generated PDFs stored in R2. The
queue consumer worker handles notification fan-out, email sending, and
contract PDF generation.

## Consequences

- Phase 6 builds a minimal admin without draft or version features.
- The schema lint must catch REAL money columns and missing CHECK
  constraints.
- Task 4.2 must resolve email token permissions before any test send.
- Task 7.1 produces the admin permissions inventory before Phase 6 work
  starts.
- Task 6.1 implements the queue consumer with PDF generation.
