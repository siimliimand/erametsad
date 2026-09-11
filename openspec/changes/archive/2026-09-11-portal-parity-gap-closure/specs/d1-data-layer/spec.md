## MODIFIED Requirements

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
