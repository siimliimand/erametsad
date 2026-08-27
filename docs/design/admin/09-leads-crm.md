# Juhtlõimed (CRM) — Leads pipeline

> **In brief:** Track enquiries through the pipeline, assign specialists and export.
| Area | admin |
|---|---|
| **Route** | `/juhtloid` (views: Kanban / Tabel) |
| **Access** | specialist (own assigned leads), admin, superadmin (all + export) |
| **In nav** | sidebar "Juhtlõimed" |

## Purpose & user goals
Work marketing form submissions (all eametsad.ee lead forms + newsletter indirectly) through a pipeline to contracts: triage new leads, assign specialists, track notes and next actions, respect SLA and consent records.

## Wireframe (desktop)
```
┌──────────────────────────────────────────────────────────────────────────┐
│ Juhtlõimed   [Kanban] [Tabel]   Filtrid: [Allikas ▾][Maakond ▾][Spets. ▾]│
│ + Uus juhtlõige (käsitsi, nt telefonikõnest)                             │
├──────────┬───────────┬──────────────┬──────────┬─────────────────────────┤
│ UUS (6)  │ VÕETUD    │ KVALIFIT-    │ LEPING   │ MITTEKVALIFITSEERITUD  │
│          │ ÜHENDUST  │ SEERITUD (9) │ (4)      │ (2)                     │
│ ┌──────┐ │ ┌──────┐  │ ┌──────┐     │ ┌──────┐ │ ┌──────┐               │
│ │Jaan T│ │ │Piret │  │ │Mikk │     │ │Toomas│ │ │…     │               │
│ │Pärnu ⚠│ │ │Tartu │  │ │Harju │     │ │Saare │ │ │       │               │
│ │kava   │ │ │raieõ│  │ │kinnis│     │ │raieõ │ │ │       │               │
│ │> 26h ⏱│ │ └──────┘  │ └──────┘     │ └──────┘ │ └──────┘               │
│ └──────┘ └───────────┴──────────────┴──────────┴─────────────────────────┘
Card click → detail drawer:
┌─────────────────────────────────────┐
│ Jaan Torn · UUS · #5121             │
│ Allikas: kava päring / /paringud/…  │
│ tel 52… · jaan@… · katastritest 34… │
│ Sõnum: "…" (+manused 1)             │
│ Nõusolek: 26.08 09:12 ✓             │
│ Spetsialist: [määramata ▾]          │
│ Järgmine tegevus: [28.08] meeldetuletus │
│ [Märkmed / ajajoon]                 │
└─────────────────────────────────────┘
```

## Block-by-block spec
1. **Toolbar** — view switch (state persisted per user); filters: allikas (form name: põhivorm/raieõiguse-müük/kava/hooldusraie/istutamine/kiiroksjon/kontakt…), maakond (derived from cadastre/parish if resolvable), spetsialist, SLA-only toggle. `+ Uus juhtlõige` manual entry (phone-lead capture: name, phone, source=telefon, note).
2. **Kanban** — 5 columns Uus → Võetud ühendust → Kvalifitseeritud → Leping → Mittekvalifitseeritud. Drag-and-drop between columns (optimistic + server confirm; drop to Kvalifitseeritud/Leping requires assigned specialist — else snap-back + toast "Määra spetsialist"). Column counts; cards show name, county chip, source chip, SLA badge, next-action date icon. Cards per specialist highlight (my-cards border) for role clarity.
3. **Tabel view** — DataTable: ID, Kuupäev, Nimi, Telefon, E-post, Allikas (form+page slug), Maakond, Katastrid, Olek, Spetsialist, Järgmine tegevus, Märkmete arv. Row click → drawer. Bulk: [Ekspordi CSV] (admin), [Määra spetsialist].
4. **Lead detail drawer**:
   - Pealkiri: name + status chip + id.
   - Allikas: form name + page slug + occurrence (reference `form-name` convention, plan §4.4) + UTM/source if present.
   - Kontakt: phone (click-to-call tel:), email, cadastral numbers (linked to Maa-amat map).
   - Sõnum + manused (attachments list, download).
   - **Nõusolek**: consent timestamp (mandatory at submission) — "Nõusolek turunduseks: 26.08 09:12 ✓"; if withdrawn: red chip "nõusolek tagasi võetud 30.08 — kontakt keelatud".
   - Spetsialist: assign select; auto-assignment suggestion chip ("soovitus: Marit (Pärnu, järjekorras järgmine)").
   - **Märkmete ajajoon** — append-only notes (author, timestamp, text); status-change log interleaved (auto-entries "Uus → Võetud ühendust — Marit, 27.08 10:01").
   - Järgmine tegevus: date + reminder → creates calendar-less in-app reminder (bell in topbar on due date).
5. **Auto-assignment** — settings-driven (13): round-robin per county among active specialists with county coverage; only fires on `Uus` if enabled; manual override always possible; log entry shows "automaatmääramine".
6. **SLA badge** — Uus column: unhandled >24h amber "→ 26 h", >48h red; counted from created_at to first note/status change. Dashboard 01 mirrors count.

## Interactions & edge cases
- Drag on mobile: card menu "Liiguta →" instead of DnD.
- Duplicate detection: same phone/email within 30 days → amber "võimalik duplikaat #4982" link on card + drawer.
- Newsletter subscribers are NOT leads — separate list, only referenced if email matches (chip "uudiskirja tellija").
- Export CSV respects consent: marketing-consent-withdrawn leads exported with contact fields blanked + notice row.
- Deleted leads: soft-delete only (evidence of consent), superadmin, typed reason.

## Data & API
`GET /api/admin/leads?where=&view=`, `PATCH /api/admin/leads/:id {status?, assignedSpecialistId?, nextActionAt?}`, `POST :id/notes {text}`, `GET /api/admin/leads/export.csv`; ingest from `POST /api/leads` (public, honeypot+rate-limited per plan §4.4).

## States
Empty column: faint "—". Empty board: "Juhtlõimed puuduvad — vormide esitamised ilmuvad siia automaatselt". Offline save conflict: note kept, last-write-wins with toast.

## Copy (Estonian, draft)
"Juhtlõimed" · "Uus" · "Võetud ühendust" · "Kvalifitseeritud" · "Leping" · "Mittekvalifitseeritud" · "Määra spetsialist" · "Järgmine tegevus" · "Märkmed" · "Lisa märkus" · "Nõusolek turunduseks" · "Nõusolek tagasi võatud — kontakt keelatud" · "SLA ületatud" · "võimalik duplikaat" · "Ekspordi CSV" · "Uus juhtlõige (käsitsi)".

## Permissions & audit
Audit-logged: manual create, assignment changes (auto vs manual flagged), status changes (in status log), export (contains personal data), soft-delete (reason). Specialist sees only assigned leads; cannot export.

## Status semantics & guards
| Status | Entered by | Exit guard |
|---|---|---|
| Uus | form ingest / manual | any move requires assigned specialist |
| Võetud ühendust | drag / menu | first note exists (prompt if none) |
| Kvalifitseeritud | drag | note with qualification reason (inline mini-form on drop) |
| Leping | drag / linked contract | linked auction/contract ref or note |
| Mittekvalifitseeritud | drag | typed reason (mini-form) — sets marketing-consent review chip if withdrawn |

Moves are logged in the ajajoon by whom+when; nothing is deletable.

## Notes timeline entries
Manual notes (author, text, optional "klient ei vastanud" quick-chip), auto-entries: created, status changes, assignment changes (auto/manual), next-action set/done, attachment added, consent events, export mentions. Filter chips: kõik / märkmed / sündmused.

## Auto-assignment algorithm (setting in 13)
Candidate specialists = active + county coverage (lead county from cadastre prefix or explicit field). Round-robin counter per county persists; falls back to all-active round-robin if no county match; disabled → "määramata" + dashboard red. Reassignment keeps both entries in timeline ("Marit → Kaire, põhjus …").

## CSV export columns
ID, loodud, nimi, telefon, e-post, katastrid, maakond, allikas (form+slug), olek, spetsialist, nõusolek (aeg / tagasivõetud), järgmine tegevus, märkmete arv. Consent-withdrawn → contact columns blanked. Admin+ only.

## Edge cases
| Case | Behaviour |
|---|---|
| Spam burst from one IP | honeypot/rate-limit blocks ingest; blocked list viewable (superadmin) — never in pipeline |
| Lead for county with no specialist | fallback assignment + dashboard warning chip |
| Same lead submits twice forms | duplicate banner + "ühenda" action (merges notes, keeps earliest consent) |
| Next-action overdue | bell badge on topbar + card icon red |

## Accessibility
Kanban columns are lists with drop targets announced; drag has keyboard alternative (card menu "Liiguta →"); drawer focus-trapped; SLA badges text+colour.

## Open questions
- SMS notification to assigned specialist on new lead (plan mentions optional) — enable via 13?
- Should "Leping" status auto-create from a signed seller contract elsewhere, or stay manual?
- Lead↔auction linkage: attach won/created lots to the originating lead for funnel accuracy (12)?
