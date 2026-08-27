# Töölaud — Dashboard

> **In brief:** Staff home: KPIs, auctions ending today, action queues and system health.
| Area | admin |
|---|---|
| **Route** | `admin.eametsad.ee/` (redirect target after login) |
| **Access** | admin (all roles: specialist, seller, admin, superadmin — content varies by role) |
| **In nav** | sidebar first item |

## Purpose & user goals
Staff landing screen: in one glance see what needs action today (auctions ending, approvals pending, new leads, contracts unsigned) and whether the platform is healthy. Everything is a shortcut into the relevant module.

## Admin shell (defined once, referenced by all admin files)
```
┌──────┬─────────────────────────────────────────────────────────────┐
│ ◉ LOG│ PROD ▎ Eametsad haldus ── otsing: kasutaja/oksjon/leid...  │ ⛭ ▶ Marit V. (admin)
├──────┼─────────────────────────────────────────────────────────────┤
│ ⌂ Töö│  ⚠ Vaadeld kasutajana: Jaan T. ( veel 12:34 ) · LÕPETA     │
│ ▤ Oks│ ────────────────────────────────────────────────────────── │
│ ⇄ Pak│                                                             │
│ ✉ Sul│   ... screen content ...                                   │
│ ☰ Ksv│                                                             │
│ 🗎 Lep│  Left sidebar: 56px icon rail, tooltips, active = green    │
│ ◉ Juh│  left border. Groups:                                       │
│ ⛁ Pär│   1 Töölaud · 2 Oksjonid · 3 Pakkumised · 4 Sul. avamine   │
│ ✎ Sis│   5 Kasutajad · 6 Ettevõtted · 7 Lepingud · 8 Juhtlõimed   │
│ 📊 Sta│   9 Päringud · 10 Sisu · 11 Statistika · 12 Seaded ·       │
│ ⚙ Sea│   13 Auditlogi                                              │
│ 🛡 Aud│  Topbar: environment badge (PROD amber=stage, red=dev),    │
│      │  global search (⌘K), notifications bell, user menu.        │
│      │  Impersonation banner (orange) whenever active.             │
│      │  Density: 16px base font, tables 40px rows, 12px labels.    │
└──────┴─────────────────────────────────────────────────────────────┘
```
Roles: specialist sees own lots/leads only; seller sees own lots' bids/approvals; admin sees all modules except roles matrix & audit export; superadmin sees everything. Modules hidden by role are not rendered.

## Wireframe (desktop)
```
┌────────────────────────────────────────────────────────────────────┐
│ KPI strip: 7 cards                                                 │
│ [Aktiivsed 36] [Lõpevad täna 4!] [Pakkumisi täna 87] [Ootel 3+5]   │
│ [Uued juhtlõimed 6] [Allkiri ootel 9] [Tasud kuus 12 480 €]        │
├───────────────────────────────────────┬────────────────────────────┤
│ Lõpevad täna (countdown, live)        │ Süsteemi tervis            │
│ #4810 Lepsi   raieõigus  00:14:32 ▶Monitor │ Queue lag  0.4s  ●   │
│ #4812 Ööviiuli kinnistu 02:41:05 ▶Monitor   │ Failed jobs 0  ●     │
│ #4809 ...                          [kõik]│ SSE ühendusi 214 ●     │
├───────────────────────────────────────┤ eID/võtmed ● (Settings→)   │
│ Kiire tegevus (action queues)         ├────────────────────────────┤
│ ▸ Ettevõtte taotlused (3) →           │ Juhtlõimed täna            │
│ ▸ Alapakkumised ootel (5) →           │ 09:12 Pärnu kava päring    │
│ ▸ Lepingud allkirja ootel (9) →       │ 08:40 raieõigus Müü / Jüri ││
└───────────────────────────────────────┴────────────────────────────┘
```
Mobile: KPI cards 2-col grid, lists stack; sidebar collapses to bottom bar.

## Block-by-block spec
1. **KPI strip** — 7 cards, today = calendar day 00:00 Europe/Tallinn → now:
   - Aktiivsed oksjonid — count `status=active`; subtext: +N scheduled. → link 02.
   - Lõpevad täna — `endTime` within today; amber highlight if >0; click filters 02 to "ending today".
   - Pakkumisi täna — bids created today (all auctions) + sparkline 7 days. → 04.
   - Ootel kinnitamisel — companies (07) + alapakkumised (04) as "a + b"; red if >0.
   - Uued juhtlõimed — leads created today unassigned or status=uus. → 09.
   - Allkirja ootel — contracts `status=sent` count. → 08.
   - Teenustasu kuu jooksul — sum of fee estimates (signed auctions × fee%) MTD; tooltip "prognoos, mitte arve".
2. **Lõpevad täna** — rows: lot id+name (link portal detail new tab), type icon, live countdown (`Countdown` component, server-synced), current leading bid / sealed count, **[▶ Monitor]** button → 04 deep-link. Sorted by endTime asc. Live via SSE `admin.dashboard`.
3. **Kiire tegevus** — three shortcut rows with counts; each opens target module pre-filtered. Alapakkumised row also shows oldest waiting age ("vanim 3 p").
4. **Süsteemi tervis** — status dots + values: queue lag (BullMQ oldest pending age; red >5s during endings), failed jobs 24h (red >0, link to retry), active SSE connections, integration pings (eID, Äriregister, mail, SMS) — last-check timestamp, values masked, config in 13. Superadmin/admin only.
5. **Juhtlõimed täna** — latest 8: time, source form chip, name/county, assigned specialist chip or "määramata" red. Link → 09.

## Interactions & edge cases
- Countdowns tick client-side, resync from server every 30s; display "--:--" on disconnect + "Ühendus katkes" toast.
- KPI numbers refresh on SSE event or 60s poll; optimistic never (server numbers only).
- Role filtering: specialist's KPIs scoped `specialist_id=me` (leads, lots); seller sees only own-lot queues.
- Anti-snipe extension visibly bumps a countdown (row flashes green, tooltip "Pikenes 5 min").

## Data & API
`GET /api/admin/dashboard` (aggregate, 30s cache per role); SSE `admin.dashboard` push events (bid.created, auction.ended, lead.created). Health from `GET /api/admin/health` (superadmin/admin).

## States
Loading: skeleton cards. Error: per-card "Ei õnnestunud laadida · Proovi uuesti". Empty (no endings today): "Täna ei lõpe ükski oksjon". No-permission (health for specialist): block hidden.

## Copy (Estonian, draft)
"Töölaud" · "Aktiivsed oksjonid" · "Lõpevad täna" · "Pakkumisi täna" · "Ootel kinnitamisel" · "Uued juhtlõimed" · "Allkirja ootel" · "Teenustasu kuu jooksul" · "Lõpevad täna" · "Monitori vaade" · "Süsteemi tervis" · "Järjekorra viide" · "Nurjunud tööd" · "SSE ühendusi" · "Juhtlõimed täna" · "määramata" · "Täna ei lõpe ükski oksjon."

## Permissions & audit
Dashboard itself read-only, not audit-logged. Health values (integration names, counts) contain no personal data. Impersonation banner state per 06.

## Keyboard shortcuts (dashboard + global shell)
| Keys | Action |
|---|---|
| ⌘K / Ctrl+K | global search (users, lots, leads, contracts by id/name/code) |
| g then d | Töölaud |
| g then o | Oksjonid |
| g then p | Pakkumised (alapakkumised queue) |
| g then u | Kasutajad |
| g then a | Auditlogi (superadmin) |
| ? | shortcut cheat-sheet overlay |
Shortcuts are latent (no input focused); shown once as onboarding toast, recallable via "?".

## Accessibility
- All KPI cards are reachable in tab order with aria-labels stating value + trend ("Aktiivseid oksjoneid 36, lisaplaanis 4").
- Status dots never carry meaning alone — always paired with text label or value.
- Countdown regions have `aria-live="off"` (too chatty live); a "Loe aega ette" button announces remaining time on demand.
- Contrast: token palette already AA; dense-table 12px labels use `--ink` on white only.

## Notification & alert behaviour
- Health red state also fires a toast once per session ("Järjekorra viide 12 s — oksjoni lõpetamise tööd on hilinenud") and bell entry; repeat suppressed 15 min.
- KPI deltas vs yesterday shown as small ▲▼ with tooltip ("eile samal ajal 71").
- "Lõpevad täna" rows: 10-minute warning turns countdown red and pushes bell notification to all admins (opt-out per user).

## Failure & degradation matrix
| Failure | UI behaviour |
|---|---|
| SSE down | countdowns freeze with "--:--", yellow bar, poll fallback 30s |
| dashboard API 5xx | skeleton → per-card retry, cached last-good values greyed with timestamp |
| health endpoint denied | block hidden (role), no error surfaced |
| Redis lag metrics missing | health row shows "andmed pole saadaval", not red |

## Open questions
- Should fee MTD include kiiroksjon backup-offer purchases (Eametsad as buyer)?
- Does seller role need queue-lag visibility near their lot's ending?
- Personalised dashboard per role remembered (collapsed panels) or fixed layout?
