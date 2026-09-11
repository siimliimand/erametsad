## MODIFIED Requirements

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
and the "Saada test-teavitus" action. The "Saada test-teavitus" action
SHALL call `POST /api/v1/my/notifications/test`, which SHALL require a
session, rate-limit per user to one request per minute, build a sample
notification from a transactional template, and deliver it to the
user's own email through the production email sender. The button SHALL
report the real outcome: a success state on delivery and the error
message on failure or rate-limit. The matrix SHALL persist per user
through the profiles PATCH (`notificationPreferences`); the dispatcher
SHALL consult it before sending on a channel, and a disabled channel
SHALL produce no notification. Panel "Otsingute tellimused": the saved
search cards with filter chips, the frequency selector, edit filters in
a modal, delete with confirm, and delete-all with typed count.
"Märgi loetuks" SHALL clear all visible unread. Unsubscribe token links
SHALL open the confirm flow without a session and land on the saved
searches panel.

#### Scenario: Test notification sends an email

- **WHEN** the user clicks "Saada test-teavitus"
- **THEN** the endpoint sends one sample email to the user's own
  address and the button shows a success state

#### Scenario: Test notification is rate-limited

- **WHEN** the user clicks "Saada test-teavitus" twice within one
  minute
- **THEN** the second request is refused with a 429 and the button
  shows the rate-limit message

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
(ZIP)" SHALL call `GET /api/v1/my/export`, which SHALL require a
session, rate-limit per user, gather the user's records (user row
without ciphertext fields, profiles, bids, autobidders, auction rights,
consent log entries, notification preference state, session metadata,
own service requests and rights requests), and stream the ZIP
`erametsad-andmed-<date>.zip`; the danger "Kustuta konto" button opens
the confirm modal "Kustuta konto?" with the Kustutame/Säilitame lists
and the 7-year retention note, and confirming with the typed word
`KUSTUTA` SHALL call `POST /api/v1/my/delete-account`: the endpoint
SHALL refuse while the user holds active participation (active auction
bids, live autobidders, pending contracts), and otherwise anonymize the
user (tombstone email, wipe name, phone, isikukood fields, and password
material), revoke all sessions, and write an audit entry with reason
`user-self-deletion`; the browser SHALL then end on the signed-out
state. The consents log with withdrawal for optional consents SHALL
render in this card group.

#### Scenario: Isikukood reveal logs to audit
- **WHEN** the user clicks "Näita" on the masked isikukood
- **THEN** the full value shows, the audit note flips to "Vaatamine
  logitud auditisse.", and the access is recorded

#### Scenario: Export downloads a real ZIP
- **WHEN** the user clicks "Ekspordi mu andmed (ZIP)"
- **THEN** the browser downloads `erametsad-andmed-<date>.zip` whose
  entries cover the user's bids, consents, and profile data

#### Scenario: Deletion refuses while bids are active
- **WHEN** the user confirms deletion while holding a bid on an active
  auction
- **THEN** the endpoint refuses with the active-participation reason
  and the account stays intact

#### Scenario: Deletion anonymizes and signs out
- **WHEN** the user with no active participation types `KUSTUTA` and
  confirms
- **THEN** the personal fields are wiped, sessions are revoked, an
  audit entry is written, and the browser lands on the signed-out
  state

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
