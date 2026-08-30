# portal-lot-detail Specification

## Purpose
TBD - created by archiving change phase-3-auction-portal. Update Purpose after archive.
## Requirements
### Requirement: Shared lot dossier
`/oksjon/:id` SHALL render the shared dossier for both auction types:
header with name, StatusPill, and a server-synced Countdown (drift
corrected against the server clock captured at SSR, with an `onEnd`
refresh); gallery with lightbox; map pin with ky.kataster.ee and
register.metsad.ee links; the full field DataTable (cadastres, registry
numbers, area, volume, species with full-name tooltips, logging types,
compartments, metsateatis number, deadlines, storage approval, removal
roads, rental agreement, minBid, bidStep - the latter two omitted for
sealed); package table for pakett lots; two rich-text info cards
("Oksjoni info ja erisuses" from the public description and "Lisainfo"
from `descriptionSecondary`, headings preserved, cards hidden when the
source is empty); file downloads; and SpecialistCard with the stored
photo, stored role, and the per-lot alias email with copy-to-clipboard.
Empty fields SHALL hide their rows.

#### Scenario: Secondary info card renders
- **WHEN** an auction has `descriptionSecondary` filled
- **THEN** the lot page shows the "Lisainfo" card with its headings
  intact

#### Scenario: Countdown survives clock skew
- **WHEN** the client clock differs from the server clock
- **THEN** the countdown displays the remaining time computed from the
  server reference

#### Scenario: Ended open auction dossier
- **WHEN** a visitor opens an ended lot's page
- **THEN** the panel area shows "Oksjon on lõppenud" with the final price
  and no bidding UI

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
When `settings.alapakkumineEnabled` is true and the auction is open and
active, the panel SHALL offer the under-start toggle labeled "nõuab müüja
nõusolekut". Submitting below start price SHALL set the bid to
`pending_seller_approval` and show the pending chip "Alapakkumine ootab
müüja kinnitust".

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

### Requirement: Inline autobidder management
The panel SHALL let eligible users create, edit, or remove their
autobidder max inline. The page SHALL fetch the caller's existing row for
the auction so the input prefills with the stored max and shows
"Uuenda"/"Eemalda" actions; validation SHALL require max ≥ current
leading + step.

#### Scenario: Stored max prefills
- **WHEN** a user with an existing autobidder row opens the panel
- **THEN** the input shows the stored max with "Uuenda" and "Eemalda"
  actions

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
`auction:extended` SHALL move the countdown and panel deadline without a
reload; `auction:ended` SHALL lock the panel to the ended state and
refresh the bid outcome.

#### Scenario: Extension updates the countdown live
- **WHEN** an anti-snipe extension fires while the user views the lot
- **THEN** the header countdown and the panel deadline show the new end
  time without a reload

#### Scenario: End event locks the panel
- **WHEN** `auction:ended` arrives while the panel is open
- **THEN** the bidding form is replaced by the ended state and the final
  outcome

#### Scenario: Outbid banner lifecycle
- **WHEN** another bidder passes the user's leading bid
- **THEN** the banner appears and clears once the user's bid leads again

### Requirement: Sealed-bid panel
The sealed variant SHALL replace the BidPanel with the sealed submission:
the explanation card ("Kõik saabunud pakkumised avatakse üheaegselt..."),
the identity snapshot form prefilled from the active profile with five
fields (name, isikukood 11-digit or registrikood 8-digit validation,
address, email, phone), amount ≥ minBid, the binding confirm modal, a
locked submitted card with blurred amount, and revision resubmit while
the server-confirmed revision budget allows it; a
`revision_cap_exceeded` response SHALL lock the form with an inline
message. The page SHALL show only the bid count. Post-opening states
SHALL render winner (link to contract flow), loser ("Sinu pakkumine ei
olnud edukaim"), and unsold ("Oksjon jäi müümata") per caller.

#### Scenario: Snapshot fields prefill
- **WHEN** an authed user opens a sealed auction
- **THEN** name, code, address, email, and phone prefill from the
  profile and the code validates by checksum

#### Scenario: Server cap locks the form
- **WHEN** the API rejects a revision with `revision_cap_exceeded`
- **THEN** the form locks and the message states the budget is used

#### Scenario: Submitted bid locks the form
- **WHEN** the user's sealed bid is accepted
- **THEN** the form locks, the amount is masked, and the timestamp shows

