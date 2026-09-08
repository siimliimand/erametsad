## ADDED Requirements

### Requirement: Under-bid queue parity

The bids area SHALL keep the global pending under-bid queue with audited
identity reveal chips, SLA badges, and accept/reject-with-reason flows,
and SHALL adopt the unified status pill and shared confirm primitives for
decisions.

#### Scenario: Rejection requires a reason

- **WHEN** an operator rejects a pending under-bid
- **THEN** the shared confirm dialog enforces a reason of at least 5
  characters and the decision is audited
