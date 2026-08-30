## MODIFIED Requirements

### Requirement: Sealed-bid encryption at rest
Sealed submission SHALL verify the objectType right before accepting the
bid. The request SHALL carry an identity snapshot (name, isikukood or
registrikood, address, email, phone) validated on the server. Amount and
identity snapshot SHALL be encrypted with AES-256-GCM including auth-tag
storage; the Bid row SHALL store `amount: 0` and an unreadable
`identity_snapshot`. Sealed bids SHALL be admitted through the same
production path as open bids (the bid route and AuctionDO), and the
revision cap `1 + settings.sealedRevisionCap` SHALL be enforced
server-side with error code `revision_cap_exceeded`. Decryption SHALL
verify the auth tag; on tamper or failure the bid SHALL be marked invalid
rather than silently reported as 0.

#### Scenario: Rights required for sealed submission
- **WHEN** a user without the auction's objectType right submits a
  sealed bid
- **THEN** the response is HTTP 403

#### Scenario: Amount and identity unreadable in the database
- **WHEN** a sealed bid row is inspected in the database
- **THEN** the amount column is 0, the snapshot columns hold ciphertext
  only, and neither is decryptable without the key

#### Scenario: Revision cap exceeded
- **WHEN** the user submits more revisions than the configured cap allows
- **THEN** the response is an error with code `revision_cap_exceeded`
  and the earlier bid stands

#### Scenario: Tampered ciphertext is rejected
- **WHEN** the encrypted amount is modified in storage and then opened
- **THEN** decryption throws, the bid is marked invalid, and the ceremony
  continues with the remaining bids
