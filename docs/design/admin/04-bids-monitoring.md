# Pakkumiste jälgimine — Bid monitoring

> **In brief:** Live bid feeds, under-bid approvals and anomaly flags.
| Area | admin |
|---|---|
| **Route** | `/oksjonid/:id/pakkumised` (+ global tab `/pakkumised` alapakkumiste järjekord) |
| **Access** | admin, superadmin; specialist (own lots); seller (own lots, alapakkumine decisions only) |
| **In nav** | sidebar "Pakkumised"; deep links from 01/02 |

## Purpose & user goals
Live per-auction oversight: watch the bid feed in real time, approve/reject alapakkumised, spot suspicious patterns, and — only when justified — end an auction manually with a documented reason.

## Wireframe (desktop)
```
┌────────────────────────────────────────────────────────────────────────┐
│ #4810 Lepsi · raieõigus · AVATUD     Lõpp: 00:14:32 ⏱anti-snipe: 5min   │
│ Juhtiv: 7 500 € (Pakkuja #14) · varu järgmise sammuni: +250            │
│ [Lõpeta käsitsi] [Ekspordi pakkumiste logi]                            │
├───────────────────────────────────────┬────────────────────────────────┤
│ Pakkumiste voog (SSE, uus esimene)    │ Anomaaliaid 2 ⚠                 │
│ 12:41:03  #14 Tõnis K.  7 500 €  käsitsi ● juhtiv │ ▸ IP klaster: 3 pakkujat│
│ 12:40:55  #9  Kalle T.   7 250 €  automaat  ○   │   ühise IP-rahaga (4810)│
│ 12:33:12  #9  Kalle T.   6 500 €  automaat  ○   │ ▸ Uued kontod: 2 kontot │
│ 12:31:00  #7  Anon (alapakk. 2 800 €) ⏳ ootel  │   <7 päeva, 6 pakkumist│
├───────────────────────────────────────┴────────────────────────────────┤
│ Alapakkumised (3 ootel)                                   [Vaata kõik]  │
│ 2 800 € · Anon #7 · 11:58 · [Nõustu] [Keeldu põhjusega]                │
├────────────────────────────────────────────────────────────────────────┤
│ Anti-snipe pikenduste log: 12:03 → +5 min (põhjus: pakkumine #5)        │
└────────────────────────────────────────────────────────────────────────┘
```
Mobile: feed single column, anomaly cards collapsible.

## Block-by-block spec
1. **Header** — lot id/name/type, live countdown (server-synced, green pulse <5 min, "⏱ Pikendatud" chip after extension), leading bid + margin to second, next-minimum-step hint. Buttons: Lõpeta käsitsi (see below), Ekspordi (CSV: time, anonymized label, identity for admin export, amount, source, status, ip_hash).
2. **Bid feed** — newest first, SSE `auctions/:id/bids`; rows: aeg (HH:mm:ss), **anonümiseeritud silt** "Pakkuja #N" (portal-consistent numbering) + real identity visible to admin/specialist as expandable chip (name + link to 06 user detail; seller sees identity only on alapakkumised); summa €; allikas chip: käsitsi / automaat (tooltip: autobidder max shown as range if reached — "automaat, piir saavatatud"); olek: juhtiv/ületatud/ootel/tagasi lõigatud (retraction not possible — status read-only). Feed items slide in; pause-on-scroll toggle; filter chips (käsitsi/automaat/ootel).
3. **Alapakkumised queue** — per-auction block here + global cross-auction tab `/pakkumised` (columns: oksjon, pakkuja, summa, % alghinnast, esitatud, ootel juba, tegevused). Decision:
   - **Nõustu** → confirm modal: "Aktsepteeritud summas X € saab juhtivaks pakkumiseks ja on pakkujale siduv" → bid status=leading, min-bid floor becomes X−step? (no — floor stays minBid; alapakkumine accepted as leading regardless), all parties notified (bidder + previous leader outbid notice). Audit.
   - **Keeldu** → typed reason required → bidder notified with template "Alapakkumine lükati tagasi: {reason}". Audit.
   - Seller role gets this block only (their decision per plan §5.7).
4. **Anomaaliaid (shill-bid heuristics, plan §7.3)** — computed flags card list, each expandable to evidence:
   - **IP klaster** — ≥2 distinct bidders sharing ip_hash prefix on this auction (list labels + bid times).
   - **Uute kontode pursked** — bidders with account age <7 days making ≥N bids (default 3).
   - **Kiire ületamise muster** — consecutive bids by two labels alternating within <10s ×5.
   Each flag: [Märgi uurimiseks] (creates audit note + optional user flags in 06), [Avalda platvormile? — no: internal only]. Heuristics configurable in 13 (thresholds).
5. **Anti-snipe log** — append-only list: time, trigger bid id, +N min, new endTime; mirrors what bidders saw.
6. **Lõpeta käsitsi** — modal per 02 (typed reason mandatory, outcome chooser, countdown re-check) — audit `auction.end_manual` with reason + actor.

## Interactions & edge cases
- SSE drop → yellow bar "Ühendus katkes, taasühendamine…", auto-reconnect, backfill via `GET bids?since=`.
- Identity reveal: clicking anonymous label expands inline; every reveal of personal identity is audit-logged (`user.identity_view`, plan §6 GDPR).
- Autobidder war visualization: when two autobidders duel, feed shows collapsed group "Automaatpakkuja duell: 7 pakkumist" expandable.
- Alapakkumine accepted while another leading bid exists: system notifies leader-of-record; if accepted amount < current leading (edge), action blocked with explanation.
- Countdown during extension: freezes, shows "+5 min" transition animation once.
- Keyboard: P pause feed, J/K navigate rows.

## Data & API
`GET /api/admin/auctions/:id/bids?since=`, SSE `auctions/:id/bids`; `POST /api/admin/bids/:id/approve`, `POST /api/admin/bids/:id/reject {reason}`; `GET /api/admin/auctions/:id/anomalies`; `POST /api/admin/auctions/:id/end-manual`; export `GET :id/bids.csv` (identity columns only for admin/superadmin). ip_hash is salted hash — raw IP never stored.

## States
No bids: "Pakkumisi veel ei ole" EmptyState. No anomalies: green "Anomaaliaid ei tuvastatud". Sealed auction → header shows "Suletud pakkumised: N (avamine 05)" instead of feed. Permission error on identity reveal (seller): chip stays anonymized.

## Copy (Estonian, draft)
"Pakkumiste voog" · "Juhtiv pakkumine" · "käsitsi" · "automaat" · "ootel müüja kinnitamisel" · "Nõustu" · "Keeldu põhjusega" · "Keeldumise põhjus (kohustuslik)" · "Alapakkumine aktsepteeritud — summas {sum} €" · "Anomaaliaid" · "Ühise IP-rahaga pakkujad" · "Äsja loodud kontod" · "Märgi uurimiseks" · "Pikendatud +{n} min" · "Lõpeta käsitsi" · "Ühendus katkes".

## Permissions & audit
Audit-logged: identity reveals, alapakkumine approve/reject (reason), anomaly mark, manual end, export. Seller: no export, no identity (except alapakkumine), no anomaly heuristics.

## Global alapakkumised tab (`/pakkumised`)
Cross-auction queue DataTable: columns Oksjon (id+nimi), Tüüp, Pakkuja (anon label; identity for admin/specialist), Summa €, % alghinnast (red if <50%), Esitatud, Ootel juba (SLA amber >24 h, red >72 h — seller decision deadline from settings 13), Müüja, Tegevused (Nõustu / Keeldu). Filters: auction type, county, age. Default sort oldest first. This is the seller's main screen (their own lots only).

## Anomaly evidence detail
Each expandable flag shows: affected anonymized labels (with bid-counts), ip_hash prefixes (2 chars visible), account creation dates, bid time deltas chart (mini timeline). All evidence internal-only; nothing is auto-published or auto-actioned — human decision required, per-legal-caution.

## Export format
CSV columns: submitted_at, anonymized_label, bidder_id (admin export only), bidder_name (admin only), amount, source, status, is_underbid, ip_hash. Filename `pakkumised-{auctionId}-{date}.csv`. Export event logged with row count.

## Edge case catalogue
| Case | Behaviour |
|---|---|
| Auction ends while monitoring | feed freezes, banner "Oksjon on lõppenud — lõpptöötlus käib", then final state (winner/unsold) |
| Bid arrives during alapakkumine approval | approvals unaffected; leading shown separately |
| Two admins decide same alapakkumine | first wins; second gets "Juba otsustatud (Kaire, 12:03)" inline |
| SSE reconnect gap >60 s | backfill via `?since=`, inserted rows marked "laaditud hiljem" |
| Seller views sealed lot | queue shows "Suletud pakkumised: N — avamine 05" only |

## Accessibility
Feed rows have role="log" aria-live="polite" toggleable to "off"; anomaly cards colour-independent (icon + text); countdown same pattern as 01.

## Copy additions (Estonian, draft)
"Ühine IP-räsi" · "konto loodud {kuupäev}" · "vahemik {a}—{b} s" · "Automaatpakkuja duell" · "laaditud hiljem" · "Juba otsustatud ({nimi}, {aeg})" · "Oksjon on lõppenud — lõpptöötlus käib" · "Märgi uurimiseks (sisemine)".

## Bid feed columns (full definition)
| Column | Content |
|---|---|
| Aeg | HH:mm:ss, server time, tooltip full date + relative |
| Pakkuja | "Pakkuja #N" consistent with portal; identity chip (admin/specialist) expands name + link 06; alapakkumised show to seller too |
| Summa | € monospace; alapakkumised styled hollow/amber |
| Allikas | käsitsi / automaat (+ "piir saavatatud" sub-chip) |
| Olek | juhtiv ● / ületatud ○ / ootel ⏳ / võidetud ✓ / kaotatud ✕ |

## States (full)
- No bids: EmptyState "Pakkumisi veel ei ole — voog algab esimese pakkumisega".
- Pre-start: banner "Oksjon ei ole alanud — voog algab {aeg}".
- Ended: frozen feed + final banner (winner/unsold + link 05 for sealed).
- Permission denied (seller on another seller's lot): standard "Ainult oma oksjonid" page.

## Open questions
- Should accepted alapakkumine trigger autobidders (they'd instantly outbid)?
- Thresholds for heuristics — tune after first real auctions; expose in 13?
- Show sellers the anomaly heuristics on their own lots (transparency vs. gaming risk)?
