# Kinnistu müük oksjonil — Forest-property sale service page

> **In brief:** How selling a whole forest property works, including the sealed-bid (closed-envelope) method.
| Area | marketing |
|---|---|
| **Route** | `/teenused/kinnistu-muuk` |
| **Access** | public |
| **In nav** | "Metsa müümine" → 2. item |

## Purpose & user goals
Metsakinnistu (või põllumaa) omanik saab aru, kuidas kinnistu oksjon erineb raieõiguse müügist (suletud pakkumine, notar), mida protsess sisaldab ja kui palju maksab; jätab kontakti või tutvub aktiivsete kinnistuoksjonidega.

## Wireframe (desktop)

```
┌──────────────────────────────────────────────────────────────────────┐
│ HERO: H1 + intro  [Btn: Tutvu kinnistute oksjonitega]                │
│                   [Btn-sec: Tutvu raieõiguste oksjonitega]           │
├──────────────────────────────────────────────────────────────────────┤
│ LEADFORM #1 (#kontaktvorm)                                           │
├──────────────────────────────────────────────────────────────────────┤
│ 9-SAMMULINE AKORDIONEON (sama komponent nagu 02-failis, kinnistu-    │
│ tekstitusega): Eeltöö 1-3 / Oksjon 4-6 / Tulemus 7-9                │
├──────────────────────────────────────────────────────────────────────┤
│ PIMEPAKKUMINE SELGITUS (H2 + 2 veergu: skeem + tekst)                │
│   [Skeem: sulgedud ümbrikud → avamine → parim pakkumine]             │
├──────────────────────────────────────────────────────────────────────┤
│ PAKETTIDE OKSJONID: bänd + link                                      │
├──────────────────────────────────────────────────────────────────────┤
│ TASU & VASTUTUS (2 Card) · OSTJATE EELKONTROLL (trust)               │
├──────────────────────────────────────────────────────────────────────┤
│ ContactBand + Footer                                                 │
└──────────────────────────────────────────────────────────────────────┘
```
**Mobiil:** nagu 02; pimepakkumise skeem vertikaalseks ajajooneks (3 nummerdatud punkti).

## Block-by-block spec
1. **Hero** — H1 "Kinnistu müük oksjonil" (draft), intro: kogu metsakinnistu (või põllumaa) müük ühe tervikuna; notariaalne tehe. Kaks CTA-d → `oksjonid.erametsad.ee/kinnistud` ja `/raie`.
2. **LeadForm #1** (`kinnistu-muuk-1`, `#kontaktvorm`) — kõrvale 3 eelist (turuhind pakkumiste konkurentsii kaudu; ostjad eelkontrollitud; notar ja paberitoimingud korraldame).
3. **9-sammuline akordioneon** — sama `Accordion`-komponent ja ankrud (`#eeltöö/#oksjon/#tulemus`) nagu failis 02, kinnistutekstid (draft):
   - Eeltöö: 1. "Hindame kinnistu väärtuse" (tasuta lähtehind: takseer, asukoht, tee, sihtotstarve) · 2. "Kokkulepe tingimustes" (alghind/piirhind, kuupäevad) · 3. "Valmistame dokumendid" (kinnistusraamat, piirangud, notari andmed).
   - Oksjon: 4. "Avalikustame kinnistuoksjoni" · 5. "Teavitame kinnistuostjate võrgustikku" · 6. "Kogume suletud pakkumised" (vt plokk 4).
   - Tulemus: 7. "Avame pakkumised ja kuulutame võitja" · 8. "Notariaalne ostu-müügileping" (e-notar või kokkuleppel kohtumine) · 9. "Jälgime tehingu lõpuni" (kanded, maksmine, üleandmine).
4. **Pimepakkumine (suletud ümbriku meetod)** — H2 "Metsakinnistu oksjon toimub pimepakkumisena" (draft). Selgitus: kõik pakkumised esitatakse üheaegselt enne tähtaega; keegi (ka teised pakkujad) ei näe teiste summasid; tähtajal avatakse kõik korraga, võidab kõrgeim kehtiv pakkumine; võrdlus avatud (tõusva hinnaga) oksjoniga — väike tabel 2 veergu. VIIDE: portaalile `03-lot-detail-sealed.md` mehaanika detailide jaoks.
5. **Pakett-oksjonid** — `--bg-mist` bänd: "Sul on mitu kinnistut? Vaata pakettoksjonite võimalust" → `oksjonid.erametsad.ee/paketid` + mainitud ka `/teenused/raieoiguse-muuk` ristiviide.
6. **Tasu & vastutus** — 2 `Card`: 3% + km võiduhinnast; 0 € kui oksjon ei õnnestu; vastutus protsessi korrektsuse eest. **Ostjate eelkontroll** — nagu 02 plokk 5 ("N kinnistute ostjat eelkontrollitud").

## Interactions & edge cases
- Süvalingid `/teenused/kinnistu-muuk#eeltöö` jne toimivad (avalehe protsessiveerud suunavad raieõiguse lehele — kinnistu versioon kasutab samu ankruid).
- Võrdlustabelis liikumine klaviatuuriga, tabelil `<caption>` (a11y).

## Data & API
- CMS `Page` + `Accordion` (sammud eraldi sisukirjega kinnistute jaoks — ei jagata raieõiguse lehe tekstega, on eraldi sisu).
- Statistika `GET /api/v1/statistics` (kinnistute ostjate arv).
- Vorm `POST /api/leads`, `form_name=kinnistu-muuk-1`.

## States
- nagu failis 02 (statistika fallback, vormi veaolekud).

## Copy (Estonian, draft)
- H1: "Kinnistu müük oksjonil" · "Pimepakkumine ehk suletud pakkumine tähendab, et keegi ei tea teiste pakkumisi enne avamist — parim hind ei ole nähtav ja iga ostja motiveeritud pakkuma maksimaalselt." · "Sul on mitu kinnistut? Pakettoksjon liidab huvilised ühte." · "Tutvu kinnistute oksjonitega".

## SEO & analytics
- Title: "Metsakinnistu müük oksjonil | Erametsad"; desc: "metsakinnistu, põllumaa, pimepakkumine, suletud pakkumine, oksjon, notar".
- JSON-LD: `Service`, `BreadcrumbList`.
- Sündmused: `accordion_step_open{step_index, group}`, `sealed_explainer_engage` (tabeli lahtikaardistamine mobiilis), `package_band_click`, `lead_form_submit_start/complete`, `outbound_click{kinnistud|raie|paketid}`.

## Accessibility & performance
- Võrdlustabel: `<th scope>`, `caption`, mobiilis kaardistatud read (CSS `display:block` + data-label).
- Akordioneon ARIA pattern nagu 02-failis; numbrid nähtavad ka klaviatuuril navigeerides.
- Skeem (pimepakkumise selgitus) on dekoratiivne SVG `aria-hidden` — sisu kordub tekstina.
- Hero foto `fetchpriority=high`; ülejäänud laisk.

## SEO lisamärkus
- Pimepakkumise jaotis kandub `Service` JSON-LD `description`-isse — katab otsingu "suletud pakkumine metsakinnistu".

## Open questions
- Kas põllumaa müük saab eraldi alamlehe või jääb siia sisse (viites sai eraldi `/pollumaa-muuk` SEO-leht — otsus Phase 1)?

## Dependencies & change log
- Sõltub: 00-global-shell (kate, LeadForm, CookieBanner), README tokenid.
- Muudatused: v1 2026-08-27 (esimene draft).
- Seotud admin: admin/09-leads-crm (vormi esitused), admin/11-cms-content (sisu).
- Pimepakkumise detailmehaanika: portal/03-lot-detail-sealed.md.
