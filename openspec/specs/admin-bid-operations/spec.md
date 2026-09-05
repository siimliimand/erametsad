# admin-bid-operations Specification

## Purpose
TBD - created by archiving change phase-5-admin-backend. Update Purpose after archive.
## Requirements
### Requirement: Live bid monitoring

The per-auction monitor SHALL show a server-synced countdown, the
leading bid with the margin to the next step, a live SSE feed
(newest first) with source chips (käsitsi/automaat) and status chips,
a pause control, an anti-snipe extension log, and reconnect with
`?since=` backfill after a dropped connection. Sealed lots SHALL show
the encrypted-bid count instead of the feed. Specialists SHALL see only
their own lots' monitors.

#### Scenario: Feed recovers after a connection drop

- **WHEN** the SSE connection drops and reconnects after 60 seconds
- **THEN** bids missed during the gap are backfilled from the repository
  and marked as loaded late

#### Scenario: Anti-snipe extension is visible

- **WHEN** a bid inside the anti-snipe window extends the end time
- **THEN** the countdown updates and the extension log gains an entry
  with the trigger bid, the extension, and the new end time

### Requirement: Alapakkumine queues and decisions

Alapakkumine decisions SHALL be available per auction and in a global
cross-auction queue with SLA badges computed from the Settings deadline
(amber beyond the deadline, red beyond twice the deadline). Approve
SHALL make the bid leading and notify all parties; reject SHALL require
a typed reason and notify the bidder with that reason. Sellers SHALL
see the queue for their own lots only. Every decision SHALL be
audit-logged, and a second decision attempt on the same bid SHALL
report the earlier decision instead of failing.

#### Scenario: Reject requires a reason

- **WHEN** the operator rejects an alapakkumine with an empty reason
- **THEN** the action is blocked until a reason of at least 5 characters
  is entered

#### Scenario: Double decision race

- **WHEN** two operators decide the same alapakkumine and the second
  submit arrives after the first succeeded
- **THEN** the second operator sees the first decision with its actor
  and time, and no second state change occurs

### Requirement: Identity reveal is audited

Anonymous bidder labels SHALL expand to the real identity for admin and
specialist roles on their lots. Every identity reveal SHALL write a
`user.identity_view` audit entry before the response includes the
personal data. Sellers SHALL see identity only on alapakkumine rows for
their own lots.

#### Scenario: Reveal writes an audit entry

- **WHEN** an admin expands an anonymous bidder label
- **THEN** an audit entry records the actor, the revealed user, and the
  timestamp

### Requirement: Sealed-opening ceremony

The ceremony screen for an ended sealed auction SHALL enforce:
- a precondition checklist (ending worker completed with its
  idempotency key, no pending alapakkumised, an active contract
  template with a warning when it changed within 24 hours of auction
  start);
- a two-person rule with typed keyword confirmation and signatures
  valid for 30 minutes from distinct sessions;
- a one-shot simultaneous reveal presenting all bids ranked by amount
  descending with ties ordered by earliest submission and invalid bids
  greyed with a reason;
- winner confirmation against the reserve with sold, unsold, and
  (superadmin-only) kiiroksjon house-backup paths;
- a void path with a typed reason before winner confirmation;
- step-up re-authentication by the opener at winner confirmation.

Every checklist confirmation, signature, reveal, confirmation, and void
SHALL write an audit entry. After the reveal the page SHALL become a
permanent read-only record. The reveal SHALL be disabled until 60
seconds after the recorded end time.

#### Scenario: Tie broken by earliest submission

- **WHEN** two sealed bids carry the same top amount
- **THEN** the earlier submission is ranked first and marked with the
  tie badge

#### Scenario: Reserve not met

- **WHEN** the top bid is below the reserve price and the operator
  confirms
- **THEN** only the unsold path (or the kiiroksjon house-backup path for
  a superadmin on a kiiroksjon) is offered, the lot moves to unsold,
  and the seller is notified

#### Scenario: Ceremony is locked to participants

- **WHEN** another admin opens the ceremony page after two signatures
  are recorded
- **THEN** the page renders read-only showing the ceremony participants
  and state

