# Minu pakkumised — My bids (customer portal)
| Area | portal |
|---|---|
| **Route** | `/user/bids` |
| **Access** | authed (private / company profile; any user with an account) |
| **In nav** | Portal shell sidebar item 1; also user-menu on public portal pages |

## Purpose & user goals
A logged-in bidder checks the state of their auction participation at a glance: which of their active bids currently lead, which have been outbid, what their autobidder ceiling is, and how past auctions resolved (won / lost / unsold) with next steps (contract signing). It is the bidder's "home" screen.

## Portal shell (SHARED — defined once here, referenced by 10/11/12/13)
Persistent layout for all `/user/*` routes on `oksjonid.eametsad.ee`:

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ShellHeader: logo→/  [Otsi oksjoneid]      🔔(badge)  👤 K&A dropdown  ⋮ │
├────────────┬─────────────────────────────────────────────────────────────┤
│ Sidebar    │  Breadcrumb: Minu keskkond › Minu pakkumised                │
│ 🌲 Avaleht │  ┌──────────────── Page content (max 1040px) ────────────┐ │
│ 📊 Pakkum. │  │                                                        │ │
│ 🏷 Müügid  │  │                                                        │ │
│ 🔔 Teavit. │  │                                                        │ │
│ 👤 Profiil │  │                                                        │ │
│ 📄 Lepingud│  │                                                        │ │
│ ──────────  │  └────────────────────────────────────────────────────────┘ │
│ 👤 Erki P. │  ShellFooter: abi@… · kasutustingimused · privaatsuspoliitika│
│ [Vaheta ▾] │                                                            │
│ ⏻ Logi välja│                                                           │
└────────────┴─────────────────────────────────────────────────────────────┘
```

- **ShellHeader**: portal wordmark → `/`; quick search opens `/` with filters; **notification bell** → `/user/notifications` with unread-count badge (from `GET /api/my/notifications?unread=1` count via SSE `notification` event); **profile chip** shows active profile (private name or company name) with dropdown → profile switcher (like `/select-profile`: `POST /api/profiles/:id/select`), "Minu profiil", "Logi välja".
- **Sidebar** (collapsible to 64px icons; active item `--primary` tint + left 3px bar). On **≤768px**: sidebar hidden, replaced by fixed **bottom tab bar** (Avaleht · Pakkumised · Müügid · Teavitused · Profiil); Lepingud moves into the profile chip dropdown.
- **Profile switcher** ("Vaheta profiili") — private ↔ approved company profiles; switching refetches all page data scoped to the active profile.
- **SSE**: one `GET /api/my/stream` (SSE) per shell mount; events `bid`, `outbid`, `auction_end`, `notification`, `countdown_sync` fan out to open pages; heartbeat 30s; auto-reconnect with backoff; on reconnect full refetch of current page.
- Breadcrumb root "Minu keskkond" → `/user/bids`.

## Wireframe (desktop)
```
Minu pakkumised                                    [Filtrid ▾] [Eksport CSV]
────────────────────────────────────────────────────────────────────────
Tabs:  Aktiivsed (4) · Lõppenud (27) · Automaatpakkuja (2)
────────────────────────────────────────────────────────────────────────
┌ Tab: AKTIIVSED ────────────────────────────────────────────────────────┐
│ DataTable                                                              │
│ Oksjon            Tüüp    Minu pakkumine  Hetkel juhtiv  Olek  Auto-   │
│                                                          pakkuja       │
│ Lepsi raieõigus   AVATUD  12 500 €        12 500 €      JUHTIV  14 000€│
│  Harjumaa · 6,4ha  [↗]                          ●Juhtiv           [✎]  │
│ Saarte pakett     SULETUD 85 000 €          —              OOTEL   —   │
│  16 kinnistut      [↗]                          ●Esitatud              │
│ Kukevere põllumaa SULETUD 21 000 €        —            ÜLE PAKUTUD —   │
│                                        (avatud: 23 500 €) ●Üle pakutud │
│ Lõpp: [Countdown 02:14:39] ← endTime column, red <1h                     │
│ [◀ 1 2 3 ▶]  10 / lehekülg · sorteeritav: Hetkel juhtiv, Lõpp, Minu    │
└────────────────────────────────────────────────────────────────────────┘
┌ Tab: LÕPPENUD ─────────────────────────────────────────────────────────┐
│ Oksjon · Tüüp · Minu pakkumine · Lõpphind · Tulemus · Leping · Kuupäev │
│ Lepsi    AVATUD  12 500 €   13 250 €  ✔ VÕITSID  Allkirjastamisel [↗]  │
│ Ööviiuli SULETUD 40 000 €  88 000 €  ✖ EI VÕITNUD  —            [↗]    │
│ Kadrina  SULETUD 15 000 €   —        ⚪ JÄI MÜÜMATA (piirhind)    [↗]   │
└────────────────────────────────────────────────────────────────────────┘
┌ Tab: AUTOMAATPAKKUJA ──────────────────────────────────────────────────┐
│ Oksjon · Max summa · Minu hetke pakkumine · Staatus · Tegevus          │
│ Lepsi   14 000 €   12 500 €   ● Aktiivne   [Muuda] [Tühista]           │
└────────────────────────────────────────────────────────────────────────┘
```
Mobile: each table row collapses to a card — lot name + status pill header, rows of label:value, primary action button full-width.

## Block-by-block spec
1. **Page header** — H1 "Minu pakkumised", right side: Filter dropdown (Tüüp: avatud/suletud; Olek: juhtiv/üle pakutud/ootel; Aasta) and "Eksport CSV" (`GET /api/my/bids?format=csv`, async job if >5k rows).
2. **Tabs** — Aktiivsed / Lõppenud / Automaatpakkuja; counters from same payload. Deep-link `?tab=`. (Tabs component)
3. **Aktiivsed DataTable** — columns:
   - **Oksjon** — lot name (link `/oksjon/:id`), county + area/volume subtitle, kiiroksjon ⚡ badge if `isQuickAuction`.
   - **Tüüp** — badge: `AVATUD` (green outline) / `SULETUD` (slate filled) from `auctionType`.
   - **Minu pakkumine** — my latest/standing bid amount; for pending alapakkumine shows amount + "alapakkumine" chip.
   - **Hetkel juhtiv** — open auctions: `leadingBidAmount` (visible to authed users); **sealed: always "—"** with tooltip "Suletud pakkumised avaldatakse pärast lõppemist" (only "Esitatud" status is shown until opening).
   - **Olek** — StatusPill: `Juhtiv` (accent), `Üle pakutud` (danger) + outbid row highlight pulse; `Ootel (alapakkumine)` (pending amber) → becomes Juhtiv/Tagasi lükatud per seller decision; `Esitatud` (info) for sealed.
   - **Automaatpakkuja** — my `max_amount` + inline ✎ edit: click → inline input + Salvesta/Tühista (`PATCH /api/auto-bidders/:id`, min = current leading + step); shows "—" when none. `isAutobidderLimitReached` → "Maks. summa saavutatud" chip.
   - **Lõpp** — `<Countdown>` server-synced; <1h red, <10min bold + seconds; anti-snipe extension updates live via SSE.
4. **Row quick-link** — whole Oksjon cell is a link; row hover shows "Vaata oksjonit ↗".
5. **Lõppenud DataTable** — columns: Oksjon, Tüüp, Minu pakkumine, Lõpphind (`finalPrice`), Tulemus (✔ `Võitsid` accent / ✖ `Ei võitnud` grey / ⚪ `Jäi müümata`), Leping (link "Allkirjasta leping" → `/contract/:id` when status `sent`, "Allkirjastatud ✓" with date, "—" if lost), Lõppkuupäev. Filters: aasta, tulemus.
6. **Automaatpakkuja tab** — full CRUD list (`GET /api/auto-bidders`); **create**: "Lisa automaatpakkuja" → lot picker (only auctions I'm eligible for) + max summa → `POST /api/auto-bidders` → Modal confirm: "Automaatpakkuja pakub sinu eest kuni X €. Jätkad?" **cancel**: `DELETE /api/auto-bidders/:id` → confirm Modal "Auto­maatpakkuja peatatakse. Sinu viimane pakkumine jääb kehtima." Editing disabled once auction `ended`.
7. **Empty states** — new user: EmptyState 🌱 "Sul pole veel ühtegi pakkumist. Sirvi aktiivseid oksjone ja tee esimene pakkumine." + `Btn` cta "Vaata oksjone". Per-tab empty variants ("Aktiivseid pakkumisi pole", "Lõppenud pakkumisi pole veel", "Automaatpakkujat pole seadistatud").

## Interactions & edge cases
- Outbid while page open → SSE `outbid` event → row updates instantly + amber toast "Sinu pakkumist on üle pakutud: {lot}" (also bell badge +1).
- Auction ends live → row animates out of Aktiivsed into Lõppenud (refetch both).
- Sealed bid: no amounts of others ever shown; status locked to Esitatud until opening, then flips to Võitsid/Ei võitnud/Jäi müümata.
- Autobidder edit below current leading → inline validation "Max summa peab olema suurem kui praegune juhtiv pakkumine ({X} €)".
- Data scoped to active profile (private vs company bids never mixed).
- Keyboard: table rows focusable, Enter opens lot.

## Data & API
- `GET /api/auctions/with-user-bids?status=active|ended&tab=&filters=&sort=&page=` (per-profile).
- `GET/POST /api/auto-bidders`, `PATCH/DELETE /api/auto-bidders/:id`.
- CSV export: `GET /api/my/bids?format=csv` (job → notification when ready).
- SSE `/api/my/stream`: `bid`, `outbid`, `auction_end`, `countdown_sync`, `notification`.
- Countdown from server-issued `endTime`; drift-corrected by `countdown_sync`.

## States
Loading: skeleton rows ×5. Error: inline banner "Pakkumiste laadimine ebaõnnestus. Proovi uuesti." + retry. No-permission: if user has zero bidding rights, show info banner "Sul pole veel pakkumisõigust. Taotle õigust profiilis." → `/user/profile`. Offline: "Ühendus kadunud — näitan viimaseid andmeid" chip until SSE reconnects.

## Copy (Estonian, draft)
- H1 "Minu pakkumised"; tabs "Aktiivsed / Lõppenud / Automaatpakkuja".
- Columns: "Oksjon · Tüüp · Minu pakkumine · Hetkel juhtiv · Olek · Automaatpakkuja · Lõpp".
- Statuses: "Juhtiv", "Üle pakutud", "Ootel (alapakkumine)", "Esitatud", "Võitsid", "Ei võitnud", "Jäi müümata".
- Toast outbid: "Sinu pakkumist on üle pakutud — {oksjoni nimi}". CTA: "Tee uus pakkumine".
- Autobidder confirm: "Automaatpakkuja pakub sinu eest automaatselt kuni {summa} €. Jätkad?" / "Lõpeta automaatpakkuja?"
- Empty: "Sul pole veel ühtegi pakkumist. Sirvi aktiivseid oksjone ja tee esimene pakkumine."

## Open questions
- Should aktiivsed show my full bid history per lot (expandable) or only standing bid?
- CSV export scope (bids only vs bids + outcomes + contracts)?
