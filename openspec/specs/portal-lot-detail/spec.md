# portal-lot-detail Specification

## Purpose
TBD - created by archiving change phase-3-auction-portal. Update Purpose after archive.
## Requirements
### Requirement: Shared lot dossier
`/oksjon/:id` SHALL render the shared dossier for both auction types:
header with name, StatusPill, and server-synced Countdown; gallery with
lightbox; map pin with ky.kataster.ee and register.metsad.ee links; the
full field DataTable (cadastres, registry numbers, area, volume, species
with tooltips, logging types, compartments, metsateatis number, deadlines,
storage approval, removal roads, rental agreement, minBid, bidStep - the
latter two omitted for sealed); package table for pakett lots; rich-text
info cards; signed-URL file downloads; and SpecialistCard with the per-lot
alias email and copy-to-clipboard. Empty fields SHALL hide their rows.

#### Scenario: Ended open auction dossier
- **WHEN** a visitor opens an ended lot's page
- **THEN** the panel area shows "Oksjon on lõppenud" with the final price
  and no bidding UI

#### Scenario: Alias email copyable
- **WHEN** the user clicks the alias email copy affordance
- **THEN** the alias address is on the clipboard

### Requirement: Open-auction bid panel
The open-auction variant SHALL render the BidPanel for active auctions:
leading bid for authed users, amount input prefilled to current + bidStep
with ± step buttons, a confirm modal restating the amount and next step,
the teenustasu notice, and the auto-extension notice when anti-sniping is
enabled. Guest, no-rights, not-started, and ended states SHALL render
their dedicated panels instead.

#### Scenario: Confirm modal before bid
- **WHEN** the user submits a bid amount
- **THEN** a modal asks for confirmation stating the amount and the next
  step before any API call

#### Scenario: Guest panel
- **WHEN** a guest views an active open auction
- **THEN** the panel shows "Logi sisse pakkumise tegemiseks" with a CTA
  and the bid list shows only count and times

### Requirement: Alapakkumine toggle
When alapakkumine is enabled, the panel SHALL offer the under-start toggle
labeled "nõuab müüja nõusolekut". Submitting below start price SHALL set
the bid to `pending_seller_approval` and show the pending chip
"Alapakkumine ootab müüja kinnitust".

#### Scenario: Under-start submission pends
- **WHEN** the user submits an amount below minBid with the toggle on
- **THEN** the panel shows the pending chip and no leading-bid claim

### Requirement: Inline autobidder management
The panel SHALL let eligible users create, edit, or remove their
autobidder max inline. Existing max SHALL prefill the input with
"Uuenda"/"Eemalda" actions; validation SHALL require max ≥ current leading
+ step.

#### Scenario: Autobidder update below minimum rejected
- **WHEN** the user saves a max below leading + step
- **THEN** the inline error states the minimum allowed amount

### Requirement: Framework contract gate
Open-auction bid submission by a user without a signed raamleping SHALL
redirect to `/lepingud/raamleping?next=/oksjon/:id` with the message
"Enampakkumise tegemiseks tuleb esmalt allkirjastada raamleping."

#### Scenario: Unsigned bidder redirected
- **WHEN** a rights-holding user without raamleping submits a bid
- **THEN** the browser lands on the framework contract flow with `next`
  preserved

### Requirement: Role-shaped bid list with live updates
The bid list SHALL render authed rows as "#N {amount} € · Pakkuja #k ·
relative time" ordered descending with own bids highlighted and autobid
bids marked; guests see only count and latest time. New `bid:created`
SSE events SHALL prepend rows live; an outbid event SHALL show the sticky
banner "Sinu pakkumine pakuti üle" until the user leads again.

#### Scenario: Outbid banner lifecycle
- **WHEN** another bidder passes the user's leading bid
- **THEN** the banner appears and clears once the user's bid leads again

### Requirement: Sealed-bid panel
The sealed variant SHALL replace the BidPanel with the sealed submission:
the explanation card ("Kõik saabunud pakkumised avatakse üheaegselt..."),
identity snapshot fields prefilled from the active profile (isikukood
11-digit or registrikood 8-digit validation), amount ≥ minBid, the
binding confirm modal, a locked submitted card with blurred amount, and
revision resubmit when the auction allows it. The page SHALL show only
the bid count. Post-opening states SHALL render winner (link to contract
flow), loser ("Sinu pakkumine ei olnud edukaim"), and unsold ("Oksjon jäi
müümata") per caller.

#### Scenario: Submitted bid locks the form
- **WHEN** the user's sealed bid is accepted
- **THEN** the form locks, the amount is masked, and the timestamp shows

#### Scenario: Invalid isikukood blocked
- **WHEN** the identity form contains a checksum-invalid isikukood
- **THEN** submission is blocked with the Estonian validation message

