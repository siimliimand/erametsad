# Metsamajanduskava päring — Management-plan request form

> **In brief:** A form to request a forest management plan from partner providers.
| Area | marketing |
|---|---|
| **Route** | `/paringud/metsamajanduskava` |
| **Access** | public |
| **In nav** | "Päringud" → 1. alamleht |

## Purpose & user goals
Omanik esitab metsamajanduskava koostamise päringu; päring edastatakse partnerfirmadele, kes vastavad 7 päeva jooksul. Sisuteave (miks kava vaja, mis selles on) aitab otsustada.

## Wireframe (desktop)

```
┌──────────────────────────────────────────────────────────────────────┐
│ VAHEKAARDID (Tabs): [Metsamajanduskava] [Istutamine] [Hooldusraie]   │
│ H1 "Metsamajanduskava koostamise päring"                             │
├──────────────────────────────────────────────────────────────────────┤
│ [7-col sisu: mis on kava, miks vaja, mis ajakava] │ [5-col VORM]     │
│                                                   │ ┌─────────────┐  │
│                                                   │ │ PÄRINGU     │  │
│                                                   │ │ VORM (Card) │  │
│                                                   │ │ nimi        │  │
│                                                   │ │ telefon     │  │
│                                                   │ │ email       │  │
│                                                   │ │ katastritunn│  │
│                                                   │ │             │  │
│                                                   │ │ ☐ paber     │  │
│                                                   │ │ kommentaar  │  │
│                                                   │ │ ☐ nõusolek  │  │
│                                                   │ │ [SAADA]     │  │
│                                                   │ └─────────────┘  │
├──────────────────────────────────────────────────────────────────────┤
│ "7 päeva" lubaduse bänd + korduma kippuvad (2 KKK linki)             │
├──────────────────────────────────────────────────────────────────────┤
│ ContactBand + Footer                                                 │
└──────────────────────────────────────────────────────────────────────┘
```
**Mobiil:** vahekaardid scrollitav riba; vorm täislaius, all sisust (vorm siiski lehe ülaosas, kohe H1 järel — konversioon eesmärk tõstetakse vorm mobiilis esimeseks, sisu alla); väljad ühe veeruna.

## Block-by-block spec
1. **Vahekaardid (Tabs)** — 3 teenust (Metsamajanduskava / Istutamine / Hooldusraie) → lingid `/paringud/metsa-istutamine`, `/paringud/hooldusraie` (päris navigeerimine, mitte SPA-olek — SEO jaoks eraldi lehed). Aktiivne `--primary` täis.
2. **Sisuveerg** — H2 "Mis on metsamajanduskava?" (draft): kava on 10 aastaks koostatud tegevuskava, raieliikide ja mahudega; vajalik raieluba-taolisteks toiminguteks ja toetuste taotlemiseks (link `/kkk/metsaandmed`). H2 "Mis ajakava oodata?" — pakkujad võtavad ühendust kuni 7 päeva jooksul; kava koostamine 2–6 nädalat (oleneb pakkujast).
3. **Päringuvorm (Card)** — väljad (vastavalt ERAMETSAD-PLAN §4.3 tabelile):
   - `nimi` (kohustuslik), `telefon` (kohustuslik), `email` (kohustuslik) — `FormInput`
   - `katastritunnus(ed)` (kohustuslik siin — kava on katastripõhine; mitu numbrit komaga; vihjevorming)
   - `☐ Soovin lisaks kava paberkandjal` (`FormCheck`, valikuline)
   - `kommentaar` (tekstiala, valikuline — nt metsa suurus, erijärgud)
   - `ConsentCheck` (kohustuslik; tekst märgib, et andmed edastatakse teenusepakkujatele — vt all draft)
   - `SAADA` (`Btn`-cta) + honeypot (vt 00 LeadForm)
4. **Lubaduse bänd** — `--bg-mist`: "Pakkujad vastavad 7 päeva jooksul. Vorm on tasuta ega kohusta sind." + 2 KKK linki (metsaandmed, müük).

## Interactions & edge cases
- Vorm valideerimine: telefon Eesti vorming; email RFC; katastritunnuse muster `NNNNN:NNN:NNNN` lubab mitu sissekannet, tolerantselt tühikud; veateated välja all, `--danger`.
- Edu → vorm asendatakse `EmptyState`-edu jalusega (roheline `CheckCircle`) + `Toast`; ei jää syndmust topelt esitama (nupp disabled saatmise ajaks).
- Vahekaardi vahetus enne esitamist → `beforeunload` pole vaja (vähe tähtis), aga poolikult täidetud vormi kaitsmiseks säilitame mustandi localStorage'is (draft, 24h, kustutatakse pärast edu).

## Data & API
- `POST /api/service-requests` `{type:"kava", payload:{name, phone, email, cadastres[], paper_copy, comment}, consent_at, form_name:"metsamajanduskava-1"}` → backend loob `ServiceRequest`, marsruutimisreeglite järgi (admin/10) edastab partneritele, logib `routed_to[]`.
- Kordustõke: sama telefoni + katastriga päring < 10 min → tõrge "Päring on juba saadetud".

## States
- Edu: "Aitäh! Päring edastati N pakkujale." (N = marsruutimise tulemus; kui N = 0 → "Päring salvestati, võtame ise ühendust" — partneri puudumise varuvariand).
- Viga võrgus: "Ei õnnestunud saata — proovi uuesti" + nupp jälle aktiivne.
- Serveri valideerimisviga 422: väljade kaupa inline.

## Copy (Estonian, draft)
- H1: "Metsamajanduskava koostamise päring" · "Mis on metsamajanduskava?" · väljade labels: "Sinu nimi", "Telefoninumber", "E-mail", "Metsamaa katastritunnus(ed)", "Soovin lisaks kava paberkandjal", "Lisa kommentaar", nõusolek: "Nõustun, et minu andmed edastatakse metsamajanduskava teenuse pakkujatele, kes võivad minuga ühendust võtta." · "SAADA" · "Pakkujad vastavad 7 päeva jooksul."

## SEO & analytics
- Title: "Metsamajanduskava koostamise päring | Erametsad"; desc: "metsamajanduskava, koostamine, päring, pakkumused, 7 päeva".
- JSON-LD: `Service` + `BreadcrumbList` (Päringud → Kava).
- Sündmused: `tab_switch{to}`, `service_request_start`, `service_request_validation_error{field}`, `service_request_complete{routed_count_bucket}`, `faq_link_click`.

## Accessibility & performance
- Vorm: `label` kõigil väljadel, veateated `aria-describedby`, fookus esimesele veale esitamisel.
- Vahekaardid on päris lingid — JS-ita navigatsioon töötab.
- Mustandi salvestus ei puuduta nõusoleku ruutu (see ei salvestata kunagi taastamiseks — GDPR-puhastus).

## Open questions
- Kas katastritunnus peaks olema kohustuslik ka kava puhul (praegu jah — pakkujad vajavad seda hinnakirja jaoks)?
