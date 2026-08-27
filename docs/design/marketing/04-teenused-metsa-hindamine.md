# Metsa väärtuse hindamine — Valuation SEO-article page (+ SEO-artikli mall)

> **In brief:** A long-form article on what determines forest value — also the reusable template for other SEO pages.
| Area | marketing |
|---|---|
| **Route** | `/teenused/metsa-hindamine` |
| **Access** | public |
| **In nav** | "Metsa müümine" → 3. item |

## Purpose & user goals
Otsingumootorist tulnud omanik ("metsa hind", "kui palju mu mets väärt on") saab pikaformaadilise hariva artikli ja väljub läbi kontaktvormi tasuta konsultatsioonile. Käesolev fail **defineerib ka taaskasutatava SEO-artikli malli**, mida kasutavad `/metsa-hinna-kalkulaator`, `/taksaator`, `/tehingukeskus`, `/metsa-ost`, `/lageraie` jt. ~20 pika sabaga lehte (vt EAMETSAD-PLAN §4.1).

## Wireframe (desktop)

```
┌──────────────────────────────────────────────────────────────────────┐
│ HERO: H1 + sissejuhatus (kitsas, 8-col)                              │
├──────────────────────────────────────────────────────────────────────┤
│ AUCTIONTICKER (4 LotCard'i) — sama komponent nagu avalehel           │
├──────────────────────────────────────────────────────────────────────┤
│ LEADFORM #1 (#kontaktvorm)                                           │
├──────────────────────────────────────────────────────────────────────┤
│ ARTIKKEL (H2 jaotised, 8-col + 4-col kõrvalmenüü sisukord)           │
│  ## Kus sinu mets asub — asukoha mõju hinnale                        │
│  ## Mis saagi hind sisaldab — puuliigid ja mahud                     │
│  ## Ülestöötamise ja väljaveo kulud                                  │
│  ## Riskantsed lepinguvormid, mida vältida                           │
│  ## Õige aeg metsa müüa                                              │
│  ## Kuidas oksjon hinna kujundab                                     │
├──────────────────────────────────────────────────────────────────────┤
│ CTA-BÄND: "Konsultatsioon on tasuta" (--primary-dark)                │
├──────────────────────────────────────────────────────────────────────┤
│ LEADFORM #2                                                          │
└──────────────────────────────────────────────────────────────────────┘
```
**Mobiil:** ticker horisontaalselt skrollitav; sisukord peidetud (artikkel ise nummerdatud H2-d); vormid ühe veeruna.

## Block-by-block spec
1. **Hero** — väike foto või puhas `--bg-mist`; H1 48px; 2-lauseline sissejuhatus. Pilt kerge, et LCP < 2,5 s.
2. **AuctionTicker** — täpselt nagu avalehe plokk 3 (jälgitavus: kasutaja näeb kohe reaalseid lõpphindu). Otsene `01-home.md` viide, ei dubleeri spetsi.
3. **LeadForm #1** (`metsa-hindamine-1`, `#kontaktvorm`) + pealkiri "Tahad teada, kui palju sinu mets väärt on? Hindame tasuta."
4. **Pikaformaadiline artikkel** — rich text CMS-ist (`Article`/`Page` body). H2-jaotised (draft, kõik originaalsed, vt wireframe). Nõuded: 1 pilt iga 2 H2 tagant (16:10, lazy), võimalikud sisefailid (tabelid), lingid teenuselehtedele ja KKK kategooriatesse. 4-col kõrvalmenüü = automaatne sisukord H2 põhjal (sticky).
5. **CTA-bänd** — `--primary-dark` taust, valge tekst: "Meie konsultatsioon on tasuta. Ei ole kohustusi — vastame 1 tööpäeva jooksul." + `Btn`-cta → `#kontaktvorm-2`.
6. **LeadForm #2** (`metsa-hindamine-2`, ankur `#kontaktvorm-2`).

### SEO-artikli mall (taaskasutatav komponent/jaotis)
**Mall:** hero (H1 + sissejuhatus) → ticker → LeadForm #1 → artikli keha (H2 jaotised, min 800 sõna, sisukord >1024px) → CTA-bänd "Konsultatsioon on tasuta" → LeadForm #2 → ContactBand → footer.
**Taaskasutajad** (igaüks instantsieerib malli, erinevad H1/H2 ja form_name): `/metsa-hinna-kalkulaator` (H1 draft: "Metsa hinna kalkulaator — kuidas hinda arvutada"; NB: nagu viitelgi, ei ole see päris kalkulaator, vaid hariv artikkel + viide tasuta hindamisele), `/taksaator`, `/tehingukeskus`, `/metsa-ost`, `/raieoiguse-ost`, `/metsakinnistute-ost`, `/pollumaa-{ost,muuk,hind}`, `/maa-hindamine`, `/lageraie`, `/harvendusraie`, `/metsaraie-korraldaja`, `/metsaomanikule`, `/ise-oksjoni-korraldamine`, `/tingimused-ostjatele`, juhendi-artiklid (`/millal-on-vaja-raieluba` jne).
**Erand:** `/metsateatis` ja `/metsateatise-juhend` kasutavad hoopis juhendi-malli (vt 05-metsateatis.md — screenshot-tutorial + külgriba).
**Admin:** sisestatav ühe CMS-kogumikuga `SEOArticle(slug, h1, intro, body, cta_text, seo fields)`; mall on üks Next.js layout.

## Interactions & edge cases
- Sisukorra aktiivne jaotis rõhutatakse scroll-spies (IntersectionObserver) — kerge, analüütikast sõltumatu.
- Kui tickeril pole andmeid → nagu avalehe tühi-olek (link teavitusele).

## Data & API
- Ticker: `GET /api/auctions?status=active&limit=4` (sama cache kui avaleht).
- Artikli sisu: CMS ISR 1h.
- Vormid: `POST /api/leads` (form_name vastavalt lehele, nt `metsa-hinna-kalkulaator-1`).

## States
- Artikli pilt laadimata → aspect-ratio placeholder (`--bg-mist`), ei hüppa.

## Copy (Estonian, draft)
- H1: "Metsa väärtuse hindamine" · sissejuhatus: "Metsa hind ei ole üks number — see on asukoha, puuliikide, mahu ja kulude summa. Selgitame lahti, mis sinu metsa hinda tõstab ja mida langetab." · CTA: "Konsultatsioon on tasuta".

## SEO & analytics
- Title: "Metsa väärtuse hindamine — kuidas arvutada metsa hind | Eametsad"; desc + H2-d peavad katma vastavad otsingud ("metsa hind", "metsa hindamine", aastaarv pealkirjas kus asjakohane).
- JSON-LD: `Article` + `BreadcrumbList`. Sitemap-canonical kõikidel instantsidel (vältida dubleeringuid malliga).
- Sündmused: `toc_click{section}`, `read_progress{25|50|75|100}` (Plausible scroll-sündmus), `lead_form_submit_start/complete{form_name}`, `ticker_card_click{lot_id}`.

## Accessibility & performance
- Sisukorra lingid anchoritele `scroll-margin-top: 96px` (sticky header ei katta pealkirja).
- Artikli pildid `alt` kohustuslik (CMS-i valideerimine); laisklaadimine kõigile peale esimesele.
- Mastifailid (kui on) lazy iframe või allalaaditavad lingid — ei blokeeri renderdust.
- Sisu ISR 1h; ticker koos vormiga ilma CLS-ideta (reserveeritud kõrgused).

## Open questions
- Kas CTA-bändi tekst jääb kõigile SEO-lehtede instantsidele ühtseks või CMS-i sisestatav (soovitus: sisestatav, vaikeväärtus "Konsultatsioon on tasuta")?

## Dependencies & change log
- Sõltub: 00-global-shell (kate, LeadForm, CookieBanner), README tokenid.
- Muudatused: v1 2026-08-27 (esimene draft).
- Seotud admin: admin/09-leads-crm (vormi esitused), admin/11-cms-content (sisu).

