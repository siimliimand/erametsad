# payload-foundation Specification

## Purpose
TBD - created by archiving change option-b-cloudflare-only. Update Purpose after archive.
## Requirements
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

### Requirement: Security middleware
The app SHALL apply CORS, security headers, and an API rate-limit middleware
skeleton.

#### Scenario: Headers applied
- **WHEN** a response is returned
- **THEN** security headers and CORS are present and requests over the rate
  limit are rejected
