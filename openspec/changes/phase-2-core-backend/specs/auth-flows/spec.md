## ADDED Requirements

### Requirement: Password authentication
`POST /api/v1/auth/login` SHALL accept `identifier` (isikukood or email)
and `password`. Failed attempts SHALL be rate-limited to 5 per IP per
minute. Error responses SHALL be identical regardless of whether the
identifier or the password is wrong.

#### Scenario: Wrong password yields neutral error
- **WHEN** a valid isikukood is submitted with a wrong password
- **THEN** the response is HTTP 401 with message "Vale kasutajanimi või
  parool" and the same JSON shape as a missing-user response

#### Scenario: Rate limit triggers after 5 attempts
- **WHEN** 6 login requests arrive from the same IP within 60 seconds
- **THEN** the 6th request returns HTTP 429

### Requirement: Demo eID simulator
A provider adapter SHALL abstract eID operations behind three endpoints
per method (`start`, `status`, `complete`) for SMART-ID, MOBIIL-ID, and
ID-CARD. The demo implementation SHALL show a control-code screen and
poll for status until the user confirms (configurable 2-second poll).
Demo accounts SHALL be defined in seed data with known isikukoods.

#### Scenario: Successful Smart-ID login flow
- **WHEN** a user selects Smart-ID and a known demo isikukood
- **THEN** `POST /api/v1/auth/smartid/start` returns a control code and
  a session reference
- **WHEN** the polling detects the demo user confirmed
- **THEN** `GET /api/v1/auth/smartid/status` returns `{ status: "completed" }`

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
Password reset tokens SHALL expire after 2 hours and be single-use.
Submitting a valid reset token SHALL revoke all active sessions for that
user. Password change via an authenticated session SHALL require the
current password.

#### Scenario: Reset token revokes prior sessions
- **WHEN** a password reset completes successfully
- **THEN** all prior sessions for that user are invalidated and the old
  refresh tokens are revoked

### Requirement: Profile selection scope
The session SHALL carry the `activeProfileId`. All profile-scoped
API routes SHALL extract the profile from the session and ignore
cross-profile data. `POST /api/profiles/:id/select`

SHALL activate a new profile in the same session.

#### Scenario: User switches active profile
- **WHEN** `POST /api/profiles/:companyId/select` is called
- **THEN** subsequent API calls scope to that company profile until
  another switch occurs

### Requirement: Rate limit on protected auth endpoints
All auth endpoints accepting credentials SHALL carry a rate limiter
configured at 5 requests per IP per minute. The limit SHALL be stored in
Redis (local dev) or Cloudflare KV (prod).

#### Scenario: Rate limiter enforced consistently
- **WHEN** 5 password-reset requests arrive from the same IP in under 60s
- **THEN** the 6th request returns HTTP 429