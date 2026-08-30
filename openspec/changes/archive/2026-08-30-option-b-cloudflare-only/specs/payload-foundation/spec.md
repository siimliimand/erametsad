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
The app SHALL bootstrap Payload CMS 3 with the Postgres adapter,
auth-disabled default user handling, and a media collection. The media
collection SHALL use local disk in dev and R2 in production (via Payload's
S3 plugin).

#### Scenario: Payload starts
- **WHEN** the app boots
- **THEN** Payload initialises with Postgres and exposes its REST API and
  media endpoints

### Requirement: CMS versioning
The app SHALL wire versioning and draft-preview for CMS collections.
(Should-priority.)

#### Scenario: Draft preview
- **WHEN** an editor previews a draft
- **THEN** the preview renders the draft version without publishing it
