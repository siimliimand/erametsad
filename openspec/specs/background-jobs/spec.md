# background-jobs Specification

## Purpose
TBD - created by archiving change option-b-cloudflare-only. Update Purpose after archive.
## Requirements
### Requirement: Queue consumer worker
A queue consumer worker SHALL process the `erametsad-jobs` queue:
notification fan-out with one message per user and channel (idempotent
through the existing `dedupeKey`), email sending, and contract PDF
generation into R2. Request latency SHALL not include this work.

#### Scenario: Auction end fans out without polling
- **WHEN** an auction ends
- **THEN** D1 state changes, the SSE event fires, queue messages are
  consumed, and emails are sent with no worker polling loop

#### Scenario: Duplicate message is a no-op
- **WHEN** the same notification message is delivered twice
- **THEN** the `dedupeKey` makes the second delivery a no-op

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

### Requirement: Dead-letter queue and retries
The queue SHALL have a retry policy and a dead-letter queue. DLQ depth
SHALL be monitored with an alert when messages accumulate.

#### Scenario: Poison message lands in the DLQ
- **WHEN** a message fails beyond the retry policy
- **THEN** it moves to the dead-letter queue and the depth alert fires

