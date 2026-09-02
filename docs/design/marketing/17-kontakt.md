# Kontakt — Contact

> **In brief:** Contact page: company details, location and enquiry form.
| Area | marketing |
|---|---|
| **Route** | `/kontakt` |
| **Access** | public |
| **In nav** | jalus + KKK "Ei leidnud vastust?" + globaalne ContactBand CTA siia kui lehel vormi pole |

## Purpose & user goals
Küsimusega või hooldusprobleemiga tulnud kasutaja leiab ettevõtte andmed, spetsialistid, kaardi ja esitab LeadFormi. Eraldi kanalid: müük vs üldine vs press (draft).

## Wireframe (desktop)

```
┌──────────────────────────────────────────────────────────────────────┐
│ HERO: H1 "Võta ühendust" + lühintro                                   │
├──────────────────────────────────────────────────────────────────────┤
│ [5-col]                                 │ [7-col LEADFORM #1 Card]   │
│  ETTEVÕTE (nimi, registrikood, KMKR,   │  nimi, telefon, email,     │
│   aadress, telefon, e-post, avatus?)   │  katastrinumber,           │
│  OTSED numbrid (Müük / Üldine)         │  ☐ nõusolek, [SAADA]       │
│  SPETSIALISTID MINI (3 kaarti)         │                            │
├──────────────────────────────────────────────────────────────────────┤
│ KAAPARD: Leaflet kaart + Maa-amet ortofoto, marker + linke           │
│  [Vaata Google Mapsis] [Ava Maa-ameti kaardil]                       │
├──────────────────────────────────────────────────────────────────────┤
│ ContactBand + Footer                                                 │
└──────────────────────────────────────────────────────────────────────┘
```
**Mobiil:** ettevõtte plokk ja vorm vahetavad järjekorda — vorm kohe H1 järel; kaart täislaius 260px kõrgusel; spetsialistide mini-kaardid horisontaalne scroll.

## Block-by-block spec
1. **Hero** — H1 (draft) "Võta ühendust"; intro: "Kirjuta või helista — vastame 1 tööpäeva jooksul."
2. **Ettevõtte plokk (vasak)** — sama `Card` komponent mis 13-meist plokis 2 (juriidiline nimi, registrikood, KMKR, aadress, telefon, e-mail; andmed CMS globaalsest seadistusest — üks allikas). Täiendus: kaks otsecentral numbrit (kohatäited): **Müük ja konsultatsioon** `[+372 XXX XXXX]` (tel:) ning **Üldine / tehniline abi** `[+372 XXX XXXX]`.
3. **Spetsialistide mini-rida** — 3 `SpecialistCard` (mini: foto, nimi, telefon) → `/meist/metsaspetsialistid`. Draft-lõik: "Ei tea, kelle poole pöörduda? Helista üldnumbrile — suuname õige inimese juurde."
4. **LeadForm #1** (`kontakt-1`, `#kontaktvorm`) — täis LeadForm (vt 00). All väike tekst: press ja koostöö → `press@erametsad.ee` (kohatäide).
5. **Kaardiplokk** — `MapEstonia` (Leaflet + Maa-ameti ortofoto/WMS, vt README): üks kontorimarker; juhtnupud: klõps markerile → infoaken (aadress, link Maa-ameti kaardile ja Google Mapsi → `target=_blank rel=noopener`). Kaardil `loading="lazy"`, ei laadi kuni vaatevälja jõudmiseni (jõudlus). Interaktiivne kaart ei ole mobiilis lukus (üks sõrm puutetundlik).
6. **ContactBand** — siin lehel sama sisu, aga CTA-link `#kontaktvorm` (ei välju lehelt).

## Interactions & edge cases
- Vormi eesmärk on müügijuhtlõime — tehniliste probleemide jaoks viide "tehniline abi" numbrile (ei pea vormi kasutama).
- Kaart ei laadi (CDN tõrge) → staatiline kaardipilt (CMS-is üles laaditud) + aadress tekstina — mitte tühi plokk.
- Avatusajad pole avaldatud (ei pea) — otsus kliendile; kui lisatakse, siin kohal.

## Data & API
- Ettevõtte andmed: CMS `Settings` globaalne (sama mis 13/16).
- Spetsialistid: `GET /api/specialists?limit=3&featured=true`.
- Vorm: `POST /api/leads`, `form_name=kontakt-1` — CRM-is markeeritud kanal "kontakt" (vt admin/09).
- Kaart: Leaflet + LMV WMS (vt ERAMETSAD-PLAN §10 — soovitus Leaflet + Maa-amet, Google fallback).

## States
- Vormi edu: `Toast` + `EmptyState` edu ("Aitäh! Võtame ühendust 1 tööpäeva jooksul.") — vormi ei näidata uuesti (v.a "Saada veel" link).
- Kaardi API tõrge → staatiline fallback (vt ülal).
- Spetsialistid 0 → plokk peidetud.

## Copy (Estonian, draft)
- H1: "Võta ühendust" · "Vastame 1 tööpäeva jooksul." · "Müük ja konsultatsioon" · "Üldine ja tehniline abi" · "Ei tea, kelle poole pöörduda?" · "Press ja koostöö" · kaardi lingid: "Vaata Google Mapsis", "Ava Maa-ameti kaardil".

## SEO & analytics
- Title: "Kontakt | Erametsad"; desc: telefon, e-mail, aadress (NAP konsistents jalusega).
- JSON-LD: `Organization` (kontaktPunkt: Müük, Teenindus; `ContactPoint` telefonid) — see on lehe peamine rikastus.
- Sündmused: `lead_form_submit_start/complete`, `phone_click{sales|general}`, `email_click`, `specialist_mini_click{name}`, `map_marker_click`, `map_outbound_click{google|maaamet}`.

## Accessibility & performance
- Kaardi marker klaviatuurilt keskendatav; infoaken sulgub `Esc`-ga.
- Telefonid/e-mailid on lingid (`tel:`, `mailto:`) — mobiilis üks klõps.
- Kaart laisk (`loading="lazy"` + IntersectionObserver init) — ei aeglusta LCP-d.

## Open questions
- Pressie-posti aadress ja telefonide lõplikud numbrid (kohatäited).
- Kas näidata füüsilist külastusaadressi kaardi all (juriidiline vs külastusaadress erinevad?) — kliendi sisend.

## Dependencies & change log
- Sõltub: 00-global-shell (kate, LeadForm, CookieBanner), README tokenid.
- Muudatused: v1 2026-08-27 (esimene draft).
- Seotud admin: admin/09-leads-crm (vormi esitused), admin/11-cms-content (sisu).
- Kaart: Leaflet + Maa-amet LMV ortofoto (Google fallback, vt plan §10).
- Kontakti lehe Organization JSON-LD on kogu saidi kontakti rikastuse allikas.
- Kaardi staatiline fallback (CMS-i pilt) CDN-tõrke korral.
- Pressie-posti aadress ja lõplikud numbrid: kliendi kohatäited.
- Telefonid/e-mailid lingituna (tel:/mailto:) — üks klõps mobiilis.
