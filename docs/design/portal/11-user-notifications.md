# Teavitused — Notifications, preferences & saved searches

> **In brief:** Notification history, channel preferences and saved-search subscriptions.
| Area | portal |
|---|---|
| **Route** | `/user/notifications` |
| **Access** | authed (all profiles) |
| **In nav** | Portal shell sidebar item 4; notification bell in shell header |

## Purpose & user goals
One inbox for everything the platform has told the user (and a place to catch missed e-mails/SMS), plus the control room for *what* they get told and *how*: per-event/per-channel preferences and saved searches (notification subscriptions on filter sets) with digest frequency. Users arrive here from the bell badge or an e-mail "Halda teavitusi" link.

## Wireframe (desktop)
(Shared portal shell per `09-user-bids.md`; this page is the bell's target — badge clears on visit.)
```
Teavitused                                                        [Märgi loetuks]
────────────────────────────────────────────────────────────────────────
Tabs:  Saabunud (3) · Seaded · Otsingute tellimused
────────────────────────────────────────────────────────────────────────
┌ Tab: SAABUNUD ─────────────────────────────────────────────────────────┐
│ Filter chips: [Kõik] [Lugemata] [Pakkumised] [Oksjonid] [Lepingud]     │
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │ 🔼  Sinu pakkumine on üle pakutud        Lepsi · 28.08 14:02 · ●    │ │
│ │     Keegi pakkus 12 750 €. Tee uus pakkumine.      [Vaata oksjonit]│ │
│ ├────────────────────────────────────────────────────────────────────┤ │
│ │ 📄  Leping allkirjastamiseks valmis      Saarte pakett · 27.08     │ │
│ │     Oksjonileping on koostatud…          [Vaata lepingut]  ✓loetud │ │
│ ├────────────────────────────────────────────────────────────────────┤ │
│ │ 🌲  Uus sobiv oksjon                     Järvamaa · 26.08          │ │
│ │     Vastab sinu otsingule "Harjumaa raieõigus >10ha"               │ │
│ └────────────────────────────────────────────────────────────────────┘ │
│ [Laadi veel] (cursor pagination 25)                                    │
└────────────────────────────────────────────────────────────────────────┘
┌ Tab: SEADED ── Teavituste eelistused ──────────────────────────────────┐
│ Sündmus                                E-post    SMS                   │
│ Uus sobiv oksjon (otsingute põhjal)    [☑]       —                     │
│ Minu pakkumine pakuti üle             [☑]       [☑]                   │
│ Oksjoni võit / kaotus                [☑]       [☑]                   │
│ Oksjon lõppeb 24h jooksul (valikuline)[☐]       [☑]                   │
│ Alapakkumise otsus                    [☑]       —                     │
│ Ettevõtte ligipääsu taotluse otsus    [☑]       —                     │
│ Leping allkirjastamiseks valmis       [☑]       [☑]                   │
│ Kiiroksjoni tulemus                   [☑]       —                     │
│ [Salvesta]  "Muudatused rakenduvad kohe"                               │
└────────────────────────────────────────────────────────────────────────┘
┌ Tab: OTSINGUTE TELLIMUSED ─────────────────────────────────────────────┐
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │ Harjumaa raieõigus >10 ha            [Kohe][Igapäev][Nädalas] ▾    │ │
│ │ (Raieõigus · Harjumaa · 10–100 ha · Mänd, kuusk) @ 📧 e-post        │ │
│ │ [Muuda filtreid] [Kustuta]                                          │ │
│ ├────────────────────────────────────────────────────────────────────┤ │
│ │ Metsakinnistud Tartumaal <50k €     [Igapäev] ▾                    │ │
│ │ (Kinnistu · Tartumaa · kuni 50 000 €) @ 📧 e-post                   │ │
│ └────────────────────────────────────────────────────────────────────┘ │
│ [+ Telli uus oksjoniteavitus]          [Tühista kõik tellimused]      │
└────────────────────────────────────────────────────────────────────────┘
```
Mobile: inbox items full-width cards; preference table → stacked rows of event name + two toggle chips; saved-search cards stack.

## Block-by-block spec
1. **Header** — H1 "Teavitused"; "Märgi loetuks" marks all visible unread (`PATCH /api/my/notifications/read-all`) with confirm-free action + toast "Kõik teavitused märgitud loetuks".
2. **Inbox (Saabunud)** — list (not DataTable; single-column feed), 25/page cursor pagination, filter chips by category (Lugemata, Pakkumised, Oksjonid, Lepingud, Süsteem). Item anatomy:
   - Event icon (Lucide): 🔼 outbid, 🏆 won, 🎗 lost, 🌲 new matching lot, ⏰ ending-24h, ✅/✖ alapakkumise otsus, 🏢 company access, 📄 contract, ⚡ kiiroksjon.
   - **Title** (event line), **body** (1–2 lines, payload-rendered), **lot link** (deep link to lot/contract), **time** relative ("2 tundi tagasi", absolute on hover), unread dot ●; unread rows have `--bg-mist` background.
   - Click row → marks read (`PATCH /api/my/notifications/:id/read`) + navigates to the target link. Keyboard navigable.
3. **Seaded (preferences)** — matrix of the 8 event types (plan §5.9) × channels (E-post, SMS). SMS column disabled (—) for non-critical events (matches plan: SMS for bid/auction-critical only). Toggles save on change → `PATCH /api/profiles` (`notificationPreferences`), optimistic + toast. Footer note linking to privacy policy & consent log.
4. **Otsingute tellimused (saved searches)** — list of `AuctionSubscription` records. Each card:
   - **Name** — auto-generated from filters ("Harjumaa raieõigus >10 ha"), editable inline (rename → `PATCH /api/auction-subscriptions/:id`).
   - **Filter summary chips** — object type, county, area/price ranges, species etc. from `filter_json`.
   - **Frequency selector** — Kohe / Igapäev / Nädalas (dropdown; instant = per-lot e-mail, others = digest job).
   - **Channel** — badge 📧 e-post (SMS not offered for digests).
   - **[Muuda filtreid]** → reopens the listing `FilterPanel` inside a Modal pre-filled from `filter_json`; Save → confirm "Otsingut uuendatakse. Järgmine teavitus läheb uute filtritega." → `PATCH /api/auction-subscriptions/:id`.
   - **[Kustuta]** → confirm Modal "Lõpetame selle otsingu teavitused. See ei mõjuta teisi tellimusi." → `DELETE /api/auction-subscriptions/:id`.
5. **"+ Telli uus oksjoniteavitus"** — opens FilterPanel Modal empty → `POST /api/auction-subscriptions` (channel default e-mail, frequency default Igapäev).
6. **"Tühista kõik tellimused"** — destructive: confirm Modal listing count ("Lõpetame 3 otsingu tellimused. Seda ei saa tagasi võtta.") → `DELETE /api/auction-subscriptions?all=1` → EmptyState.

## Interactions & edge cases
- New notification while page open → SSE `notification` event prepends item (animated) + bell badge increments.
- Unsubscribe from e-mail footer ("Loobu kõigist teavitustest" / per-search link with token): lands here with pre-opened confirm modal — same API, token-authenticated so it works without session.
- Preference changes take effect immediately for future events; already-queued digests not retro-changed (note in toast).
- Ending-24h SMS toggle only available if user has phone verified; else tooltip "Kinnita telefoninumber profiilis".
- Empty states: inbox "Teavitusi pole. Siia ilmuvad sinu pakkumiste ja oksjonide sündmused."; searches "Pole ühtegi tellimust. Filtreeri oksjonite nimekirja ja vajuta 'Telli teavitus'."

## Data & API
- `GET /api/my/notifications?filter=&cursor=` (25/page), `PATCH /api/my/notifications/:id/read`, `PATCH /api/my/notifications/read-all`.
- Preferences: `GET/PATCH /api/profiles` (active profile) — `notificationPreferences[event][email|sms]`.
- Saved searches: `GET/POST /api/auction-subscriptions`, `PATCH/DELETE /api/auction-subscriptions/:id`, `DELETE /api/auction-subscriptions?all=1`; token variant for e-mail unsubscribe: `POST /api/auction-subscriptions/unsubscribe?token=`.
- SSE `/api/my/stream` event `notification`.
- Digest jobs run BullMQ daily 08:00 / weekly Monday 08:00 Europe/Tallinn (backend; noted for copy "Igapäevane kokkuvõte saadetakse iga hommikul").

## States
Loading skeletons ×6; error banner + retry; no-permission n/a (authed only — redirect to login). Unread badge in shell header mirrors inbox unread count live.

## Copy (Estonian, draft)
- H1 "Teavitused"; tabs "Saabunud · Seaded · Otsingute tellimused"; "Märgi loetuks".
- Preferences heading "Teavituste eelistused"; columns "Sündmus / E-post / SMS"; note "Muudatused rakenduvad kohe".
- Event titles (drafts): "Sinu pakkumine on üle pakutud", "Sul on uus juhtiv pakkumine", "Oksjoni võitsid!", "Oksjon jäi kaotuseks", "Oksjon lõppeb 24 tunni jooksul", "Alapakkumine aktsepteeriti" / "Alapakkumine lükati tagasi", "Ettevõtte ligipääs kinnitatud" / "ükati tagasi", "Leping allkirjastamiseks valmis", "Kiiroksjoni tulemus".
- Saved searches: "Telli uus oksjoniteavitus", "Muuda filtreid", "Kustuta", "Tühista kõik tellimused".
- Delete-all confirm: "Lõpetame {n} otsingu tellimused. Seda ei saa tagasi võtta. Jätkad?"

## Open questions
- Push (browser Web Push) as third channel — Phase 4+?
- Retention: how long inbox items persist (propose 12 months then archive)?
