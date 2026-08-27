# Kasutajad & õigused — Users & rights

> **In brief:** Find users, grant bidding rights, manage access and impersonate for support.
| Area | admin |
|---|---|
| **Route** | `/kasutajad` (list), `/kasutajad/:id` (detail) |
| **Access** | admin, superadmin (rights changes, ban, impersonate: superadmin or admin-with-delegated-right; suspend: admin) |
| **In nav** | sidebar "Kasutajad" |

## Purpose & user goals
Find any user, inspect identity/profiles/activity, manage per-auction-type bidding rights, apply enforcement (suspend/ban), run support via safe impersonation, and handle GDPR requests.

## Wireframe (desktop)
```
┌──────────────────────────────────────────────────────────────────────────┐
│ Kasutajad    [otsing: isikukood / e-post / registrikood / nimi]          │
│ Filtrid: [Profiil ▾ kõik/era/ettevõte][Olek ▾][Õigus ▾][Maakond ▾]      │
├──┬──────────────────────┬──────────────────┬───────────────┬────────────┤
│ID│ Nimi / isikukood     │ Profiilid        │ Õigused       │ Olek       │
│82│ Tõnis Kask           │ ○era  ●Tamm OÜ   │ R✓ K✓ P— B—  │ ● aktiivne │
│79│ Kalle Tamm           │ ○era             │ R✓ K— P— B—  │ ● aktiivne │
│… │ 3870516*****(masked) │                  │ 12 pakkumist │ sisse 26.08│
├──┴──────────────────────┴──────────────────┴───────────────┴────────────┤
│ Detail (Tõnis Kask #82) ← drawer/page                                     │
│ [Identiteet][Profiilid][Õigused][Lepingud][Pakkumised][Teavitused][GDPR] │
│ Õigused: raieõigus ● antud 12.05 (M. Vain)   [Eemalda↓ põhjusega]       │
│          kinnistu ●    [Eemalda]   põllumaa ○ —   pakett ○ —  [+ Anna]  │
└──────────────────────────────────────────────────────────────────────────┘
```
Mobile: list becomes cards; detail tabs stack.

## Block-by-block spec
**List** — DataTable columns: ID; Nimi + isikukood masked (first 5 + `*****`; unmask on click = audit-logged view); Profiilid (chips era/ettevõte, company chip links to company profile, amber if approval pending); Õigused summary (R/K/P/B letters for raieõigus/kinnistu/põllumaa/pakett, ✓/—); Pakkumised count (all-time, link filtered); Olek (aktiivne/suletud/bännitud); Viimane sisseastumine (relative). Filters: profile type, status, granted right, county, freetext. Default sort last login desc. Row click → detail.

**Detail tabs**
1. **Identiteet** — full name, isikukood (reveal button, logged), auth method (eID / parool), e-mail, phone, created_at, status; sessions list (device, IP hash, last active) with per-session force-logout.
2. **Profiilid** — cards per profile: era (data) / ettevõte (company name, registrikood, approval status + link to 07 request, board-member cross-check note). Profile switch history.
3. **Õigused** — rights matrix rows per object type (forest/property/field/package): state (antud /—), granted_by, granted_at, revoked history; grant button → modal: right type, **reason (required)**, notify user toggle (template "Öigused anti: …"), audit; revoke → typed reason mandatory + notify toggle. Changes take effect on next request (JWT claim re-check via profile version).
4. **Lepingud** — user's framework + per-auction contracts (status chips), link 08.
5. **Pakkumised** — bid history table (auction, amount, status, date) — link 04 per auction.
6. **Teavitused** — opt-in summary per channel (e-post/SMS), saved searches; per-event toggles read-only view of portal 11 settings.
7. **GDPR** — requests list (export/delete) with statuses: [Käivita eksport] → async zip (profile, bids, contracts metadata, consents; contracts PDFs retained per accounting law — notice shown) → download link 48h; [Käivita kustutus] → typed reason + double confirm modal explaining retention carve-outs (7-year accounting records: bid compensations + signed contracts kept pseudonymised), scheduled anonymisation job; both audit-logged.

**Actions** (header of detail + row overflow):
- **Peata (suspend)** — modal: duration (24h/7d/ indefinite) + typed reason; blocks login & bidding, active autobidders cancelled; user notified. Audit.
- **Keela (ban)** — typed reason, superadmin or admin+; irreversible per-user (new account with same isikukood blocked); running bids left standing (outbid-able), sealed bids voided only via 05 flow. Double confirm.
- **Välusta sessioon (force-logout)** — kills refresh tokens.
- **Vaata kasutajana (impersonate)** — admin+; modal: reason required + max duration 30 min; session opens portal as user with persistent orange banner "Vaadeld kasutajana: Tõnis K. · veel 24:12 · LÕPETA"; cannot place bids, sign, or change settings while impersonating (write-actions API-rejected); everything logged (`user.impersonate` start/end). Time-box auto-expires.
- **Märgi shill-kahtluseks** — flag from 04 anomalies: internal marker with note, visible in list filter "märgitud".

## Interactions & edge cases
- Isikukood masking: masked by default everywhere; reveal requires click + is audit event `user.identity_view` (GDPR plan §6).
- Search by isikukood works against hash index even though column is encrypted.
- Rights revocation while user has leading bid: warning "Kasutajal on juhtiv pakkumine #4810 — õiguse eemaldamine ei tühista seda" (choice: revoke anyway / + void bid via compensating entry by superadmin).
- Duplicate company profile request → route to 07.
- Keyboard: ⌘K global search lands here for user queries; E=export list.

## Data & API
`GET /api/admin/users?where=`, `GET :id`, `POST /api/admin/users/:id/rights {objectType, action, reason}`, `POST :id/suspend {until, reason}`, `POST :id/ban {reason}`, `POST :id/force-logout`, `POST :id/impersonate {reason, ttl}` → short-lived impersonation token; `POST :id/gdpr-export|gdpr-delete {reason}`.

## States
Empty search: "Kasutajat ei leitud — kontrolli isikukoodi". Suspend/ban confirmation errors inline in modal. Impersonation blocked for other staff accounts (never impersonate admin).

## Copy (Estonian, draft)
"Kasutajad" · "Anna õigus" · "Õiguse andmise põhjus (kohustuslik)" · "Eemalda õigus" · "Peata konto" · "Keela kasutaja" · "Keelamine on pöördumatu" · "Vaata kasutajana" · "Vaadeld kasutajana: {nimi}" · "LÕPETA" · "Käivita eksport" · "Käivita kustutus" · "Andmed säilitatakse raamatupidamise nõuete alusel 7 aastat (pseudonümiseeritult)" · "Isikukood on varjatud — klõpsa paljastamiseks (audit)".

## Permissions & audit
Audit-logged: identity view, rights grant/revoke (reason), suspend, ban, force-logout, impersonation start/end, GDPR export/delete, shill flag. Not logged: list/filter views (aggregate only, no message).

## Rights matrix semantics
- Rights are per object type on the **user**, effective per **active profile** for company (company profile active → user bids as company; rights checked against user+profile pair; UI shows both if differing).
- Grant modal fields: object type, reason (required), notify user (default on), effective immediately note.
- Revocation history visible as timeline (granted_by/at, revoked_by/at + reason each).
- Default rights on company approval (07) create entries with reason "Ettevõtte vaikimisi õigused".

## Impersonation safety rules
- Banner persists on every portal page (fixed top, orange, cannot be dismissed); countdown visible; auto-end at TTL or on "LÕPETA".
- Write-block list (API-enforced, admin UI just hides): placing bids, autobidder changes, signing, profile/consent changes, password change, notifications prefs.
- Read access: bids, notifications, profile — sufficient for support diagnosis.
- Impersonation of staff accounts (any admin/specialist) is always blocked.
- Concurrent impersonation of same user by two staff: second gets "Kasutajat vaatab juba M. Vain".

## GDPR flows detail
- **Export**: async job ≤24h; zip contains profile data, bids, contracts metadata, notifications log, consents; signed contracts PDFs included (they are the user's documents); download link personal, 48h expiry; log includes export contents hash.
- **Delete**: pre-check report (active bids, open contracts, accounting retention items); execution = anonymise user row (isikukood dropped, email tombstoned), bids/contracts pseudonymised to "Kustutatud kasutaja #id", personal identity snapshots purged; sealed-unopened bids deleted entirely; carve-out notice in confirm modal; scheduled job runs after 14-day cooling-off (user can cancel via portal).
- Both actions require typed reason and are double-confirm.

## Edge cases
| Case | Behaviour |
|---|---|
| Suspend user with active autobidders | autobidders cancelled automatically, note in timeline |
| Ban user with signed framework contract | allowed; contract retained (accounting); bidding blocked |
| Rights revoke racing a bid in-flight | bid validity determined server-side at bid time; UI warns |
| User has two profiles, rights differ | matrix shows per-profile rows with profile chips |

## Accessibility
Tabs standard tablist; masked isikukood reveal is a labelled button with aria-pressed; ban/suspend modals announce severity via role="alertdialog".

## Open questions
- 2FA (TOTP) mandatory for company-profile users — enforce from admin here?
- Should banned users' sealed bids auto-void or require ceremony decision?
- Staff accounts separate collection or User rows with staff role (audit separation)?
