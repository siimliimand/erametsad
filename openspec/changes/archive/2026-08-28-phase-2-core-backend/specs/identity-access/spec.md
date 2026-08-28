## ADDED Requirements

### Requirement: User collection
`User` SHALL be a Payload collection with an `isikukood` field stored as
AES-256-GCM ciphertext with a unique hash index for equality queries. The
collection SHALL also expose unencrypted `email`, `phone`, `status`
(active/suspended), and `authMethod` (eid/password).

#### Scenario: Isikukood is never stored in plaintext
- **WHEN** a User document is persisted
- **THEN** the `isikukood` column in Postgres contains only ciphertext and
  the hash index contains only a salted hash

#### Scenario: Exact isikukood lookup succeeds
- **WHEN** a login form submits isikukood `38702019999`
- **THEN** the query resolves the correct User using the hash index

### Requirement: Profile collection
`Profile` SHALL be a Payload collection. Each Profile SHALL carry a `type`
(private or company) and an `approval_status` (pending/approved/rejected)
for company profiles. A Profile SHALL belong to exactly one User.

#### Scenario: New company profile is pending by default
- **WHEN** a company user completes registration
- **THEN** the created Profile has `approval_status: pending`

### Requirement: CompanyAccessRequest collection
The system SHALL persist admin-facing company access requests with a
`regCode`, `reason`, and status (pending/approved/rejected/held).

#### Scenario: Access request routes to admin
- **WHEN** a company user submits `POST /api/v1/business/request-access`
- **THEN** a CompanyAccessRequest record is created with status pending

### Requirement: AuctionRight collection
`AuctionRight` SHALL be a Payload collection mapping a User to an
objectType (raieÕigus, kinnistu, kiire, pakett) with `grantedBy`,
`grantedAt`, and `revokedAt` fields. A User SHALL NOT have more than one
active right per objectType.

#### Scenario: Duplicate active right is rejected
- **WHEN** an admin grants `raieõigus` to a User who already has an
  active right for `raieõigus`
- **THEN** the operation returns a 409 conflict error

### Requirement: Session store
The auth layer SHALL issue a short-lived JWT access token (5-minute
expiry) and a rotating refresh token stored in an HttpOnly cookie. The
refresh token SHALL rotate on every use. A leaked refresh token SHALL
revoke the entire token family.

#### Scenario: Refresh token rotation on use
- **WHEN** the app exchanges a valid refresh token
- **THEN** the old refresh token is invalidated and a new one is issued

#### Scenario: Refresh token family revocation on replay
- **WHEN** an already-consumed refresh token is submitted
- **THEN** the entire token family is revoked and the session is logged out

### Requirement: Password login endpoint
`POST /api/v1/auth/login` SHALL accept `identifier` (isikukood or email)
plus `password`. The endpoint SHALL rate-limit to 5 attempts per IP per
minute and return a neutral error message regardless of whether the
identifier or password is wrong.

#### Scenario: Neutral error on wrong password
- **WHEN** a user submits a valid isikukood with a wrong password
- **THEN** the API returns HTTP 401 with the same error shape a missing-user
  response would produce