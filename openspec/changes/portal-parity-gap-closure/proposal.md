## Why

The `portal-demo-design-parity` change brought every portal page to the approved demo design, but the build recorded known gaps (DESIGN.md "Implementation gaps"). On the auctions pages the visible defects are: the Raietähtaeg (aasta) select does not filter, the Raieliigid chips match no stored data, the Põllumaad tab and the archive Põllumaa chip return empty because the schema has no matching object type, and every lot card and gallery renders a placeholder because no seed media exists. Self-service gaps sit next to them: "Saada test-teavitus" fakes success with a toast, "Ekspordi mu andmed (ZIP)" and "Kustuta konto" point at the support channel, and the footer social links point at invented targets. This change closes those gaps.

## What Changes

- Schema: add the `pollumaa` auction object type (enum, CHECK migration, label ripple), a `cut_deadline_year` INTEGER column backfilled from the `deadlines` JSON `loggingDeadline` value and kept in sync on writes, and a `deleted` user status with a PII-anonymization repository helper.
- Seeds: bundle 8 licensed forest photos as same-origin static assets (CSP-safe, no R2 in seeds), create media rows and attach 1-3 images to each seed auction, add `deadlines.loggingDeadline` / `removalDeadline` values, rewrite seed logging codes to the canonical VR/HR/SR/LR/RD set, and add pollumaa auctions for the listing tab and archive chip.
- Listing: the Raietähtaeg select filters server-side on the new column and offers the years that exist in the active set; logging chip matching becomes case-insensitive; the Põllumaad tab queries `pollumaa` auctions instead of rendering the empty state.
- Ajalugu: the Põllumaa type chip filters `pollumaa` auctions.
- Self-service: `POST /api/v1/my/notifications/test` sends a real sample notification email through the existing email sender with per-user rate limiting; `GET /api/v1/my/export` streams a real ZIP of the user's data (fflate); `POST /api/v1/my/delete-account` anonymizes the user, revokes sessions, refuses while active participation exists, and writes an audit entry.
- Shell: footer social URLs come from settings keys (`social.facebook_url`, `social.instagram_url`, `social.youtube_url`); the "Jälgi meid" column hides when all are empty; a small admin settings card manages the URLs.
- DESIGN.md: remove the implementation gaps this change closes from the deviations list.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `d1-data-layer`: the auctions table gains `cut_deadline_year`; the object-type enum gains `pollumaa`; the user status enum gains `deleted`.
- `identity-access`: the User collection documents the `deleted` status and the PII-anonymization semantics (keep the row for bid/contract/audit integrity, wipe personal fields).
- `seed-fixtures`: seed auctions carry media, deadlines, canonical logging codes, and pollumaa rows; the photo assets are bundled with attribution.
- `portal-listing`: the filter panel's Raietähtaeg select applies server-side with stored-year options; logging chips match stored codes case-insensitively; the Põllumaad tab lists pollumaa auctions.
- `portal-archive`: the Põllumaa type chip filters pollumaa auctions.
- `portal-customer-area`: the test-notification action sends a real email; the privacy card exports a real ZIP; account deletion is a real self-service flow.
- `portal-shell`: footer social links are settings-driven and hidden when unset.

## Impact

- Code: `apps/platform/src/lib/data/schema/**`, `apps/platform/drizzle/**`, `apps/platform/src/lib/data/repositories/**`, `apps/platform/src/lib/data/seed/**`, `apps/platform/src/lib/auction/queries.ts`, `apps/platform/src/app/(portal)/**` (listing, ajalugu, user, shell), `apps/platform/src/app/api/v1/my/**`, `apps/platform/src/app/(admin)/admin/settings/**`, `apps/platform/public/seed/**`.
- New dependency: `fflate` (Workers-compatible ZIP writer) for the export endpoint.
- No new external image host; CSP stays unchanged because seed photos are same-origin assets.
- Marketing and admin surfaces stay visually unchanged except the new admin settings card (functional, admin token scope).
- Docs: `DESIGN.md` deviations list updated.
- Verification: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, plus a screenshot pass of the listing, detail, and archive pages and unit tests for every fixed filter and endpoint.
