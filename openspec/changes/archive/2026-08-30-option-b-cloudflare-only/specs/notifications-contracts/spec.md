## MODIFIED Requirements

### Requirement: Notification event bus
Domain events SHALL carry the affected `userId` so dispatch can reach the
user. Dispatch SHALL run in the Cloudflare Queues consumer worker (one
message per user and channel), not in an in-process dispatcher started by
application bootstrap. Email SHALL be sent through the Email Service
transport chain (`email-sender.ts`) with the `@erametsad/emails`
templates and stored as Notification rows with per-recipient delivery
status; SMS stays a log stub. Duplicate dispatch per user and event SHALL
be deduplicated through `dedupeKey`.

#### Scenario: Auction end notifies the winner
- **WHEN** an auction ends with a winning bid
- **THEN** the winner receives an email from the deployed worker and an
  in-app Notification row with delivery status

#### Scenario: Dispatcher runs without a request
- **WHEN** the queue consumer processes an ending event
- **THEN** the notification is dispatched without any HTTP request
  involved
