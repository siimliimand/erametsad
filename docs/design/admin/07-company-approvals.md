# Ettevõtte taotlused — Company access approvals

> **In brief:** Approve or reject company access requests.
| Area | admin |
|---|---|
| **Route** | `/ettevotted` (tabs: Ootel / Ajalugu) |
| **Access** | admin, superadmin |
| **In nav** | sidebar "Ettevõtted"; KPI shortcut from 01 |

## Purpose & user goals
Review and decide company-profile access requests: verify the requesting user against Äriregister data, detect duplicates, approve (activates profile + default bidding rights per settings) or reject with a notified reason.

## Wireframe (desktop)
```
┌────────────────────────────────────────────────────────────────────────┐
│ Ettevõtte taotlused   [Ootel 3] [Ajalugu 412]                          │
├────────────────────────────────────────────────────────────────────────┤
│ ┌─ Taotlus #77 ──────────────────────────────────────────────────────┐ │
│ │ Tamm OÜ · registrikood 14309277                       28.08 11:02   │ │
│ │ ┌ Äriregister (automaatne) ──────┐  ┌ Taotleja ──────────────────┐  │ │
│ │ │ Nimi: Tamm OÜ                  │  │ Tõnis Kask (#82)           │  │ │
│ │ │ Vorm: Osaühing  Olek: REGISTREERITUD │ ● era-profiil aktiivne 28.05│ │
│ │ │ Juhatuse liige: Tõnis Kask ✓   │  │ 3 pakkumist, 1 leping      │  │ │
│ │ │ Teadaolev esindaja: K. Tamm?   │  └────────────────────────────┘  │ │
│ │ └────────────────────────────────┘  ┌ Motivatsioon ─────────────┐   │ │
│ │ ⚠ Sama ettevõte juba olemas: profiil #14 (Kalle Tamm) — DUPLEKAAT│   │ │
│ │                                     └────────────────────────────┘  │ │
│ │ [Nõustu — aktiveeri profiil]  [Keeldu põhjusega]  [Hoia ootel]      │ │
│ └────────────────────────────────────────────────────────────────────┘ │
├────────────────────────────────────────────────────────────────────────┤
│ Ajalugu: tabel (kuupäev, ettevõte, taotleja, otsus, otsustaja, põhjus)  │
└────────────────────────────────────────────────────────────────────────┘
```
Mobile: cards stack; Äriregister panel becomes accordion.

## Block-by-block spec
1. **Ootel tab — request cards** (oldest first, SLA chip "oodatud 2 p" amber >2d, red >5d):
   - **Header**: company name + registrikood (8-digit), submitted timestamp, request id.
   - **Äriregister panel (auto-fetched)** — via company-lookup API: juriidiline nimi, õigusvorm (OÜ/AS/MTÜ…), registreeringu olek (REGISTREERITUD / KUSTUTATUD — red flag), juhatuse liikmed (cross-checked against requesting user's name + isikukood → ✓/✗/manual check marker), asukoht, KMKR nr if present, data-fetched-at timestamp. Fallback if API down: manually entered data shown with "kinnitamata" warning + link to ariregister.rik.ee.
   - **Taotleja panel** — user name/id, existing profiles, bidding history, framework contract status, account age, shill flags if any.
   - **Motivatsioon** — free-text from request form.
   - **Duplicate warning** — if registrikood already exists on an approved profile: amber block listing existing profile + its owner; guidance: existing owner must grant access OR reject duplicate with reason "Ettevõte on juba registreeritud" (mirrors reference behaviour). Cross-check: same board member on two profiles → info note.
2. **Decision actions**:
   - **Nõustu** — confirm modal: summary of what happens — activates company profile, grants default rights per settings 13 (checkbox list pre-filled from defaults, e.g. raieõigus ✓ kinnistu ✓), notifies user (template `company.approved`). Audit `company.approve`.
   - **Keeldu** — typed reason required; reason is included in the user notification template `company.rejected`; audit with reason.
   - **Hoia ootel** — internal note + reminder date; user sees "taotlus on ülevaatamisel" (no change).
3. **Ajalugu tab** — DataTable: kuupäev, ettevõte (name+regcode), taotleja (masked isikukood), otsus (chip: aktsepteeritud/tagasi lükatud), otsustaja, põhjus (truncated, expandable). Filters: decision, date range, freetext. Export CSV (admin).

## Interactions & edge cases
- Approve on a KUSTUTATUD (deleted) registry status: hard block with red banner "Ettevõte on äriregistrist kustutatud" — reject path only.
- Board-member check ✓ is a heuristic (name+id match); UI always leaves manual judgement; a "kontrollisin" checkbox on approve modal (checker accountability).
- Race: two requests for same regcode → first decision wins; second card shows "Profiil on juba aktiveeritud" and only reject-with-note remains.
- Notifications failures surface inline after decision ("Teavitus e-mail ei läinud välja — saada uuesti") but decision stands.
- Keyboard: A=nõustu (opens modal), R=keeldu, H=ootel on focused card.

## Data & API
`GET /api/admin/company-access-requests?status=pending|decided`, `POST /api/admin/company-access-requests/:id/approve {defaultRights[], checkedRegistry: true, note?}`, `POST :id/reject {reason}`, `POST :id/hold {note, remindAt}`; registry data from `GET /api/v1/company-lookup?regCode=` (cached per request).

## States
Empty queue: "Uusi taotlusi ei ole" + green check. Registry lookup pending: skeleton panel; failure: "Äriregistri andmed pole saadaval — sisestatud andmed kuvatakse kinnitamiseta".

## Copy (Estonian, draft)
"Ettevõtte taotlused" · "Ootel" · "Ajalugu" · "Äriregistri andmed (automaatselt)" · "Juhatuse liige kinnitatud" · "Ettevõte on juba registreeritud" · "Nõustu — aktiveeri profiil" · "Keeldu põhjusega" · "Keeldumise põhjus (kohustuslik)" · "Hoia ootel" · "Otsus teavitatakse taotlejale e-postiga" · "Ettevõte on äriregistrist kustutatud" · "Kontrollisin äriregistri andmeid" · "oodatud {n} p".

## Permissions & audit
Audit-logged: approve (with granted rights list), reject (reason), hold. Registry payload (board members' personal data) is shown but every card view with full registry data is logged as `user.identity_view`-class event (personal data of third parties) — noted in UI footer: "Registriandmete vaatamine logitakse".

## Approval effects (checklist shown in confirm modal)
On Nõustu:
1. Company profile `approval_status → active`; requesting user gains company profile in profile switcher.
2. Default bidding rights granted per settings 13 (editable checkbox list in modal, default from settings; each grant becomes a rights entry, reason "Ettevõtte vaikimisi õigused").
3. User notified via template `company.approved` (e-mail) — includes "Profiili valimine" deep link.
4. Audit `company.approve {requestId, profileId, rights[]}`.

## Registry data caching & re-validation
Lookup result cached per request at submission time; panel shows "Andmed päritud {aeg}"; [Kontrolli uuesti] refetches (logged view). Discrepancy between submitted name and registry legal name → amber "Nimi erineb registrist" with side-by-side.

## Board-member cross-check logic
- Match by isikukood (strong) or exact name (weak — marked "kinnita käsitsi").
- Neither matches → red flag "Taotleja ei ole juhatuse liige ega teadaolev esindaja" — approver must select: reject / approve with justification note (e.g. volikiri — power of attorney upload field appears, stored to request).

## History tab columns (full)
Kuupäev · Ettevõte (nimi + registrikood) · Taotleja (nimi + masked isikukood, link 06) · Otsus (chip aktsepteeritud/tagasi lükatud) · Otsustaja · Põhjus (expandable) · Antud õigused (chips). Filters: decision, date range, regcode. Export CSV (admin) — logged.

## Edge cases
| Case | Behaviour |
|---|---|
| Registry API down | manual-verification mode: data as submitted + link to ariregister.rik.ee; approve requires "Kontrollisin käsitsi" checkbox |
| Requesting user banned meanwhile | card shows red "Kasutaja on keelatud" — only reject path |
| User deleted account while pending | card marked "Taotleja kustutas konto" → auto-archive |
| Same regcode request re-submitted after rejection | shows prior rejection in history strip on card |

## Accessibility
Cards are articles with headings; decision buttons disabled until panel reviewed — disabled reason on tooltip; status chips text+colour.

## Data model mapping
Card = CompanyAccessRequest(id, profile_id, reg_code, status, reviewer_id, decided_at) joined with User, Profile and cached registry payload; history tab reads decided requests; decisions write both the request row and (on approve) profile `approval_status=active` + AuctionRight rows.

## States (full)
- Empty queue: "Uusi taotlusi ei ole" with green check and link to history.
- Registry fetch pending: skeleton lines in panel; failure: manual-mode banner.
- Card already decided elsewhere (race): read-only card with outcome chip.
- Hold: card moves to "Hoia ootel" subgroup at bottom with reminder date chip.

## Open questions
- Should approval auto-generate a framework-contract invitation for the company profile?
- SLA escalation: auto-notify superadmin when pending >5 days?
- Power-of-attorney (volikiri) uploads — retention period?
