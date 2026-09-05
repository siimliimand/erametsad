# admin-people (delta)

## ADDED Requirements

### Requirement: Users search and masked identity

The users list SHALL search by isikukood, email, registrikood, and name,
and SHALL render the isikukood masked. Click-to-reveal SHALL require a
confirmation and SHALL write a `user.identity_view` audit entry before
the full value is shown. Search by isikukood SHALL work against the
hash index while the column stays encrypted.

#### Scenario: Reveal is audited

- **WHEN** an admin reveals a user's isikukood
- **THEN** the value is displayed and an audit entry records the actor,
  target user, and timestamp

### Requirement: Rights matrix with reasons

User detail SHALL present the per-objectType rights matrix (forest,
property, field, package) with grant state, grantor, and timestamps.
Grant and revoke SHALL require a typed reason, SHALL offer user
notification (on by default), and SHALL be audit-logged. Revocation
history SHALL remain visible as a timeline.

#### Scenario: Grant without a reason is rejected

- **WHEN** the operator grants a right with an empty reason
- **THEN** the action is rejected and nothing is stored

#### Scenario: Grant takes effect on the next bid

- **WHEN** a right is granted for an object type
- **THEN** the user's next bid submission for that type passes the
  rights check

### Requirement: Suspend with autobidder cancellation

Suspend SHALL accept a duration (24h, 7d, or indefinite) and a typed
reason, block login and bidding, cancel the user's active autobidders,
and notify the user. The action SHALL be audit-logged.

#### Scenario: Suspension cancels autobidders

- **WHEN** an operator suspends a user with an active autobidder
- **THEN** the autobidder is deactivated and the suspension is recorded
  in the user's timeline

### Requirement: Company access approvals

Company access request review SHALL present request cards with a
registry fixture panel (legal name, legal form, registry status, board
members, fetched-at time) and an applicant panel. The review SHALL warn
on duplicate registrikood against an approved profile, SHALL
cross-check board membership (strong match by isikukood, weak by exact
name), and SHALL hard-block approval when the registry status is
KUSTUTATUD. Approve SHALL activate the company profile, grant the
default rights chosen in a pre-filled checklist, and notify the
applicant; reject SHALL require a typed reason included in the
notification; hold SHALL record an internal note and reminder date.
A history tab SHALL list decided requests with decision, decider, and
reason.

#### Scenario: Duplicate registrikood warning

- **WHEN** a request arrives for a registrikood that already has an
  approved profile
- **THEN** the card shows the existing profile and its owner with
  guidance to route access through the existing owner or reject

#### Scenario: Approve grants default rights

- **WHEN** an operator approves a request with the default-rights
  checklist accepted
- **THEN** the profile activates, one right entry per checked type is
  created with reason "Ettevõtte vaikimisi õigused", and the applicant
  is notified
