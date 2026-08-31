# marketing-seo

## ADDED Requirements

### Requirement: Per-page metadata

Every marketing page SHALL emit title, description, canonical, and
OpenGraph metadata through the shared helpers. Canonical URLs SHALL use
the marketing host.

#### Scenario: Canonical on a nested page

- **WHEN** a crawler reads `/teenused/kinnistu-muuk`
- **THEN** the canonical link points at the marketing host with that path

### Requirement: Structured data

The site SHALL emit JSON-LD through shared builders: Organization on the
home page, Service on service pages, FAQPage on KKK category pages, HowTo
on Metsateatis, and BreadcrumbList on nested pages.

#### Scenario: Home Organization

- **WHEN** the home page renders
- **THEN** an Organization JSON-LD block is present with name, contacts,
  and sameAs social links

### Requirement: Sitemap and robots

`/sitemap.xml` and `/robots.txt` SHALL be generated routes. The sitemap
SHALL cover marketing URLs plus public portal URLs with canonical hosts.
The shared-path classification SHALL keep both files served identically on
both hosts.

#### Scenario: Sitemap contents

- **WHEN** a crawler fetches `/sitemap.xml`
- **THEN** marketing pages and public portal pages appear with their
  canonical host URLs

### Requirement: Caching tiers

Content pages SHALL use ISR with 1-hour revalidation. Statistics SHALL use
24-hour revalidation with hide-on-failure. The ticker SHALL refresh
client-side every 60 seconds.

#### Scenario: Content revalidation

- **WHEN** a CMS article changes
- **THEN** the article page serves stale content for at most 1 hour
