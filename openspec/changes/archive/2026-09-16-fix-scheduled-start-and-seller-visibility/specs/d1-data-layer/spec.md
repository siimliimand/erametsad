# delta: d1-data-layer

## MODIFIED Requirements

### Requirement: Access-control guards

Collection access SHALL stay expressed as explicit guard functions in the
repository layer, inventoried from the source Payload access rules, and
every operation SHALL pass the matching guard server-side. The `published`
read rule SHALL support `ownFields`: for an authenticated non-admin caller
the read filter becomes `or: [published, ...ownField equals caller]`, so an
auction owner (`seller`) or assigned specialist reads their own row in any
status while anonymous callers read only published rows. Admin roles
bypass the filter. Write rules stay unchanged: sellers gain read access
only, never update, publish, or delete.

#### Scenario: Seller reads their scheduled auction

- **WHEN** a `private` role seller loads `/user/objects`, which queries
  `auctions` with `seller: { equals: <their id> }`
- **THEN** their `scheduled` auction returns alongside `active` rows

#### Scenario: Seller cannot read another seller's draft

- **WHEN** an authenticated caller queries or fetches an auction whose
  `seller` and `specialist` differ from their id and whose status is not
  `active`
- **THEN** the guard filters the row out of results and denies `findByID`

#### Scenario: Guard rejects an unauthenticated mutation

- **WHEN** an anonymous caller attempts a guarded mutation
- **THEN** the guard rejects the call before any data access
