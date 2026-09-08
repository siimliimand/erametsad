# marketing-content Specification

## Purpose
TBD - created by archiving change phase-4-marketing-site. Update Purpose after archive.
## Requirements
### Requirement: KKK hub and categories

`/kkk` SHALL render a hub with chip navigation. `/kkk/[category]` SHALL
render one of 7 CMS categories with a SearchableAccordion that supports
`#q-slug` deep links, diacritic-insensitive filtering, and aria-live
result counts. Each category page SHALL emit FAQPage JSON-LD. FAQ items
whose show_until date has passed SHALL not render.

#### Scenario: Deep link to a question

- **WHEN** a visitor opens `/kkk/oksjonid#q-maksmine`
- **THEN** the accordion scrolls to that question and opens it

#### Scenario: Expired FAQ item

- **WHEN** a FAQ item has a show_until date in the past
- **THEN** the item is absent from the page and from the JSON-LD

### Requirement: About and specialists

`/meist` SHALL render the company card from Settings and the CEO quote.
`/meist/metsaspetsialistid` SHALL render 6 SpecialistCards with direct
contacts. `/meist/[slug]` SHALL render a specialist profile with bio, the
specialist's active lots, their articles, and a prefilled LeadForm.

#### Scenario: Specialist profile

- **WHEN** a visitor opens a specialist profile
- **THEN** the page shows the bio, active lots linked to the portal host,
  articles, and a LeadForm with form_name `spetsialist-<slug>`

### Requirement: Articles hub and template

`/artiklid` SHALL render category chip navigation, a featured article,
9-per-page pagination, and a newsletter block. `/artiklid/[slug]` SHALL
render the article template with author link, table of contents, CMS CTA
band, and related articles. The static category routes `/artiklid/uudised`,
`/artiklid/klientide-lood`, and `/artiklid/kasutustingimused` SHALL filter
the hub by category.

#### Scenario: Category filter

- **WHEN** a visitor opens `/artiklid/klientide-lood`
- **THEN** the hub lists only articles in that category with the same
  layout as the main hub

### Requirement: Contact page

`/kontakt` SHALL render the company card, direct phones, 3 specialists, a
full LeadForm, and a map block with a static-image fallback.

#### Scenario: Map tile failure

- **WHEN** the map tiles fail to load
- **THEN** the static fallback image renders instead

### Requirement: Contracts document list

`/lepingud` on the default host SHALL render the versioned legal document
list from the CMS with no email gate and a version-notification signup.
The portal contract signing stays at `/lepingud` on the portal host.

#### Scenario: Portal route unaffected

- **WHEN** an authed user opens `/lepingud` on the portal host
- **THEN** the contract signing list renders as shipped in phase 3

### Requirement: Page block storage

The CMS SHALL store marketing page content as ordered blocks:
`page_blocks` rows (pageId, type, ordinal, configJson) validated against
a block type registry with zod configs for hero, text, cards, accordion,
form, ticker, stats, cta, testimonials, and faq. Ordinals SHALL stay
contiguous under reorder, insert, and delete.

#### Scenario: Invalid block config rejected

- **WHEN** a block is saved with a config that fails its registry schema
- **THEN** the write is rejected with field-level errors and nothing is
  stored

### Requirement: Block builder UI

The page editor SHALL provide a block builder: an ordered block list
with move up/down and delete, an add-block menu from the registry, and a
per-block settings drawer, alongside a live read-only preview pane with
desktop and mobile width toggles. Destructive block changes SHALL use
the shared confirm dialog.

#### Scenario: Preview follows order

- **WHEN** a block is moved, added, or deleted
- **THEN** the preview re-renders in the same order without a page
  reload

### Requirement: Page version snapshots

Publishing a page SHALL create a version snapshot of its blocks. A
versions drawer SHALL list snapshots with author and time, show a
two-column diff between the current and a chosen version, and offer
restore. Snapshots SHALL be retained per the CMS retention policy.

#### Scenario: Restore returns to a snapshot

- **WHEN** an operator restores an earlier version
- **THEN** the block list and preview match that snapshot and the
  restore is recorded

### Requirement: Marketing block rendering

The marketing pages route SHALL render stored blocks through a shared
`PageBlocks` renderer component that maps each registry type to its
presentation, so admin preview and public rendering stay visually
consistent. Pages without blocks SHALL keep rendering their existing
content path.

#### Scenario: Legacy pages still render

- **WHEN** a page has no stored blocks
- **THEN** the route falls back to the previous rendering without error

