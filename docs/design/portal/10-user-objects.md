# Minu müügid — My sales (seller view)
| Area | portal |
|---|---|
| **Route** | `/user/objects` |
| **Access** | authed (seller profile — the lot owner; specialists see the same screen via admin) |
| **In nav** | Portal shell sidebar item 3; user-menu "Minu müügid" |

## Purpose & user goals
The forest owner (metsaomanik) monitors the auctions of their own lots: how many people are watching/bidding, what the current price is, and — critically — decides on **alapakkumised** (under-start bids requiring seller approval). After ending they see the result, contract status and view statistics; unsold lots offer a re-list path.

## Wireframe (desktop)
(Uses shared portal shell defined in `09-user-bids.md` — sidebar + bell + breadcrumb.)
```
Minu müügid                                    [+ Müüa metsa]  [Eksport CSV]
────────────────────────────────────────────────────────────────────────
💡 1 alapakkumine ootab sinu otsust  [Vaata]                    ← action bar
────────────────────────────────────────────────────────────────────────
Tabs: Kõik (5) · Mustand (1) · Plaanis (0) · Aktiivsed (2) · Lõppenud (2)
────────────────────────────────────────────────────────────────────────
DataTable (Kõik)
Oksjon        Tüüp    Olek      Avaldatud  Lõpp        Vaatamisi  Pakku-  Hind        Spetsialist
Lepsi         AVATUD  ● Aktiivne 12.08     29.08 14:00  342       mised 3  12 500 €    M. Mets
 raieõigus                                                ▲+27/öö           (juhtiv)
Ööviiuli      SULETUD ● Aktiivne 10.08     30.08 23:59  518         0     Alghind     M. Mets
 Kadrina kinnistu SULETUD ● Lõppenud 02.07 25.07        1 204       4     88 000 €    K. Kask
                                                                      Leping: allkirjastatud
Kadrina põld  SULETUD ○ Jäi müümata 20.06   15.07        430        0     —           K. Kask
                                                            [Taotle uut oksjonit]
Tammiku mustand SULETUD ◑ Mustand —        —             —          —     —           (määramata)
                                                     [Eelvaade] [Saada spetsialistile]
[◀ 1 2 ▶] 10/lehekülg · sorteeritav: Lõpp, Hind, Vaatamisi, Pakkumised
────────────────────────────────────────────────────────────────────────
Row click → Lot detail Drawer (右侧 overlay, 720px):
┌ Drawer: Lepsi ─────────────────────────── [↗ Ava oksjonileht] ─┐
│ StatusPill Aktiivne · Countdown · juhtiv pakkumine 12 500 €   │
│ [Pakkumiste logi] [Alapakkumised (1)] [Jälgimise statistika]  │
│  Tabs content:                                                 │
│  • Pakkumiste logi:                                            │
│    28.08 14:02  Pakkuja #3   12 500 €   (käsitsi)              │
│    28.08 13:58  Pakkuja #1   12 250 €   ⚙ automaatpakkuja      │
│    28.08 13:55  Pakkuja #2   12 000 €   (käsitsi)  ★alapakk.   │
│    → bidders anonymised (Pakkuja #n), times, autobidder marker │
│  • Alapakkumised (kinnitamisjärjekord):                        │
│    12 000 € · Pakkuja #2 · 28.08 13:55   [Aktsepteeri][Lükka   │
│                                              tagasi] (mõlemad confirm)│
│  • Jälgimise statistika: mini bar-chart 14 päev (vaatamised/   │
│    jälgijad, `GET /api/my-auctions/:id/stats`)                 │
│  • Leping: staatus Allkirjastatud 27.07 · [Laadi PDF]          │
└────────────────────────────────────────────────────────────────┘
```
Mobile: table → cards; drawer becomes full-screen sheet.

## Block-by-block spec
1. **Header + CTA** — H1 "Minu müügid". `Btn` cta **"+ Müüa metsa"** opens choice Modal: "Hinda ja müü oksjonil" (→ LeadForm with type=oksjon, katastrinumber, maakond, telefon/e-mail, ConsentCheck → `POST /api/leads`) or "Võta ühendust spetsialistiga" (→ SpecialistCard list with direct phones). Eksport CSV: `GET /api/my-auctions?format=csv`.
2. **Alapakkumiste action bar** — persistent top banner when queue non-empty: "N alapakkumist ootab sinu otsust" → jumps to the queue tab in the drawer of the oldest item. (Also mirrored as a notification.)
3. **Tabs / status filter** — Kõik, Mustand, Plaanis, Aktiivsed, Lõppenud (lootab `auctionStatus` + scheduled/draft). Counters server-side.
4. **My lots DataTable** columns:
   - **Oksjon** — name + object-type subtitle ("raieõigus / metsakinnistu / põllumaa / pakett"), kiiroksjon ⚡ badge.
   - **Tüüp** — AVATUD/SULETUD badge.
   - **Olek** — StatusPill: `Mustand` (grey), `Plaanis` (info, shows startTime), `Aktiivne` (green), `Lõppenud` (dark), `Jäi müümata` (amber), `Teostatud` (accent, contract signed + deal closed).
   - **Avaldatud** — published date (— for drafts).
   - **Lõpp** — end date-time; `<Countdown>` for active.
   - **Vaatamisi** — view count + overnight delta tooltip ("+27 viimase 24h"); seller-only metric (never public).
   - **Pakkumised** — bid count (authed seller only); for open auctions the leading amount shown under it ("juhtiv 12 500 €"); sealed: "Pakkumisi: 3" only, amounts hidden until opening.
   - **Hind** — active open: `leadingBidAmount`; sealed active: `Alghind {minBid}`; ended: `finalPrice` (or "—" if unsold).
   - **Spetsialist** — assigned specialist avatar + name → SpecialistCard popover.
5. **Row actions per state**:
   - Draft: [Eelvaade] (renders lot detail as it would publish) + [Saada spetsialistile] (message → specialist, `POST /api/my-auctions/:id/request-review`).
   - Scheduled: read-only + startTime.
   - Active: [Vaata] → public lot page; drawer for bid log.
   - Ended-unsold: [Taotle uut oksjonit] → Modal with two options: "Korruta oksjon" (re-list request → admin queue, `POST /api/my-auctions/:id/relist-request`) or "Paku kiiroksjonil" (48h path, sets lead type=kiiroksjon).
   - Completed: [Leping] link + PDF download.
6. **Lot detail Drawer** (`<Drawer>`, tabs):
   - **Pakkumiste logi** — `GET /api/auctions/:id/bids` seller-shaped: time, anonymised `Pakkuja #n`, amount, marker "⚙ automaatpakkuja" (`source`), "alapakkumine" chip on `is_underbid`; append-only, newest first, paginated 20.
   - **Alapakkumised** — pending queue: amount, bidder label, submitted time; **Aktsepteeri** → confirm Modal "Alapakkumine {X} € muutub juhtivaks pakkumiseks. Pakkuja teavitatakse kohe." (`POST /api/my-auctions/:id/underbids/:bidId/approve`); **Lükka tagasi** → confirm + optional reason → bidder notified (`…/reject`). Decisions irreversible (append-only ledger); decided items move to log with ✔/✖.
   - **Jälgimise statistika** — mini bar chart (14d) views + watchers (`GET /api/my-auctions/:id/stats?days=14`), summary chips: kogu vaatamised, jälgijad, unikaalsed külastajad.
   - **Leping** — per-auction contract status (prepared/sent/signed), signer initials, timestamps, [Laadi PDF] (signed container).
7. **Empty states** — no lots at all: EmptyState 🌲 "Siin näed oma oksjonitel olevaid objekte. Pole veel midagi müügis? Jäta oma andmed — spetsialist võtab ühendust." + "Müüa metsa" CTA.

## Interactions & edge cases
- Live updates: SSE `bid` events for my lot ids update bid count/leading price/log instantly; toast "Uus pakkumine: {lot}".
- Approve alapakkumine race: if a higher regular bid arrived meanwhile → API 409 → drawer shows "Vahel tuli kõrgem pakkumine — alapakkumine ei saa enam juhiks" and offers reject/keep-pending.
- Sealed lots: seller never sees amounts or count detail beyond bid count until admin opening; log tab disabled with note "Suletud pakkumised avatakse pärast oksjoni lõppu".
- Seller sees own lot's public page without their seller metrics (metrics only in this screen).
- All approve/reject/re-list actions require confirm Modal; side-effect text always states who gets notified.
- Kiiroksjon reserve (piirhind) shown to seller as "Sinu piirhind" chip; never to bidders.

## Data & API
- `GET /api/auctions/my-auctions?status=&tab=&sort=&page=` (+`format=csv`).
- `GET /api/auctions/:id/bids` (seller shape), `GET /api/my-auctions/:id/stats`.
- `POST /api/my-auctions/:id/underbids/:bidId/approve|reject`, `POST /api/my-auctions/:id/relist-request`, `POST /api/my-auctions/:id/request-review`.
- LeadForm → `POST /api/leads` (type=oksjon).
- SSE `/api/my/stream` filtered to owned auction ids.

## States
Loading skeletons; error banner + retry; no-permission (account without seller lots & no seller role): page still renders with empty state + CTA (any owner can become a seller via lead). Draft preview uses same renderer as public detail with "MUSTAND" watermark banner.

## Copy (Estonian, draft)
- H1 "Minu müügid"; CTA "Müüa metsa"; banner "1 alapakkumine ootab sinu otsust".
- Columns: "Oksjon · Tüüp · Olek · Avaldatud · Lõpp · Vaatamisi · Pakkumised · Hind · Spetsialist".
- Statuses: "Mustand", "Plaanis", "Aktiivne", "Lõppenud", "Jäi müümata", "Teostatud".
- Drawer tabs: "Pakkumiste logi · Alapakkumised · Jälgimise statistika · Leping".
- Approve confirm: "Aktsepteerid alapakkumise {X} €? See muutub juhtivaks pakkumiseks ja pakkuja teavitatakse kohe."
- Reject confirm: "Lükkad alapakkumise {X} € tagasi? Pakkuja saab teavituse."
- Empty: "Pole veel midagi müügis? Jäta oma andmed — spetsialist võtab ühendust."

## Open questions
- Do sellers see watcher identities? (No — only counts, per privacy posture.)
- Re-list pricing: does a re-list request auto-copy lot fields into a draft?
