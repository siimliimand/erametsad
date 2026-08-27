# Sul. avamine — Sealed-bid opening ceremony

> **In brief:** The sealed-bid opening ceremony: freeze, reveal and confirm the winner.
| Area | admin |
|---|---|
| **Route** | `/oksjonid/:id/avamine` |
| **Access** | admin, superadmin; **two-person rule**: opener (admin) + approver (superadmin or second admin — configurable in 13) |
| **In nav** | from 02/04 on sealed ended lots; sidebar "Sul. avamine" lists eligible lots |

## Purpose & user goals
Ceremonial, tamper-evident reveal of sealed bids after endTime: verify preconditions, decrypt + rank bids, confirm winner, publish finalPrice, trigger notifications and contract generation — or abort with documented cause.

## Wireframe (desktop)
```
┌──────────────────────────────────────────────────────────────────────────┐
│ #4812 Ööviiuli · kinnistu · SULGUNUD 28.08 14:00 · 3 suletud pakkumist   │
│ 🛡 Kõik tegevused sel lehel jäävad auditlogi (näidatakse allpool)        │
├──────────────────────────────────────────────────────────────────────────┤
│ EELKONTROLL                                                               │
│ ☑ Lõppaeg kinnitatud (queue worker 14:00:02, idempotent ✓)               │
│ ☑ Ootel alapakkumised: puuduvad                                          │
│ ☑ Lepingu mall: Metsakinnistu v3.1 (aktiivne) ✓                          │
│ ☐ Avaja allkiri: M. Vain (admin) — [Kinnita avajana]                     │
│ ☐ Kinnitaja allkiri: — ootab teist isikut (superadmin)                   │
├──────────────────────────────────────────────────────────────────────────┤
│ ┌─ Paljastus ───────────────────────────────── [⚡ Paljasta pakkumised] ┐│
│ │ #  Summa €        Pakkuja              Esitatud          Allkiri*     ││
│ │ 1  61 000        Kalle Tamm (Tamm OÜ) 26.08 09:12       …            ││
│ │ 2  58 500        Tõnis Kask            27.08 19:44      …            ││
│ │ 3  52 000        Annika Saar           25.08 11:03      …            ││
│ └─ Viigi korral võidab varasem esitus ─────────────────────────────────┘│
├──────────────────────────────────────────────────────────────────────────┤
│ Võitja: Kalle Tamm — 61 000 € ≥ piirhind ✓                               │
│ [Kinnita võitja ja avalda lõpphind]   [Tühista oksjon (põhjusega)]       │
├──────────────────────────────────────────────────────────────────────────┤
│ Auditliider: 14:02 avaja kinnitas · 14:03 kinnitaja kinnitas · …         │
└──────────────────────────────────────────────────────────────────────────┘
```

## Block-by-block spec
1. **Header** — lot, sealed chip, "SULGUNUD" frozen state; while active: banner "Pakkumised on krüpteeritud — näeb ainult arv: N" (count only, no amounts; same as portal). After endTime the lot is frozen: no bid mutations possible by anyone.
2. **Audit banner** — permanent: "Kõik tegevused sel lehel jäävad auditlogi". Live audit trail strip at bottom (append-only, timestamps + actors).
3. **Eelkontroll (checklist)** —
   - Lõppaeg kinnitatud: ending worker ran, idempotency key shown, ended_at.
   - Ootel alapakkumised: none pending (if any → link to 04; checklist blocks).
   - Lepingu mall: active template for object type + version; warning if template changed in last 24h ("Mall vahetati pärast oksjoni algust" — requires superadmin override note).
   - Piirhind (reserve) indicator — shown only after reveal, as comparison "≥ piirhind ✓/✗".
4. **Two-person rule** — Avaja clicks [Kinnita avajana] (modal: typed confirmation "AVAN" + note field) → status "avaja ootel"; Kinnitaja (different account, must be superadmin unless single-admin fallback enabled with explicit risk acknowledgement) confirms → both signatures stored with timestamps; session of each is bound; reveal button enabled only when both present. If approver leaves page >30 min, signatures expire (re-start).
5. **Paljastus** — [⚡ Paljasta pakkumised] decrypts all bids at once (never one-by-one — simultaneous reveal per terms), ranking table:
   - Columns: koht (#), summa € (mono, largest first), pakkuja (full identity — name, isikukood/registrikood masked mid-digits, company chip, link to 06), esitatud (datetime), siduvus (valid/invalid — e.g. identity mismatch flag),* marginal notes (late revision, revision count).
   - **Tie-break: varasem esitusaeg** — equal amounts automatically ordered with "viik — varasem esitus" badge on row 1.
   - Invalid bids (identity validation failed): greyed, marked "kehtetu", excluded with reason.
6. **Võitja kinnitamine** — highlighted top row; comparison to piirhind:
   - Top ≥ reserve → [Kinnita võitja ja avalda lõpphind]: final confirm modal (shows winner, price, fee estimate €) → atomic action: finalPrice published, winner status=won (contract generation queued, template version pinned), losers queued "ei võitnud" notifications, lot → status=contract. Audit entry with full before/after.
   - Top < reserve → "Jäi piirhinnale alla" branch: choices = märgi müümata (→ unsold, seller notified with re-list/kiiroksjon-backup options) or (kiiroksjon) käivita varupakkumise töövoog (Eametsad house offer, superadmin only).
7. **Tühistamine (abort/void)** — available until winner confirm: typed reason mandatory + superadmin; outcomes: `voided` (all bids void, bidders notified "Oksjon tühistati", no fee), lot returns to draft for re-list. Post-confirm voiding happens in 08 (contract void), not here.

## Interactions & edge cases
- Page locks to the two signed sessions; other admins see read-only "Avamine on pooleli (M. Vain + K. Mets)".
- Reveal is one-shot: after reveal, page becomes permanent record view (same URL) — ranked table + winner + audit trail.
- No bids at all → skip reveal, checklist offers "Märgi müümata" directly (single admin allowed, still audit-logged).
- Clock edge: reveal button disabled until `ended_at + 60s` grace (prevents race with ending worker retries).
- Keyboard: Enter on confirm modals requires typed keyword, not accidental.

## Data & API
`GET /api/admin/auctions/:id/sealed-state` (frozen, count, checklist); `POST /api/admin/auctions/:id/open-sealed` (with opener+approver session tokens — server verifies two distinct sessions); `POST :id/confirm-winner {winnerBidId, feeEstimate}`; `POST :id/void {reason}`; `POST :id/mark-unsold`. Decryption server-side; plaintext amounts exist only in response to signed-in opener session; everything logged (`sealed.reveal`, `sealed.winner_confirm`, `sealed.void`).

## States
Pre-end: "Oksjon veel käib — pakkumised krüpteeritud". Waiting approver: pulsing "Ootab kinnitajat". Already opened: permanent record view. Notification failures: warning row "Võitja teavitus ebaõnnestus — uuesti saatmise nupp" (does not roll back result).

## Copy (Estonian, draft)
"Suletud pakkumiste avamine" · "Pakkumised on krüpteeritud" · "Eelkontroll" · "Kinnita avajana" · "Ootab kinnitajat (teine isik)" · "Paljasta pakkumised" · "Viik — varasem esitus võidab" · "Kinnita võitja ja avalda lõpphind" · "Jäi piirhinnale alla" · "Tühista oksjon" · "Tühistamise põhjus (kohustuslik)" · "Kõik tegevused salvestatakse auditlogisse" · "Varupakkumise töövoog (kiiroksjon)".

## Permissions & audit
Highest-audit screen in the system: every checklist confirm, signatures, reveal, winner confirm, void, unsold — each an immutable audit entry with actor, timestamps, and before/after JSON (amounts unmasked — internal). Specialist/seller cannot open this screen.

## Reveal table columns (full definition)
| Column | Content |
|---|---|
| Koht (#) | rank after sort: amount desc, submitted_at asc |
| Summa € | monospace, thousands separator |
| Pakkuja | name; isikukood/registrikood masked mid-digits; company chip + profile link (06); shill flag icon if marked in 04 |
| Esitatud | datetime + revision count if >1 ("2. parandus") |
| Siduvus | kehtiv / kehtetu + reason (identity validation, late arrival) |
| Marginaal | gap to next-lower bid ("+2 500 €") |

## Notification triggers (on winner confirm)
1. Winner: e-mail + SMS "Oksjon võidetud — leping allkirjastamiseks" (template from 13), contract generation queued immediately.
2. Losers (n-1): "Pakkumine ei võitnud" e-mail; amounts of others never disclosed.
3. Seller: result summary with fee estimate and next steps (re-list assistant if unsold path taken).
4. Archive snapshot worker writes stats entry; finalPrice becomes public on lot page.

## Ceremony timing rules
- Signatures valid 30 min from each sign; reveal must happen within both windows.
- If either signer navigates away, state persists server-side ("avaja ootel" visible to all admins read-only).
- Winner confirm requires re-auth (eID or password re-entry) of the opener — ceremony-level step-up.

## Edge cases
| Case | Behaviour |
|---|---|
| Only 1 valid bid | table + winner flow unchanged; no tie logic |
| All bids invalid | "Kehtivaid pakkumisi ei ole" → mark unsold (single admin OK, logged) |
| Reserve exactly met | counts as sold (≥) — banner explains |
| Company profile bid, company approval still pending | bid flagged amber "ettevõtte profiil ootel" — decision: treat as valid if approved before confirm, else invalid; forced admin choice with note |
| Notifications queue down | result stands; retry panel with per-recipient status |

## Accessibility
Checklist uses real checkboxes with labels; reveal table sortable-no (fixed order — ceremony record); confirm modals trap focus; typed keyword input labelled clearly.

## Open questions
- Single-admin orgs: allow "both roles same person" with superadmin risk toggle, or require board member as second signee?
- Publish losing-bid count publicly (archive shows finalPrice only today)?
- Should the ceremony screen record a signed PDF protocol automatically (open protocol doc)?
