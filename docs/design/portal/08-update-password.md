# Parooli muutmine ja lähtestamine — Set / change / reset password
| Area | portal |
|---|---|
| **Route** | `/update-password` (authed change) · `/reset-password` (request link) · `/reset-password/:token` (set new) |
| **Access** | authed (change) / public via token (reset) |
| **In nav** | login "Unustasid parooli?" · user profile security card |

## Purpose & user goals
Password-fallback users set or change their password with clear strength guidance; users who lost it reset via e-mail token; eID-only users can set a first password to gain the fallback path.

## Wireframe (desktop)
```
AUTHED (change):                       RESET REQUEST:
┌────────────────────────────┐        ┌──────────────────────┐
│ Parooli muutmine           │        │ Parooli lähtestamine │
│ Praegune parool [______]   │        │ E-post [__________]  │
│ Uus parool       [______]  │        │ [ SAADA LINK ]       │
│ ▮▮▮▯▯ Nõrk / Kesine / Tugev│        │ "Saadame e-kirja     │
│ [ SALVESTA ]               │        │  juhistega."         │
└────────────────────────────┘        └──────────────────────┘
RESET TOKEN PAGE:  Uus parool [___] + meter → [ KINNITA PAROOL ]
```
Mobile: identical single-column; no changes beyond spacing.

## Block-by-block spec
1. **Change form (authed)** — Praegune parool (hidden for "set first password" state), Uus parool, Uus parool uuesti; live **strength meter** (Nõrk/Kesine/Tugev — bars + label; rules listed below input).
2. **Password rules** (inline checklist, live ticks): vähemalt 10 tähemärki; üks suur täht; üks number; üks sümbol; ei tohi kattuda isikukoodiga. Server enforces; rate-limited.
3. **Success** — toast "Parool on uuendatud." + e-mail confirmation sent ("Saatsime kinnituse e-postile {masked}").
4. **Reset request** (`/reset-password`) — e-mail input → `POST /api/users/forgot-password` → always neutral success copy (no account enumeration): "Kui selline konto on olemas, saadame e-kirja juhistega parooli lähtestamiseks."
5. **E-mail** — link `/reset-password/{token}`; **token aegub 2 tunni järel**.
6. **Token page** — Uus parool + meter + Uus parool uuesti → `POST /api/users/reset-password` → success: "Parool on lähtestatud. Logi sisse." → `/login`.
7. **eID-user first password** — authed user with `auth: eid` sees heading "Seadista parool" (no current-password field) + note "Sinu konto on eID-tuvastusega — parool on alternatiivne sisselogimisviis."

## Interactions & edge cases
- Show/hide password toggle (Lucide eye); caps-lock warning on inputs.
- Mismatched repeat: inline "Paroolid ei kattu."
- Wrong current password: "Praegune parool on vale." (after server check; rate limit after 5).
- Strength meter computed client-side (zxcvbn-style); submit disabled until minimum "Keskinne".
- Token states: **valid** (form) · **used** ("Link on juba kasutatud. Küsi uus link.") · **expired** ("Link on aegunud (kehtis 2 tundi). Küsi uus link.") · **invalid** ("Link ei ole valiidne.").
- After reset, all other sessions revoked (toast note "Kõik seadmed logiti välja").

## Data & API
| Action | Endpoint |
|---|---|
| change | `POST /api/users/reset-password`-style change endpoint (authed; current+new) |
| request reset | `POST /api/users/forgot-password` {email} |
| apply reset | `POST /api/users/reset-password` {token, password} |
| first-password set | same change endpoint, `hasPassword:false` → current omitted |
No caching. No realtime.

## States
- Change: idle / validation errors / wrong-current / success.
- Reset request: idle / sent (neutral) / rate-limited ("Liiga sage taotlus — proovi hiljem").
- Token: valid / used / expired / invalid.
- eID-first-password variant.
- Loading per submit; generic error retry.

## Copy (Estonian, draft)
"Parooli muutmine" · "Parooli lähtestamine" · "Seadista parool" · "Praegune parool" · "Uus parool" · "Uus parool uuesti" · "Salvesta" · "Kinnita parool" · "Vähemalt 10 tähemärki, üks suur täht, number ja sümbol" · "Nõrk / Kesine / Tugev" · "Kui selline konto on olemas, saadame e-kirja juhistega parooli lähtestamiseks." · "Link on aegunud (kehtis 2 tundi)." · "Parool on uuendatud."

## SEO & analytics
noindex. Events: password_change_success, reset_requested, reset_token_state (used/expired/invalid), first_password_set.

## Open questions
- Force password change on first login for fallback-registered accounts? (Recommend yes.)
- SMS as secondary reset channel for phone-verified accounts?
