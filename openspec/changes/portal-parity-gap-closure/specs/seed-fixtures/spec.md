## MODIFIED Requirements

### Requirement: Auction type in seed data
Seed auctions SHALL set `type` (`open`/`sealed`) on every row, with at
least one sealed auction per supported object type in `ended` status
holding encrypted sealed bids ready for the live opening demo. The
Settings seed SHALL enable the framework-contract gate
(`requireFrameworkContract: true`). Seed auctions SHALL carry photos:
the seed run SHALL create `media` rows pointing at the bundled
same-origin assets under `apps/platform/public/seed/lot-photos/` and
SHALL attach 1-3 image entries to each auction's `media` JSON, so the
listing cards and the detail gallery render photos; the asset set SHALL
ship with `ATTRIBUTION.md` crediting the sources. Seed auctions SHALL
carry `deadlines` values (`loggingDeadline`, `removalDeadline`) so the
cut-deadline year column backfills and the dossier deadline rows
render. Seed logging codes SHALL use the canonical uppercase set VR,
HR, SR, LR, RD. The seed SHALL include `pollumaa` auctions in active
and ended states so the Põllumaad tab and the archive Põllumaa chip
have data. The seed SHALL leave the social URL settings keys empty.
`pnpm seed:reset` SHALL run against D1 through the repository layer and
SHALL reproduce the current fixture dataset unchanged.

#### Scenario: Fresh seed supports the sealed demo
- **WHEN** `pnpm seed:reset` completes against a fresh local D1
- **THEN** a sealed auction exists in `ended` status whose bids decrypt
  to the documented demo amounts during the ceremony

#### Scenario: Fresh seed shows photos on the listing
- **WHEN** `pnpm seed:reset` completes and the listing renders
- **THEN** lot cards show forest photos from the bundled assets instead
  of the SVG placeholder

#### Scenario: Fresh seed feeds the Raietähtaeg filter
- **WHEN** the listing renders after `pnpm seed:reset`
- **THEN** the Raietähtaeg select offers the years present in seed
  `loggingDeadline` values and selecting one returns matching auctions

#### Scenario: Fresh seed fills the Põllumaad tab
- **WHEN** the user opens `/?tab=polumaad` after `pnpm seed:reset`
- **THEN** at least one active pollumaa auction is listed

#### Scenario: Seed resets reproducibly
- **WHEN** `pnpm seed:reset` runs twice in a row
- **THEN** the second run wipes and reproduces the same dataset without
  errors
