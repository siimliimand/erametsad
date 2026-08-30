## ADDED Requirements

### Requirement: Minu pakkumised
`/user/bids` SHALL show tabs Aktiivsed / Lõppenud / Automaatpakkuja with
counters and deep-linkable `?tab=`. The active table SHALL render per
auction: type badge (AVATUD/SULETUD), the user's standing bid, leading
amount for open auctions, an em-dash with tooltip for sealed, status pill
(Juhtiv / Üle pakutud / Ootel (alapakkumine) / Esitatud), inline
autobidder edit, and a live countdown. The ended table SHALL show outcome
(Võitsid / Ei võitnud / Jäi müümata), final price, and the contract link
when actionable. SSE `outbid` SHALL update the row and raise a toast;
SSE `auction_end` SHALL move rows between tabs.

#### Scenario: Sealed leading column masked
- **WHEN** the active table lists a sealed auction
- **THEN** the leading column shows "—" with the explanation tooltip and
  the row status reads "Esitatud"

#### Scenario: Live outbid
- **WHEN** an `outbid` SSE event arrives for a visible row
- **THEN** the row highlights, its status flips to "Üle pakutud", and the
  toast names the auction

#### Scenario: Autobidder inline edit validated
- **WHEN** the user saves a max below the allowed minimum
- **THEN** the inline error shows the minimum and nothing is saved

### Requirement: Minu müügid
`/user/objects` SHALL show the seller's lots with status tabs (Kõik,
Mustand, Plaanis, Aktiivsed, Lõppenud), view and bid counts, leading price
for open auctions (start price for sealed active), and per-state actions
(draft preview + request review; unsold relist request). A persistent
banner SHALL surface pending alapakkumised. The lot drawer SHALL carry the
bid log (anonymized, newest first, autobid markers) and the alapakkumine
queue with approve/reject confirms; approval SHALL become leading and
reject SHALL notify the bidder; a 409 race SHALL render the conflict
message with follow-up options.

#### Scenario: Alapakkumine approval
- **WHEN** the seller confirms approval of a 12 000 € alapakkumine
- **THEN** it becomes the leading bid and the bidder is notified

#### Scenario: Race on approval
- **WHEN** a higher regular bid arrived before approval
- **THEN** the drawer shows the conflict message and offers reject or
  keep-pending

#### Scenario: Draft review request
- **WHEN** the seller clicks "Saada spetsialistile" on a draft
- **THEN** the review request is sent and the action disables

### Requirement: Teavitused
`/user/notifications` SHALL offer three tabs: inbox (cursor-paginated 25,
category chips, unread highlighting, click marks read and deep-links),
"Seaded" preference matrix (8 events × email/SMS with SMS restricted to
bid/auction-critical events and phone verification), and "Otsingute
tellimused" saved-search cards (filter chips, frequency selector, edit
filters in a modal, delete with confirm, delete-all with typed count).
"Märgi loetuks" SHALL clear all visible unread. Unsubscribe token links
SHALL open the confirm flow without a session.

#### Scenario: Inbox click deep-links
- **WHEN** the user clicks an unread outbid notification
- **THEN** it is marked read and the browser navigates to the auction

#### Scenario: Saved search deleted
- **WHEN** the user confirms deleting one saved search
- **THEN** only that subscription is removed

### Requirement: Minu profiil
`/user/profile` SHALL provide: profile switcher/manager (add company via
registrikood lookup and access request), private data card (isikukood
locked with eID-verified badge), company card (registry-validated,
read-only registrikood, re-lookup), the rights matrix with "Taotle õigust"
(refused while a request is pending), password modal, session list with
per-session and bulk revoke, and the consents log with withdrawal for
optional consents only.

#### Scenario: Rights request creates pending state
- **WHEN** the user requests property rights
- **THEN** the row flips to "Taotlus menetluses" and re-request is
  disabled

#### Scenario: eID isikukood locked
- **WHEN** the profile is eID-verified
- **THEN** the isikukood field renders read-only with the verified badge

#### Scenario: Session revoke
- **WHEN** the user revokes another session
- **THEN** that session is invalidated and disappears from the list

### Requirement: Lepingute allkirjastamine
`/lepingud` SHALL list the caller's contracts with type, auction link,
version, status pill, and actions. `/lepingud/raamleping` and
`/lepingud/oksjonileping/:auctionId` SHALL run the full-page 4-step flow
(Andmed prefilled from profile → PDF review with mandatory
"Olen dokumendi läbi lugenud" checkbox → mock eID signing with PIN2
control-code screen → Valmis with download), a status timeline
(Koostatud → Saadetud → Allkirjastatud / Tühistatud), resume on
interruption, an already-signed short-circuit showing the valid-from date
without re-signing on template version bumps, and a deadline countdown
chip on the auction contract.

#### Scenario: Framework gate round trip
- **WHEN** the user completes raamleping signing started from a bid gate
- **THEN** "Jätka pakkumisega" returns to `/oksjon/:id` with the bid panel
  focused

#### Scenario: Version bump does not force re-sign
- **WHEN** the contract template version increases after signing
- **THEN** the existing signature stays valid and the flow short-circuits
  to Valmis

#### Scenario: Signing provider failure
- **WHEN** the mock signing session expires
- **THEN** the flow offers re-prepare and keeps the contract in `sent`
