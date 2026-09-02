# Minu profiil — My profile (data, rights, security, GDPR)

> **In brief:** Your account details, security settings and GDPR data export/delete.
| Area | portal |
|---|---|
| **Route** | `/user/profile` |
| **Access** | authed (private + company profiles) |
| **In nav** | Portal shell sidebar item 5; shell profile-chip dropdown "Minu profiil" |

## Purpose & user goals
The account control room: maintain contact data for the active profile (private person or company), see and request auction bidding rights, manage security (password, eID, sessions), exercise GDPR rights (export/delete), and review the consent log.

## Wireframe (desktop)
(Shared portal shell per `09-user-bids.md`.)
```
Minu profiil
[ Profiil: (●) Erki Prants  ( ) OÜ Mets & Mets  ▾ ]      ← profile switcher/manager
────────────────────────────────────────────────────────────────────────
┌ 1. ANDMED ────────────────────────────────────────────────────────────┐
│ ┌ Eraisik ─────────────────────────────────────────────────────────┐  │
│ │ Nimi*        [Erki Prants        ]                                │  │
│ │ Isikukood    382xxxxxxxx (lukus 🔒, kinnitatud eID-iga ✓)         │  │
│ │ E-post*      [erki@…      ] ✓ kinnitatud                          │  │
│ │ Telefon      [+372 5…     ] (kinnita SMS-koodiga)                 │  │
│ │ Aadress      [Viljandi mnt 12-4, Tallinn]                         │  │
│ │                                    [Salvesta muudatused]          │  │
│ └───────────────────────────────────────────────────────────────────┘  │
│ ┌ Ettevõte (aktivne profiil kui valitud) ───────────────────────────┐  │
│ │ Ettevõtte nimi  AS Mets & Mets  ( valideeritud Äriregistrist ✓)   │  │
│ │ Registrikood   12345678 (ainult lugemiseks)  [Kontrolli uuesti ↻] │  │
│ │ Staatus        ● Kinnitatud (16.08.2026)                          │  │
│ │ Esindajad: E. Prants (omanik) · M. Tamm (kinnitatud)              │  │
│ │            [+ Kutsu esindaja]                                     │  │
│ │ Kontakt, aadress … [Salvesta]                                     │  │
│ └───────────────────────────────────────────────────────────────────┘  │
┌ 2. OKSJONIÕIGUSED ────────────────────────────────────────────────────┐
│ Tüüp              Pakkumisõigus                                        │
│ Raieõigus (forest)      ● Olemas (alates 12.05.2026)                   │
│ Metsakinnistu (property)○ Puudub   [Taotle õigust]                     │
│ Põllumaa (field)         ○ Puudub   [Taotle õigust]                     │
│ Pakett (package)         ⏳ Taotlus menetluses (17.08)                 │
└────────────────────────────────────────────────────────────────────────┘
┌ 3. TURVE ─────────────────────────────────────────────────────────────┐
│ Parool        ● Seadistatud (vahetatud 01.07)  [Muuda parooli]         │
│ eID           ● Smart-ID seotud (isikukood kinnitatud) [Seo / Vaheta]  │
│ Aktiivsed sessioonid                                                    │
│  ▪ Chrome · Windows · Tallinn, EE · praegu        [Lõpeta]              │
│  ▪ Safari · iPhone · 2 t tagasi                    [Lõpeta]             │
└────────────────────────────────────────────────────────────────────────┘
┌ 4. PRIVAATSUS JA ANDMED ──────────────────────────────────────────────┐
│ [Laadi alla minu andmed]  [Kustuta minu konto]                          │
│ Nõusolekute logi: 16.08 11:04 — Teenustingimused ✓ (aktine)           │
│                   16.08 11:04 — Turunduslikud teavitused ✖ (loobutud) │
└────────────────────────────────────────────────────────────────────────┘
```
Mobile: sections stack as cards; rights matrix → rows with status pill + button; sessions → cards.

## Block-by-block spec
1. **Profile switcher** — segmented control of user's profiles; selecting one activates it for the whole portal (`POST /api/profiles/:id/select`) and re-renders sections. "+" adds a company profile (registrikood entry → `GET /api/v1/company-lookup?regCode=` → validated name shown → `POST /api/v1/business/request-access` → status "Ülevaatamisel"; duplicates: "See ettevõte on juba registreeritud. Saada ligipääsu taotlus.").
2. **Andmed (data cards)** — private card: Nimi*, E-post*, Telefon (verify by SMS code → `POST /api/my/phone/verify`), Aadress; Isikukood readonly-locked with "kinnitatud eID-iga" badge. Company card: name auto-filled & readonly from registry (validated ✓), **registrikood readonly**, "Kontrolli uuesti" refreshes registry data (`company-lookup`), approval StatusPill (Ülevaatamisel/Kinnitatud/Üldatud), **Esindajad** list (representatives; owner can invite: e-mail invite → recipient registers → appears in admin approval queue; remove with confirm). Save → `PATCH /api/profiles/:id`; dirty-state guard; toast "Andmed salvestatud".
3. **Oksjoniõigused (rights matrix)** — 4 rows (Raieõigus / Metsakinnistu / Põllumaa / Pakett) with status pill: `Olemas` (accent + granted date), `Puudub` (grey), `Taotlus menetluses` (amber + date). **[Taotle õigust]** → Modal explain: "Taotlus saadetakse Erametsad meeskonnale. Enne metsakinnistu pakkumist tuleb allkirjastada raamleping." → confirm → `POST /api/my/rights-requests {objectType}` → creates admin-queue item (§7.4) + notification on decision. Pending state disables re-request.
4. **Turve (security)**:
   - **Parool** — if no password (eID-only account): "Sea parool" flow; else "Muuda parooli" Modal (praegune + uus ×2, strength meter, min 10 tähemärki) → `POST /api/my/password-change`; links to reset flow (`08-update-password.md`).
   - **eID** — active binding display (Smart-ID/Mobiil-ID/ID-kaart verified by isikukood); [Seo / Vaheta] runs eID auth ceremony; isikukood itself never editable.
   - **Sessioonid** — list: device, browser, location (city, country), last active, "praegu" marker on current; [Lõpeta] per session with confirm ("See sessioon logitakse välja kohe") → `DELETE /api/my/sessions/:id`; "Lõpeta kõik teised" bulk with confirm.
5. **Privaatsus ja andmed (GDPR tools)**:
   - **Laadi alla minu andmed** → Modal choice JSON / CSV / mõlemad → `POST /api/my/data-export` (async job; status chip "Valmib…"; ready notification + download link valid 72h; includes profile, bids, autobidders, subscriptions, contracts metadata, consents).
   - **Kustuta konto** — multi-step flow:
     1. Warning Modal: what is deleted (account, profiles, subscriptions, drafts) vs retained (bids & contracts per accounting law 7 aastat, anonymised; legal basis cited).
     2. **Hold check**: if active contracts or ongoing auctions (bids on active auctions, signed unsigned contracts) → deletion **blocked**: inline error "Konto kustutamine pole võimalik, kuni Sul on kehtivaid lepinguid või käimasolevate oksjonite pakkumisi. Vii need lõpule või võta ühendust…" with links.
     3. If clear → type-to-confirm ("Kirjuta KUSTUTA") → `POST /api/my/account-delete` → **grace period 14 päeva**: banner "Konto kustub 10.09. Saad tühistada [Tühista kustutamine]" (cancel: `DELETE /api/my/account-delete`).
   - **Nõusolekute logi** — read-only list: consent type (Teenustingimused, Turundus, Turunduslikud teavitused/SMS…), timestamp, state (aktine/loobutud); withdraw action for marketing consents → confirm → `POST /api/my/consents/:id/withdraw` (records withdrawal time; contractually required consents cannot be withdrawn — shown locked with explanation).
6. **Empty/edge states** — eID-only account shows password section as "Pole seadistatud" + set flow; company pending approval shows read-only card with banner "Taotlus on ülevaatamisel. Võtame ühendust 1–2 tööpäeva jooksul."

## Interactions & edge cases
- Email change → re-verification e-mail to new address; old kept until confirmed (dual-state chip).
- Phone needed for SMS notifications — verification here gates SMS toggles in `11-user-notifications.md`.
- Company registry refresh can change name/legal address → shows diff confirm before overwrite.
- Switching profiles mid-edit → dirty guard "Sul on salvestamata muudatusi. Kas loobun?"
- All destructive actions (session revoke, representative remove, consent withdraw, delete account) confirm side-effects in plain Estonian; deletion additionally requires typed confirmation + hold check.
- Representative invite to an already-registered user → they accept from their own profile page.

## Data & API
- `GET/PATCH /api/profiles`, `POST /api/profiles/:id/select`, `POST /api/profiles` (new company).
- `GET /api/v1/company-lookup?regCode=`, `POST /api/v1/business/request-access`.
- Rights: `GET /api/my/auction-rights`, `POST /api/my/rights-requests` (admin queue §7.4).
- Security: `POST /api/my/password-change`, eID re-bind via `POST /api/v1/auth/{smartid|mobileid|idcard}/start|status|complete`, `GET /api/my/sessions`, `DELETE /api/my/sessions/:id`, `DELETE /api/my/sessions?others=1`.
- GDPR: `POST /api/my/data-export` (+`GET /api/my/data-export/:jobId`), `POST /api/my/account-delete`, `DELETE /api/my/account-delete`, `GET /api/my/consents`, `POST /api/my/consents/:id/withdraw`.
- Everything written to audit log (`AuditEntry`).

## States
Loading skeletons per card; error banners per section (save failures inline on fields); no-permission n/a. Export job states: Valmib → Valmis (link) / Ebaõnnestus (retry + contact). Delete states: Aktiivne → Armuajal (banner + cancel) → Kustutatud (logout).

## Copy (Estonian, draft)
- H1 "Minu profiil". Sections: "Andmed", "Oksjoniõigused", "Turve", "Privaatsus ja andmed".
- Labels: "Nimi · Isikukood · E-post · Telefon · Aadress · Registrikood · Ettevõtte nimi · Esindajad".
- Rights: "Pakkumisõigus", statuses "Olemas / Puudub / Taotlus menetluses", CTA "Taotle õigust"; confirm "Saadan taotluse Erametsad meeskonnale. Jätkad?"
- Security: "Muuda parooli", "Aktiivsed sessioonid", "Lõpeta", "Lõpeta kõik teised sessioonid".
- GDPR: "Laadi alla minu andmed", "Kustuta konto", block message "Konto kustutamine pole praegu võimalik, kuni Sul on kehtivaid lepinguid või käimasolevate oksjonite pakkumisi.", grace banner "Konto kustub {kuupäev}. Saad veel tühistada."
- Consent log: "Nõusolekute logi", states "aktiivne / loobutud", action "Loobu".

## Open questions
- Representative roles/permissions inside a company (owner vs bidder-only)?
- Data-export format details per dataset (bids include amounts + auction snapshots?) — legal review.
