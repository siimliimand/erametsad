# marketing-content

## ADDED Requirements

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
