# Profiili valik — Profile switcher

> **In brief:** Switch between personal and company profiles.
| Area | portal |
|---|---|
| **Route** | `/select-profile?next=…` |
| **Access** | authed, users with ≥2 profiles (private + one or more companies) |
| **In nav** | shown after login when multiple profiles; user menu "Vaheta profiili" |

## Purpose & user goals
A user who bids both personally and under company (or several companies) picks which profile the session acts as — bids, autobidders, contracts and notifications are all profile-scoped.

## Wireframe (desktop)
```
┌────────────────────────────────────────────┐
│ Vali profiil                               │
│ ┌────────────────────────────────────────┐ │
│ │ 👤 Mari Mets  ·  Eraisik        [AKTIIVNE] │
│ │ Isiklik profiil · kõik õigused olemas  │ │
│ └────────────────────────────────────────┘ │
│ ┌────────────────────────────────────────┐ │
│ │ 🏢 OÜ Mets & Koer · Ettevõte           │ │
│ │ Reg 14319209 · õigused: forest, field  │ │
│ │ Taotlus kinnitatud 12.03.2026          │ │
│ └────────────────────────────────────────┘ │
│              [ JÄTKA → ]                   │
└────────────────────────────────────────────┘
```
Mobile: cards stack full width; active marker as left border stripe; "Jätka" full-width sticky button.

## Block-by-block spec
1. **Heading** — "Vali profiil" + sub "Pakkumised ja lepingud seotakse valitud profiiliga. Saad hiljem menüüst vahetada."
2. **Profile cards** — per profile: type icon (Lucide `user` / `building-2`), display name (full name / company name), type chip (Eraisik / Ettevõte), rights summary line ("Oksjoniõigused: raieõigused, põllumaad" / "Ülevaatamisel"), reg code for companies. Active profile gets accent border + "AKTIIVNE" chip.
3. **Card interactions** — click selects (radio behavior), highlight; second click or "Jätka" confirms → `PATCH` session profile → redirect `next` (or `/`).
4. **New company card (ghost)** — dashed "+ Lisa ettevõtte profiil" → jumps to register step-2 company flow in a modal.
5. **Pending profiles** — rendered greyed with StatusPill "Ülevaatamisel"; not selectable; tooltip "Taotlus on menetluses".

## Interactions & edge cases
- Keyboard: cards are radio group (arrows + enter).
- Switching profile mid-portal (from user menu) → returns to same page; if current page contains profile-scoped data (own bid list), reload with new profile.
- Direct navigation without multiple profiles → auto-redirect to `next`/`/`.
- Company rejected: card hidden from selection (visible only in profile management with rejected state).

## Data & API
| Field | Source |
|---|---|
| profiles list (type, name, reg code, approval_status) | `GET /api/profiles` |
| bidding rights summary per profile | AuctionRight via `GET /api/profiles` include, or `GET /api/users/me` |
| select/switch | session profile switch endpoint (profile id in session cookie) — `PATCH /api/profiles/:id/select` |
No caching (authed). No realtime.

## States
- Loading skeletons (2 cards).
- Single profile: auto-redirect (no page render).
- All company profiles pending: only private selectable; info banner.
- Error loading profiles: retry.

## Copy (Estonian, draft)
"Vali profiil" · "Pakkumised ja lepingud seotakse valitud profiiliga." · "Eraisik" · "Ettevõte" · "Oksjoniõigused" · "Ülevaatamisel" · "Lisa ettevõtte profiil" · "Jätka" · "Vaheta profiili"

## SEO & analytics
noindex. Events: profile_selected (type), profile_add_company_click.

## Open questions
- Should contract list/bids be visible cross-profile read-only? (Recommend no — strict separation, simpler mental model.)
