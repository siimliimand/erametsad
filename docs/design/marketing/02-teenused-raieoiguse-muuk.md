# Raieõiguse müük oksjonil — Cutting-right sale service page
| Area | marketing |
|---|---|
| **Route** | `/teenused/raieoiguse-muuk` |
| **Access** | public |
| **In nav** | "Metsa müümine" → 1. item |

## Purpose & user goals
Metsaomanik, kellel on kehtiv metsamajanduskava ja/või metsateatis, saab aru täielikust müügiprotsessist (9 sammu), teenustasust (3% + km) ja ostjate eelkontrollist, ning jätab kontakti.

## Wireframe (desktop)

```
┌──────────────────────────────────────────────────────────────────────┐
│ HERO: H1 + intro        [Btn: Tutvu raieõiguste oksjonitega]         │
│                         [Btn-sec: Tutvu kinnistute oksjonitega]      │
├──────────────────────────────────────────────────────────────────────┤
│ LEADFORM #1 (2 veergu: "Müü raieõigus mõistlikult" + vorm)           │
├──────────────────────────────────────────────────────────────────────┤
│ 9-SAMMULINE AKORDIONEON (Accordion)                                  │
│ ── H2 Eeltöö ──────────────────────────────────────────────────────  │
│  ▸ 1. Vaatame sinu metsa üle      ▸ 2. Paneme paiku hinna           │
│  ▸ 3. Valmistame dokumendid ette                                      │
│ ── H2 Oksjon (#oksjon) ────────────────────────────────────────────  │
│  ▸ 4. Avalikustame oksjoni   ▸ 5. Teavitame ostjad   ▸ 6. Pakkumised │
│ ── H2 Tulemus (#tulemus) ─────────────────────────────────────────  │
│  ▸ 7. Kinnitame tulemuse  ▸ 8. Sõlmime lepingu  ▸ 9. Jälgime tööd    │
├──────────────────────────────────────────────────────────────────────┤
│ TASU & VASTUTUS (2 Card'i)                                           │
├──────────────────────────────────────────────────────────────────────┤
│ OSTJATE EELKONTROLL (trust: garantiid, arv, kuidas kontrollime)      │
├──────────────────────────────────────────────────────────────────────┤
│ ContactBand + Footer                                                 │
└──────────────────────────────────────────────────────────────────────┘
```
**Mobiil:** hero CTAd virn; vorm täislaius; akordioneoni rühmad → üks vertikaalne nummerdatud nimekiri (sammud avanevad klõpsuga, numbritähist jäetakse alles); tasu/vastutus kaardid virna.

## Block-by-block spec
1. **Hero** — foto + overlay, H1, intro (draft): "Raieõiguse oksjonil müük tekitab ostjate vahel konkurentsii ja tagab saagi tegeliku turuväärtuse." Kaks CTA-d → `oksjonid.eametsad.ee/raie` ja `/kinnistud`. Ilma vormita (vorm kohe all).
2. **LeadForm #1** (`raieoiguse-muuk-1`, ankur `#kontaktvorm`) — vasakul veerulõik "Müü raieõigus mõistlikult" + 3 eelist (tasuta hindamine; tasu ainult eduka tehingu korral; hallatud kogu protsess).
3. **9-sammuline akordioneon** — `Accordion` kolmes grupis; iga rida = number (ring `--primary`-iga) + pealkiri (nupp, `aria-expanded`); avanedes H3 + 2 lõiku. Algne olek: kõik suletud (deep-link `#eeltöö/#oksjon/#tulemus` avab vastava grupi ja scrollib).
   - **Eeltöö:** 1. "Vaatame sinu metsa üle" (tasuta välitöö, takseeri kontroll) · 2. "Paneme paika alghinna" (hinna kujunemine: puuliigid, maht, väljavedu, turg) · 3. "Valmistame dokumendid" (kava, metsateatis, lepingu eelkontroll).
   - **Oksjon:** 4. "Avalikustame oksjoni" (portaalis, foto+kaart+takseer) · 5. "Teavitame ostjate võrgustikku" (e-mail + SMS) · 6. "Pakkumised konkureerivad" (klassikaline tõusev oksjon, samm, autonoomne pakkumine, alapakkumise selgitus).
   - **Tulemus:** 7. "Kinnitame tulemuse" (võiduteatis, tasu 3% + km võiduhinnast) · 8. "Sõlmime lepingu" (oksjonileping, makse- ja raietingimused) · 9. "Jälgime tööde õigsust" (raie- ja väljaveo tähtajad; Eametsad vastutab protsessi korrektsuse eest).
4. **Tasu & vastutus** — 2 `Card`: (a) "Mis see maksab?" — teenustasu 3% + km lõpphinnast; **tasu 0 €, kui oksjon ei õnnestu** (piiramata korduskatsed); (b) "Meie vastutus" — vastutame korraldatavate tööde ja protsessi õigsuse eest; müüja ei pea kohale tulema.
5. **Ostjate eelkontroll** — H2 "Kes sinu metsale pakkumist teeb?" — tekst: iga ostja läbib eelkontrolli (äriregistri kontroll, maksevõime, varasem tehingute ajalugu); personaalsed garantiid; kõik pakkumised anonüümsed. Numbriline foon: "N kontrollitud raieõiguse ostjat" (API statistikast).

## Interactions & edge cases
- Grupipealkirjad on ankru sihtpunktid (nii avalehe protsessiveerg kui footer).
- Klaviatuur: nooled üles/alla akordioneonis, `Home/End` esimene/viimane samm (WAI-ARIA accordion pattern).
- Ainult 1 sammu rühmas avatud korraga? Ei — lubatud mitu avatud (kasutaja saab võrrelda).

## Data & API
- Kogu sisu CMS-ist (`Page` block builder + `Accordion` plokk); sammud sisestatavad admin/11-s.
- Statistika ostjate kohta: `GET /api/v1/statistics` (ISR 24h).
- Vorm: `POST /api/leads`, `form_name=raieoiguse-muuk-1`.

## States
- Statistika kättesaamatu → näita viidet "üle 200 kontrollitud ostja" (fallback staatiline).
- Vormi vead: inline, `--danger`, fookus esimesele veaväljale.

## Copy (Estonian, draft)
- H1: "Raieõiguse müük oksjonil" · "Tutvu raieõiguste oksjonitega" · "Tutvu kinnistute oksjonitega" · "Mis see maksab?" → "Teenustasu on 3% käibemaksuga lõpphinnast. Kui oksjon jääb müümata, ei maksa sa midagi." · "Konsultatsioon ja metsa ülevaatus on alati tasuta."

## SEO & analytics
- Title: "Raieõiguse müük oksjonil | Eametsad" (draft); desc mainigu "raieõigus, metsa müük, oksjon, 3% teenustasu, tasuta hindamine".
- JSON-LD: `Service` + `FAQPage`-väli pole (KKK eraldi); `BreadcrumbList` Teenused → Raieõigus.
- Sündmused: `accordion_step_open{step_index, group}`, `hero_cta_click{target}`, `lead_form_submit_start/complete`, `outbound_click{raie|kinnistud}`.

## Accessibility & performance
- Akordioneon: ARIA `aria-expanded`/`aria-controls`, nooleklahvid, nähtav fookus (`outline 2px --accent`).
- Kontrast: intro valgel taustal `--ink`; hero overlay tagab ≥4.5:1 valge tekstiga.
- Hero foto `fetchpriority=high`, ülejäänud pildid lazy; LCP siht <2,5s.
- Sisu ISR 1h — kiire cache-hit.

## Open questions
- Kas lisada hindamisakti/apakettide ristilink ploki 4 juurde (viide /hindamisaktid)?

## Dependencies & change log
- Sõltub: 00-global-shell (kate, LeadForm, CookieBanner), README tokenid.
- Muudatused: v1 2026-08-27 (esimene draft).
- Seotud admin: admin/09-leads-crm (vormi esitused), admin/11-cms-content (sisu).

