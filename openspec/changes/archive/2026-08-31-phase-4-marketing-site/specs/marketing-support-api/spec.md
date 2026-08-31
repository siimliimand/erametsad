# marketing-support-api

## ADDED Requirements

### Requirement: Consent endpoint

`POST /api/v1/consent` SHALL log every consent decision to the append-only
`consent_log` table with the choice, the category map as JSON, a salted
ip_hash, and the timestamp. The endpoint SHALL require no auth and SHALL
apply rate limiting.

#### Scenario: Consent logged

- **WHEN** the banner POSTs a decision
- **THEN** a consent_log row exists with the choice and ip_hash

### Requirement: Newsletter double opt-in

`POST /api/v1/newsletter` SHALL create a pending subscriber with a
single-use token and send a confirmation email. An existing address SHALL
receive a neutral success with no new row. `GET /api/v1/newsletter/confirm`
SHALL confirm the subscription by token. The unsubscribe route SHALL set
the status to unsubscribed by token. All three routes SHALL apply rate
limiting.

#### Scenario: Confirm by token

- **WHEN** a visitor opens the confirm link with a valid pending token
- **THEN** the subscriber status becomes confirmed and the token is
  single-use

#### Scenario: Duplicate subscribe

- **WHEN** an already-confirmed email subscribes again
- **THEN** the API returns neutral success and no new row is created

### Requirement: Events skeleton

`POST /api/v1/events` SHALL append named events with JSON props and a
salted ip_hash to `analytics_events`. The client `track()` helper SHALL
send events only when the consent cookie grants statistics consent, except
`cookie_consent`, which SHALL always send.

#### Scenario: Gated tracking

- **WHEN** a visitor without statistics consent triggers `nav_click`
- **THEN** the browser sends no request to the events endpoint
