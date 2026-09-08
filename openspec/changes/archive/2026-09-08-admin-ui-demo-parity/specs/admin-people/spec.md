## ADDED Requirements

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

Admins and superadmins SHALL start a read-only impersonation session for
a user after giving a reason (minimum 5 characters), and the action SHALL
write a `user.impersonate` audit entry. While impersonating, every portal
write action (bids, autobidders, contracts, signing, profile changes)
SHALL be rejected server-side, and the admin SHALL see a persistent amber
banner with a LÕPETA VAATLUS control that ends the session and audits the
stop.

#### Scenario: Impersonated writes are blocked

- **WHEN** an impersonation session submits a portal bid or signature
- **THEN** the action is rejected server-side with an explicit error and
  no state changes

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

Staff SHALL trigger a user data export (ZIP download link delivered to
the operator) and an anonymize-and-delete flow. Anonymization SHALL
remove or mask personal data while preserving accounting-relevant rows
for the 7-year retention period. Both actions SHALL be audited
(`user.gdpr_export`, `user.gdpr_delete`).

#### Scenario: Anonymize keeps invoices

- **WHEN** a user with past contracts is anonymized
- **THEN** contract and billing rows survive with masked personal fields
  and the audit entry records the actor and reason

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
