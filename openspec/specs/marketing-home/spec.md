# marketing-home Specification

## Purpose
TBD - created by archiving change phase-4-marketing-site. Update Purpose after archive.
## Requirements
### Requirement: Homepage composition

`/` on the default host SHALL render in spec order: hero with photo
overlay and LeadForm (form_name `avaleht-1`), the "Plaanis metsa müük?"
band, the AuctionTicker, 4 mini SpecialistCards, the trust statistics
block, the 3-column process with anchor deep links, the latest 3 articles,
the newsletter block, testimonials, and the closing LeadForm
(`avaleht-2`) at `#kontaktvorm`.

#### Scenario: Full composition renders

- **WHEN** the homepage loads with seeded data
- **THEN** all sections render in spec order with the Estonian draft copy

#### Scenario: Empty article block

- **WHEN** the CMS has no published articles
- **THEN** the articles section is hidden and the page renders without it

### Requirement: Auction ticker freshness

The ticker SHALL render 4 active lots server-side and refresh client-side
every 60 seconds. Each card SHALL link to the lot on the portal host and
show a server-synced countdown. With no active lots the ticker SHALL show
the info card "Hetkel pole avatud oksjoneid" with a link to the portal
notifications.

#### Scenario: Empty ticker

- **WHEN** no active auctions exist
- **THEN** the info card replaces the ticker

### Requirement: Trust statistics resilience

The statistics block SHALL read `GET /api/v1/statistics` with 24-hour
revalidation and SHALL hide entirely when the API fails or returns no
data. It SHALL never render zeros.

#### Scenario: Statistics API down

- **WHEN** the statistics request fails
- **THEN** the block is absent and the rest of the page renders

### Requirement: Newsletter block

The homepage newsletter block SHALL submit the email to
`POST /api/v1/newsletter` and show the toast "Kontrolli posti — saatsime
kinnitussõnumi". An already-subscribed address SHALL receive the same
neutral confirmation.

#### Scenario: Duplicate subscribe

- **WHEN** a visitor submits an email that is already subscribed
- **THEN** the block shows the neutral confirmation and no error

