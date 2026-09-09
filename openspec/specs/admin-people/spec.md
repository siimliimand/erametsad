# admin-people Specification

## Purpose
TBD - created by archiving change phase-5-admin-backend. Update Purpose after archive.
## Requirements
### Requirement: Users search and masked identity

The users list SHALL additionally filter by profile type, status, granted
right, and county, and SHALL show the documented columns: profile chips with
approval state, a rights summary per object type, an all-time bid count, and
the last login. The default sort SHALL be last login descending. A shill
flag action SHALL be available with a "märgitud" filter.

#### Scenario: Filter by right

- **WHEN** the operator filters by the raieõigus right
- **THEN** only users holding that right are listed

### Requirement: Rights matrix with reasons

The rights matrix SHALL render per-profile rows when the profiles hold
different rights, and a revoke on a user with a leading bid SHALL warn with
the bid reference and offer the superadmin void path.

#### Scenario: Leading-bid revoke warning

- **WHEN** the operator revokes a right from a user holding the leading bid
  on an active auction
- **THEN** the form warns with the bid number and offers the superadmin void
  option

### Requirement: Suspend with autobidder cancellation

Suspend SHALL accept a duration (24h, 7d, or indefinite) and a typed
reason, block login and bidding, cancel the user's active autobidders,
and notify the user. The action SHALL be audit-logged.

#### Scenario: Suspension cancels autobidders

- **WHEN** an operator suspends a user with an active autobidder
- **THEN** the autobidder is deactivated and the suspension is recorded
  in the user's timeline

### Requirement: Company access approvals

The company approval card SHALL additionally show:

- the registry panel fields asukoht and KMKR nr;
- a "Kontrolli uuesti" re-fetch button whose view is audit-logged;
- an amber name-discrepancy block comparing the applicant and registry names;
- the applicant's existing profiles, bidding history, and framework contract
  status;
- volikiri enforcement: a failed board-member check permits only rejection or
  an approval with justification and a power-of-attorney upload;
- an SLA chip amber after 2 days and red after 5 days ("oodatud {n} p");
- approval rights defaults read from Seaded;
- a history tab with decision/date/freetext filters, pagination, and an
  audited CSV export.

#### Scenario: Board check failure forces a choice

- **WHEN** the applicant is not a board member and no volikiri is attached
- **THEN** approve stays disabled until a justification with an upload is
  provided, or the operator rejects

### Requirement: User detail drawer

The users list SHALL open a 720px right drawer (full-width on mobile)
with seven tabs: Identiteet, Profiilid, Õigused, Lepingud, Pakkumised,
Teavitused, and GDPR. The drawer SHALL reuse the detail page tab panels
as shared components, and the detail page route SHALL keep working for
deep links. Identity unmasking inside the drawer SHALL stay audited.

#### Scenario: Drawer and page share truth

- **WHEN** the same user is opened in the drawer and on the detail page
- **THEN** both render from the same tab components with identical data
  and actions

### Requirement: Impersonation

Impersonation SHALL have a 30-minute maximum duration enforced server-side,
and the banner SHALL show the remaining time as a countdown.

#### Scenario: TTL expiry

- **WHEN** 30 minutes have elapsed
- **THEN** the impersonation session ends

### Requirement: Ban

Staff with users:write SHALL ban a user with a mandatory reason. Ban
SHALL set the account status and SHALL block new registration with the
same isikukood. The action SHALL be audited and reflected as a Keelatud
pill in the users list.

#### Scenario: Banned identity cannot re-register

- **WHEN** a banned isikukood attempts registration again
- **THEN** registration is rejected with a neutral error and no account
  is created

### Requirement: GDPR export and anonymization

Both GDPR actions SHALL require a typed reason and a double confirm. Delete
SHALL run a pre-check report (active bids, open contracts, retention items),
observe a 14-day cooling-off cancellable in the portal, pseudonymise the
user's bid and contract rows, and delete unopened sealed bids. The export ZIP
SHALL include the consent log and signed contract PDFs.

#### Scenario: Delete blocked by cooling-off

- **WHEN** an anonymization is requested with an active bid
- **THEN** the pre-check report lists the bid and the delete requires
  resolution or explicit override flow

### Requirement: Company approvals parity

The companies module SHALL present pending requests as decision cards
with a registry snapshot panel, an applicant panel, wait-time badges,
duplicate and board-mismatch warnings, decision notes after action, and
default bidding-rights selection on approval. Existing registry
cross-check and reject-reason behavior SHALL be preserved.

#### Scenario: Decision leaves a note

- **WHEN** a request is approved, rejected, or held
- **THEN** the card shows the decision mark and reason, and the pending
  rail badge count decreases for approvals and rejections

### Requirement: Shill flags

Staff with user permissions SHALL be able to flag a user for shill
investigation with a mandatory reason. Flagged users SHALL be filterable in
the users list and marked with an icon on anomaly cards in the bid monitor.

#### Scenario: Flag and filter

- **WHEN** an admin flags a bidder for shill investigation
- **THEN** the user appears under the "märgitud" filter and their reveal chip
  shows the flag icon

