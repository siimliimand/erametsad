# admin.erametsad.ee — the staff control room

> Analysis of the admin backend: what the staff tool does, all 14 modules, how staff work in it day to day, and its security model.
> Sources: `docs/ERAMETSAD-PLAN.md` (§7), `docs/design/admin/ADMIN-DESIGN-SPEC.md`, `docs/design/admin/*.md`, `docs/tasks.md` (Phase 5).

---

## 1. What this site is

`admin.erametsad.ee` is the internal tool for Erametsad staff. It runs on the same core API as the portal and the marketing site, but every screen is role-gated. Staff use it to run auctions end to end: create and publish lots, watch live bids, decide under-bids, open sealed auctions, manage users and rights, sign-off contracts, process marketing leads, route service requests, edit website content, read statistics, configure the platform, and inspect the audit trail.

Everything a staff member does here that touches users, bids, contracts, or settings lands in an append-only audit log.

## 2. Who logs in

| Role | Scope |
|---|---|
| **Specialist** (metsaspetsialist) | Own lots: create, edit, publish. Own leads. Sees bids on own lots. No manual auction ending, no exports, no fee override. |
| **Seller** (metsaomanik) | Own lots read-only in admin, plus alapakkumine decisions (mostly handled in the portal). |
| **Admin** | Everything except the roles matrix, settings writes, and audit export. |
| **Superadmin** | Everything. Required as the second signer in the sealed-bid opening ceremony. Assigns roles. |

## 3. The shell

- **Left icon rail (56 px, 13 modules):** Töölaud, Oksjonid, Pakkumised, Sul. avamine, Kasutajad, Ettevõtted, Lepingud, Juhtlõimed, Päringud, Sisuhaldus, Statistika, Seaded, Auditlogi. Icons show red or amber dots when a queue needs attention. Module visibility follows the role.
- **Topbar (64 px):** environment badge (PROD / STAGE / DEV), global search with a ⌘K command palette, notification bell with an unread counter, user menu.
- **Impersonation banner (conditional):** while an admin views the system as a user, an amber strip shows whose view it is, when the session expires, and that all writes are blocked. One click ends the impersonation.
- Recommended artboard: 1440 × 900 desktop. Tables collapse to cards on narrow screens.

## 4. The 14 modules

### 4.1 Töölaud (Dashboard, `/`)

The daily control room.

- **7 KPI cards:** active auctions, ending today (amber if > 0), bids today with a 7-day sparkline, pending confirmations (companies + alapakkumised), new leads, contracts awaiting signature, fee revenue month to date.
- **Lõpevad täna:** a live SSE table of auctions ending today with countdowns and a "Monitor" button per row. The row flashes green when anti-sniping extends an auction.
- **Süsteemi tervis** (admins): queue lag, failed jobs, live SSE connections, integration indicators (eID, Äriregister, SMS).
- **Kiire tegevus:** three action queues with counts (company requests, alapakkumised, contracts) that deep-link into the right module.
- **Viimased juhtlõimed:** the 8 newest leads with source and assignment state.

### 4.2 Oksjonid (Auctions list, `/oksjonid`)

- Tabs by type with counters (Kõik, Raieõigus, Kinnistud, Põllumaad, Paketid, Kiiroksjonid ⚡).
- Filter chips: status, type, county, specialist, date range, free text over name / cadastre / ID / e-mail alias. Filters live in the URL, so views are shareable.
- Data table (25 per page) with 11 columns, including a live countdown column and bid counts (amber "(p)" marks pending alapakkumised).
- Row actions on hover: Vaata (opens the portal lot), Muuda (wizard), Dupl. (clone as draft), Lõpeta käsitsi (admin+, active auctions only), Arhiivi / Avalda uuesti.
- Bulk bar for selections: schedule publishing together, export selected to CSV.
- **"Lõpeta käsitsi" modal:** red guarded flow. Shows the current leading bid, asks for an outcome (declare the current bid the winner, or mark unsold), requires a written reason, and confirms with a red button.

### 4.3 Oksjoni koostamine (Auction editor, `/oksjonid/uus`)

A 7-step wizard with autosave and per-step validation marks:

1. **Tüüp ja mehaanika.** Pick one of 4 object types. Property, field, and package lock the mechanic to sealed bid with an explanation. Kiiroksjon toggle (48 h, €1 start). Anti-sniping toggle with minutes. Start and end times in Europe/Tallinn. Minimum duration 1 hour.
2. **Asukoht.** County → parish cascade, address, an interactive map pin picker (Maa-amet orthophoto), coordinate fields, and automatic links to the cadastral map and the forest portal.
3. **Maa ja mets.** Area (ha), volume (m³), cadastral number repeater with format validation and a live state-registry check, registry numbers, 24 tree-species codes, logging types, compartments, forest notification numbers, logging and removal deadlines, storage and road approvals, rental agreement fields.
4. **Hinnad.** Start price. Bid step (open auctions only). The secret reserve price (piirhind) for sealed and kiiroksjon lots, masked after save and never shown to sellers or specialists. Fee override for admins only (empty = system default 3%).
5. **Sisu ja meedia.** Title, auto-generated anonymized contact alias (for example `mt27082601@oksjonid.erametsad.ee`), responsible specialist, two rich-text blocks, hero image plus gallery with drag ordering, focal point, and **mandatory alt text**, PDF uploads with labels.
6. **Pakett** (package lots only): property count plus a table editor (cadastre, registry part, county, area, start price) with CSV paste.
7. **Ülevaade ja avaldamine.** Summary with "Muuda" jumps. A two-column diff view when editing a published lot. Validation gates (required fields, alt text, deadline logic). Actions: save draft, schedule publishing, publish now, guest preview with a token.

### 4.4 Pakkumiste jälgimine (Bid monitoring, `/pakkumised`, per-lot variant)

- Header with a live ticking countdown, leading bid, and step size. Buttons for manual end and CSV export.
- **Live SSE bid feed** (newest first): time, anonymized bidder label, amount, source chip (Käsitsi / Automaatpakkuja), status (leading / outbid / pending). Rapid autobidder exchanges collapse into one "duel" row that expands.
- **Identity reveal:** an admin can click to unmask a bidder name. Every reveal is audit-logged.
- **Alapakkumiste queue:** approve (becomes the leading bid, others are notified) or reject with a mandatory reason that goes to the bidder. SLA badges show waiting age.
- **Anomaly flags (heuristics):** same-IP clusters, bursts from new accounts, and sub-5-second flip patterns. A card can be marked for internal investigation.
- **Anti-snipe log:** every extension with its trigger bid.

### 4.5 Suletud pakkumiste avamine (Sealed opening ceremony, `/oksjonid/:id/avamine`)

The highest-security screen. Until the ceremony, staff see only the number of sealed bids.

1. **Pre-flight checklist:** end time confirmed by the worker, no pending alapakkumised or disputes, contract template active.
2. **Two-person rule:** an opener signs with the typed keyword "AVAN". A separate superadmin session approves. Both sessions bind to the ceremony. Signatures expire after 30 minutes.
3. **Reveal:** one action decrypts all bids at once into a ranked table (amount, bidder with masked ID code, submission time, validity, gap to next). Ties resolve to the earlier submission. Invalid bids grey out.
4. **Outcome:** the system compares the top bid with the secret reserve.
   - Reserve met: "Kinnita võitja ja avalda lõpphind" → publishes the final price, generates the winner's contract, notifies losers neutrally.
   - Reserve not met: mark unsold, or (kiiroksjon) start the house backup purchase workflow.
   - A void path exists with a reason.
5. Every step writes to the audit log in real time.

### 4.6 Kasutajad ja õigused (Users, `/kasutajad`)

- Search by name, isikukood, e-mail, or registry code. Filters by profile, status, rights, county.
- Isikukood is masked (`3870516*****`). The reveal icon logs a `user.identity_view` audit event each time.
- Detail drawer with 7 tabs: identity (with session management and remote logout), profiles, **rights matrix** (grant/revoke per object type with a mandatory reason and automatic notification), contracts, full bid history, notification settings, GDPR tools (export ZIP, delete/anonymize honoring the 7-year accounting retention).
- Critical actions: impersonate for support (reason required, writes blocked), suspend (24 h / 7 days / indefinite + reason), ban (permanent, at the identity level).

### 4.7 Ettevõtte taotlused (Company approvals, `/ettevotted`)

- Pending cards with waiting age, an auto-fetched Äriregister panel (name, status, address, board members), and the applicant's profile with their reason.
- Automatic **board-member cross-check** against the applicant's name and identity code. A deleted company status blocks approval.
- **Duplicate warning** when the registry code already exists under another user, with a link to the existing profile.
- Actions: approve (optionally granting default bidding rights, auto e-mail), reject (mandatory reason), hold with an internal note. A history tab lists all past decisions.

### 4.8 Lepingud ja mallid (Contracts, `/lepingud`)

- **Contracts table:** number, type (Raamleping / Oksjonileping), user, company, auction, template version, status (Valmistatud → Saadetud → Allkirjastatud / Tühistatud), signing date. Stuck contracts show amber badges.
- Row actions: view PDF, download the signature container (ASiC-E, with the download logged), resend an expired invitation, void with a reason.
- **Templates tab:** DOCX upload with automatic `{{...}}` placeholder detection. A placeholder catalog (bidder, lot, transaction fields). Test render with sample data. Version history with one active version per type.

### 4.9 Juhtlõimed (Leads CRM, `/juhtloid`)

- Two views: a **Kanban board** and a table. Five columns: Uus → Võetud ühendust → Kvalifitseeritud → Leping → Mittekvalifitseeritud (requires a reason).
- **SLA badges:** amber after 24 h untouched, red after 48 h.
- Cards show name, county, request type chip, assigned specialist, and next action date. Drag and drop moves stages with exit guards.
- **Detail drawer:** click-to-call and mailto links, source form and page, cadastre with a map link, consent record with timestamp, specialist assignment (with a round-robin suggestion), next-action reminder, and a chronological notes timeline mixing staff notes and system events.
- Filters by source, county, specialist. Manual lead creation (for example from a phone call). CSV export for admins.

### 4.10 Päringute suunamine (Service requests, `/paringud`)

- Table of incoming päringud (management plan, tending cut, planting) with client, county, cadastre, forwarding state, and partner count.
- **Routing panel:** lists matching partner companies by service and county with their free capacity, pre-selects the top 3, and forwards with a **minimized payload** (name, phone, e-mail, cadastre only, no internal notes) plus 14-day signed links. A forwarding log tracks each partner and reply state.
- **Partner directory tab:** companies, contacts, services, covered counties, request limits, active toggle.

### 4.11 Sisuhaldus (CMS, `/sisu`)

- Left collection menu: pages, articles, FAQ, specialists, testimonials, subsidy programs, legal documents, media, redirects, menus.
- **Block builder** for pages: drag-and-drop blocks (hero, text, cards, process accordion, form, auction ticker, stats, CTA, testimonials) with a per-block settings drawer and a live preview with a desktop/mobile toggle.
- **Article editor:** rich text plus an SEO panel with a Google SERP preview, an Open Graph card preview, and character counters (title ≤ 60, description ≤ 160).
- **Media library:** upload with automatic renditions, focal point picker, and a hard gate: no image publishes without alt text.
- Prototype note: the plan accepts Payload's native admin for CMS collections at first. The custom block builder is post-prototype scope.

### 4.12 Statistika (Statistics, `/statistika`)

- Filter bar with period, object type, and county. CSV and multi-sheet XLSX export.
- **KPI cards:** auctions, sold and sell-through rate, total turnover, average €/ha and €/m³, fee revenue.
- **Monthly stacked chart** (sold / unsold / cancelled), a **choropleth map** of average prices by county (click for species-level detail, table alternative for accessibility), and a **lead funnel** (requests → contacted → qualified → contract) with average days to deal.
- **Public statistics curator:** toggles that decide which aggregate numbers appear on the public portal statistics page.

### 4.13 Seaded (Settings, `/seaded`)

Superadmin writes. Admin sees most sections read-only. Every save requires a written reason and is audit-logged.

- **Üldandmed:** company name, registry code, VAT number, address, alias domain, support contacts.
- **Teenustasud:** default fee %, VAT %, kiiroksjon fee override, optional minimum fee, and a **live sample calculation** (final price → fee + VAT → invoice total).
- **Oksjonireeglid:** anti-snipe minutes (1–30), autobidder on/off, alapakkumine default and seller decision window, minimum auction duration, the two-person rule for sealed openings.
- **Teavitused:** e-mail and SMS template editors with placeholders and test send. An SMS character and segment counter.
- **Integratsioonid:** status cards for Smart-ID/eID Easy, Äriregister, e-mail, SMS, and the map server, with masked API keys and connection tests.
- **Rollid:** the permission matrix (actions × roles).
- **Hooldusaken:** maintenance windows with a **conflict checker** that blocks saving if an auction ends inside the window.
- **Lipud:** feature flags (sealed_bids, sms_notifications, map_view, quick_auction).

### 4.14 Auditlogi (Audit log, `/audit`)

- Append-only and immutable. Deletion is technically blocked. Records are kept 7 years. A Merkle-chain integrity check runs nightly and shows a green indicator.
- Filters: staff member, action group (users/rights, auctions, sealed opening, contracts, settings), entity, date range, ID search.
- Table rows show millisecond timestamps, actor, action code with a human explanation, entity link, a diff button, and the reason.
- **Detail drawer:** a side-by-side JSON diff of the before/after state, with secrets masked, plus IP hash, user agent family, and session ID. CSV export for superadmins.

## 5. How staff use it (routines)

### 5.1 Morning routine

1. Open Töölaud. Check the KPI strip: anything ending today? Pending approvals?
2. Work the **Kiire tegevus** queues: company requests, alapakkumised, unsigned contracts. Each row links to the module.
3. Check **Süsteemi tervis** (admins): queue lag, failed jobs, integrations green.

### 5.2 Publishing a new auction

1. Oksjonid → "Uus oksjon" (⌘N).
2. Walk the 7 wizard steps. Type and mechanic first (sealed locks automatically for property/field/package). Pin the location on the map. Enter the land data with live cadastre checks. Set prices (the reserve hides after saving). Upload media with alt text.
3. Review the summary, fix validation marks, then save as draft, schedule, or publish now. Optionally open the guest preview link.

### 5.3 Running a live open auction

1. Open Pakkumiste jälgimine for the lot (or from the dashboard's "ending today" table).
2. Watch the live feed. Investigate each anomaly card.
3. Decide alapakkumised inside the SLA window: approve or reject with a reason.
4. If the auction must stop early, use "Lõpeta käsitsi" with an outcome and a reason.

### 5.4 Opening a sealed auction

1. After the deadline, open Sul. avamine. Complete the pre-flight checklist.
2. The opener types "AVAN". A superadmin signs in from their own account and approves within 30 minutes.
3. Reveal all bids at once. Confirm the winner against the reserve, or mark unsold / start the kiiroksjon house-offer flow. The winner's contract generation starts automatically.

### 5.5 Handling a lead

1. A marketing form fires. The lead appears in Juhtlõimed as "Uus".
2. Open the drawer: check the source and consent, call the client (click-to-call), write notes.
3. Assign the specialist (accept the suggestion), set a next-action date, drag the card forward. Keep leads out of the red SLA zone.

## 6. Security model, in short

- Role gates on every module. Destructive actions require typed keywords or written reasons.
- Personal identities stay masked until reveal. Every reveal, rights change, settings save, contract download, and ceremony step is audit-logged with before/after values.
- Impersonation is read-only by design.
- Sealed amounts are unreadable until the two-person ceremony.
- The audit chain is append-only with a nightly integrity check.

## 7. Known open items (from the specs and task list)

1. Statistics screen is deferred post-prototype (the public statistics endpoint already exists).
2. Settings ships as a subset (general, fees, auction rules, flags) first. Templates and the full matrix follow.
3. Anomaly/shill heuristics, GDPR job tooling, impersonation, and audit exports are later-scope items.
4. CMS: custom block builder, menu builder, and redirect manager are post-prototype scope. Payload's native admin covers the first release.
5. Anti-snipe default (5 vs 13 minutes) needs one decision in Settings.
