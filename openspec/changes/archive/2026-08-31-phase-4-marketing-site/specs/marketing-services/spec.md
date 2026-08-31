# marketing-services

## ADDED Requirements

### Requirement: Raieõiguse müük page

`/teenused/raieoiguse-muuk` SHALL render: hero with dual CTA, a LeadForm,
a 9-step process accordion grouped into Eeltöö, Oksjon, and Tulemus with
working `#anchors`, fee and liability cards (3% + VAT, 0 € if unsold), and
a buyer-vetting block.

#### Scenario: Anchor deep link

- **WHEN** a visitor follows `/teenused/raieoiguse-muuk#oksjon`
- **THEN** the page scrolls to the Oksjon group with that group expanded

### Requirement: Kinnistu müük page

`/teenused/kinnistu-muuk` SHALL render the raieõiguse skeleton plus a
sealed-bid explainer with an SVG diagram and a comparison table, and a
pakettoksjonid band.

#### Scenario: Sealed-bid explainer

- **WHEN** a visitor opens the page
- **THEN** the sealed-bid section renders the diagram and the comparison
  table between open and sealed auctions

### Requirement: Metsa hindamine template

`/teenused/metsa-hindamine` SHALL render the SEO-article template:
hero -> ticker -> LeadForm -> article body with StickyTOC -> CTA band ->
LeadForm. The template SHALL be built once and reusable for later
long-tail instances.

#### Scenario: Template instance

- **WHEN** the page renders
- **THEN** all six template sections appear in order and the StickyTOC
  tracks the article headings

### Requirement: Metsateatis page

`/metsateatis` SHALL render a screenshot Steps tutorial with lightbox,
sidebar links, a sticky LeadForm, and HowTo JSON-LD. The path
`/metsateatise-juhend` SHALL 301 to `/metsateatis`.

#### Scenario: Legacy path redirect

- **WHEN** a client requests `/metsateatise-juhend`
- **THEN** the middleware responds with a 301 to `/metsateatis`

### Requirement: Hindamisaktid page

`/hindamisaktid` SHALL render a sticky numbered side-nav, 5 sections,
prices from €480 plus VAT, and mailto ordering.

#### Scenario: Section navigation

- **WHEN** a visitor clicks a side-nav number
- **THEN** the page scrolls to that section and the active item highlights

### Requirement: Kiiroksjon page

`/kiiroksjon` SHALL render a dark hero with "48 H", a 5-step process with
the emphasized house-backup step, benefit and suitability checklists, and
two LeadForms.

#### Scenario: House-backup emphasis

- **WHEN** the process renders
- **THEN** the house-backup step renders with the emphasis variant
