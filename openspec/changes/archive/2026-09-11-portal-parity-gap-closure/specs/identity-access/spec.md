## MODIFIED Requirements

### Requirement: User collection
`User` SHALL be a Payload collection with an `isikukood` field stored as
AES-256-GCM ciphertext with a unique hash index for equality queries. The
collection SHALL also expose unencrypted `email`, `phone`, `status`
(active/suspended/deleted), and `authMethod` (eid/password). The
`deleted` status SHALL mark a self-deleted account: the row stays for
bid, contract, consent-log, and audit-chain integrity, while the
personal fields are wiped — `email` becomes the tombstone
`deleted-<id>@invalid.local`, and `name`, `phone`, the `isikukood`
ciphertext columns and hash, and the password hash and salt are erased.
A deleted account SHALL hold no active sessions and SHALL not
authenticate. The repository layer SHALL expose the anonymization as a
single helper so the deletion endpoint and any future admin flow share
one implementation.

#### Scenario: Isikukood is never stored in plaintext
- **WHEN** a User document is persisted
- **THEN** the `isikukood` column in Postgres contains only ciphertext and
  the hash index contains only a salted hash

#### Scenario: Exact isikukood lookup succeeds
- **WHEN** a login form submits isikukood `38702019999`
- **THEN** the query resolves the correct User using the hash index

#### Scenario: Anonymization wipes personal fields
- **WHEN** the anonymization helper runs for a user
- **THEN** the email is the tombstone value, the name, phone,
  isikukood, and password columns are null, and the status is
  `deleted`

#### Scenario: Deleted account cannot authenticate
- **WHEN** a login attempt targets a `deleted` user
- **THEN** authentication fails with the generic invalid-credential
  error
