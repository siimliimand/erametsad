# delta: portal-customer-area

## MODIFIED Requirements

### Requirement: Minu müügid

`/user/objects` SHALL show the signed-in seller their own auction lots in
every status: `draft`, `scheduled`, `active`, `ended`, and the post-end
statuses. Each card SHALL render its status pill for the row's real status
("Mustand", "Plaanis", "Aktiivne", "Lõppenud", "Müümata", "Leping
allkirjastatud"), and a `scheduled` card SHALL show an "Algab \<kuupäev\>"
side note with the start time instead of a countdown. The existing tabs
(Kõik, Käimasolevad, Lõppenud, Mustandid and the status filters) SHALL
work over the full status set. Lots that are not `active` SHALL NOT offer
bid actions; bidding stays gated on `status = 'active'`.

#### Scenario: Scheduled lot is visible to its owner

- **WHEN** the owner opens `/user/objects` while their lot is `scheduled`
- **THEN** the lot card appears under Käimasolevad with the "Plaanis"
  pill and the "Algab \<kuupäev\>" note

#### Scenario: Draft lot is visible to its owner

- **WHEN** the submitter opens `/user/objects` after the wizard created
  their draft
- **THEN** the draft appears under Mustandid with the preview and review
  request actions

#### Scenario: Ended lot stays visible

- **WHEN** the owner opens `/user/objects` after their lot ended
- **THEN** the lot appears under Lõppenud with the post-end status pill
