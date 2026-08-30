## MODIFIED Requirements

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

## ADDED Requirements

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
