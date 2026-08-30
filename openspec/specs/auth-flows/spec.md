# auth-flows Specification

## Purpose
TBD - created by archiving change phase-2-core-backend. Update Purpose after archive.
## Requirements
### Requirement: Password authentication
Password login SHALL accept isikukood or email with password, apply the
5/min/IP rate limit, return neutral Estonian errors, and reject users
whose status is `suspended`. The issued access token SHALL carry the
user's real role and active profile id.

#### Scenario: Suspended user cannot log in
- **WHEN** a user with status `suspended` submits correct credentials
- **THEN** the response is the neutral auth error and no session is
  created

#### Scenario: Token carries role
- **WHEN** an admin logs in
- **THEN** the access token's role claim is `admin`

### Requirement: Demo eID simulator
The simulator SHALL expose `start`, `status`, and `complete` for each of
smartid, mobileid, and idcard behind the provider interface. `complete`
SHALL verify the completed session state and create an application
session (tokens as httpOnly cookies) for the demo user. Demo isikukoods
SHALL be configurable via environment variables.

#### Scenario: eID login establishes a session
- **WHEN** the demo user completes the eID flow
- **THEN** `complete` returns success and sets the session cookies

#### Scenario: Complete before status completion fails
- **WHEN** `complete` is called for a session still `pending`
- **THEN** the response is HTTP 400 and no session is created

### Requirement: Registration end-to-end
The registration flow SHALL support four steps: eID identity (or email
token fallback), profile type selection (private or company), personal
data entry with 3 consent checkboxes (timestamped), and confirmation
screen.

#### Scenario: Company registration with mock lookup
- **WHEN** a user enters regCode `12345678` during registration
- **THEN** the company is matched from fixtures and the company name is
  displayed for confirmation

### Requirement: Company lookup mock
`GET /api/v1/company-lookup?regCode=` SHALL return a fixture company
with `name`, `regCode`, and `boardMembers` from a local fixture file.

#### Scenario: Unknown regCode returns empty
- **WHEN** the regCode is not in the fixtures
- **THEN** the endpoint returns HTTP 404 with `{ found: false }`

### Requirement: Password reset and change
A forgot-password endpoint SHALL accept the account identifier, create a
single-use 2-hour token, and email the reset link through Mailpit. The
reset endpoint SHALL consume the token, set the new password, and revoke
all other sessions. An authenticated change-password endpoint SHALL
verify the old password before setting the new one and revoke other
sessions. Minimum length SHALL be 10 characters.

#### Scenario: Forgot password sends the link
- **WHEN** a user requests a reset for a known account
- **THEN** a single-use token is stored and the link is emailed

#### Scenario: Change requires the old password
- **WHEN** an authenticated user submits a wrong old password
- **THEN** the response is HTTP 400 and the password is unchanged

### Requirement: Profile selection scope
The session SHALL carry the active profile id, and the access token SHALL
include it as a claim so every scoped read is filtered by the active
profile. Selecting a profile SHALL update the session and issue a fresh
token.

#### Scenario: Token reflects selected profile
- **WHEN** a user selects a different profile
- **THEN** subsequent access tokens carry the new profile id

### Requirement: Rate limit on protected auth endpoints
All auth endpoints accepting credentials SHALL carry a rate limiter
configured at 5 requests per IP per minute. The limit counters SHALL be
stored authoritatively in `RateLimiterDO`, so the limit holds across
isolates.

#### Scenario: Rate limiter enforced consistently
- **WHEN** 5 password-reset requests arrive from the same IP in under 60s
- **THEN** the 6th request returns HTTP 429

### Requirement: Session refresh and revocation
A refresh endpoint SHALL rotate the refresh token on use, detect reuse of
a rotated token and invalidate the session family, and issue a new access
token. Access-token sessions SHALL persist in a D1-backed session store,
not in process memory, so rotation survives isolate restarts.
Authenticated endpoints SHALL list the user's sessions and revoke any of
them (including the current one). The refresh cookie path SHALL match the
refresh endpoint.

#### Scenario: Refresh extends the session
- **WHEN** a valid refresh token is posted after the access token
  expired
- **THEN** a new access token is issued and the old refresh token is
  unusable

#### Scenario: Reused refresh token kills the family
- **WHEN** a rotated refresh token is presented a second time
- **THEN** the session is invalidated and all its tokens stop working

#### Scenario: Rotation survives isolate restarts
- **WHEN** the worker restarts between the issue and use of a refresh
  token
- **THEN** the refresh still succeeds because the session state is in D1

#### Scenario: User revokes a session
- **WHEN** the user revokes another session from the session list
- **THEN** that session's tokens no longer authenticate

### Requirement: Web Crypto runtime purity
All cryptographic operations SHALL use Web Crypto (`crypto.subtle`) or
other Workers-compatible APIs: hashing in `jwt.ts` (HMAC),
`computeIpHash` in the bid path, random identifiers, and sealed-bid
encryption. Node `crypto` imports SHALL be absent from runtime code; a
dual implementation is permitted only where local vitest requires it.

#### Scenario: No Node crypto at runtime
- **WHEN** the worker bundle is inspected or run under workerd without
  `nodejs_compat` crypto
- **THEN** all auth and bid crypto paths still work
