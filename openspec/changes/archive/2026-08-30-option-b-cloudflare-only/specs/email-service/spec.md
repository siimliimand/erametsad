## ADDED Requirements

### Requirement: Email transport chain
`src/lib/notifications/email-sender.ts` SHALL send transactional email
through a fixed chain: the `EMAIL` binding first, then the Email Service
REST API (`CLOUDFLARE_EMAIL_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`), then SMTP.
Local `next dev` SHALL keep Mailpit. A provider swap SHALL be a
configuration-level change behind this interface.

#### Scenario: Binding path sends
- **WHEN** a notification email is sent from the deployed worker and the
  binding is available
- **THEN** the email is delivered through the `EMAIL` binding

#### Scenario: Fallback on binding failure
- **WHEN** the `EMAIL` binding send fails
- **THEN** the sender retries through the REST path and records which
  transport delivered

### Requirement: Sender and domain verification
The system SHALL send from `noreply@erametsad.ee` with the
`erametsad.ee` zone verified in Cloudflare Email Service.

#### Scenario: Outbid email delivered from production
- **WHEN** a bidder is outbid on the deployed worker
- **THEN** the outbid email arrives from `noreply@erametsad.ee`

### Requirement: Delivery status and error codes
Notification logs SHALL surface email error codes, including
`E_RATE_LIMIT_EXCEEDED` and `E_DAILY_LIMIT_EXCEEDED`. The notifications
row SHALL record a per-recipient result: `delivered`, `queued`, or
`permanent_bounces`.

#### Scenario: Quota error is recorded
- **WHEN** the daily quota is exceeded
- **THEN** the notification row records `E_DAILY_LIMIT_EXCEEDED` for the
  affected recipients

### Requirement: GDPR unsubscribe headers
Marketing email templates SHALL carry `List-Unsubscribe` headers.
Transactional templates are exempt but SHALL be reviewed for the same.

#### Scenario: Marketing mail carries the header
- **WHEN** a marketing-category email is sent
- **THEN** the message includes a working `List-Unsubscribe` header
