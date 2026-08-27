## ADDED Requirements

### Requirement: Payload bootstrap
The app SHALL bootstrap Payload CMS 3 with the Postgres adapter,
auth-disabled default user handling, and a media collection. The media
collection SHALL use local disk in dev and R2 in production (via Payload's
S3 plugin).

#### Scenario: Payload starts
- **WHEN** the app boots
- **THEN** Payload initialises with Postgres and exposes its REST API and
  media endpoints

### Requirement: Role-based access control
The app SHALL implement an access-control helper layer that maps the roles
guest, private, company, seller, specialist, admin, and superadmin (plan
section 5.1).

#### Scenario: Access evaluated
- **WHEN** a collection or endpoint is accessed
- **THEN** the helper resolves the caller's role and applies the matching
  access rules

### Requirement: Security middleware
The app SHALL apply CORS, security headers, and an API rate-limit middleware
skeleton.

#### Scenario: Headers applied
- **WHEN** a response is returned
- **THEN** security headers and CORS are present and requests over the rate
  limit are rejected

### Requirement: CMS versioning
The app SHALL wire versioning and draft-preview for CMS collections.
(Should-priority.)

#### Scenario: Draft preview
- **WHEN** an editor previews a draft
- **THEN** the preview renders the draft version without publishing it
