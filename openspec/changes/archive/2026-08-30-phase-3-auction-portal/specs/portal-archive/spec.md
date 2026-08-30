## ADDED Requirements

### Requirement: Archive tabs and counters
`/ajalugu` SHALL present the same five type tabs with archived counters
from archived statistics, persisted in the URL, defaulting to the first
tab.

#### Scenario: Tab counters reflect archive
- **WHEN** the archive loads
- **THEN** each tab label shows its archived auction count

### Requirement: Archive filters and sorting
The archive FilterPanel SHALL offer county, parish, endYear multi-select
chips (years with data only), final price range, area range, and
species/logging types on the forest tab, all URL-encoded. Default sort
SHALL be final price descending; end time and start price sorts SHALL also
be available. Pagination SHALL be server-side at 24 per page.

#### Scenario: Filter to a single year
- **WHEN** the user selects endYear 2025
- **THEN** only lots that ended in 2025 are listed and the URL carries the
  filter

### Requirement: Archive card privacy
Archive cards SHALL show image, name, endYear badge, "Lõppenud" StatusPill,
final price (or "Müümata jäi"), end date, county, and area. They SHALL NOT
show winner identity or bid counts anywhere on the archive or the ended
detail, and a privacy footer line SHALL state that only final prices are
published.

#### Scenario: No winner leakage
- **WHEN** any user browses the archive or an ended lot's detail
- **THEN** no winner name, bidder identity, or bid count is rendered

### Requirement: Unsold archive entries
Unsold lots SHALL render with the "Müümata jäi" presentation instead of a
final price.

#### Scenario: Unsold card
- **WHEN** an archived lot has no sale
- **THEN** its card shows "Müümata jäi" where the price would be

### Requirement: Ended detail cross-link
Ended lot pages SHALL offer "Vaata sarnaseid oksjoneid" linking to the
active listing filtered by the same county and object type.

#### Scenario: Similar lots link
- **WHEN** the user clicks the similar-lots link on an ended lot
- **THEN** the listing opens filtered to that county and type
