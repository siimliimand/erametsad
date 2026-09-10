## MODIFIED Requirements

### Requirement: Minu pakkumised
`/user/bids` SHALL render the demo page head (crumb "Minu keskkond /
Minu pakkumised", H1 "Minu pakkumised", the summary sentence) and the
info hint banner ("Lülita teavitused sisse, et mitte oksjoni lõppu magama
jääda." with the "Ava teavitused" action). Filter chips SHALL read
Käimasolevad, Lõppenud, Võidetud, Kaotatud. Bids SHALL render as demo
bid cards (not tables): the title with the type badge ("Avatud" outlined
green / "Suletud" grey), the sub line "<county> · <area> · <type>", the
stat rows "Minu pakkumine", "Hetkel juhtiv" (or "Lõpphind" on ended), and
"Automaatpakkuja max" with the working switch and the "Muuda" action; the
right rail with the status pill ("Juhtiv pakkumine", "Ootel avamine",
"Võitsid", "Ei võitnud", "Leping allkirja ootel"), the live countdown,
and the actions ("Vaata oksjonit", "Allkirjasta leping" to the contract
flow, "Vaata tulemust"). Sealed amounts SHALL NOT be disclosed: the
leading cell shows "—" with the explanation tooltip until the opening
ceremony. Lost cards SHALL render dimmed. An empty filter result SHALL
show the empty state with "Tühjenda filtrid". SSE `outbid` SHALL update
the card and raise a toast; SSE `auction_end` SHALL move cards between
chips; the autobidder switch and "Muuda" SHALL validate the max
(≥ current leading + step) inline.

#### Scenario: Sealed leading masked
- **WHEN** the list shows a sealed auction before opening
- **THEN** the leading row reads "—" with the tooltip "Suletud
  pakkumised avaldatakse pärast lõppemist"

#### Scenario: Live outbid
- **WHEN** an `outbid` SSE event arrives for a visible card
- **THEN** the card highlights, its status flips to "Üle pakutud", and
  the toast names the auction

#### Scenario: Autobidder inline edit validated
- **WHEN** the user saves a max below the allowed minimum
- **THEN** the inline error shows the minimum and nothing is saved

#### Scenario: Won card links to signing
- **WHEN** a won auction has a contract awaiting signature
- **THEN** the card shows "Võitsid" with the pill "Leping allkirja
  ootel" and the "Allkirjasta leping" action

### Requirement: Minu müügid
`/user/objects` SHALL render the demo page head with the right-aligned
CTA "Paku oma objekti" and the filter chips Kõik, Käimasolevad,
Lõppenud, Mustandid (Käimasolevad covers scheduled and active auctions).
Lots SHALL render as demo object cards (not tables): the title with the
type badge, the sub line, the stat rows "Hetke hind" or "Lõpphind",
"Pakkumisi", "Vaatamisi" with the "+N / 24h" chip, and "Jälgijaid"; the
right rail with the status pill ("Aktiivne", "Leping allkirjastatud",
"Müümata", "Mustand"), the live countdown for active lots, and the
actions ("Vaata oksjonit", "Leping ja PDF", "Proovi uuesti" for unsold,
"Muuda" for drafts). Unsold and draft cards SHALL render dimmed with
their demo notes ("Oksjon jäi tulemuseta...", "Muudatused tehakse koos
metsaspetsialistiga — enne avaldamist vaatab ta objekti üle."). A draft
SHALL keep the preview and the "Saada spetsialistile" review request; an
unsold lot SHALL keep the relist request. A persistent banner SHALL
surface pending alapakkumised. The lot drawer SHALL carry the bid log
(anonymized, newest first, autobid markers) and the alapakkumine queue
with approve/reject confirms; approval SHALL become leading and reject
SHALL notify the bidder; a 409 race SHALL render the conflict message
with follow-up options.

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

#### Scenario: Unsold card action
- **WHEN** an auction ended without a sale
- **THEN** its dimmed card shows "Müümata" with the "Proovi uuesti"
  relist action

### Requirement: Teavitused
`/user/notifications` SHALL render one page with three stacked panels in
the demo layout. Panel "Saabunud teavitused": the header with "Märgi
loetuks", the category chips (Kõik, Lugemata, Pakkumised, Oksjonid,
Lepingud), and cursor-paginated notification items (25 per page, "Laadi
veel"): a 44px category icon, the title, the category badge, the body,
the meta line with the relative time, and the action button ("Vaata
oksjonit", "Vaata lepingut", "Vaata objekti"). Unread items SHALL show
the mist background with the amber dot; clicking an item SHALL mark it
read and deep-link. The panel SHALL show the empty state "Teavitusi
pole". Panel "Teavituste eelistused": the matrix with one row per event
and the columns Teavitused (switch), E-post (checkbox), SMS (checkbox,
"—" where the channel is restricted to bid/auction-critical events with
a verified phone), covering the domain event set including the
auction-published event; the channel note about e-post as the main
channel and the SMS thresholds; the persistence note "Muudatused
rakenduvad kohe.", the link "Privaatsuspoliitika ja nõusolekute logi",
and the "Saada test-teavitus" action. The matrix SHALL persist per user
through the profiles PATCH (`notificationPreferences`); the dispatcher
SHALL consult it before sending on a channel, and a disabled channel
SHALL produce no notification. Panel "Otsingute tellimused": the saved
search cards with filter chips, the frequency selector, edit filters in
a modal, delete with confirm, and delete-all with typed count.
"Märgi loetuks" SHALL clear all visible unread. Unsubscribe token links
SHALL open the confirm flow without a session and land on the saved
searches panel.

#### Scenario: Muted channel sends nothing
- **WHEN** the user disables email for the outbid event and another
  bidder passes them
- **THEN** no outbid email is queued for that user

#### Scenario: Matrix persists across reload
- **WHEN** the user toggles a channel and reloads the page
- **THEN** the matrix shows the saved state

#### Scenario: Inbox click deep-links
- **WHEN** the user clicks an unread outbid notification
- **THEN** it is marked read and the browser navigates to the auction

#### Scenario: Mark all read
- **WHEN** the user clicks "Märgi loetuks"
- **THEN** all visible unread items clear their unread state

#### Scenario: Saved search deleted
- **WHEN** the user confirms deleting one saved search
- **THEN** only that subscription is removed

### Requirement: Minu profiil
`/user/profile` SHALL render five stacked cards (maximum 880px) in the
demo layout. "Andmed": the auth chip with the eID method, the rows Nimi
(disabled input), Isikukood (masked "3870516*****" with "Näita"/"Peida",
the audit note that flips to "Vaatamine logitud auditisse.", and the
chip-note "kinnitatud eID-iga"), E-post ("kinnitatud"), Telefon (with
the "kinnita SMS-koodiga" hint), Aadress, and the "Muuda
kontaktandmeid" edit mode with "Loobu" and "Salvesta muudatused".
"Profiilid": one row per profile with the type, name, email or registry
code, the pills "Aktiivne profiil" and "Kinnitatud", and the "Lisa
ettevõte" action (registrikood lookup and access request; a company
card stays read-only on the registry number with re-lookup). 
"Oksjoniõigused": the on/off rights chips with dates and the note about
requesting rights and the framework contract; "Taotle õigust" SHALL be
refused while a request is pending. "Turve": the Parool row with "Muuda
parooli", the eID row with "Vaheta", the "Aktiivsed sessioonid" list
with the "See seanss" pill and per-session "Lõpeta", and "Logi välja
teistest seanssidest". "Privaatsus ja andmed": "Ekspordi mu andmed
(ZIP)" and the danger "Kustuta konto" button opening the confirm modal
"Kustuta konto?" with the Kustutame/Säilitame lists and the 7-year
retention note; the consents log with withdrawal for optional consents
SHALL render in this card group.

#### Scenario: Isikukood reveal logs to audit
- **WHEN** the user clicks "Näita" on the masked isikukood
- **THEN** the full value shows, the audit note flips to "Vaatamine
  logitud auditisse.", and the access is recorded

#### Scenario: Rights request creates pending state
- **WHEN** the user requests property rights
- **THEN** the row flips to "Taotlus menetluses" and re-request is
  disabled

#### Scenario: Session revoke
- **WHEN** the user revokes another session
- **THEN** that session is invalidated and disappears from the list

#### Scenario: Delete modal shows retention
- **WHEN** the user opens the delete-account modal
- **THEN** the modal lists what is deleted, what is kept, and the
  7-year retention note before the confirm action

### Requirement: Lepingute allkirjastamine
`/lepingud` SHALL render the demo-styled list: the raamleping status
card (signed: "Raamleping on allkirjastatud" with "Vaata"; unsigned:
"Raamleping on allkirjastamata" with the primary "Allkirjasta
raamleping") and the contract table with the columns Tüüp, Oksjon,
Versioon, Staatus, Allkirjastatud, Tegevus, status pills (Koostatud,
Saadetud, Allkirjastatud, Tühistatud), and the row actions ("Jätka" for
in-progress, "Vaata" for signed). The list SHALL include the caller's
in-progress (`prepared`/`sent`) contracts, not only signed ones, scoped
to that user. `/lepingud/raamleping` and
`/lepingud/oksjonileping/:auctionId` SHALL run the full-page signing
flow in the demo 4-step layout: the steps card (Andmed, Kontroll,
Allkiri, Valmis with "Allkirjastamine 1/4" progress) and the status rail
(Koostatud → Saadetud allkirjastamisele → Allkirjastatud → Erametsadi
vastuallkiri); on the auction contract an amber deadline banner
("Allkirjasta <date> — vastasel juhul läheb oksjon järgmisele
pakkujale.") with the deadline countdown chip. Step Andmed SHALL show
the context card with the winner line and three blocks: "Ostja (andmed
profiilist)" prefilled from the profile, "Hinna kokkuvõte" (Sinu
lõpphind, Teenustasu 3%, Käibemaks 22% (teenustasule), "Kokku
laekumisel"), and "Makse- ja raietingimused". Step Kontroll SHALL show
the document viewer card (version line, "lk 1/N · PDF eelvaade", "Laadi
alla PDF", the scrollable serif document) with the checkbox "Olen
dokumendi läbi lugenud ja nõustun tingimustega" enabling "Ava
allkirjastamiseks". Step Allkiri SHALL show the three vertical eID
buttons (Smart-ID, Mobiil-ID, ID-kaart) and the waiting state with the
PIN2 hint, the large mono control code, and "Katkesta allkirjastamine".
Step Valmis SHALL show the success card ("Leping allkirjastatud!" with
the timestamp and the signer), "Laadi allkirjastatud fail (.bdoc)", and
the "Mis edasi?" card (Arve saadetakse with the total, Raieteavitus
with the deadlines, Järgmised oksjonid). The flow SHALL resume on
interruption, short-circuit when already signed showing the valid-from
date without re-signing on template version bumps, and return to
`next` after the framework gate round trip.

#### Scenario: In-progress contracts appear in the list
- **WHEN** the user has a prepared but unsigned raamleping and opens
  `/lepingud`
- **THEN** the list shows the row with its status pill and a resume
  action, scoped to that user's contracts only

#### Scenario: Agree checkbox gates signing
- **WHEN** the document checkbox is unchecked on step Kontroll
- **THEN** "Ava allkirjastamiseks" stays disabled

#### Scenario: Framework gate round trip
- **WHEN** the user completes raamleping signing started from a bid gate
- **THEN** "Jätka pakkumisega" returns to `/oksjon/:id` with the bid
  panel focused

#### Scenario: Version bump does not force re-sign
- **WHEN** the contract template version increases after signing
- **THEN** the existing signature stays valid and the flow
  short-circuits

#### Scenario: Deadline banner on auction contract
- **WHEN** the winner opens an auction contract with a signing deadline
- **THEN** the amber banner shows the date and the countdown chip
