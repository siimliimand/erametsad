## MODIFIED Requirements

### Requirement: Shared lot dossier
`/oksjon/:id` SHALL render the shared dossier for both auction types in
the demo two-column layout: a main column (`minmax(0, 1fr)`) and a
400px sticky side rail that collapses to one column at the demo
breakpoint. Open auctions SHALL render a breadcrumb row ("Oksjonid" /
"<type>" / lot name) with the status pill pushed right. Sealed auctions
SHALL render the demo mist lot-head band with the crumbs, the H1, the
status pill, the dark "Suletud pimepakkumine" badge with a lock icon,
and the right-aligned deadline chip "Tähtaeg <d>p <HH:MM:SS>". Both
variants SHALL render the anchor tab row Ülevaade, Asukoht,
Dokumendid, Pakkumised that scrolls to its section and tracks the
active section. The dossier SHALL include: the gallery (main image plus
thumbnails) with a lightbox dialog (previous/next/close controls, arrow
key navigation, Escape to close); the map card with the pin, the
coordinates line, and the "Katastrikaart" (ky.kataster.ee) and
"Metsaregister" (register.metsad.ee) buttons; the demo facts table as a
zebra-striped definition list with the label column near 230px
(cadastres, registry numbers, county, parish, area, volume, species
with full-name tooltips, logging types, compartments, metsateatis
number, deadlines, minBid, bidStep — the latter two omitted for
sealed); the package table for pakett lots; the two rich-text info
cards ("Oksjoni info ja erisuses" and "Lisainfo", hidden when empty);
and the document list with red PDF icons and "Laadi alla" buttons.
Empty fields SHALL hide their rows.

#### Scenario: Anchor tab scrolls
- **WHEN** the user clicks the "Dokumendid" anchor tab
- **THEN** the page scrolls to the document section and the tab marks
  active

#### Scenario: Gallery lightbox keyboard
- **WHEN** the lightbox is open and the user presses the right arrow
- **THEN** the next image shows, and Escape closes the lightbox

#### Scenario: Countdown survives clock skew
- **WHEN** the client clock differs from the server clock
- **THEN** the countdown displays the remaining time computed from the
  server reference

#### Scenario: Sealed head band
- **WHEN** a visitor opens a sealed auction's page
- **THEN** the mist page-head band shows the crumbs, the H1, the dark
  sealed badge, and the "Tähtaeg" countdown chip

#### Scenario: Ended open auction dossier
- **WHEN** a visitor opens an ended lot's page
- **THEN** the panel area shows "Oksjon on lõppenud" with the final
  price and no bidding UI

### Requirement: Open-auction bid panel
The open-auction variant SHALL render the demo sticky bid rail: the
type line "Raieõigus · Avatud oksjon", the H1, the countdown with the
absolute end line "Oksjon lõppeb <D.M.YYYY> kell <HH:MM>", the "Hetke
hind" row with the amount and "Pakkumisi: <N>", the info chips "Samm:
<step> €" and "Anonüümsed pakkujad", the next-bid box "Järgmine lubatud
pakkumine <amount>", the amount form ("Sinu pakkumine (€)" input
prefilled to current + bidStep with the "Esita pakkumine" CTA), the
confirm modal restating the amount before any API call, the
"Automaatpakkuja" switch with the hidden limit input ("Automaatpakkuja
limiit (€)") and the hint "Pakub sinu eest kuni maksimaalse limiidini.",
the note "Uus pakkumine pikendab oksjoni 5 minutit" when anti-sniping
is enabled, the fee line "Oksjoni tasu 3% + km lisandub lõpphinnale",
and the "Oksjoni reeglid ja tingimused" link. An anti-snipe extension
SHALL show the banner "Oksjoni lõppu pikendati 5 minuti võrra." Guests,
no-rights users, not-started, and ended states SHALL render their
dedicated panels instead; the guest state SHALL use the demo gate modal
("Pakkumise tegemiseks logi sisse" with "Logi sisse" and "Registreeru"
actions).

#### Scenario: Confirm modal before bid
- **WHEN** the user submits a bid amount
- **THEN** a modal asks for confirmation stating the amount before any
  API call

#### Scenario: Next-bid box tracks price
- **WHEN** a new leading bid arrives over SSE
- **THEN** "Hetke hind", "Pakkumisi", and the next-bid box update
  without a reload

#### Scenario: Guest gate modal
- **WHEN** a guest tries to submit a bid on an active open auction
- **THEN** the gate modal opens with "Logi sisse" and "Registreeru"
  actions instead of an API call

#### Scenario: Snipe banner after extension
- **WHEN** an anti-snipe extension fires while the user views the lot
- **THEN** the banner "Oksjoni lõppu pikendati 5 minuti võrra." shows
  and the countdown and end line update

### Requirement: Role-shaped bid list with live updates
The bid history SHALL render as the demo table with the columns Aeg,
Summa, Pakkuja, and Viis, ordered descending. Times SHALL render in
mono; the leading row SHALL highlight with the demo primary-light style,
the inset left bar, and the "Liidab" chip; the Viis column SHALL show
the "Käsitsi" or "Automaat" source chip; own bids SHALL highlight and
sealed auctions SHALL show only the bid count. Below the table the note
"Kuvame <k> viimast pakkumist kokku <N>-st" SHALL render. New
`bid:created` SSE events SHALL prepend rows live; an outbid event SHALL
show the sticky banner "Sinu pakkumine pakuti üle" until the user leads
again. `auction:extended` SHALL move the countdown and panel deadline
without a reload; `auction:ended` SHALL lock the panel to the ended
state and refresh the bid outcome.

#### Scenario: Leading row chip
- **WHEN** the bid table renders on an open auction
- **THEN** the leading row shows the "Liidab" chip and each row shows
  its Käsitsi or Automaat chip

#### Scenario: Extension updates the countdown live
- **WHEN** an anti-snipe extension fires while the user views the lot
- **THEN** the header countdown and the panel deadline show the new end
  time without a reload

#### Scenario: End event locks the panel
- **WHEN** `auction:ended` arrives while the panel is open
- **THEN** the bidding form is replaced by the ended state and the
  final outcome

#### Scenario: Outbid banner lifecycle
- **WHEN** another bidder passes the user's leading bid
- **THEN** the banner appears and clears once the user's bid leads again

### Requirement: Sealed-bid panel
The sealed variant SHALL render the demo sealed panel in the side rail:
the dark head "Pimepakkumine" with the lock icon and the sub line "Üks
konfidentsiaalne pakkumine — parim võidab"; the explanation box ("Kõik
saabunud pakkumised avatakse üheaegselt..."); the deadline box with the
countdown and the absolute "Pakkumiste tähtaeg: <D.M.YYYY> kl <HH:MM>";
the counter "Pakkumuste arv: <N>"; the identity snapshot fields
prefilled from the active profile (name, isikukood 11-digit or
registrikood 8-digit validation, address, email, phone); the amount
form ("Pakkumise summa (€)", amount ≥ minBid, the hint about the start
price and the reserve, the "Esita pimepakkumine" CTA); the binding
confirm modal "Kinnita pakkumine" ("Katkesta" / "Kinnita"); the locked
submitted card with the blurred amount, the submission timestamp, and
"Muuda pakkumist"; revision resubmit while the server-confirmed
revision budget allows it; a `revision_cap_exceeded` response SHALL
lock the form with an inline message; the fee-on-win line "Teenustasu
3% + km — rakendub vaid oksjoni võitmise korral."; and the
confidentiality footnote. The page SHALL show only the bid count.
Post-opening states SHALL render in the demo phase cards: winner (link
to contract flow), loser ("Sinu pakkumine ei olnud edukaim"), unsold
("Oksjon jäi müümata"), and the result state with the large "Lõpphind"
figure and the fee note.

#### Scenario: Snapshot fields prefill
- **WHEN** an authed user opens a sealed auction
- **THEN** name, code, address, email, and phone prefill from the
  profile and the code validates by checksum

#### Scenario: Confirm modal before sealed bid
- **WHEN** the user submits a sealed amount
- **THEN** the "Kinnita pakkumine" modal restates the sum before any
  API call

#### Scenario: Server cap locks the form
- **WHEN** the API rejects a revision with `revision_cap_exceeded`
- **THEN** the form locks and the message states the budget is used

#### Scenario: Submitted bid locks the form
- **WHEN** the user's sealed bid is accepted
- **THEN** the form locks, the amount is masked, the timestamp shows,
  and "Muuda pakkumist" starts a revision

#### Scenario: Result phase
- **WHEN** the sealed auction opened and the caller is the winner
- **THEN** the phase card shows "Oksjoni tulemus" with the large
  "Lõpphind" figure and the fee note, and links to the contract flow
