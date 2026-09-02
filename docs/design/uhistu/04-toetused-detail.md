# Toetuse lehekülg (template) — Subsidy program detail

> **In brief:** A single subsidy: deadline, amounts, eligibility and how to apply.
| Area | uhistu |
|---|---|
| **Route** | `metsauhistu.erametsad.ee/toetused/<slug>` (e.g. `/toetused/hooldusraie`, `/toetused/metsameede-hooldusraie`) |
| **Access** | public |
| **In nav** | /toetused sidebar (active item); home table "Taotle" |

## Purpose & user goals
Owner evaluates one program: how much, do I qualify, how and until when to apply; converts via inline join/contact form ("taotle ühistu kaudu") or self-submits in e-PRIA with our checklist.

## Wireframe (desktop)

```
┌────────────────────────────────────────────────────────────────────┐
│ breadcrumb Toetused / <program>   [pill: Avatud · 07.04–23.04.2026]│
│ H2 <Programmi nimi>                          ┌───────────────────┐ │
│  intro ¶ (1–2 lauset)                        │ INLINE FORM CARD  │ │
├──────────────────────────────────────────────┤ "Taotle ühistu     │ │
│ H3 Kui suur on toetus?                       │  kaudu"           │ │
│  <table> Taotleja | Toetuse määr            │ nimi/telefon/email│ │
│   Füüsiline isik & FIE   356 €/ha           │ metsa asukoht(pind)│ │
│   Juriidiline isik       297 €/ha           │ [ConsentCheck]    │ │
│ H3 Olulisemad tingimused                     │ [Btn cta TAOTLE]  │ │
│  · min 0,1 ha · kehtiv takseer … (bullets   └───────────────────┘ │
│    w/ highlighted numeric params)                                  │
│ H3 Kuidas taotlust esitada?  — Tabs: [Ühistu kaudu] [e-PRIA ise]   │
│   steps per channel + document links (Excel import, PRIA juhend)  │
│ H3 Teenustasu — 7% laureaat-toetusest, detailtingimus link        │
│ H3 Taotluse esitamine — email workflow + dokumentide nimekiri     │
│ H3 Seotud toetused — 3 Card (same family / same deadline)         │
├────────────────────────────────────────────────────────────────────┤
│ <ContactBand>                                                      │
└────────────────────────────────────────────────────────────────────┘
```
Mobile: form card renders as a full-width block after "Kui suur on toetus?" (context before CTA); Tabs stack.

## Block-by-block spec
1. **Header** — breadcrumb, H2 program title, deadline `<StatusPill>` (same computed status as hub; shows window `07.04–23.04.2026` or `deadlineNote`), 1–2 sentence intro from CMS.
2. **Inline form card** ("Taotle ühistu kaudu") — sticky on desktop right rail: nimi, telefon, email, metsa asukoht ja pindala (text), `program` hidden field = slug, ConsentCheck visible/unchecked/required, `<Btn cta>` "ESITA SOOV". → `POST /api/leads` (`form_name=toetus-taotle`, `page=/toetused/<slug>`). Success state offers link to /liitu.
3. **Kui suur on toetus?** — semantic `<table>` from `rates[]`: rows per applicant type (Füüsiline isik/FIE, Juriidiline isik, Ühistu liige füüsiline isik …), columns Taotleja / Toetuse määr / Ühik. Flat vs per-ha unit rendered from `unit`. If single rate: one emphasized stat card instead of table.
4. **Olulisemad tingimused** — bullet list from `eligibility[]`; numeric params (0,1 ha, 1 ha/aasta, 30 ha, metsateatis >20 m³ …) wrapped in `<strong class="hl">` amber highlight — CMS stores rich text with `{{param}}` markers.
5. **Kuidas taotlust esitada?** — `<Tabs>`:
   - **Ühistu kaudu** (default): Steps 1) Jäta kontakt siin lehel või kirjuta metsauhistu@erametsad.ee → 2) Konsultant kontrollib kõlblikkuse ja pindalad → 3) Ühistu koostab ja esitab e-PRIAs ühistaotluse liikmete eest → 4) Teavitame otsusest ja abistame aruandluses.
   - **e-PRIA ise**: Steps 1) Logi sisse e-PRIA → 2) "Esita taotlus KIK-ile → <programmi menüütee>" → 3) Laadi alla Exceli impordimall (external link, tracked) → 4) Esita enne tähtaega.
6. **Teenustasu** — stat block: **7%** saadud toetusest; note: rakendub ühistaotluse puhul; e-PRIA iseesitamisel tasuta nõustame liikmeid.
7. **Taotluse esitamine** (email workflow) — numbered list: 1) Täida taotlusvorm (link, Media) ja saada metsauhistu@erametsad.ee; 2) pärast tööde lõppu saada samale aadressile tööde aruanne + kuludokumendid. Plus dokumentide checklist (Checkbox visual list): metsateatis, takseerandmed, krundi andmed, arved.
8. **Seotud toetused** — up to 3 Cards: same `parentProgram` siblings first, else nearest deadlines; links.
9. **`<ContactBand>`**.

## Interactions & edge cases
- Closed program: pill "Suletud", form CTA switches to "Teavita mind järgmisest voorust" (lead with `intent=notify_next_round`), Tabs note "Voor on suletud".
- `tbd` deadlines: pill "Aeg täpsustub" + subscribe-to-notify CTA.
- Sticky card must not overlap footer; max-height scroll if short viewport.
- Tab state persisted in URL hash (`#e-pria`) for sharing.

## Data & API
- One `SubsidyProgram` document renders whole page: `title, slug, parentProgram?, intro, deadline{start,end,note}, rates[], eligibility[](rich w/ params), channels{associationSteps[], epriaSteps[], menuPath, excelTemplateUrl}, serviceFeePct, workflowSteps[], checklist[], documents[], relatedOverride[]`.
- Program data is **shared verbatim with home table + hub** (single source; the reference duplicates and lets them drift).
- Form → `POST /api/leads` `{form_name:"toetus-taotle", page:slug, program:slug}`.
- Page statically generated per program; revalidated on CMS publish (ISR).

## States
- Unknown slug → 404 with subsidy hub links.
- Form success/error inline as usual; double-submit prevented.
- Empty `rates` → section shows "Määr täpsustub" note.

## Copy (Estonian, draft)
- Form title: "Taotle ühistu kaudu"; consent: "Nõustun, et Erametsad Metsaühistu töötleb mu andmeid toetuse taotlemise eesmärgil ja võtab ühendust." (unchecked, required).
- Tab labels: "Ühistu kaudu" / "e-PRIAs ise"; section H3s as in wireframe.
- Teenustasu: "Ühistu teenustasu on 7% laekunud toetusest — arvestame alles pärast toetuse laekumist."

## SEO & analytics
- Title: "<Programm> 2026 — toetuse suurus, tingimused, tähtaeg | Erametsad Metsaühistu".
- JSON-LD `Article`/`GovernmentService`-lite: we draft `FAQPage` only if content team adds Q/A pairs (avoid fake FAQ).
- BreadcrumbList JSON-LD (Avaleht → Toetused → programm).
- Events: `detail_view{slug}`, `taotle_form_start/submit{slug}`, `tab_switch{channel}`, `doc_download{name}`, `related_click{slug}`.

## Responsive notes
- ≥1024px: content 7col + sticky form rail 5col; rate table full width inside content col.
- 768–1023px: form rail moves below intro; Tabs full-width segmented control.
- <768px: rate table stacks rows (Taotleja as label, määr as value — same `<table>` with CSS reflow); Steps vertical; sticky form CTA bar ("Taotle ühistu kaudu") once form scrolls out of view.
- Checklist items keep checkbox affordance but are informational (not interactive) — styled `::before`, not inputs.

## Accessibility
- Tabs: roving tabindex, arrow-key navigation, `aria-controls` panels; deep-linkable via hash.
- Sticky form: `role="complementary" aria-label="Taotluse vorm"`; success message moves focus to itself for screen readers.
- Numeric highlights (`<strong class="hl">`) also bold — not color-only emphasis.

## Performance & freshness
- SSG + on-demand revalidation from CMS publish; deadline badges computed at render time and re-checked client-side against server clock (plan §5.2 clock rule) so a page cached over a deadline rollover self-corrects.

## Open questions
- **Who maintains program data?** Proposal: content editor role in admin/11 CMS with quarterly PRIA-calendar review task; auto-reminder task 4 weeks before `deadlineEnd` to verify next round. Needs owner assignment.
- Legal review needed for eligibility param highlighting (risk of misquoting official terms).
- Should `notify_next_round` leads get automatic email when new deadline is published?
