## MODIFIED Requirements

### Requirement: Consent checkboxes in registration
Registration SHALL require three consents (terms, privacy, marketing) with
timestamps and SHALL persist all three with their timestamps on the
created profile for audit.

#### Scenario: Consents stored
- **WHEN** a user registers with all three consents accepted
- **THEN** the stored profile records each consent with its timestamp

#### Scenario: Missing consent rejected
- **WHEN** a registration omits any required consent
- **THEN** the response is HTTP 400

### Requirement: Sealed-bid revision cap
The revision cap SHALL be enforced as: one original plus up to N
revisions (N from Settings), after which further submissions are rejected
with a clear error. Sealed seed fixtures SHALL be created through the
encrypted submission path so amounts are unreadable at rest and the live
opening demo works.

#### Scenario: Seed sealed bids are encrypted
- **WHEN** seed data for a sealed auction is inspected in the database
- **THEN** every sealed bid row has amount 0 and encrypted payloads with
  auth tags

#### Scenario: Cap enforced
- **WHEN** a user submits more than 1 + N sealed bids
- **THEN** the next submission is rejected with the revision-limit error

## ADDED Requirements

### Requirement: Auction type in seed data
Seed auctions SHALL set `type` (`open`/`sealed`) on every row, with at
least one sealed auction per supported object type in `ended` status
holding encrypted sealed bids ready for the live opening demo. The
Settings seed SHALL enable the framework-contract gate
(`requireFrameworkContract: true`).

#### Scenario: Fresh seed supports the sealed demo
- **WHEN** `pnpm seed:reset` completes
- **THEN** a sealed auction exists in `ended` status whose bids decrypt
  to the documented demo amounts during the ceremony
