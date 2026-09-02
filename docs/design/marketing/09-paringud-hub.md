# Teenuste päringud — Service-request hub

> **In brief:** Entry point to three service-request forms that are forwarded to partner companies.
| Area | marketing |
|---|---|
| **Route** | `/paringud` |
| **Access** | public |
| **In nav** | "Päringud" (dropdown 3 alamlehega) |

## Purpose & user goals
Omanik, kes vajab metsamajanduskava, hooldusraiet või istutamist, mõistab päringute turu mudelit (päring edastatakse partnerfirmadele, kes esitavad pakkumise 7 päeva jooksul) ja valib teenusekaardi.

## Wireframe (desktop)

```
┌──────────────────────────────────────────────────────────────────────┐
│ HERO: H1 "Teenuste päringud" + selgitus (mudel, 7 päeva lubadus)     │
├──────────────────────────────────────────────────────────────────────┤
│ 3 TEENUSEKAARDI (Card, 3 veergu):                                    │
│ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐                │
│ │ 📋 Metsa-     │ │ 🌳 Hooldus-   │ │ 🌱 Metsa       │                │
│ │ majanduskava  │ │ raie          │ │ istutamine     │                │
│ │ tekst 2rida   │ │ tekst 2rida   │ │ tekst 2 rida   │                │
│ │ [Esita päring]│ │ [Esita päring]│ │ [Esita päring] │                │
│ └───────────────┘ └───────────────┘ └───────────────┘                │
├──────────────────────────────────────────────────────────────────────┤
│ KUIDAS SEE TOIMIB — 3 sammu rida (tühi → pakkumised → leping)        │
├──────────────────────────────────────────────────────────────────────┤
│ PARTNERITE INFO (mitte-nimekiri: mitu firmat, mida tähendab edastus) │
├──────────────────────────────────────────────────────────────────────┤
│ ContactBand + Footer                                                 │
└──────────────────────────────────────────────────────────────────────┘
```
**Mobiil:** kaardid virna (täislaius, üksteise järel); sammude rida → vertikaalne nimekiri.

## Block-by-block spec
1. **Hero** — H1 (draft) "Teenuste päringud", intro: "Täida päring ja saada see ühe klikiga kõigile registreeritud teenusepakkujatele. Nemad võtavad sinuga ühendust ja esitavad pakkumise — tavaliselt 7 päeva jooksul." Lubadus esile tõstetud (väli `--accent` alajoon: "Pakkujad vastavad 7 päeva jooksul").
2. **3 teenusekaarti** — `Card` (ikoon Lucide, H3, 2-realine kirjeldus, `Btn` "Esita päring"):
   - Metsamajanduskava → `/paringud/metsamajanduskava`
   - Hooldusraie → `/paringud/hooldusraie`
   - Metsa istutamine → `/paringud/metsa-istutamine`
   Kaardi hover: äär `--primary`, vari süveneb.
3. **Kuidas see toimib** — 3 nummerdatud sammu (draft): 1. "Täida ja saada päring" (1 minut) · 2. "Päring läheb kõigile pakkujatele" (edastuslogi, vt admin/10) · 3. "Võrdle pakkumisi ja vali" (otsus jääb täielikult sinu kätte; Erametsad vahendajaks, leping sõlmid otse firmaga).
4. **Partnerite info** — lühitekst: mitu registreeritud pakkujat teenuse kohta (arv CMS-ist/administ); selgitus, et edastamine on omanikule tasuta (ärimudeli läbipaistvus). "Oled teenusepakkuja? Vaata liitumist" → `/liitu` (kui Phase 5 puudub, link peidetud).

## Interactions & edge cases
- Hubil **pole LeadFormi** (nagu viitel) — ainsad tegevused on 3 kaarti.
- Kui mõne teenuse pakkujaid pole hetkel (tühjändus), jääb kaart nähtavaks, vorm töötab, aga intro-teavitus "hetkel lubab vastust kauem kui 7 päeva" — admini lipp teenuse kohta.

## Data & API
- Teenuste metaandmed CMS `PartnerService` (nimetus, ikoon, lühikirjeldus, aktiivne).
- Pakkujate arv: `GET /api/v1/partner-services?type=< tüüp >` või ISR-ga CMS — lihtsaim: arv hoitakse CMS-i väljal, admin uuendab.
- Ei ole vormi → pole API kirjutuskutsungit.

## States
- Teenus deaktiveeritud → kaart hallil (`ended/archived` värv `#6B7570`), "Hetkel pole saadaval".
- Tulevane teenus → ei renderdata.

## Copy (Estonian, draft)
- H1: "Teenuste päringud" · "Esita päring" · "Pakkujad vastavad 7 päeva jooksul." · kaardid: "Metsamajanduskava — kava on raiete ja toetuste alus." / "Hooldusraie — hooldus- ja valgusraie korraldamine." / "Metsa istutamine — maa ettevalmistus, istikud, istutamine." · "Kuidas see toimib?"

## SEO & analytics
- Title: "Teenuste päringud — kava, raie, istutamine | Erametsad"; desc: "metsamajanduskava, hooldusraie, istutamine, päring, pakkumused".
- JSON-LD: `ItemList` (3 teenust) + `BreadcrumbList`.
- Sündmused: `service_card_click{service}`, `how_it_works_view`, `partner_info_view`, `join_provider_click`.

## Accessibility & performance
- Kaardid on `<a>`-põhised — klaviatuur ja ekraanilugeja loevad "Esita päring hooldusraie päring" (aria-label).
- Aktiivsuse (deaktiveeritud) olek edastatakse nii värviga kui tekstiga "Hetkel pole saadaval".
- 3 kaardi pildid/ikoonid puhtad SVG-d; leht on peaaegu JS-vaba.

## Analüütiline pööre
- Kui `service_card_click` on kõrge aga päringute arv madal → vaadata järgmise lehe (`10/11/12`) hülgamismäära.

## Open questions
- Kas näidata partnerfirmade nimed (viide ei näita) või jääda anonümseks arvu juurde (soovitus: anonüümne, privaatsus ja paindlikkus)?
- `/liitu` pakkujate lehe prioriteet (Phase 5-ga seotud).

## Dependencies & change log
- Sõltub: 00-global-shell (kate, LeadForm, CookieBanner), README tokenid.
- Muudatused: v1 2026-08-27 (esimene draft).
- Seotud admin: admin/09-leads-crm (vormi esitused), admin/11-cms-content (sisu).
- Marsruutimisreeglid ja partnerite haldus: admin/10-service-requests.md.
- Pakkujate arv hoitakse CMS-is, admin uuendab käsitsi (lihtsus).
