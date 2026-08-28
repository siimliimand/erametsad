## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Session refresh and revocation
A refresh endpoint SHALL rotate the refresh token on use, detect reuse of
a rotated token and invalidate the session family, and issue a new access
token. Authenticated endpoints SHALL list the user's sessions and revoke
any of them (including the current one). The refresh cookie path SHALL
match the refresh endpoint.

#### Scenario: Refresh extends the session
- **WHEN** a valid refresh token is posted after the access token
  expired
- **THEN** a new access token is issued and the old refresh token is
  unusable

#### Scenario: Reused refresh token kills the family
- **WHEN** a rotated refresh token is presented a second time
- **THEN** the session is invalidated and all its tokens stop working

#### Scenario: User revokes a session
- **WHEN** the user revokes another session from the session list
- **THEN** that session's tokens no longer authenticate
