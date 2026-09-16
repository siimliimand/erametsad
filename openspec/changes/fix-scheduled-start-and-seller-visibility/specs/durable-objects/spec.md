# delta: durable-objects

## MODIFIED Requirements

### Requirement: AuctionDO alarm scheduling

Auction timing SHALL be server-authoritative and driven by DO `alarm()`:
start activation for scheduled auctions, anti-snipe window checks, the
`scheduled -> active` promotion, the `active -> ended` transition, winner
computation including the sealed-opening trigger, and notification
enqueue. `hydrateState` SHALL arm the alarm at `startsAt` while status is
`scheduled` and at `endsAt` while status is `active`. The promotion tick
SHALL re-read the D1 row instead of trusting hot state, because the row
decides the current `startsAt` and `endsAt`. The promotion SHALL be
status-guarded against double-fire, SHALL write an `auction_activated`
audit entry, SHALL broadcast `auction:published`, and SHALL arm the end
alarm at `endsAt` afterwards. A cron `scheduled()` sweep SHALL act as a
safety net for auctions whose DO was evicted.

#### Scenario: Scheduled auction activates at start time

- **WHEN** the DO alarm fires for a `scheduled` auction whose `startsAt`
  has passed
- **THEN** the row becomes `active` with `activatedAt` set, the audit
  entry `auction_activated` exists, the hot state status is `active`, and
  the end alarm is armed at `endsAt`

#### Scenario: Scheduled auction arms a start alarm

- **WHEN** `hydrateState` hydrates a `scheduled` auction with a future
  `startsAt`
- **THEN** the DO sets its alarm at `startsAt` when no earlier alarm exists

#### Scenario: Stale start alarm re-arms from the row

- **WHEN** the alarm fires for a `scheduled` auction whose `startsAt` was
  moved later by an admin after the alarm was armed
- **THEN** the tick re-reads the row and re-arms at the new `startsAt`
  without promoting

#### Scenario: Auction ends on time after DO eviction

- **WHEN** an auction's DO is evicted before its end time
- **THEN** the cron sweep rehydrates the DO or ends the auction so the
  end still processes at the right time
