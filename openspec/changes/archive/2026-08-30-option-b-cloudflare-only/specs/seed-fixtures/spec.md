## MODIFIED Requirements

### Requirement: Auction type in seed data
Seed auctions SHALL set `type` (`open`/`sealed`) on every row, with at
least one sealed auction per supported object type in `ended` status
holding encrypted sealed bids ready for the live opening demo. The
Settings seed SHALL enable the framework-contract gate
(`requireFrameworkContract: true`). `pnpm seed:reset` SHALL run against
D1 through the repository layer and SHALL reproduce the current fixture
dataset unchanged.

#### Scenario: Fresh seed supports the sealed demo
- **WHEN** `pnpm seed:reset` completes against a fresh local D1
- **THEN** a sealed auction exists in `ended` status whose bids decrypt
  to the documented demo amounts during the ceremony

#### Scenario: Seed resets reproducibly
- **WHEN** `pnpm seed:reset` runs twice in a row
- **THEN** the second run wipes and reproduces the same dataset without
  errors
