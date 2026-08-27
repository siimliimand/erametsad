# Liitu — Join the association
| Area | uhistu |
|---|---|
| **Route** | `metsauhistu.eametsad.ee/liitu` |
| **Access** | public |
| **In nav** | subsite header CTA button "Liitu"; hero form success link; detail-page form |

## Purpose & user goals
Forest owner decides to join: confirms membership is free, reads benefits, submits the join form. No payment, no member portal — staff follow up by phone/email (lead funnel, monetization via services).

## Wireframe (desktop)

```
┌────────────────────────────────────────────────────────────────────┐
│ H1 Astu Erametsad Metsaühistu liikmeks                             │
│ banner (bg-mist): "Liitumine ja liikmelisus: TASUTA"               │
├──────────────────────────────────┬─────────────────────────────────┤
│ MIKS LIITUDA (7col)              │ LIITUMISVORM Card (5col)        │
│ ✓ ×11 benefits checklist         │ Eesnimi ja perekonnanimi*       │
│  1 Koolitused ja isiklik nõustamine │ Isikukood*                   │
│  2 Metsatoetuste taotlemine      │ Elukoht / postiaadress*         │
│  3 Raieõiguste oksjonikeskkond   │ Telefon*                        │
│  4 Metsakinnistute oksjonid      │ E-post*                         │
│  5 Metsauuendus- ja istutustööd  │ [ConsentCheck* — visible,       │
│  6 Maapinna ettevalmistus        │  unchecked, required]           │
│  7 Noorendike hooldus            │ [Btn cta LIITU]                 │
│  8 Metsavara kaitsmine (ulukitõrje)│ link: loe põhikiri (PDF)      │
│  9 Õigusabi metsaküsimustes      │                                 │
│ 10 Seadusnõustamine metsanduses  │                                 │
│ 11 Abi metsatulu deklareerimisel │                                 │
├──────────────────────────────────┴─────────────────────────────────┤
│ H3 Mis edasi saab? — Steps ×4 · <ContactBand>                      │
└────────────────────────────────────────────────────────────────────┘
```
Mobile: benefits collapse into 2-col checklist grid then form; form gets sticky "Liitu" bar? No — keep single form, fields stack.

## Block-by-block spec
1. **Header** — H1 + amber-tinted info banner: joining and membership are **free**; ühistu teenib teenustasudega (link to /toetused §Teenustasu), mitte liikmemaksuga.
2. **Miks liituda** — 11-item benefits list (own draft, based on research §5): 1 Koolitused ja isiklik nõustamine; 2 Metsatoetuste taotlemine ühistaotlusega; 3 Raieõiguste oksjonikeskkond; 4 Metsakinnistute enampakkumised; 5 Metsauuendus- ja istutustööd korraldatult; 6 Maapinna ettevalmistus; 7 Noorendike ja metsataimede hooldus; 8 Metsavara kaitsmine ulukite ja kahjustuste eest; 9 Õigusabi metsaomamisega seotud vaidlustes; 10 Metsanduslik seadusnõustamine; 11 Abi metsatulude deklareerimisel. Items 3–4 cross-link to oksjonid.eametsad.ee; others anchor /teenused or /toetused.
3. **Join form** (`form_name=liitu`) — fields with inline validation: nimi\* (text), isikukood\* (EE format checksum + clear error text), elukoht/postiaadress\* (text), telefon\* (tel, EE/LT/LV prefixes accepted), e-post\* (email), ConsentCheck\*: "Olen nõus, et Erametsad Metsaühistu MTÜ töötleb minu andmeid liitumistaotluse läbiviimiseks ja võtab minuga ühendust." — **visible, unchecked, required; no hidden pre-checked box** (explicit fix of the reference's GDPR flaw; the reference also misnamed the data controller). Below submit: link to põhikiri PDF (`LegalDocument`, new tab) + privaatsuspoliitika anchor. → `POST /api/leads`.
4. **Mis edasi saab?** — `Steps`: 1) Võtame 1 tööpäeva jooksul ühendust → 2) Kinnitame liikmelisuse ja saadame põhikirja tingimused → 3) Koostame sinu metsa tegevuskava ja toetuste kalendri → 4) Vajadusel ühineks kohe esimese toetusvooruga.
5. **`<ContactBand>`**.

## Interactions & edge cases
- Isikukood validation: local checksum only (no registry call); error "Palun kontrolli isikukoodi (11 numbrit)." — accepts also äriregistri kood with type toggle? No: this form is for private members; companies are directed ("Esindad juriidilist isikut? Kirjuta meile") to mailto.
- Submit disabled until all required valid + consent checked; per-field inline errors on blur.
- Honeypot + rate limit (per plan §4.4); success replaces card with confirmation incl. "Vaata vahepeal toetusi" link.
- Duplicate detection in CRM (same isikukood) merges, doesn't create second lead.

## Data & API
- → `POST /api/leads` `{form_name:"liitu", page:"/liitu", name, personalCode, location, phone, email, consent:true, consentText, consentAt}`; source tracking fields per §4.4; lead auto-tagged `type=membership`.
- Benefits + steps from CMS `Page` blocks so copy is editable; statute PDF in `LegalDocument`.

## States
- Success: green inline confirmation "Tervist, tulevane liige! Võtame ühendust…" + link /toetused.
- Error (validation/network): inline field errors / "Saatmine ebaõnnestus — proovi uuesti või helista +372 …".
- Consent unchecked submit attempt: scroll to consent + inline error (no modal).

## Copy (Estonian, draft)
- Banner: "Liitumine ja liikmelisus on tasuta — me teenime teenustasudega, mitte liikmetega."
- Submit: "LIITU"; steps H3: "Mis edasi saab?"
- Consent as above; põhikiri link label: "Loe ühistu põhikirja (PDF)".

## SEO & analytics
- Title: "Liitu metsaühistuga — tasuta | Erametsad Metsaühistu"; desc: benefits summary + "liitumine tasuta".
- JSON-LD `Organization` with `member` join action potential (limited value; skip Action schema v1).
- Events: `join_page_view`, `join_form_start`, `join_field_error{field}`, `join_submit`, `statute_download`, `benefit_link_click{item}`.
- Funnel: hero-join (01) and toetus-taotle (04) submissions counted as upper-funnel joins in analytics.

## Responsive notes
- ≥1024px: 7/5 benefits/form split; benefits list 2-col checklist grid.
- 768–1023px: form above benefits (conversion-first) — decision made on desktop layouts, reversed here after scroll-depth review; benefits 2-col.
- <768px: everything single column; number keypad on telefon (`inputmode="tel"`), isikukood `inputmode="numeric"`; submit full-width sticky within form card only (no global sticky bar).
- Form card shadow per tokens; inputs 10px radius, inline labels, error text 14px `--danger`.

## Accessibility
- All errors linked via `aria-describedby`; consent checkbox is a real checkbox, first tab stop in the form's tail; error summary on failed submit (focus moved to it).
- Benefits checklist: decorative check icons `aria-hidden`; text is plain list content.
- Banner "TASUTA" not conveyed by color/size alone — sentence text carries the meaning.

## Analytics funnel note
join_form_start should fire on first field focus (not page load) to keep the metric comparable with marketing-site forms (§4.4 convention).

## Open questions
- Juriidilised isikud: separate form variant or pure mailto? (Default mailto; revisit if volume appears.)
- Isikukood in a public form — confirm lawful basis wording with privacy counsel; consider masking display in CRM (admin/09).
