# background-jobs Specification

## Purpose
TBD - created by archiving change option-b-cloudflare-only. Update Purpose after archive.
## Requirements
### Requirement: Queue consumer worker
A queue consumer worker SHALL process the `eametsad-jobs` queue:
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
Per-auction timing SHALL come from `AuctionDO` alarms. A cron trigger
`scheduled()` sweep SHALL run as a safety net for auctions whose DO was
evicted. The polling auction-ending worker SHALL be removed.

#### Scenario: Sweep catches an evicted DO
- **WHEN** an auction's end time passes while its DO is evicted
- **THEN** the cron sweep ends the auction and the end is idempotent

### Requirement: Dead-letter queue and retries
The queue SHALL have a retry policy and a dead-letter queue. DLQ depth
SHALL be monitored with an alert when messages accumulate.

#### Scenario: Poison message lands in the DLQ
- **WHEN** a message fails beyond the retry policy
- **THEN** it moves to the dead-letter queue and the depth alert fires
