# d1-data-layer Specification

## Purpose
TBD - created by archiving change option-b-cloudflare-only. Update Purpose after archive.
## Requirements
### Requirement: Drizzle schema in SQLite dialect
The system SHALL define all 26 former Payload collections as a Drizzle
schema in SQLite dialect, split into core (transactional) and content
(CMS-like) groups. The Postgres-to-SQLite mapping rules SHALL apply with
no exceptions: money as INTEGER cents, enums as TEXT with
`CHECK (col IN (...))`, `jsonb` as TEXT parsed in the repository layer,
UUIDs as app-generated TEXT via `crypto.randomUUID()`, and timestamps as
TEXT ISO-8601 UTC. The `auctions` table SHALL carry an indexed nullable
`cut_deadline_year` INTEGER column derived from the `deadlines` JSON
`loggingDeadline` value, backfilled by migration and recomputed on the
repository write path. The auction object-type enum SHALL include
`pollumaa`. The user status enum SHALL include `deleted`. Every enum
change SHALL ship as a CHECK-constraint migration that preserves
existing rows.

#### Scenario: Money column stored as cents
- **WHEN** the schema for `bids` is generated
- **THEN** the amount column is INTEGER cents and no money column uses
  `REAL`

#### Scenario: Enum column carries a CHECK constraint
- **WHEN** an enum-like column such as auction status is defined
- **THEN** the column is TEXT and the table DDL includes a CHECK
  constraint with the allowed values

#### Scenario: Cut-deadline year backfills from the JSON
- **WHEN** the migration runs on an auction whose `deadlines` JSON
  holds `loggingDeadline: "2031-12-31"`
- **THEN** `cut_deadline_year` is 2031 and an index covers the column

#### Scenario: Cut-deadline year syncs on write
- **WHEN** an admin saves an auction with a new `loggingDeadline`
- **THEN** `cut_deadline_year` is recomputed in the same write

#### Scenario: pollumaa passes the CHECK constraint
- **WHEN** an auction row is inserted with `object_type = 'pollumaa'`
- **THEN** the insert succeeds under the updated CHECK constraint

#### Scenario: deleted user status passes the CHECK constraint
- **WHEN** a user row is updated to `status = 'deleted'`
- **THEN** the update succeeds under the updated CHECK constraint

### Requirement: Repository layer
App code SHALL read and write data through a first-party repository layer
(`src/lib/data/`) exposing a Payload-like surface: `find`, `findByID`,
`create`, `update`, and `delete`, with `where` support limited to the
operators call sites actually use (from the inventory). The repository
layer SHALL parse TEXT-encoded JSON and SHALL convert cents to currency
at the API boundary.

#### Scenario: Call site equivalence
- **WHEN** a route that previously used the Payload local API reads an
  auction through the repository
- **THEN** it receives the same fields and applies the same filters as
  before the port

### Requirement: Access-control guards
Collection and field access rules that Payload enforced SHALL be encoded
as explicit guard functions in the repository layer, inventoried from
`payload/collections/*.access.ts`. Every mutation and query path SHALL
pass the matching guard server-side.

#### Scenario: Guard rejects an unauthenticated mutation
- **WHEN** an unauthenticated caller invokes a repository mutation that
  requires a role
- **THEN** the guard rejects the call before any data access

### Requirement: Migrations flow
Schema changes SHALL flow through `drizzle-kit generate` into
`wrangler d1 migrations apply`, for both local development (miniflare)
and the remote database. A fresh environment SHALL reach a working
database with migrations alone.

#### Scenario: Fresh database migrates
- **WHEN** `wrangler d1 migrations apply` runs against an empty local D1
- **THEN** all tables are created and the seed can run

### Requirement: D1 binding replaces the Postgres DSN
The `NEON_DATABASE_URL` and `DATABASE_URL` plain-text bindings SHALL be
removed from `wrangler.jsonc` and replaced by a D1 `DB` binding.

#### Scenario: Deployed worker holds no Postgres secret
- **WHEN** the deployed worker configuration is inspected after cutover
- **THEN** it contains a D1 binding and no Postgres connection string

### Requirement: Schema lint for money and enums
A lint step SHALL fail the build when a money column is declared `REAL`
or when an enum-like TEXT column lacks a CHECK constraint.

#### Scenario: Lint rejects a REAL money column
- **WHEN** a schema change declares a money column as `REAL`
- **THEN** the lint fails with a message that cites the integer-cents
  rule

