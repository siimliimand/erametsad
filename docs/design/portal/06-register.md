# Registreerimine — Registration (eID-first, private + company)

> **In brief:** Create a private or company account, with business-registry validation for companies.
| Area | portal |
|---|---|
| **Route** | `/register` (flow: identify → profile type → data → consents → done) |
| **Access** | public |
| **In nav** | login page "Registreeru" link |

## Purpose & user goals
A new bidder creates an account: identified via eID (preferred) or e-mail+isikukood fallback, then chooses a private profile or attaches an already-registered company via access request. Registration ≠ bidding rights (granted by admin per auction type).

## Wireframe (desktop)
```
┌─────────────────────────────────────────────────────────────┐
│ Registreerimine        ●────○────○────○   1/4 Tuvastus      │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ TUVASTA ENDE                                            │ │
│ │ [Smart-ID] [Mobiil-ID] [ID-kaart]                       │ │
│ │ ── või ilma eID-ta ──                                   │ │
│ │ E-mail [________]  Isikukood [________]  → kiri kinnit.  │ │
│ └─────────────────────────────────────────────────────────┘ │
│ Step 2: ┌ Eraisik ──────┐  ┌ Ettevõte ─────┐               │
│         │ Isiklik prof. │  │ Äriregistri   │               │
│         │ pakkumisteks  │  │ kood → otsing │               │
│         └───────────────┘  └───────────────┘               │
│ Step 3: kontaktandmed + <ConsentCheck>×3                    │
│ Step 4: ✅ "Konto on loodud" → /select-profile or /login     │
└─────────────────────────────────────────────────────────────┘
```
Mobile: steps stack; method cards full width; `<Steps>` becomes progress bar "Samm 2/4".

## Block-by-block spec
1. **Step 1 — Tuvasta end** — same eID method cards as login (shared component; Smart-ID/Mobiil-ID control-code flow, ID-card cert). On success: isikukood + name prefilled from eID response, proceed to step 2. **No-eID fallback**: E-mail + isikukood → double-opt-in e-mail "Kinnita konto" token link → continue at step 2.
2. **Step 2 — Profiili tüüp** — two `<Card>`s:
   - **Eraisik**: "Isiklik profiil pakkumiste tegemiseks enda nimel." Select → step 3 with prefilled personal data.
   - **Ettevõte**: "Paku ettevõtte nimel — vajab ülevaatamist." Select → **Äriregistri kood** input (8 digits) → company-lookup autocomplete (`GET /api/v1/company-lookup?regCode=`) returning company name/address → user confirms. Branch:
     - company **not yet registered** → profile created with `approval_status: pending` → step 3.
     - company **already registered** → access-request branch: "See ettevõte on juba registreeritud. Ligipääsu saamiseks saada taotlus." → `POST /api/v1/business/request-access` → **pending screen** "Sinu taotlus on ülevaatamisel. Võtame Sinuga ühendust läbivaatuse jooksul." → dead-end state (e-mail on decision).
3. **Step 3 — Andmed ja nõusolekud** — editable: e-mail, telefon, aadress (from eID/lookup). `<ConsentCheck>` ×3 (unchecked, required where marked): ☐ Kasutustingimused (link) — kohustuslik; ☐ Privaatsuspoliitika — kohustuslik; ☐ Soovin teavitusi uutest oksjonitest — valikuline. Submit `GET/POST /api/profiles`.
4. **Step 4 — Valmis** — success `<Card>`: "Konto on loodud." + role clarity copy: "Pakkumiste tegemiseks vajad vastava oksjonitüübi õigusi — kirjuta info@erametsad.ee või allkirjasta raamleping esimese pakkumise juures." CTAs: "Jätka pakkumisteni" (`next` or `/`), "Allkirjasta raamleping".
5. **Pending-company state page** — persistent banner across portal: "Ettevõtte profiil on ülevaatamisel" until approved/rejected.

## Interactions & edge cases
- eID identifies existing account → short-circuit: "Sul on juba konto olemas. Logi sisse." → `/login`.
- Company lookup: invalid code → "Registrikoodi ei leitud — kontrolli numbrit või sisesta andmed käsitsi" (manual-entry fallback per plan §6).
- Multiple company profiles: repeat step 2 later from profile page.
- Consent timestamps stored (`consent_at`); unchecked required consent blocks submit with inline error.
- Register while logged out mid-bid: `next` preserved through the whole flow.

## Data & API
| Action | Endpoint |
|---|---|
| eID identify | `POST /api/v1/auth/{smartid\|mobileid\|idcard}/start\|status\|complete` |
| e-mail fallback verify | password-reset-style token mail (reuse reset token infra) |
| company lookup | `GET /api/v1/company-lookup?regCode=` |
| access request | `POST /api/v1/business/request-access` {profile_id, reg_code} |
| create profile + consents | `POST /api/profiles`, consents stored on User/Profile |
No caching. No realtime.

## States
- Per-step loading; eID pending/rejected/expired (as login).
- Existing-account detected; already-registered company; pending approval; rejected approval (e-mail decision, banner state "Taotlus lükati tagasi — võta ühendust info@erametsad.ee").
- Generic error with retry; validation errors inline per field.

## Copy (Estonian, draft)
"Registreerimine" · "Tuvasta end" · "Vali profiili tüüp" · "Eraisik" · "Ettevõte" · "Äriregistri kood" · "See ettevõte on juba registreeritud. Ligipääsu saamiseks saada taotlus." · "Sinu taotlus on ülevaatamisel. Erametsadi meeskond võtab Sinuga ühendust." · "Konto on loodud" · "Nõustun kasutustingimustega" · "Soovin teavitusi uutest oksjonitest (valikuline)"

## SEO & analytics
noindex. Events: register_started, register_eid_success, register_company_lookup, access_request_sent, register_completed.

## Open questions
- Manual-entry fallback for company data if Äriregister API is down (queue for admin verification)?
- Can registration directly trigger the raamleping flow (skip the e-mail-to-admin rights step)? Recommend: yes for private, to reduce friction.
