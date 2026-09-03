# notifications-contracts Delta

## MODIFIED Requirements

### Requirement: Contract service
Prepare SHALL bind the contract to the authenticated user by storing
`signedBy` = user id at prepare time; the column is the signing-session
owner. Signing SHALL reject with a user error when the authenticated user
does not match the stored owner, then record `signedAt`. Prepare/complete
endpoints SHALL pass the session user through. Auction-type prepare SHALL
reject with 403 unless the caller holds the `won` bid on the auction
(server-side winner gate). The in-progress (`prepared`/`sent`) contract
lookup SHALL filter by `signedBy` = caller. The 15-minute signing expiry,
content hash, and status transitions remain as specified.

#### Scenario: Prepared contract records the owner
- **WHEN** a user prepares a framework or auction contract
- **THEN** the contract row stores `signedBy` = user id before any signing

#### Scenario: Signed contract records the signer
- **WHEN** a user completes framework-contract signing
- **THEN** the contract row stores `signedBy` = user id

#### Scenario: Cross-user sign rejected
- **WHEN** a user other than the stored owner completes signing with a
  contract id
- **THEN** the API rejects the request and no signature is recorded

#### Scenario: Non-winner auction prepare rejected
- **WHEN** an authed user without the `won` bid prepares an auction
  contract
- **THEN** the API responds 403

#### Scenario: In-progress lookup is user-scoped
- **WHEN** the raamleping page resolves an in-progress contract for a user
- **THEN** only rows with `signedBy` = that user are returned
