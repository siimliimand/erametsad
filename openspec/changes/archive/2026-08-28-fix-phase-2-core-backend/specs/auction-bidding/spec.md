## MODIFIED Requirements

### Requirement: Auction collection complete field model
The Auction collection SHALL include a required `type` select field with
values `open` and `sealed` (default `open`). Collection validation SHALL
force `sealed` for `kinnistu` and `pakett` object types. All other field
groups remain as specified (identity/status including `isQuickAuction`
and `endYear`, location with coordinates and register links, land/forest
data, pricing, content, package fields, specialist, seller).

#### Scenario: Property auction must be sealed
- **WHEN** an auction with objectType `kinnistu` is saved with type
  `open`
- **THEN** validation fails with an Estonian error message

#### Scenario: Sealed flag stored on the row
- **WHEN** a sealed auction is created
- **THEN** the row stores `type: 'sealed'` and the ending worker can
  branch on it

### Requirement: Auction status lifecycle
The transition guard SHALL remain exactly: `draft → scheduled → active →
ended`, `ended → appraised | unsold`, `appraised → contract`,
`unsold | contract → completed → archived`. All status writes, including
worker updates, SHALL pass through the guard; no code path SHALL write a
status transition the guard rejects.

#### Scenario: Worker path passes the guard
- **WHEN** the ending worker processes an open auction with no bids
- **THEN** the auction moves `active → ended → unsold` and neither update
  throws
