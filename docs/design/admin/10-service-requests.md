# Päringute suunamine — Service requests (partner marketplace)
| Area | admin |
|---|---|
| **Route** | `/paringud` (tabs: Päringud / Partnerid) |
| **Access** | admin, superadmin |
| **In nav** | sidebar "Päringud" |

## Purpose & user goals
Route the three marketing-site inquiry forms (metsamajanduskava, hooldusraie, metsa istutamine) to partner companies, track the forwarding log and request outcomes, and maintain the partner directory — while minimising personal data shared onward.

## Wireframe (desktop)
```
Tab Päringud:
┌───────────────────────────────────────────────────────────────────────────┐
│ Päringud  [Päringud 38] [Partnerid 11]                                    │
│ Filtrid: [Tüüp ▾ kava/hooldusraie/istutamine][Olek ▾][Kuupäev —] otsing…  │
├────┬──────────┬───────────────┬───────────────┬───────────┬───────────────┤
│ID  │ Tüüp     │ Klient        │ Maakond/katastr│ Saadetud  │ Olek          │
│214 │ Kava     │ Jaan T.       │ Pärnu / 34…   │ 26.08 09:12│ ● saadetud (3)│
│213 │ Hooldusraie│ Piret K.    │ Tartu / 48…   │ 25.08 16:40│ ○ vastatud    │
├────┴──────────┴───────────────┴───────────────┴───────────┴───────────────┤
│ Detail drawer:                                                             │
│ [Päringu sisu]  [Suunamine →]  [Edastamise log]  [Manused ↓]              │
│  Suunamispaneel: Partnerid (kava, Pärnu piirkond):                        │
│   ☑ Metsakava OÜ (vaba 3/5)  ☑ Kavad & Ko OÜ (vaba 1/2)                   │
│   ☐ Tartu Metsateenused (maakond ei kattu)                                │
│   [Saada valitud partneritele]  ℹ Partnerile edastatakse vaid vajalikud   │
│     kontaktandmed (nimi, telefon, e-post, kinnistu andmed)                │
└───────────────────────────────────────────────────────────────────────────┘
Tab Partnerid: partner directory CRUD table.
```

## Block-by-block spec
**Tab 1 Päringud**
- DataTable columns: ID; Tüüp chip (Kava / Hooldusraie / Istutamine); Klient (name, masked); Maakond + katastrid; Sisu-preview (truncated, expandable payload viewer); Manused (count, ↓ zip); Saadetud (forwarded timestamp + partner count); Olek: uus (grey) / saadetud (blue) / vastatud (amber — at least one partner marked responded) / teostatud (green — work confirmed) / aegunud (14 days, auto).
- Filters: type, status, date range, county, freetext (name, cadastre).
- **Payload viewer** (drawer/expand): ALL form fields rendered as definition list per type —
  - Kava: nimi, telefon, e-post, katastritunnus(ed), ☐ soovin kava paberkandjal, kommentaar.
  - Hooldusraie: nimi, telefon, e-post, maakond, katastritunnus, eraldis(ed), ☐ kultuuride hoindamine ☐ valgusraie, kava fail (download), kommentaar.
  - Istutamine: nimi, telefon, e-post, maakond, katastritunnus, eraldis(ed), ☐ maapinna ettevalmistus ☐ istikud ☐ istutamine, kommentaar.
  Plus consent timestamp and source page slug (internal-only section, visually separated — "Ei edastata partnerile").
- **Routing panel** — partner list filtered by service type + county coverage; each row: name, capacity indicator (aktiivsed päringud / limiit), last-forwarded date; checkbox select. Warning if selected partner at capacity. [Saada valituile] → confirm modal listing recipients → creates forwarding entries, sends e-mail per partner (template from 13) with minimised payload. **Anonymisation notice** fixed in panel: partner receives only name, phone, email, property/cadastre data — never isikukood, IP, source tracking, consent metadata.
- **Forwarding log** (per request): table Saadetud | Partner | E-posti olek (saadetud/avatakse/nurjus + retry) | Vastus märgitud | Märkus. Partner responses arrive via reply e-mail (parsed to log manually or semi-auto) — admin marks "vastanud" per partner; request status auto-updates.
- Row actions: Saada uuesti (per partner), Märgi teostatuks, Sulge (aegunud).

**Tab 2 Partnerid — directory CRUD**
- Columns: Ettevõte (nimi, registrikood), Kontaktisik (nimi, e-post, telefon), Teenused (chips kava/hooldusraie/istutamine), Maakonnad (coverage chips), Aktiivsed päringud / Limiit, Aktiivne toggle, Viimati edastatud.
- Create/edit form: name, regcode (lookup prefills legal address), contact person, email (routing target), phone, services multi-select, counties multi-select, **capacity limit** (max concurrent open requests), active toggle, note.
- Deactivate: sets toggle (history retained); typed reason optional. Delete: only if never forwarded-to (else archive).

## Interactions & edge cases
- Send is idempotent-guarded: partner already received request → checkbox disabled "saadetud 26.08".
- E-mail failure in batch: partial success toast with failed partner list + per-row retry.
- Capacity limit = soft warning (admin may override with confirm).
- Attachment files forwarded as signed links (expiring 14 days) not attachments.
- Keyboard: S opens routing panel on focused row.

## Data & API
`GET /api/admin/service-requests?where=`, `GET :id` (payload+log), `POST :id/forward {partnerIds[]}`, `POST :id/partners/:pid/mark-responded|mark-done`, `POST :id/close`; partners CRUD `GET/POST/PATCH /api/admin/partners`. Public ingest `POST /api/service-requests` (honeypot, rate-limit, consent required).

## States
Empty: "Uusi päringuid ei ole". Routing panel with no matching partners: "Ühtegi aktiivset partnerit ei kata seda maakonda" + link to Partnerid tab + manual e-mail copy button (client data copy to clipboard with consent notice).

## Copy (Estonian, draft)
"Päringud" · "Partnerid" · "Metsamajanduskava" · "Hooldusraie" · "Metsa istutamine" · "Saada valituile partneritele" · "Edastamise log" · "Partnerile edastatakse vaid teenuse osutamiseks vajalikud andmed" · "Märgi vastatuks" · "Märgi teostatuks" · "Sulge päring" · "Maht täidetud" · "Ei kata seda maakonda" · "Lisa partner" · "Aktiivne" · "Mahtude limiit".

## Permissions & audit
Audit-logged: every forward (request+partner list — personal-data disclosure event), mark responded/done, close, partner create/edit/deactivate. Minimal-payload rule enforced server-side.

## Forwarding e-mail content (template `request.forward`, editable in 13)
Included (minimised payload): klient nimi, telefon, e-post, katastrid/eraldised, teenuse valikud (checkbox summary), kommentaar, allkirjastatud manuse-linkid (14 d). Excluded (enforced server-side): isikukood (never collected here), IP, source/UTM, consent metadata, admin notes. Footer: "Andmed on edastatud Eametsad OÜ vahendusel teenusepakkujale {nimi}. Küsimuste korral vastake otse kliendile."

## Partner routing rules
Order in routing panel: county match first (sorted by free capacity), then county-agnostic partners ("Kogu Eesti" coverage). Default pre-selection: top N (setting, default 3) by fewest open requests — admin can alter. Capacity = open forwarded-not-responded count vs limit.

## Status transitions
uus → (forward) → saadetud → (≥1 partner responded) → vastatud → (client confirmed work done) → teostatud; any → aegunud (auto 14 d, notifies client once with alternative offer); any → suletud (typed reason). Manual transitions via row menu; auto-transitions logged.

## Forwarding log columns (full)
Saadetud (ts) · Partner · Saaja e-post · Kande olek (järjekorras / saadetud / avatud / nurjunud + [Proovi uuesti]) · Vastanud (chip + ts) · Märkus. Per-partner "märgi vastanuks" and "lisa märkus" inline.

## Edge cases
| Case | Behaviour |
|---|---|
| Partner e-mail bounces | row red, retry after fix (partner edit), request stays saadetud if others OK |
| Client withdraws consent before forward | request locked, "Nõusolek tagasi võetud" — no forward allowed |
| Admin re-forwards to new partner after expiry | allowed, new log entries, client notified |
| Attachment >25 MB | rejected at public form with friendly error |

## Accessibility
Tables follow 02 patterns; payload viewer is a definition list; checkboxes labelled with partner name + capacity; routing confirm modal lists recipients as a list (screen-reader safe).

## Partner form fields (full)
Ettevõtte nimi* · registrikood* (lookup → juriidiline aadress prefilled) · kontaktisik* · suunamise e-post* · telefon · teenused* (multi: kava/hooldusraie/istutamine) · maakonnad* (multi, includes "Kogu Eesti") · mahtude limiit* (int, default 5) · aktiivne ✓ · märkus. Validation: unique regcode; email format; at least one service + county.

## States (full)
- Empty päringud: "Uusi päringuid ei ole — vormide esitamised ilmuvad siia".
- Empty partnerid: "Lisa esimene partner".
- Payload attachment missing (deleted file): row greyed "fail eemaldatud".
- Routing with zero active partners: fallback block + copy-to-clipboard manual flow.

## Open questions
- Should partners get a self-service portal (Phase 5) or e-mail only at launch?
- Auto-expiry of unanswered requests — notify client with alternative partners?
- Track quotes/prices partners give (revenue share later) or keep marketplace free/formless?
