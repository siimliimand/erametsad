## ADDED Requirements

### Requirement: County reference table
The system SHALL persist all 15 Estonian counties as a seeded Payload
collection. Each county record SHALL contain a `name` (Estonian) and a
`code` (two-letter) field.

#### Scenario: Seed loads counties on bootstrap
- **WHEN** the seed script runs
- **THEN** exactly 15 county records exist in the database

### Requirement: Parish reference table
The system SHALL persist all 79 Estonian parishes as a seeded Payload
collection. Each parish SHALL reference a parent county.

#### Scenario: Parishes link to counties
- **WHEN** a parish record is loaded with its county relationship populated
- **THEN** the county reference resolves to a valid county record

### Requirement: Tree-species codes enum
`packages/types` SHALL export a `TreeSpecies` enum containing all 24
Estonian tree-species codes (for example KASK, MÄND, KUUSK). Payload
collections SHALL import the enum directly so the collection config and
shared types stay in sync.

#### Scenario: Unknown tree species is rejected
- **WHEN** a Payload operation writes a tree-species value not in the enum
- **THEN** the operation returns a validation error

### Requirement: Logging-type codes enum
`packages/types` SHALL export a `LoggingType` enum containing all 10
recording codes (AR, HL, HR, KR, LR, RD, SR, TR, VE, VR).

#### Scenario: Logging-type enum rounds through Payload
- **WHEN** an Auction document is created with logging-type `HR`
- **THEN** reading the document returns `HR` exactly once without mutation