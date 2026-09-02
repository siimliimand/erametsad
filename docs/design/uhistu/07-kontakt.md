# Kontakt — Contact

> **In brief:** Staff cards, office locations and contact form.
| Area | uhistu |
|---|---|
| **Route** | `metsauhistu.erametsad.ee/kontakt` |
| **Access** | public |
| **In nav** | subsite header "Kontakt"; every page's ContactBand |

## Purpose & user goals
Owner wants a human: finds the right consultant for their region, checks office hours/visit rules, or leaves a message via the lead form.

## Wireframe (desktop)

```
┌────────────────────────────────────────────────────────────────────┐
│ H1 Võta ühendust                                                   │
├──────────────────────────────────┬─────────────────────────────────┤
│ TÖÖTAJAD (7col)                  │ ÜHISTU Card (5col)              │
│ ┌SpecialistCard┐ ┌SpecialistCard┐│ MTÜ Erametsad Metsaühistu       │
│ │ Nimi Nimi    │ │ Nimi Nimi    │ │ Reg kood: <placeholder>        │
│ │ amet + volitus│ │ amet        │ │ aadress <placeholder>          │
│ │ email · tel  │ │ …            │ │ Kontorid: Tallinn (E–R 9–17,   │
│ │ Tööpiirkond: │ │              │ │  eelregistreeritud külastused),│
│ └──────────────┘ └──────────────┘│ │ <linn> (ainult kokkuleppel)   │
│  (2×2 grid, 4 cards)             │ note: külastuseks broneeri aeg  │
├──────────────────────────────────┴─────────────────────────────────┤
│ KIRJUTA MEILE — LeadForm (2-col) · kaart (MapEstonia office pin)  │
│ <ContactBand>                                                      │
└────────────────────────────────────────────────────────────────────┘
```
Mobile: cards 1-col; org card above staff; map last, 16:10, full-width.

## Block-by-block spec
1. **Header** — H1 "Võta ühendust", 1-line intro: "Kirjuta, helista või tule külla — kontorisse tulles broneeri eelnevalt aeg."
2. **Staff cards** — grid of `<SpecialistCard>` from `Specialist` collection (filtered `showOnUhistu=true`): foto, nimi, roll (tegevjuht / atesteeritud metsakonsulent / metsanduskonsulent …), `tel:` link, mailto link (obfuscated alias per §5.4 pattern), **Tööpiirkond:** county list ("Üle Eesti", "Lääne-Eesti …" etc.). Cards link to full profile on erametsad.ee where present.
3. **Ühistu block (Card, bg-mist)** — MTÜ legal data (CMS placeholders until client supplies): nimetus "MTÜ Erametsad Metsaühistu", registrikood, juriidiline aadress; **office hours** E–R 09–17; warning note (info-colored): "Kontorisse tulles palun eelnevalt aega broneerida — konsulendid on sageli metsas."; secondary office line with "ainult kokkuleppel".
4. **LeadForm** (`form_name=kontakt`) — nimi\*, email\*, telefon, teema (Select: Liikmelisus / Toetused / Teenused / Sertifitseerimine / Muu), sõnum (textarea), ConsentCheck visible/unchecked/required ("Nõustun andmete töötlemisega ja kokkupuutega."). → `POST /api/leads`; teema routes auto-assignment in admin/10.
5. **Map** — static Leaflet pin of main office (`MapEstonia` light variant, no layers), link "Ava Google Mapsis".
6. **`<ContactBand>`** — here it anchors to the LeadForm above.

## Interactions & edge cases
- Phone/email on cards: `tel:` / `mailto:`; email displayed as alias address that forwards to specialist inbox (anti-scrape).
- Teema Select preselectable via query `?teema=toetused` (cross-linked from subsidy pages' closed-state CTA).
- Map click-through external only; keyboard alternative is the address text link.
- Visit-booking note repeated in card tooltip on "Kontor" line.

## Data & API
- `Specialist` collection (shared with main site) + CMS `kontakt` Page for org block placeholders (`registryCode`, `address`, `hours`, `offices[]`).
- LeadForm → `POST /api/leads` `{form_name:"kontakt", page:"/kontakt", topic}`.

## States
- No specialists flagged: section hidden (org block + form remain).
- Form success inline; errors per-field; rate-limited submissions get friendly retry message.
- Map tile failure: pin + address text still render (map degrades to static block).

## Copy (Estonian, draft)
- H1: "Võta ühendust"; card label "Tööpiirkond:"; visit note: "Kontorisse tulles broneeri eelnevalt aeg — nii oleme kindlasti kohal."
- Form title: "Kirjuta meile"; consent: "Nõustun, et Erametsad Metsaühistu töötleb mu andmeid ja võtab ühendust." (unchecked, required).
- Submit: "SAADA".

## SEO & analytics
- Title: "Kontakt | Erametsad Metsaühistu"; desc: phone, email, office hours, "broneeri külastus".
- JSON-LD `Organization` with `contactPoint` (phone, email, hours) + `PostalAddress` — the one subsite page where LocalBusiness-style data is clearly correct.
- Events: `staff_card_click{specialist,channel}`, `contact_form_start/submit{topic}`, `map_open`, `visit_note_view`.

## Responsive notes
- ≥1024px: staff 2×2 grid + org card right; form 2-col (nimi/email, telefon/teema, sõnum full, consent full).
- 768–1023px: org card first, staff 2-col, form 1-col; map 4:3.
- <768px: staff 1-col; `tel:` links prominent (secondary Btn style — mobile users call, not type); map 1:1 ratio; ContactBand hidden (page IS the contact page — band replaced by footer contact line).
- SpecialistCard photo 64px round on mobile / 80px desktop.

## Accessibility
- SpecialistCard mailto/tel links have `aria-label` = "Kirjuta <nimele>" / "Helista <nimele>".
- Map: `<figure>` with `<figcaption>` address text; link out is the accessible alternative to the interactive map.
- Visit-booking note uses `--info` banner with icon, not red (it is guidance, not an error).

## Performance
- Map tiles lazy-loaded below the fold; LeadForm JS deferred; staff photos AVIF/WebP with `loading="lazy"`.

## Open questions
- Registry code, legal address, second office and staff list are all placeholders — confirm with MTÜ.
- Should staff profiles live on the subsite or only on erametsad.ee (duplicate-content risk)? Default: link out, keep card summary only.
