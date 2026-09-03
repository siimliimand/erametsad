# portal-listing Delta

## ADDED Requirements

### Requirement: Free-text search filter
The listing SHALL accept a `q` query parameter as a free-text filter
matching the auction title and cadastral numbers. The portal shell quick
search SHALL submit to the listing with `q`, and the listing SHALL render
filtered results. The filter SHALL combine with the existing filters, sort,
and pagination, and SHALL be clearable via "Tühjenda".

#### Scenario: Quick search filters the listing
- **WHEN** the user submits "metskits" in the shell quick search
- **THEN** the listing shows auctions whose title or cadastral numbers
  match "metskits" and the `q` param is visible in the URL

#### Scenario: Search combines with filters
- **WHEN** a `q` value and a county filter are both active
- **THEN** results satisfy both conditions and the active-count badge
  counts both

#### Scenario: Clearing removes the term
- **WHEN** the user activates "Tühjenda"
- **THEN** the `q` param is removed from the URL and full results return
