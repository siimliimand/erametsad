# Logi sisse — Login

> **In brief:** Sign in with Smart-ID, Mobile-ID, ID-card or a password fallback.
| Area | portal |
|---|---|
| **Route** | `/login?next=/oksjon/:id` |
| **Access** | public |
| **In nav** | header "Logi sisse"; all gated CTAs redirect here with `next` |

## Purpose & user goals
Any user (bidder, seller, specialist) authenticates via eID or isikukood+parool and returns to their intended page (usually a lot they were about to bid on) with minimal friction.

## Wireframe (desktop)
```
┌──────────────────────────────────────────────────────┐
│              ERAMETSAD OKSJONID                        │
│        ┌──────────────────────────────┐              │
│        │  MÄNGI ID-GA SISSE           │              │
│        │ ┌──────────┐ ┌──────────┐   │              │
│        │ │ Smart-ID │ │ Mobiil-ID│   │              │
│        │ └──────────┘ └──────────┘   │              │
│        │ ┌──────────────────────┐    │              │
│        │ │ ID-kaart (lugejaga)  │    │              │
│        │ └──────────────────────┘    │              │
│        │ ────────── või ──────────   │              │
│        │ Isikukood  [___________]    │              │
│        │ Parool      [___________]    │              │
│        │ [ LOGI SISSE ]               │              │
│        │ Unustasid parooli? · Registreeru │         │
│        └──────────────────────────────┘              │
└──────────────────────────────────────────────────────┘
```
Mobile: method cards stack vertically; identical logic. eID status screen is a full-card replacement view.

## Block-by-block spec
1. **Method cards** (3): Smart-ID, Mobiil-ID, ID-kaart — each with provider logo placeholder (Lucide `smartphone`, `nfc`, `credit-card`), short hint ("Kiireim viis — kasuta telefoni PIN1").
2. **Smart-ID flow** (same for Mobiil-ID with phone-number step):
   - Click card → step 2 view: isikukood input (11 digits) → "Alusta" → `POST /api/v1/auth/smartid/start` returns control code (4 digits) + session token.
   - **Pending state**: big control-number display "Kontrolli, et telefonis kuvatakse sama numbrit: **4832**. Seejärel sisesta PIN1." + animated waiting ring + "Tühista" link.
   - Poll `POST /api/v1/auth/smartid/status` every 2 s (or SSE): `pending` → keep waiting; `approved` → `complete` call → session set → redirect; `rejected` → error "Tujuvuslik jätkamine keelati. Proovi uuesti."; `expired` (60–120 s) → "Kinnitus jäi saabumata. Alusta uuesti."
3. **Mobiil-ID flow** — adds phone-number input (+372 preset) before start; pending copy "Kinnituskood {code} saadeti SMS-iga. Sisesta telefonis Mobiil-ID PIN1."
4. **ID-kaart flow** — click → browser prompts client cert (Web eID plugin detection) → `POST /api/v1/auth/idcard/complete` with signature → session. Detection-failure state: "ID-kaarti ei tuvastatud. Kontrolli lugeja ühendust ja veebilehitseja pluginat." + link to plugin help.
5. **Fallback form** — Isikukood + Parool, `POST /api/v1/auth/login`. "Unustasid parooli?" → `/update-password` reset flow. "Registreeru" link → `/register`.
6. **Redirect** — on success: `next` param if safe (same-origin path), else `/`; if user has multiple profiles → `/select-profile?next=…`.
7. **Post-login banners** — suspended account, pending company request (see States).

## Interactions & edge cases
- Enter key submits active form; method switch resets pending session (cancel call).
- Only one active eID session per browser; starting again cancels the old.
- Rate limit on password login (5/min/IP): error "Liiga palju katseid. Proovi mõne minuti pärast uuesti."
- Wrong credentials: "Vigane isikukood või parool." (no hint which).
- Session cookies httpOnly, short JWT + rotating refresh.
- Pending eID screen keeps polling even if user switches tab; on `approved` while away, redirect on return.

## Data & API
| Action | Endpoint |
|---|---|
| Smart-ID start/status | `POST /api/v1/auth/smartid/start` · `/status` |
| Mobiil-ID start/status | `POST /api/v1/auth/mobileid/start` · `/status` |
| ID-card complete | `POST /api/v1/auth/idcard/complete` |
| password login | `POST /api/v1/auth/login` {isikukood, password} |
| session/refresh | cookie set on complete; refresh rotation |
No caching (no-store). No realtime besides status polling.

## States
- Default (method grid + fallback).
- eID pending / approved / rejected / expired (above).
- Wrong credentials; rate-limited; generic error "Sisselogimine ei õnnestunud. Proovi uuesti või kasuta Smart-ID-d."
- **Account suspended**: "Sinu konto on peatatud. Võta ühendust info@erametsad.ee."
- **Company profile pending**: login succeeds for private profile; banner on next page "Sinu ettevõtte profiili taotlus on ülevaatamisel."
- Loading states per button (spinner, disabled).
- Already logged in visiting /login: immediate redirect to `next` or `/`.

## Copy (Estonian, draft)
"Logi sisse" · "Määra tuvastusmeetod" → better: "Vali tuvastusmeetod" · "Kontrolli, et telefonis kuvatakse sama numbrit, seejärel sisesta PIN1." · "Kinnituskood" · "Alusta uuesti" · "Tühista" · "Isikukood ja parool on kohustuslikud" · "Unustasid parooli?" · "Registreeru" · "Vigane isikukood või parool." · "Liiga palju katseid. Proovi mõne minuti pärast uuesti."

## SEO & analytics
noindex. Events: login_method_selected, login_success, login_fail (reason), eid_status_expired.

## Open questions
- Status polling vs SSE for eID sessions (polling simpler; keep polling)?
- TOTP 2FA for company password accounts — screen design needed in Phase 3?
