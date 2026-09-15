## ADDED Requirements

### Requirement: Submission ownership columns

The data layer SHALL add a nullable `user_id` column to `service_requests` and
to `leads`, and a nullable `auction_id` reference column to `leads`, through a
Drizzle migration. The repository registry SHALL map the new columns so `where`
filters can query them (for example `user: { equals: <id> }` on
`service_requests` and `leads`). Repository tests SHALL cover filtering by each
new column, because a missing mapping silently returns empty results. Nullable
columns SHALL keep anonymous marketing rows valid without backfill.

#### Scenario: Filter service requests by user

- **WHEN** the portal queries `service_requests` with
  `user: { equals: 'u1' }`
- **THEN** only rows created by user `u1` return, and anonymous rows are
  excluded

#### Scenario: Lead carries its auction reference

- **WHEN** a portal sale submission creates its lead row
- **THEN** the row stores `user_id` and `auction_id`, and a query by either
  column resolves the lead and its draft auction

#### Scenario: Anonymous rows survive the migration

- **WHEN** the migration runs on a database with existing anonymous leads and
  service requests
- **THEN** those rows keep working with NULL ownership columns and no backfill
  is required
