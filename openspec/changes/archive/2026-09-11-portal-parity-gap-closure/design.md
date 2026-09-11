## Context

The demo parity build recorded its shortcuts in DESIGN.md. This change closes them. The relevant facts from the current code:

- `auctions.media` and `auctions.files` are TEXT-JSON columns of media entries `{id, url, filename, mimeType, filesize}`; the detail page and `PortalLotCard` already render images when entries exist. The `media` table, the upload API, R2 storage, renditions, and the admin wizard MediaStep all exist. Only seed data is missing.
- The `deadlines` TEXT-JSON column carries `loggingDeadline` ("Raie teostamise tähtaeg") and `removalDeadline` ("Väljaveo tähtaeg"), written by the admin wizard (`StepLandForest`) and read by the detail dossier. The listing filter param `cutDeadlineYear` is parsed and serialized but ignored by the query layer.
- `auctionObjectTypes = ['raieoigus', 'kinnistu', 'kiire', 'pakett']`. The Põllumaad tab and the archive Põllumaa chip reduce to empty by design comment.
- Seed logging codes are `U`, `H`, `L` (fictional legacy set); chips send `vr`, `hr`, `sr`, `lr`, `rd`; `matchesLoggingTypes` compares case-sensitively.
- `userStatuses = ['active', 'suspended']`; bids are append-only; `auctions.sellerId` references `users.id`; the audit log is an immutable hash chain.
- The email sender (`src/lib/notifications/email-sender.ts`) supports the `email-binding`, `cloudflare-api`, and `smtp` transports with Mailpit fallback.
- CSP limits `img-src` to self, data, and blob.

## Goals

- Every recorded listing/archive filter gap behaves like the demo.
- The auctions pages show real photos instead of placeholders.
- The three self-service actions do what their buttons say.
- The footer stops pointing at invented social handles.

## Non-Goals

- No admin media-upload changes; the existing wizard flow stays.
- No production `.ee` cutover work.
- No new notification categories or channels.
- No redesign; the demo design is the baseline already shipped.

## Decisions

### D1: Cut-deadline year as a backfilled column, not json_extract

Filter on a new indexed `cut_deadline_year` INTEGER column. A migration backfills it from `deadlines` JSON with the same tolerant key set the detail dossier uses (`loggingDeadline`, `logging`, `raie`), mirroring the migration 0018 pattern that backfilled `area_ha`/`volume_m3`. The auction write path (repository) recomputes it so admin edits stay in sync. Rationale: the JSON is free-form and the key set is open; a column keeps the filter index-backed and the query simple. Alternative rejected: `json_extract` in the WHERE clause (brittle against key variants, no index).

### D2: Canonical logging codes are the demo set; matching is case-insensitive

The canonical stored codes are `VR`, `HR`, `SR`, `LR`, `RD` (uppercase). `matchesLoggingTypes` normalizes both sides to uppercase before comparing. Seed data is fictional, so the seed file is rewritten to canonical codes instead of carrying a legacy mapping. The SQL migration maps the two unambiguous legacy pairs (`H` → `HR`, `L` → `LR`) and leaves other stored values untouched; rows with other codes simply do not match chips until an admin edits them. Rationale: the old `U`/`T`/`R` codes have no documented meaning in this repo; inventing a semantic mapping would fabricate data.

### D3: pollumaa joins the object-type enum

Add `pollumaa` to `auctionObjectTypes` with a CHECK migration, label maps (`PortalLotCard`, admin labels), the Põllumaad tab `objectTypes: ['pollumaa']`, and the archive chip filter. Pollumaa rows carry area and price but no volume (m³), which the summary already handles ("without volume for other types"). Seeds add a small number of pollumaa auctions in active and ended states so the tab, the chip, and the archive have data.

### D4: Seed photos as same-origin static assets

Bundle 8 forest photos (Unsplash license, WebP, resized to card/gallery sizes, well under 5 MB total) under `apps/platform/public/seed/lot-photos/` with an `ATTRIBUTION.md`. The seed run creates `media` rows whose `url` points at these public paths and attaches 1-3 per auction in the `media` JSON. No R2 involvement in seeds, no CSP change, no external host. The SVG fallback stays for lots without media. Alternative rejected: generating synthetic SVG "photos" (looks worse and still fails the design intent); remote Unsplash URLs at runtime (violates CSP).

### D5: Test notification sends through the real sender

`POST /api/v1/my/notifications/test` builds a sample notification for the signed-in user from an existing transactional template, sends it with `email-sender` to the user's own address, and rate-limits per user (reuse the service-request rate-limit helper, 1 per minute). The preference-matrix button calls the endpoint and reports success or failure honestly. Rationale: the button's job is to prove the pipeline works; a toast-only implementation hides breakage.

### D6: Export as a streamed ZIP built with fflate

`GET /api/v1/my/export` gathers the user's records (user row without ciphertext fields, profiles, bids, autobidders, auction rights, consent log entries, notification preference state, sessions metadata, own service requests and rights requests) and streams a ZIP. Use `fflate` (small, dependency-free, Workers-compatible, synchronous zip API). Filename: `erametsad-andmed-<date>.zip`. Auth required; rate-limit per user. The dependency addition needs the approval this proposal received.

### D7: Deletion anonymizes; it does not drop the row

Add `deleted` to `userStatuses`. `POST /api/v1/my/delete-account` requires a typed confirmation (`KUSTUTA`), refuses while the user has active participation (active auction bids, live autobidders, pending contracts), then: wipes `name`, `phone`, address fields in profiles, replaces `email` with `deleted-<id>@invalid.local`, erases `isikukood*` columns and password hash/salt, revokes all sessions, and writes an audit entry with the reason `user-self-deletion`. The user row stays because bids, contracts, consent log, and the audit chain reference it and are append-only (7-year retention note already shown in the modal). The modal copy stays as the source of truth for what is deleted versus kept. Alternative rejected: hard `DELETE` (breaks FK and append-only rules).

### D8: Social links from settings, hidden when unset

Settings keys `social.facebook_url`, `social.instagram_url`, `social.youtube_url`. The portal footer reads them through the settings repository on render (portal pages are dynamic) and renders the "Jälgi meid" column only when at least one URL is set; unset URLs drop their icons. A small admin settings card ("Sotsiaalsed lingid") lets `settings:write` admins edit the three URLs with URL validation. Seeds set them empty, so the prototype footer shows no fabricated targets until an admin fills them.

## Risks / Trade-offs

- Migration backfill quality: `cut_deadline_year` only fills for auctions whose deadlines JSON carries a parseable date; rows without one simply do not match the filter (the select only offers years that exist).
- `[legacy code]` auctions created before D2's migration may hold unmatched codes; acceptable in the prototype, chips document the five canonical codes.
- Export ZIP contents grow with new user-linked tables; keep the table list in one module so future tables extend one place.
- The deleted-status approach keeps a tombstone row forever; this matches the retention note already promised in the modal.

## Migration Plan

1. Schema migrations land first (one Drizzle migration set: enum CHECK updates, `cut_deadline_year` + backfill, user status CHECK).
2. Seed changes ship in the same change; `pnpm seed:reset` reproduces the new dataset.
3. Query/UI wiring follows; no API contract changes for existing consumers.

## Open Questions

(none — the explore session and the recorded DESIGN.md gaps cover the scope; D2's legacy-code ambiguity is resolved by rewriting seed data rather than inventing a mapping.)
