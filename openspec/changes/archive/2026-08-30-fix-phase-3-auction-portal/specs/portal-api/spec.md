## MODIFIED Requirements

### Requirement: Auto-bidder item endpoint
`PATCH /api/v1/auto-bidders/:id` SHALL update the max amount only upward
past the current leading bid plus step, and `DELETE` SHALL cancel the
autobidder leaving the last placed bid standing. Both SHALL be scoped to
the caller's active profile. `GET /api/v1/auto-bidders?auction=:id`
SHALL return the caller's own autobidder row for that auction (id and
max amount), or 204 when none exists, so the lot page and the customer
area can prefill and offer removal.

#### Scenario: Own row is retrievable
- **WHEN** a user with an autobidder row requests
  `GET /api/v1/auto-bidders?auction=:id`
- **THEN** the response carries that row's id and max amount and no
  other user's row

#### Scenario: Max below current leading rejected
- **WHEN** the autobidder max is set below leading + step
- **THEN** the PATCH responds 422 with the minimum allowed amount
