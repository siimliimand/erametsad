## MODIFIED Requirements

### Requirement: Live bid monitoring

The bid monitor SHALL additionally provide:

- a bids CSV export ("Ekspordi pakkumiste logi") with the documented columns
  and an audit entry carrying the row count;
- an alapakkumised block with a "Vaata kõik" link on the monitor itself;
- an accept confirmation modal naming the resulting leading amount;
- a green "Anomaaliaid ei tuvastatud" zero state;
- a link from the sealed-bid count to the opening ceremony;
- the revealed identity chip linking to the user detail in Kasutajad.

#### Scenario: Export is audited

- **WHEN** an admin exports the bid log
- **THEN** the download starts and an audit entry records the row count

#### Scenario: Accept confirm

- **WHEN** the operator accepts an alapakkumine of 12 000 €
- **THEN** a confirm dialog states that 12 000 € becomes the leading bid

### Requirement: Alapakkumine queues and decisions

Rejecting an alapakkumine SHALL require a typed reason (minimum 5 chars) on
every path, the reason SHALL be stored in the audit entry, and the bidder
notification SHALL include the reason text.

#### Scenario: Per-lot reject requires a reason

- **WHEN** the operator rejects an alapakkumine from the auction detail block
  without a reason
- **THEN** the submit is blocked

### Requirement: Sealed-opening ceremony

The ceremony SHALL additionally:

- enforce the approver role configured in Seaded for the second signature;
- render the reveal table with Pakkuja (identity with masked code, company
  chip, user link) and Marginaal (gap to next) columns after the reveal;
- show a winner-confirmation modal with the winner, final price, and fee
  estimate;
- notify the winner and the seller with the fee estimate when the winner is
  confirmed;
- force an explicit choice when a company bid awaits profile approval;
- offer "Märgi müümata" from the pre-flight checklist for lots with zero
  valid bids under single-admin rules;
- show a read-only "Avamine on pooleli" state to other admins while the
  ceremony is in progress.

#### Scenario: Approver role mismatch

- **WHEN** the configured approver role is superadmin and an admin attempts
  to approve
- **THEN** the approval is rejected with a role error

#### Scenario: Reveal table identity

- **WHEN** the reveal completes
- **THEN** each ranked row shows the bidder identity with the code masked and
  the margin to the next bid

## ADDED Requirements

### Requirement: Anomaly heuristics

The monitor SHALL flag: same-IP clusters (two or more bidders sharing an IP
hash), account-age bursts (accounts younger than 7 days placing 3 or more
bids), and rapid overtakes (alternating bids within 10 seconds, 5 times).
Anomaly cards SHALL be expandable with the affected labels, bid counts, IP
prefixes, and bid-time deltas, SHALL be hidden from sellers, and SHALL offer
"Märgi uurimiseks".

#### Scenario: IP cluster flagged

- **WHEN** two bidders share an IP hash on the same auction
- **THEN** an "IP klaster" anomaly card appears with both bidder labels
