## MODIFIED Requirements

### Requirement: Archive filters and sorting
The archive FilterPanel SHALL offer county, parish, endYear multi-select
chips (years with data only), final price range, area range, and
species/logging types on the forest tab, all URL-encoded, with an
active-filter count badge and "Tühjenda" reset. Default sort SHALL be
final price descending; end time descending, end time ascending, start
price descending, and start price ascending SHALL also be available.
Pagination SHALL be server-side at 24 per page.

#### Scenario: Sort by earliest end
- **WHEN** the user selects end time ascending
- **THEN** the archive orders results by `endTime` ascending and the URL
  carries the sort

#### Scenario: Filter to a single year
- **WHEN** the user selects endYear 2025
- **THEN** only lots that ended in 2025 are listed and the URL carries
  the filter

## ADDED Requirements

### Requirement: Archive statistics band
The archive SHALL show an all-time statistics band per tab with the
count of auctions, total hectares, total m³ (forest tab only), and total
euros, computed from the existing statistics snapshots. The band SHALL
hide gracefully when the aggregation returns no data.

#### Scenario: Band shows per-tab totals
- **WHEN** the user opens the archive forest tab
- **THEN** the band shows the all-time auction count, hectares, volume,
  and euro total for forest rights
