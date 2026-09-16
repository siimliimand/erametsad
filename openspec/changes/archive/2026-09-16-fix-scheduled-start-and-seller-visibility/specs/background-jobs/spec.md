# delta: background-jobs

## MODIFIED Requirements

### Requirement: Alarm plus cron scheduling

The every-minute cron `scheduled()` sweep SHALL wake AuctionDOs whose
transition is due but whose alarm was lost. The sweep SHALL query both
`status = 'active' AND ends_at <= now` and `status = 'scheduled' AND
starts_at <= now`, and SHALL wake each due auction through the DO `/due`
endpoint so the transition runs inside the DO. The sweep SHALL NOT write
auction state itself.

#### Scenario: Due scheduled auction is woken

- **WHEN** a `scheduled` auction's `starts_at` is in the past and its DO
  alarm was lost
- **THEN** the sweep wakes the DO through `/due` and the DO promotes the
  auction to `active`

#### Scenario: Future scheduled auction is left alone

- **WHEN** a `scheduled` auction's `starts_at` is in the future
- **THEN** the sweep does not wake its DO
