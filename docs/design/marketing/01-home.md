# Avaleht — Homepage

> **In brief:** The landing page — what Erametsad offers, live auctions, trust stats, and how to get in touch.
| Area | marketing |
|---|---|
| **Route** | `/` |
| **Access** | public |
| **In nav** | logo/kodu ikoon; kõik harud |

## Purpose & user goals
Metsaomanik, kes kaalub metsa müüki, peab 10 sekundiga aru saama, mida Erametsad pakub (oksjonimüük, tasuta konsultatsioon), nägema elavaid oksjoneid ja saama jätta kontakti. Teine sihtgrupp — ostja — suunatakse portaali.

## Wireframe (desktop)

```
┌──────────────────────────────────────────────────────────────────────┐
│ HERO (foto 16:10 + --primary-dark gradient overlay)                   │
│ H1: [draft]        ┌────────────────────────────┐                     │
│ intro 2-3 lauset   │  LEADFORM #1 (Card)        │                     │
│ [Btn: Vaata oksjoneid] [Btn-sec: Oksjonite ajalugu] │                │
│                    └────────────────────────────┘                     │
├──────────────────────────────────────────────────────────────────────┤
│ "PLAANIS METSA MÜÜKI?" band (--bg-mist, 2 veergu: tekst + Btn)       │
├──────────────────────────────────────────────────────────────────────┤
│ AUCTIONTICKER: 4 LotCard'i (kataster, ha, Countdown, → portaal)      │
├──────────────────────────────────────────────────────────────────────┤
│ MEIE KOLLEKTIIIV: 3-4 SpecialistCard'i (mini) + link Meist           │
├──────────────────────────────────────────────────────────────────────┤
│ USALDUSSTATISTIKA: 3 suurt arvu (ostjad / kinnistud / müüdud €)      │
├──────────────────────────────────────────────────────────────────────┤
│ PROTSESS 3 veergu: Eeltöö | Oksjon | Tulemus (3 tulenegu sügavlink)  │
├──────────────────────────────────────────────────────────────────────┤
│ VIIMATI ARTEKLITEST: 3 Card'i + "Vaata kõiki uudiseid"               │
├──────────────────────────────────────────────────────────────────────┤
│ UUDISKIRI: email + nupp (double opt-in)                               │
├──────────────────────────────────────────────────────────────────────┤
│ KLIENDILOOD: 3-4 tsitaadi kaarti (Testimonial)                        │
├──────────────────────────────────────────────────────────────────────┤
│ LEADFORM #2 "Soovid konsultatsiooni?"  (#kontaktvorm)                │
└──────────────────────────────────────────────────────────────────────┘
```
**Mobiil:** hero foto → H1/intro → CTAd → vorm (ühe veeruna); ticker horisontaalne scroll-sulg (`overflow-x`, snap); protsess → vertikaalne nummerdatud nimekiri; artiklid 1 kaart + nool.

## Block-by-block spec
1. **Hero** — täislaius foto, overlay `linear-gradient(90deg, rgba(22,56,42,.85), rgba(22,56,42,.35))`. Vasak: H1 (48px), intro, `Btn` "Vaata aktiivseid oksjoneid" → portaal, `Btn-secondary` "Oksjonite ajalugu". Parem: `LeadForm` Card (form_name `avaleht-1`), pealkiri "Tasuta konsultatsioon".
2. **"Plaanis metsa müük?"** — `--bg-mist` band: lühitekst konsultatsioonist (tasuta, kohustuseta) + `Btn` "Räägime detailsemalt" → `#kontaktvorm`.
3. **AuctionTicker** — 4 viimast aktiivset `LotCard`: katastrinumber, pindala ha, `Countdown`, `StatusPill` (active `#2E9E5B`), link `oksjonid.erametsad.ee/<tüüp>/<id>`. Andmed build-ajal + kliendipoolne värskekus 60s (vt Data). Kui aktiivseid pole → tühi olek vt States.
4. **Kollektiiv** — 4 `SpecialistCard` (foto, nimi, roll, "Kirjuta" link) → `/meist/metsaspetsialistid`.
5. **Usaldusstatistika** — 3 numbrit `--primary-dark` taustal, valge Manrope 48px: "kontrollitud ostjat", "metsakinnistute ostjat", "kokku müüdud (€)" — reaalarvud andmebaasist.
6. **Protsess 3 veergu** — `Card`id H3-ga Eeltöö / Oksjon / Tulemus, 3 lühipunkti; iga veeru pealkiri süvalingina `/teenused/raieoiguse-muuk#eeltöö|#oksjon|#tulemus`.
7. **Viimased artiklid** — 3 `Card` (kuupäev, kategooria, pealkiri, thumbnail 16:10) → `/artiklid/<slug>`; link "Vaata kõiki".
8. **Uudiskiri** — `FormInput` email + `Btn` "Liitun uudiskirjaga"; `POST /api/newsletter` → kinnituskiri (double opt-in), `Toast` "Kontrolli posti — saatsime kinnitussõnumi."
9. **Kliendilood** — 3–4 `Testimonial` kaarti (tsitaat, nimi, maakond). Ilma tärnihinnanguta.
10. **LeadForm #2** (`avaleht-2`, ankur `#kontaktvorm`) + järgneb globaalne ContactBand + footer.

## Interactions & edge cases
- Tickeri kaardi hover: tõus 2px + vari süveneb; countdown värskeneb serveri ajast (drift-korrektsoon).
- Uudiskiri: juba liitunud e-mail → sõbralik teade "Oled juba listis" (ei paljasta uue kasutaja poolt teise isiku olemasolu üldsõnalise vastusega — õigustatud erand UX-i jaoks, DNS-i turvalisus OK).
- H1 alla `Btn`-d: esimene `cta` (amber), teine `secondary`.

## Data & API
- Ticker: `GET /api/auctions?status=active&limit=4&sort=end_time_asc` — SSG buildis + `Cache-Control: s-maxage=60`; komponendis intervalliga re-fetch, kui analüütika-nõusolek ei ole vajalik (fetch ei sõltu nõusolekust).
- Statistika: `GET /api/v1/statistics` (kokkuvõte: vetted_buyers, property_buyers, total_eur) — ISR 24h.
- Artiklid: CMS `Article` (3 uusimat, `publish_date desc`).
- Formid: `POST /api/leads` (vt 00 LeadForm), `POST /api/newsletter`.

## States
- Oksjoneid pole: tickeri asemel infokaart "Hetkel pole avatud oksjoneid — telli teavitus" + link portaali teavitustele.
- Statistika API ei vasta: peida plokk (ei näita 0-sid).
- Artikleid < 3: näita mis on; 0 → plokk peidetud.

## Copy (Estonian, draft)
- H1: "Sinu mets, õigem hind." (draft) · intro: "Müü raieõigus või metsakinnistu oksjonil, kus konkureerivad pakkumised tagavad turuhinna. Konsultatsioon on tasuta." · "Vaata aktiivseid oksjoneid" · "Oksjonite ajalugu" · "Plaanis metsa müük? Räägime läbi, ilma kohustusteta." · "Tasuta konsultatsioon" · "Soovid konsultatsiooni? Jäta meile enda andmed." · "Liitun uudiskirjaga" · "Vaata kõiki uudiseid".

## SEO & analytics
- Title: "Erametsad — metsa ja raieõiguse müük oksjonil" (draft); description must include "metsa müük, raieõigus, metsaoksjon, metsakinnistu".
- JSON-LD: `Organization` (nimi, aadress, kontakt, sameAs sotsiaalvõrgud).
- Sündmused: `lead_form_submit_start/complete{form_name}`, `cta_click{hero_primary|hero_secondary}`, `newsletter_submit`, `ticker_card_click{lot_id}`, `article_card_click{slug}`, `process_column_click{column}`.

## Open questions
- Kas statistikaplokki näidata avalehel arvude või ka võrdlusgraafikuga (vt admin/12)?
- Hero foto: klient tarnib või pildipank (lahendada Phase 0 disainis).
