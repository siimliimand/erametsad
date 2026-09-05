# admin-ui (delta)

## MODIFIED Requirements

### Requirement: Role-guarded admin route group

The admin SHALL live in `apps/platform/src/app/(admin)/` as table and
form pages on the repository layer with server actions. Every admin
route and action SHALL be guarded by `users.role` (staff roles only:
specialist, seller, admin, superadmin). Specialist access SHALL be
scoped to lots assigned to that specialist and leads assigned to that
specialist; seller access SHALL be scoped to the seller's own lots and
limited to read access plus alapakkumine decisions; manual end, export,
fee override, and specialist reassignment SHALL be denied server-side
for the specialist role. The admin UI SHALL be in Estonian.

#### Scenario: Non-admin is rejected

- **WHEN** a user without a staff role opens an admin route
- **THEN** the request is redirected or rejected with HTTP 403

#### Scenario: Specialist scope is enforced server-side

- **WHEN** a specialist submits a write action on a lot assigned to a
  different specialist
- **THEN** the action is rejected with an explicit permission error and
  no state changes
