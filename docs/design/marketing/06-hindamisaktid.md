# Hindamisaktid — Valuation reports

> **In brief:** Sells valuation reports (from €480): methodology, price factors and how to order.
| Area | marketing |
|---|---|
| **Route** | `/hindamisaktid` |
| **Access** | public |
| **In nav** | "Metsa müümine" → 5. item |

## Purpose & user goals
Omanik (või pärija/pank/notar), kes vajab ametlikku maa ja metsa hindamisakti, saab aru metoodikast, hinda alates 480 € + km, ja tellib akti e-posti teel.

## Wireframe (desktop)

```
┌──────────────────────────────────────────────────────────────────────┐
│ HERO: H1 "Hindamisaktide koostamine" + lühinäide                      │
├──────────────────────────────────────────────────────────────────────┤
│ [4-col kleebuv nummerdatud külgmenüü]  │ [8-col sisu]                 │
│ ① Metoodika                           │ H2 1. Metoodika              │
│ ② Hinna mõjutegurid                   │ H2 2. Hinna mõjutegurid      │
│ ③ Andmeallikad                        │ H2 3. Andmeallikad           │
│ ④ Hind                                │ H2 4. Hind ("alates 480 € + km")│
│ ⑤ Tellimine                           │ H2 5. Tellimine (e-mail CTA) │
├──────────────────────────────────────────────────────────────────────┤
│ LEADFORM #1 (#kontaktvorm) — all, peale tellimise jaotist            │
├──────────────────────────────────────────────────────────────────────┤
│ ContactBand + Footer                                                 │
└──────────────────────────────────────────────────────────────────────┘
```
**Mobiil:** kleebuv külgmenüü → horisontaalne nummerdatud kiip-riba lehe ülaservas (sticky allapoole headerit); jaotised ühe veeruna.

## Block-by-block spec
1. **Hero** — H1 (draft): "Hindamisaktid metsa- ja põllumaale". Intro: "Koostame maatulundusmaa hindamisaktid kogu Eestis — müügiks, laenuks, päranduseks või kohtulikuks vaidluseks."
2. **Metoodika (H2 1)** — puistega nimekiri: võrdlev tehinguanalüüs Maa-ameti tehingute andmebaasi põhjal + **oma lõppenud oksjonite reaaltulemused** (unikaalne eelis — viide `/artiklid` ja statistikaandmetele); turuhinna ja takseerihinna vahekommentaar.
3. **Hinna mõjutegurid (H2 2)** — Card-ruudustik (6 kaarti, ikoon + pealkiri + 1 lause, draft): asukoht ja ligipääs; puuliigi koosseis; puistu vanus ja mahud; mullaproduktiivsus; piirangud (kaitsealad, veekaitsed); metsamaterjali turuhinnad.
4. **Andmeallikad (H2 3)** — nimekiri: takseerandmed metsamajanduskavadest; Maa-ameti avalikud kaardi- ja ortofotoandmed; AI-põhine metsainventuur; avalikud põlluandmed. Viimane täpsustatud: "kasutame automaatset metsainventuuri andmeid, mida võrdleme takseeriga".
5. **Hind (H2 4)** — hinnaskaart: **"alates 480 € + km"**, sõltub kinnistute arvust ja suurusest; väikene hindamateRiskide tabel (1 kinnistu / mitme kinnistu allahindlus — kohatäited).
6. **Tellimine (H2 5)** — `Btn` "Saada tellimus e-postile" → `mailto:hindamisakt@eametsad.ee?subject=Hindamisakti tellimus` (draft aadress) + juhend: kirjuta katastritunnus(ed) ja kontaktandmed. All hoiatus: "Hindamisakt ei ole tasuta konsultatsioon — tasuta on suuline lähtehindamine" (viide `/teenused/metsa-hindamine`).
7. **LeadForm #1** (`hindamisaktid-1`, `#kontaktvorm`) — "Ei tea, kas akt on sul vaja? Kirjuta."
8. **Külgmenüü** — kleebuv (top: header kõrgus + 24px), numbrid ①–⑤ ringides (`--primary`), aktiivne jaotis `--accent` rõhutatud; klõps → sujuv scroll (`scroll-margin-top` headeri võrra).

## Interactions & edge cases
- Külgmenüü aktiivse oleku scroll-spy; kui jaotis on vaateväljas üle 50% → aktiivne.
- `mailto:` ei toimi (webmail-kasutaja) → kõrval ka "Kopeeri aadress" nupp (`Toast` "Kopeeritud").
- Mobiilis kiip-riba horisontaalne scroll, aktiivne kiip auto-tsentreeritakse.

## Data & API
- Sisu CMS `Page` (jaotised H2 + Card-ruudustik); hind CMS-i üks väli, et muudatused ei vajaks koodi.
- Vorm `POST /api/leads`, `form_name=hindamisaktid-1`.

## States
- Standardne: pildid laisklaaditud; külgmenüü alla 5 jaotise ei teki (jaotised nummerdatakse CMS-i sort järgi).

## Copy (Estonian, draft)
- H1: "Hindamisaktid metsa- ja põllumaale" · "Hindamisakti koostamise hind" → "Alates 480 € + km. Lõpphind sõltub kinnistute arvust ja kaugusest." · "Hindamisakti tellimine" · "Saada tellimus e-postile" · "Ei tea, kas akt on sul vaja? Kirjuta — vastame 1 tööpäevaga."

## SEO & analytics
- Title: "Hindamisaktid — metsa ja põllumaa hindamisakt | Eametsad"; desc: "hindamisakt, maa hindamine, metsa hindamisakt, alates 480 €".
- JSON-LD: `Service` (offers: 480 EUR + KM) + `BreadcrumbList`.
- Sündmused: `sidenav_click{section}`, `mailto_click`, `copy_email_click`, `price_section_view`, `lead_form_submit_start/complete`.

## Accessibility & performance
- Külgmenüü on `<nav aria-label="Jaotised">`; numbrid ka klaviatuuril navigeeritavad; `scroll-margin-top`.
- Mobiilis kiip-riba ei varja sisu: `scrollIntoView({block:'nearest'})`, fookuse haldus mitte sundivat.
- Hinna tabel loetav ka suurendusega (rem-põhine); "480 €" ei ole ainult pildil.
- Kõik jaotised ühes HTML-is (server-renderdus) — külgmenüü on ainult navigatsioon.

## Analytics detail
- `sidenav_click` mõõdab ka esmast leitud jaotist: kui enamik kasutajaid jõuab otse `#hind` (otsingust), kaaluge hinna tõstmist lehe üles.

## Open questions
- Tellimine ainult e-postile või ka LeadForm kaudu CRM-i eraldi staatusega (soovitus: Phase 2 viia vorm-põhiseks tellimuseks)?
- Hindamisakti e-posti aadressi lõplik kuju (aliased vs üldine).

## Dependencies & change log
- Sõltub: 00-global-shell (kate, LeadForm, CookieBanner), README tokenid.
- Muudatused: v1 2026-08-27 (esimene draft).
- Seotud admin: admin/09-leads-crm (vormi esitused), admin/11-cms-content (sisu).
- Metoodika rõhutab oma oksjonite andmeid — konkurentsieelis, mida viitel kahtlustatakse.
- AI-inventuuri mainimine kooskõlastatud kliendiga (täpsusväited!).
- Hind 480 € + km on CMS-i väli, mitte kood.
- Hindamisaktide tellimuse võimalik areng vormipõhiseks Phase 2.
- Tellimise e-posti aadress: alias või üldine (vt Open questions).
