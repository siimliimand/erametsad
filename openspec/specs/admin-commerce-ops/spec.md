# admin-commerce-ops Specification

## Purpose
TBD - created by archiving change phase-5-admin-backend. Update Purpose after archive.
## Requirements
### Requirement: Contracts management

The contracts table SHALL show type, user, auction, pinned template
version, status (prepared/sent/signed/voided), signed-at, and stuck
ambers for contracts sent more than 7 days ago. Row operations: PDF
view, signed-container download (audit-logged), resend throttled to one
per hour, and void with a typed reason plus an outcome choice
(contract-only, or contract and auction result for superadmin). Void
and container download SHALL be audit-logged.

#### Scenario: Stuck contract is visible

- **WHEN** a contract has been in status sent for 8 days
- **THEN** the row shows an amber stuck indicator with a resend
  suggestion

#### Scenario: Void requires a reason

- **WHEN** the operator voids a contract with a reason shorter than 5
  characters
- **THEN** the action is blocked

### Requirement: Contract templates with placeholder validation

Template management SHALL accept DOCX uploads, extract `{{placeholder}}`
tokens, and validate them against the placeholder catalogue: unknown
tokens reject the upload with a list; required tokens per type are
enforced. Uploading a new version SHALL create a draft version, never
overwrite; activation SHALL allow one active version per type and scope
and archive the previous one. A test-render drawer SHALL render fixture
data (fictional bidder, lot, amount) to a preview document.

#### Scenario: Unknown placeholder rejects upload

- **WHEN** an uploaded template contains `{{lot.nonexistent}}`
- **THEN** the upload is rejected with the unknown token listed

#### Scenario: One active version per type

- **WHEN** a new framework template version is activated
- **THEN** the previous active version moves to archive and existing
  contracts keep their pinned version

### Requirement: Leads CRM pipeline

Leads SHALL be workable on a 5-column Kanban (Uus, Võetud ühendust,
Kvalifitseeritud, Leping, Mittekvalifitseeritud) with drag-and-drop and
a table view. Status transitions SHALL enforce exit guards: a specialist
must be assigned to leave Uus; entering Kvalifitseeritud requires a
qualification note; entering Mittekvalifitseeritud requires a typed
reason. Cards SHALL show SLA badges (amber beyond 24h, red beyond 48h in
Uus). The detail drawer SHALL show the source form and page slug,
contact links, the consent record (with a withdrawn state that marks
contact forbidden), a notes timeline with automatic status-change
entries, assignment with a round-robin suggestion, and a next-action
date that surfaces a reminder. Manual lead creation SHALL be supported.
Specialists SHALL see only leads assigned to them and SHALL NOT export.

#### Scenario: Drag without an assigned specialist snaps back

- **WHEN** an unassigned lead is dragged to Kvalifitseeritud
- **THEN** the board reverts the card and explains that a specialist
  must be assigned

#### Scenario: Consent withdrawn blocks contact

- **WHEN** a lead's marketing consent is withdrawn
- **THEN** the drawer shows the withdrawal and exports blank the contact
  fields

### Requirement: Service-request routing and partner directory

The service-request screen [S] SHALL list requests with a payload
viewer, manage a partner directory (services, county coverage, capacity
limit, active toggle), and forward a request to selected partners with
a minimized payload (name, phone, email, property data; never
isikukood, IP, source, or consent metadata) and attachment links
expiring after 14 days. Each forward SHALL be audit-logged with the
recipient list, SHALL be idempotent per partner, and SHALL appear in a
per-request forwarding log with mark-responded. Partners over capacity
SHALL warn before send.

#### Scenario: Forward payload is minimized

- **WHEN** a request is forwarded to a partner
- **THEN** the sent payload contains contact and property data only, and
  the forwarding log records the disclosure

#### Scenario: Duplicate forward is prevented

- **WHEN** a partner that already received the request is selected again
- **THEN** the partner's checkbox is disabled with the earlier send date

