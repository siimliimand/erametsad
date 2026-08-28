# seed-fixtures Specification

## Purpose
TBD - created by archiving change phase-2-core-backend. Update Purpose after archive.
## Requirements
### Requirement: Consent checkboxes in registration
User registration SHALL include 3 consent checkboxes presented visibly,
always unchecked, and required. The time of consent SHALL be recorded
in the User's `consents[]` field.

#### Scenario: Consent timestamp recorded on registration
- **WHEN** a user completes registration with all three consents checked
- **THEN** the User document has 3 entries in `consents[]` each with the
  checked timestamp

### Requirement: Sealed-bid revision cap
The sealed-bid revision cap SHALL be a Settings field defaulting to 1
(one submission only). The system SHALL allow resubmissions up to the cap
when the cap is 2 or higher, applying a double-submit guard with an
idempotency key.

#### Scenario: Resubmission allowed within cap
- **WHEN** revision cap is set to 3 and a user has submitted 2 sealed bids
  on the same auction
- **THEN** a third submission is accepted

#### Scenario: Resubmission blocked at cap
- **WHEN** revision cap is 1 and a user has already submitted a sealed bid
- **THEN** a second submission returns HTTP 409

### Requirement: Password strength and validation
Passwords MUST be at least 10 characters and MUST NOT match the user's
isikukood. The password field SHALL show a strength meter on the
registration and change-password forms. Weak passwords (common patterns)
SHALL be rejected server-side with a 400 error.

#### Scenario: Password matching isikukood rejected
- **WHEN** a user attempts to set a password that is their own isikukood
- **THEN** the request is rejected with an error message

#### Scenario: Strong password accepted
- **WHEN** a user submits a 12-character mixed-class password
- **THEN** the password is accepted and stored hashed

