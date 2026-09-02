# KKK — FAQ hub + 7 kategooria lehte

> **In brief:** The FAQ hub with seven category pages and expandable answers.
| Area | marketing |
|---|---|
| **Route** | `/kkk` (hub) + `/kkk/{oksjonid,myyk,hind,tulumaks,metsaandmed,raie,metsauhistu}` |
| **Access** | public |
| **In nav** | "KKK" (dropdown 7 kategooriaga) |

## Purpose & user goals
Kõigi küsimustega (oksjoni mehaanika, müük, hind, tulumaks, andmed, raie, ühistu) tulevad kasutajad saavad vastused sekundiga; vähendab kõnesid ja tõstab SEO-d (FAQPage rich results). KKK lehtedel **pole** LeadFormi (nagu viitel) — külglink portaali ja Kontaktile.

## Wireframe (desktop)

```
┌──────────────────────────────────────────────────────────────────────┐
│ H1 "Korduma kippuvad küsimused" + otsinguväli (lihtne tekstifilter)  │
├──────────────────────────────────────────────────────────────────────┤
│ KIIP-NAV: [Oksjonid] [Müük] [Hind] [Tulumaks] [Metsaandmed]          │
│           [Raie] [Metsaühistu]   ← aktiivne --primary täis           │
├──────────────────────────────────────────────────────────────────────┤
│ ┌────────────────────────────────────────────────────────────────┐   │
│ │ ▸ K: Miks müüa mets oksjonil?          (teaser 1 lause)       │   │
│ │    [Loe edasi…] → täisvastus (Accordion, avaneb)              │   │
│ │ ▸ K: Kuidas raieõiguse oksjon käib?                           │   │
│ │ ▸ K: …                                                       │   │
│ └────────────────────────────────────────────────────────────────┘   │
├──────────────────────────────────────────────────────────────────────┤
│ "Ei leidnud vastust?" → /kontakt link                                │
├──────────────────────────────────────────────────────────────────────┤
│ ContactBand + Footer                                                 │
└──────────────────────────────────────────────────────────────────────┘
```
**Mobiil:** kiibid horisontaalne scroll; akordioneon täislaius; otsing nähtaval kohe H1 all.

## Block-by-block spec
1. **Hub `/kkk`** — H1, lühintro, otsinguväli (kliendipoolne filter kõigi 7 kategooria küsimuste pealkirjade+teaselite peal; tulemusena kategooria + küsimuse rida, klõps viib `/{kategooria}#q-{slug}` ja avab akordioneoni).
2. **Kiip-kategooria nav** — 7 kiipi (draft nimed: "Oksjonid", "Müük", "Hind", "Tulumaks", "Metsaandmed", "Raie", "Metsaühistu"); aktiivne `--primary` valge tekstiga, ülejäänud outline. Hubil ükski pole aktiivne.
3. **Kategooria leht `/kkk/<kategooria>`** — sama kate + kiip-nav; H2 kategooria nimi; `Accordion` elementidest:
   - iga element: küsimus (nupp), teaser (1 lause, alati nähtav), `Loe edasi…` → avab täisvastuse (H3 + lõigud + vajadusel lingid teenusele/kategooriatele).
   - CMS mudel `FAQCategory → FAQItem(question, teaser, answer, sort)` (ERAMETSAD-PLAN §4.5).
   - Kategooriate sisu (draft teemad): **Oksjonid** — kuidas oksjon käib, mis on edukas oksjon, mida tehakse kui oksjon ebaõnnestub (müüjale maksust puudub, uus katse), miks mõned firmad oksjonit väldivad; **Müük** — kuidas alustada, mis dokumendid vaja, kas kaugelt müüa (e-notar); **Hind** — kuidas hind kujuneb, kas tasuta hindamine; **Tulumaks** — kas oksjonitulust tuleb tulumaks, metsa kasutushüvitis (viide Maksu- ja Tolliameti lehele, draft-juriidiline hoiatus); **Metsaandmed** — kust näen takseerandmeid, kataster, metsaportaal; **Raie** — raieliigid, metsateatis (link juhendile 05); **Metsaühistu** — üldised liikmelisuse küsimused → viide `metsauhistu.erametsad.ee`.
4. **"Ei leidnud vastust?"** — lühikaart: kirjuta `/kontakt` või helista (ContactBand numbrid).

## Interactions & edge cases
- Akordioneon: üks avatud korraga (erinevalt teenuselehe omast — siin loetavus eesmärgil), `Loe edasi…` ja küsimuserida mõlemad avajad.
- Otsing: tühi → kõik; tähtede ignoreerimine; min 2 tähemärki; mitte midagi → `EmptyState` "Ei leidnud — proovi teist sõna või kirjuta meile".
- URL-ankru `#q-slug`ga saabumine avab konkreetse vastuse (toetus spetsialisti kõnedele — saadetav link!).

## Data & API
- CMS: `FAQCategory`, `FAQItem`; SSG + ISR 1h.
- Otsing toimub kliendipoolsete andmete peal (kogu KKK < 200 elementi — ei vaja API-d).

## States
- Tühi kategooria → `EmptyState` + viide kontaktimeilile (mitte tühi leht).
- Otsingu 0 vastet → `EmptyState` (vt ülal).

## Copy (Estonian, draft)
- H1: "Korduma kippuvad küsimused" · "Otsi küsimust…" (placeholder) · "Loe edasi…" · "Ei leidnud vastust? Kirjuta meile või helista."

## SEO & analytics
- Title (hub): "KKK | Erametsad"; (kategooria): "KKK — <kategooria> | Erametsad". Desc sisaldab kategooria märksõnu.
- **JSON-LD `FAQPage`** igal kategooria lehel (küsimus + täisvastus, teaserist ei piisa) — hoitakse Google'i nõuete piires (mitte reklaam, ei logi sisse).
- Sündmused: `faq_search{query_lenght_buckets}`, `faq_search_zero`, `chip_category_click{category}`, `faq_open{question_slug}`, `faq_deep_link_view`, `contact_fallback_click`.

## Accessibility & performance
- Akordioneon ARIA `button/region` muster; aktiivne kiip `aria-current="page"`.
- Otsinguväli `role="search"` + tulemuste `aria-live="polite"` teavitus.
- Kogu KKK HTML ühes lehes (SSG) — kliendipoolne filter ei vaja API-kutset; kiiruse siht <100ms filterreaktsioon.

## Sisuhaldus
- KKK sisu sisestab/haldab admin CMS-is (admin/11); iga vastuse saab määrata "kuvatakse kuni" kuupäeva (nt tulumaksu muudatused).

## Open questions
- Tulumaksu vastuste juriidiline kontroll (koostöö kliendi juristiga) enne avaldamist.
- Kas 7. kategooria (Metsaühistu) ilmub alles Phase 5-ga ja KKK kate seda siis varjab?

## Dependencies & change log
- Sõltub: 00-global-shell (kate, LeadForm, CookieBanner), README tokenid.
- Muudatused: v1 2026-08-27 (esimene draft).
- Seotud admin: admin/09-leads-crm (vormi esitused), admin/11-cms-content (sisu).
- FAQPage JSON-LD võib rikastada otsingutulemusi — vastused peavad olema lõplikud.
- Tulumaksu vastused: juriidiline eelkontroll kohustuslik.
- 7 kategooria URL-id: oksjonid, myyk, hind, tulumaks, metsaandmed, raie, metsauhistu.
