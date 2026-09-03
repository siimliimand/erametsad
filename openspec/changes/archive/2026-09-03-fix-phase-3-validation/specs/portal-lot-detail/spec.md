# portal-lot-detail Delta

## MODIFIED Requirements

### Requirement: Alapakkumine toggle
The panel SHALL offer the under-start toggle labeled "nõuab müüja
nõusolekut" when `settings.alapakkumineEnabled` is true and the auction is
open and active. Submitting below start price SHALL set the bid to
`pending_seller_approval` and show the pending chip "Alapakkumine ootab
müüja kinnitust". The chip state SHALL be server-backed: the viewer
snapshot SHALL expose whether the caller has a pending under-start bid on
the auction, and the panel SHALL show the pending chip after a page reload
when that flag is set.

#### Scenario: Toggle appears when enabled
- **WHEN** alapakkumine is enabled in Settings and a rights-holding user
  opens an active open auction
- **THEN** the panel shows the toggle

#### Scenario: Toggle absent when disabled
- **WHEN** alapakkumine is disabled in Settings
- **THEN** the panel shows no toggle and below-minimum bids are rejected

#### Scenario: Under-start submission pends
- **WHEN** the user submits an amount below minBid with the toggle on
- **THEN** the panel shows the pending chip and no leading-bid claim

#### Scenario: Pending chip survives reload
- **WHEN** the bidder reloads the lot page while their under-start bid is
  pending
- **THEN** the panel shows the pending chip from the server snapshot

## ADDED Requirements

### Requirement: Spec-aligned portal copy and species tooltips
The open-auction bid panel and confirm modal SHALL use the spec fee notice
"Teenustasu rakendub vaid oksjoni võitmise korral". The no-rights panel
SHALL direct the user to contact `info@erametsad.ee` per
`design/portal/02-lot-detail-open.md`. Species name tooltips SHALL cover
all 24 tree-species codes from the shared taxonomy and SHALL be available
on the dossier species row, not only in the package table.

#### Scenario: Fee notice matches the spec
- **WHEN** a rights-holding user views the bid panel or the confirm modal
- **THEN** the fee notice reads "Teenustasu rakendub vaid oksjoni
  võitmise korral"

#### Scenario: No-rights contact
- **WHEN** a user without the object-type right views the bid panel
- **THEN** the panel shows contact information pointing to
  `info@erametsad.ee`

#### Scenario: Species tooltip coverage
- **WHEN** a dossier or package table cell shows a tree-species code
- **THEN** a tooltip shows the full Estonian species name for every code
  in the taxonomy
