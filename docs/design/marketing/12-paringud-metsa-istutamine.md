# Metsa istutamise päring — Planting request form

> **In brief:** A form to request planting services, with service options.
| Area | marketing |
|---|---|
| **Route** | `/paringud/metsa-istutamine` |
| **Access** | public |
| **In nav** | "Päringud" → 3. alamleht |

## Purpose & user goals
Omanik, kellel on raiest tühi maa või istutamiskohustus (3-aastane taastamistähtaeg pärast raiet), saab valida soovitud teenuseosad (maapinna ettevalmistus / istikud / istutamine) ja esitada päringu partnerfirmadele.

## Wireframe (desktop)

```
┌──────────────────────────────────────────────────────────────────────┐
│ VAHEKAARDID: [Metsamajanduskava] [Istutamine←aktiivne] [Hooldusraie] │
│ H1 "Metsa istutamise päring"                                         │
├──────────────────────────────────────────────────────────────────────┤
│ [7-col sisu: istutamiskohustus, teenuseosad] │ [5-col VORM (Card)]   │
│   Teave: pärast raiet 3 aastat         │  nimi, telefon, email       │
│   taastamiskohustus (draft)             │  maakond (Select 15)       │
│                                          │  katastritunnus           │
│                                          │  eraldis(ed)              │
│                                          │  ☐ maapinna ettevalmistus │
│                                          │  ☐ istikud                │
│                                          │  ☐ istutamine             │
│                                          │  kommentaar               │
│                                          │  ☐ nõusolek   [SAADA]     │
├──────────────────────────────────────────────────────────────────────┤
│ "7 päeva" lubaduse bänd                                               │
├──────────────────────────────────────────────────────────────────────┤
│ ContactBand + Footer                                                 │
└──────────────────────────────────────────────────────────────────────┘
```
**Mobiil:** nagu 10/11 — vorm kohe H1 järel; märkeruudud virna; sisu alla.

## Block-by-block spec
1. **Vahekaardid (Tabs)** — samad 3, aktiivne "Istutamine".
2. **Sisuveerg** — H2 "Millal mets uuesti istutada?" (draft): pärast raie tekib seadusest tulenev taastamiskohustus — istutada tavaliselt 3 aasta jooksul (viide KKK raie/metsaandmed; juriidiline hoiatus, et tähtaeg sõltub raieliigist ja otsusest). H2 "Mis hinnapäring sisaldab?" — pakkujad hindavad kas osaliselt või tervikuna: mulla ettevalmistus (külvikorrastus, võsarõve), istikute valik (puuliik, päritolu, arv), istutamistöö ise; hooldus järgnevatel aastatel (viide `/paringud/hooldusraie`).
3. **Päringuvorm (Card)** — väljad ERAMETSAD-PLAN §4.3 järgi:
   - `nimi`, `telefon`, `email` (kohustuslikud)
   - `maakond` — `FormSelect` (15, kohustuslik)
   - `katastritunnus` (kohustuslik, üks või mitu)
   - `eraldis(ed)` (kohustuslik)
   - **3 märkeruutu** (vähemalt üks kohustuslik): `☐ Maapinna ettevalmistus` · `☐ Istikud` · `☐ Istutamine`
   - `kommentaar` (valikuline — nt pindala ha, soovitud puuliigid)
   - `ConsentCheck` (kohustuslik, edastamissõnastus "metsa istutamise teenuse pakkujatele"), `SAADA` + honeypot.
4. **Lubaduse bänd** — sama komponent nagu 10/11.

## Interactions & edge cases
- Valideerimine: vähemalt üks teenuseosa märitud; ülejäänud nagu 10 (telefon/email/kataster mustrid).
- Kommentaari vihje mainib pindala — pakkujad küsivad seda kõigepealt; kui pindala on kommentaaris, on päring parem (märgitakse analüütikas `service_request_quality` — vabatahtlik, vt Open questions).
- Mustandi salvestus localStorage'is nagu 10/11.

## Data & API
- `POST /api/service-requests` `{type:"istutamine", payload:{name, phone, email, county, cadastres[], provisions, services:["maapinna_ettevalmistus","istikud","istutamine"], comment}, consent_at, form_name:"metsa-istutamine-1"}` (viite konventsioon `metsa-istutamine`; meie route on `/metsa-istutamine` — form_name peab olema route'iga kooskõlas, vt Open questions).
- Maakonnad: sama allikas kui 11.

## States
- Edu / võrguviga / serveri 422 — samad mustrid kui 10-failis; routed_count bucket analüütikas.

## Copy (Estonian, draft)
- H1: "Metsa istutamise päring" · "Millal mets uuesti istutada?" · "Mis hinnapäring sisaldab?" · väljad: "Sinu nimi", "Telefoninumber", "E-mail", "Maakond", "Katastritunnus", "Eraldis/eraldised", "Maapinna ettevalmistus", "Istikud", "Istutamine", "Lisa kommentaar (nt pindala hektarites)", nõusolek: "Nõustun, et minu andmed edastatakse metsa istutamise teenuse pakkujatele, kes võivad minuga ühendust võtta." · "SAADA" · "Pakkujad vastavad 7 päeva jooksul."

## SEO & analytics
- Title: "Metsa istutamise päring — istutamine, istikud | Erametsad"; desc: "metsa istutamine, istikud, maapinna ettevalmistus, päring, taastamine".
- JSON-LD: `Service` + `BreadcrumbList`.
- Sündmused: `tab_switch{to}`, `service_request_start`, `service_request_validation_error{field}`, `checkbox_combination{services}` (milliseid osasid pakutakse — äriinfo), `service_request_complete`, `cross_link_click{hooldusraie}`.

## Accessibility & performance
- Kolm teenuseosa märkeruutu on `fieldset`+`legend`-iga ("Soovitud teenused") — grupi kohustuslikkus on loetav.
- Valideerimine, fookus, mustand — samad mustrid kui 10/11.
- Route'i nimi jääb püsivaks pärast avaldamist (väldi SEO liikumist; vajadusel `Redirect` CMS kogum).

## Open questions
- Route'i nimi: plan §4.1 kasutab `/paringud/metsa-istutamine`, aga viite analüüsis on `/metsa-istutamine` ja teised päringud kandvad nime `/paringud/metsamajanduskava` — kinnitatud: kasutame `/paringud/metsa-istutamine` (kooskõlas hubiga), `form_name` = "metsa-istutamine-1".

## Dependencies & change log
- Sõltub: 00-global-shell (kate, LeadForm, CookieBanner), README tokenid.
- Muudatused: v1 2026-08-27 (esimene draft).
- Seotud admin: admin/09-leads-crm (vormi esitused), admin/11-cms-content (sisu).
- Kolm teenuseosa on fieldset-grupp: maapinna ettevalmistus / istikud / istutamine.
- checkbox_combination sündmus annab äriinfot nõudluse kohta.
