# portal-customer-area Delta

## MODIFIED Requirements

### Requirement: Lepingute allkirjastamine
`/lepingud` SHALL list the caller's contracts with type, auction link,
version, status pill, and actions. The list SHALL include the caller's
in-progress (`prepared`/`sent`) contracts, not only signed ones, with a
resume action that returns to the signing flow. `/lepingud/raamleping` and
`/lepingud/oksjonileping/:auctionId` SHALL run the full-page 4-step flow
(Andmed prefilled from profile → PDF review with mandatory
"Olen dokumendi läbi lugenud" checkbox → mock eID signing with PIN2
control-code screen → Valmis with download), a status timeline
(Koostatud → Saadetud → Allkirjastatud / Tühistatud), resume on
interruption, an already-signed short-circuit showing the valid-from date
without re-signing on template version bumps, and a deadline countdown
chip on the auction contract.

#### Scenario: In-progress contracts appear in the list
- **WHEN** the user has a prepared but unsigned raamleping and opens
  `/lepingud`
- **THEN** the list shows the row with its status pill and a resume
  action, scoped to that user's contracts only

#### Scenario: Framework gate round trip
- **WHEN** the user completes raamleping signing started from a bid gate
- **THEN** "Jätka pakkumisega" returns to `/oksjon/:id` with the bid panel
  focused

#### Scenario: Version bump does not force re-sign
- **WHEN** the contract template version increases after signing
- **THEN** the existing signature stays valid and the flow short-circuits
