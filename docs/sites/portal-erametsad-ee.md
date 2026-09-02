# portal.erametsad.ee — the auction environment

> Analysis of the auction portal: what it does, who can do what, every screen, the bidding rules, and step-by-step user journeys.
> Sources: `docs/ERAMETSAD-PLAN.md` (§5–§6), `docs/design/portal/*.md`, `docs/research/oksjonid-map.md`, `docs/tasks.md` (Phase 3).

> **Naming note.** The master plan calls this site `oksjonid.erametsad.ee`. The prototype runs it on `oksjonid.erametsad.ww0.dev`. This document uses the requested name `portal.erametsad.ee`. It is the same product: the auction environment and customer area. Rename it by changing the host mapping in the deployment middleware.

---

## 1. What this site is

The portal is the transactional core of Erametsad. Buyers browse lots on a list or a map, register, get bidding rights, bid in open or sealed auctions, and sign contracts electronically. Sellers follow their own lots in "Minu müügid" and decide on under-start bids. Guests can browse everything public. Bidding needs an account.

Business rules in one line: cutting rights (_raieõigus_) usually sell in open ascending auctions. Properties, fields, and packages sell by sealed bid (_pimepakkumine_). A kiiroksjon is a 48-hour variant with a secret reserve and a house backup offer. There are no deposits. The gates are identity, per-type bidding rights, and signed contracts.

## 2. Lot types and auction types

| Object type | Estonian | Auction type | Key data |
|---|---|---|---|
| `forest` | Raieõigus | open (ascending) or sealed | area ha, volume m³, species, compartments, logging deadlines |
| `property` | Metsakinnistu | sealed | cadastral numbers, registry numbers |
| `field` | Põllumaa | sealed | cadastral numbers |
| `package` | Kinnistute pakett | sealed | propertyCount + package table |
| kiiroksjon flag | Kiiroksjon | all types | 48 h duration, €1 start, secret reserve (piirhind), house backup offer |

Auction lifecycle: `draft → scheduled → active → ended → (seller accepts top bid or alapakkumine) → contract → completed → archived`, with `unsold` (re-list or kiiroksjon fallback) as the side exit. The clock is server time only. A bid inside the last minutes extends the end time (anti-sniping).

## 3. Roles and permissions

| Role | What they can do |
|---|---|
| Guest | browse listings, details, archive. See anonymized bid stubs. Subscribe to alerts by e-mail. Register |
| Registered, private person | bid (once rights are granted), use the autobidder, make alapakkumine, see own bids, sign contracts |
| Registered, company | the same under a company profile. Company access needs admin approval |
| Seller (metsaomanik) | see own lots in "Minu müügid", approve/reject alapakkumine, see results |
| Specialist | staff role. Creates and edits own lots. See `admin.erametsad.ee` analysis |

Bidding rights are granted **per object type** (forest / property / field / package) by an admin. Without the right, the bid panel shows a message to contact the team.

## 4. Public area (no login needed)

### 4.1 Listing (`/`)

- **Type tabs with live counters** and a summary sentence, for example "Hetkel on aktiivseid raieõiguste oksjoneid N, kokku X ha raiutavat mahtu Y m³ ja Z € väärtuses."
- **Grid ↔ map toggle.** The map shows Estonia with county outlines and pins from lot coordinates. Pin popups show area, price, registry number, and end date. Map tiles come from the Estonian Land Board WMS (Leaflet). OpenStreetMap is the fallback.
- **Filter panel** (collapsible, with "Tühjenda" and an active-count badge): county → parish cascade, tree species, logging types, area and volume ranges, price. The archive adds end year.
- **Sorting:** start price, final price, ending earlier/later. Server-side pagination.
- **"Telli teavitus"**: saves the current filter set as a subscription and e-mails the subscriber when a matching lot is published.
- **Live updates** via server-sent events: new lots appear, countdowns adjust, ended lots flip status without a reload.
- Cards show image, name, start price, county, area, volume (forest only), countdown "Aega jäänud", and a status pill.

### 4.2 Lot detail, shared dossier

Every lot page shows the full dossier (the open-auction and sealed-auction variants differ only in the bidding panel):

- Header with name, status pill, and a server-synced countdown (neutral → amber under 1 h → red under 5 min).
- Image gallery with lightbox.
- Map pin plus external links to the cadastral map (`ky.kataster.ee`) and the forest register (`register.metsad.ee`).
- Complete field table: cadastres, registry numbers, species, logging types, compartments, forest notification numbers, logging and removal deadlines, storage approvals, rental agreement facts.
- Rich-text info blocks (auction info and special conditions) and downloadable PDFs (inventory data, forest notifications).
- Specialist card with the per-lot anonymized contact e-mail.

### 4.3 Open auction bidding panel

State machine of the panel:

1. **Guest:** "Logi sisse pakkumise tegemiseks".
2. **Logged in, no rights for this type:** message to request rights from the team.
3. **Not started / ended:** appropriate notice with results when ended.
4. **Active with rights:**
   - Leading bid (visible to logged-in users), bid input with ± step buttons, and a binding confirm dialog ("siduv").
   - Notice "Teenustasu rakendub vaid oksjoni võitmise korral" (the fee applies only if you win).
   - **Alapakkumine toggle:** bid below the start price, clearly marked "nõuab müüja nõusolekut" (needs seller approval). It becomes pending until the seller decides.
   - **Autobidder (automaatpakkuja):** set a maximum sum. The system bids the minimum needed to stay leading.
5. **Outbid:** banner "Sinu pakkumine pakuti üle. Tee uus pakkumine." plus e-mail (and SMS if enabled).

Bid list rules: logged-in users see amounts, times, and anonymized labels (Pakkuja #1, #2…). Guests see counts and times only. Bidder identities are never public.

### 4.4 Sealed auction page

- Explanation card: "Kõik pakkumised avatakse üheaegselt peale lõppemist" (all bids open at once after the deadline).
- One submission form: amount (≥ start price) plus identity fields (name, isikukood 11 digits or registrikood 8 digits, e-mail, phone). Prefilled from the profile.
- The submission is binding and stored encrypted until the opening. After submitting, the user sees a locked confirmation card. Only the bid count is ever shown, never amounts or times.
- Post-opening states: winner (invited to sign the contract), loser ("Ei võitnud"), unsold ("Jäi müümata").

### 4.5 Archive ("Oksjonite ajalugu", `/ajalugu`)

- Tabs per object type with archived counters, filters plus end-year chips, sorting by final price, 24 cards per page.
- Cards show the final price ("Lõpphind") or "Müümata jäi". No winner identity, no bid counts, ever. A privacy line under the list states this.
- A statistics band can show all-time totals per type.

## 5. Accounts and identity

### 5.1 Login (`/login`)

- Primary: eID login with **Smart-ID, Mobile-ID, or ID-card** (control-code screen and status polling, with a demo simulator standing in for the provider in the prototype).
- Fallback: isikukood + password, rate-limited, with neutral error messages.
- Banners for pending company approval or a suspended account. A `?next=` parameter returns the user to the page they came from.

### 5.2 Registration (`/register`, 4 steps)

1. **Identify** via eID (or the prototype's e-mail token fallback).
2. **Profile type:** private, or company with registry lookup (Äriregister) and an access request if the company already has an account ("Sinu taotlus on ülevaatamisel").
3. **Data + 3 consents** with timestamps.
4. **Done** screen.

Company accounts stay inactive until an admin approves the request.

### 5.3 Profile selection and passwords

- `/select-profile`: radio cards of the user's private and company profiles with rights summaries and an "AKTIIVNE" marker. Inactive (pending) profiles are greyed out.
- `/update-password`: set, change, and reset with a strength meter (minimum 10 characters, must differ from the isikukood). A reset revokes other sessions.

## 6. Customer area ("Minu keskkond")

The logged-in shell has a header with search, a notification bell with an unread badge, and a profile chip, plus a collapsible sidebar and a mobile bottom tab bar. It subscribes to a personal event stream (outbid, auction ending, notifications).

### 6.1 Minu pakkumised (`/user/bids`)

Tabs: **Aktiivsed** (leading / outbid / pending approval states, countdowns), **Lõppenud** (won with a "Allkirjasta leping" link, lost, unsold), **Automaatpakkuja** (create, edit, delete auto-bidder limits inline). A live toast appears the moment the user is outbid.

### 6.2 Minu müügid (`/user/objects`)

The seller view: lot table with status, view and bid counts, current leading price, and a bid log (anonymized, with an autobidder marker). The **alapakkumine approval queue** sits on top: approve (the under-bid becomes the leading bid) or reject with a reason. Race conflicts are handled safely. A re-list request can be sent for unsold lots.

### 6.3 Teavitused (`/user/notifications`)

Notification inbox with category chips and deep links, mark-as-read. A preference matrix (8 event types × e-mail/SMS). Saved-search subscriptions with create/edit/delete and unsubscribe by token.

### 6.4 Minu profiil (`/user/profile`)

Personal data (isikukood locked once eID-verified), company re-lookup, the rights matrix per object type with a request action, password change modal, active sessions list, and the consents log. GDPR export and deletion requests are planned post-prototype.

### 6.5 Contract signing (`/lepingud/...`)

Two contract types, both signed with eID (prototype uses a mock PIN2 ceremony):

- **Raamleping (framework contract):** required once before the first open-auction bid. Flow: check data → review the PDF → confirm reading → sign → complete.
- **Oksjonileping (per-auction contract):** generated for the winner after the auction, with lot data, fee, and a signing deadline countdown.
- A contracts list shows all documents and their statuses. Template version bumps do not force re-signing of valid contracts.

## 7. Bidding rules (what actually happens on "tee pakkumine")

Open auctions, validation chain in order: user logged in → auction active → not ended → rights for this object type → amount ≥ current leading bid + step (or an approved alapakkumine) → framework contract signed. Every accepted bid is appended to an audit trail. Amounts never change.

- **Autobidder:** places the minimum bid needed to lead, up to the set maximum. Ties resolve in favor of the earlier-created autobidder. Two autobidders converge to (second maximum + step).
- **Anti-sniping:** a bid inside the last N minutes (default 5, configurable) extends the end time by N minutes, persisted and broadcast to all viewers.
- **Alapakkumine:** a bid below the start price, allowed when the lot enables it → status `pending_seller_approval` → the seller approves (it becomes the leading bid) or rejects (the bidder is notified).
- **Sealed auctions:** one bid per user (a configurable number of revisions before the end), encrypted at rest. At the deadline the system freezes. Staff run a two-person opening ceremony in the admin. The winner is the highest valid bid, ties go to the earliest submission. Only the final price becomes public.
- **Ending:** a background worker (never a browser) ends the auction, computes outcomes, fires notifications, and writes archive statistics. The processing is idempotent and safe to re-run.

## 8. Realtime and notifications

- Two SSE streams: `/api/auctions/stream` (public: `auction:published`, `auction:extended`, `auction:ended`, `bid:created`) and `/api/my/stream` (personal: outbid, ending, notifications, countdown sync). Reconnects use backoff and a full refetch.
- Notification events: new matching lot (saved search), outbid, won, lost, auction ending in 24 h (opt-in), alapakkumine decision, company access approved/rejected, contract ready, kiiroksjon result. E-mail covers all events. SMS serves bid-critical events (display-only until phone numbers are verified). Daily/weekly digests are a later phase.

## 9. How to use the portal (journeys)

### Journey A: new buyer, open auction (cutting rights)

1. Browse the listing, filter by county and species, or find the lot on the map.
2. Register with Smart-ID. Create a private profile.
3. An admin grants the "Raieõigus" bidding right (the portal tells the user whom to contact).
4. Open a lot, read the dossier, download the PDFs, and sign the **raamleping** (one time).
5. Bid manually, or set an autobidder maximum. If someone bids in the last 5 minutes, the countdown extends for everyone.
6. Win → the portal invites the user to sign the oksjonileping → sign with eID → the deal completes. The 3% + VAT fee applies only to the winner.

### Journey B: sealed-bid buyer (property)

1. Find a property lot (all sealed). Read the dossier.
2. Submit one binding bid with identity fields before the deadline. The bid is encrypted. Nobody, including staff, can see it before opening.
3. After the deadline, staff run the opening. Winner gets a contract invitation. Others get a neutral "Ei võitnud" notice. Only the final price is published.

### Journey C: seller (forest owner)

1. Started with a lead on the marketing site. A specialist prepared and published the lot.
2. Log in, open **Minu müügid**, watch view and bid counts.
3. An alapakkumine arrives → approve or reject with a reason.
4. The auction ends → the winner signs → the result and final price show in the list.

### Journey D: kiiroksjon bidder

1. Kiiroksjon lots are flagged. The auction runs 48 hours from a €1 start.
2. Bid like an open auction. If the secret reserve is never met, the lot goes unsold and Erametsad's own backup purchase offer flow starts on the seller side.

## 10. Privacy posture

- Bidder identities are anonymized everywhere public (Pakkuja #n).
- Guests never see amounts. Only counts and timestamps.
- Sealed amounts are unreadable in the database until the ceremony.
- The archive publishes final prices only.
- The isikukood is stored once, encrypted, with a hash index for lookup.

## 11. Known open items (from the specs and task list)

1. Leading-bid visibility for all logged-in users vs participants only (the specs lean to "all authed", needs confirmation).
2. Sealed-bid live count display: default shows the count only.
3. Anti-sniping default: plan says 5 minutes, the admin editor design assumes a Settings value (13 minutes in one draft). Both paths exist. A decision is needed.
4. Registration address is collected but not persisted yet (needs a migration).
5. Guest alert subscription stores the e-mail inside the filter payload. A dedicated field is planned.
6. SMS toggles stay display-only until phone verification exists.
7. CSV export from Minu pakkumised and the Minu müügid stats mini-chart are deferred.
