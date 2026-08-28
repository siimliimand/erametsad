## MODIFIED Requirements

### Requirement: Role-based access control
The app SHALL implement access control as explicit guard functions in
the repository layer that map the roles guest, private, company, seller,
specialist, admin, and superadmin (plan section 5.1). Guards SHALL be
inventoried from the former Payload collection access rules and enforced
server-side on every query and mutation path.

#### Scenario: Access evaluated
- **WHEN** a repository query or mutation is accessed
- **THEN** the guard resolves the caller's role and applies the matching
  access rules

## REMOVED Requirements

### Requirement: Payload bootstrap
**Reason**: Payload CMS has no D1 adapter and its SQLite adapter needs
`better-sqlite3`, which cannot run on Workers. Option B replaces Payload
with the first-party repository layer and a custom admin UI.
**Migration**: The 26 collection definitions are re-expressed as a
Drizzle schema in SQLite dialect. Access rules move to repository
guards. Payload's REST API surface is replaced by the existing
`/api/v1` routes. Admin functionality is rebuilt in
`apps/platform/src/app/(admin)/` before cutover.

### Requirement: CMS versioning
**Reason**: Draft/versioning was believed unused; the Phase 0 decision
record verifies this before removal. Keeping a CMS only for versioning
would defeat the consolidation goal.
**Migration**: If a flow is found that depends on drafts or versions,
the admin-ui scope adds an equivalent (draft flag plus published
revision) before cutover; otherwise no replacement ships.
