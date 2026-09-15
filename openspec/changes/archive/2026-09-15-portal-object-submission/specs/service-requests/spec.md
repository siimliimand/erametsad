## ADDED Requirements

### Requirement: Portal-authenticated submissions

The route SHALL stamp the created `service_requests` row with the session
user's id when `POST /api/v1/service-requests` is called with a valid portal
session. The existing payload validation, consent requirement, per-IP rate
limits, honeypot handling, attachment rules (one PDF/JPG/PNG up to 10 MB,
hooldusraie only), and duplicate throttle SHALL apply to authenticated
submissions unchanged. Requests without a session SHALL continue to store no
user id, keeping the anonymous marketing funnel intact.

#### Scenario: Wizard submission carries the user id

- **WHEN** a logged-in user submits the kava branch from the portal wizard
- **THEN** the stored row has `user_id` set to the session user and status
  `new`

#### Scenario: Limits still apply to logged-in users

- **WHEN** a logged-in user exceeds the per-IP rate limit
- **THEN** the route returns 429 the same as for anonymous traffic

#### Scenario: Anonymous submission stays anonymous

- **WHEN** the marketing service form posts without a session
- **THEN** the stored row has no `user_id` and no other contract changes
