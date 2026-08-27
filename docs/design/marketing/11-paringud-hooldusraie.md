# Hooldusraie päring — Tending-cut request form

> **In brief:** A form to request tending/thinning cuts, with file upload.
| Area | marketing |
|---|---|
| **Route** | `/paringud/hooldusraie` |
| **Access** | public |
| **In nav** | "Päringud" → 2. alamleht |

## Purpose & user goals
Omanik, kelle nooremad puistud vajavad hooldus- või valgusraiet, saab tutvuda raieliikidega ja esitada päringu (koos faili üleslaadimisega) partnerfirmadele, kes vastavad 7 päeva jooksul.

## Wireframe (desktop)

```
┌──────────────────────────────────────────────────────────────────────┐
│ VAHEKAARDID: [Metsamajanduskava] [Istutamine] [Hooldusraie←aktiivne] │
│ H1 "Hooldusraiete päring"                                            │
├──────────────────────────────────────────────────────────────────────┤
│ [7-col sisu: raieliigid, miks vaja]      │ [5-col VORM (Card)]       │
│   • Kultuuride hooldamine                │  nimi, telefon, email     │
│   • Valgusraie                           │  maakond (Select 15)      │
│   Hooldusraie vs lageraie lühislt        │  katastritunnus           │
│                                           │  eraldis(ed)              │
│                                           │  ☐ kultuuride hoindamine  │
│                                           │  ☐ valgusraie             │
│                                           │  [faili üleslaadimine]    │
│                                           │  kommentaar               │
│                                           │  ☐ nõusolek  [SAADA]      │
├──────────────────────────────────────────────────────────────────────┤
│ "7 päeva" lubaduse bänd                                               │
├──────────────────────────────────────────────────────────────────────┤
│ ContactBand + Footer                                                 │
└──────────────────────────────────────────────────────────────────────┘
```
**Mobiil:** nagu 10 — vorm kohe H1 järel, sisu alla; `Select` avaneb natiivse valikuloendina; failiüleslaadimine nupp täislaius.

## Block-by-block spec
1. **Vahekaardid (Tabs)** — samad 3 kui 10-failis, aktiivne "Hooldusraie".
2. **Sisuveerg** — H2 "Mis on hooldusraie?" (draft): noorte puistu hooldamine, võsa raie, üldine tervis; **valgusraie** — valitute langetamine, et jäätavatel puudel kasvuruumi; lühivastandus lageraiest (viide `/lageraie` SEO-artiklile ja `/kkk/raie`). H2 "Mis ajakava oodata?" — sama 7-päeva lubadus kui 10-s.
3. **Päringuvorm (Card)** — väljad EAMETSAD-PLAN §4.3 järgi:
   - `nimi`, `telefon`, `email` (kohustuslikud)
   - `maakond` — `FormSelect` (15 maakonna ref-tabel, kohustuslik)
   - `katastritunnus` — üks või mitu (kohustuslik)
   - `eraldis(ed)` — vabatekst (kohustuslik, vihje "nt 5, 7" — eraldise numbrid kava järgi)
   - `☐ Kultuuride hooldamine`, `☐ Valgusraie` — `FormCheck` (vähemalt üks valitud valideerimine; mõlemad lubatud)
   - **`FileUpload`** "Lisa kava fail (valikuline)" — PDF/JPG/PNG, max 10 MB, 1 fail; edu → failinimi + eemaldamislink
   - `kommentaar` (valikuline), `ConsentCheck` (kohustuslik, sama edastamise-tekst nagu 10), `SAADA` + honeypot.
4. **Lubaduse bänd** — sama komponent kui 10-failis.

## Interactions & edge cases
- Fail: tüübi- ja suurusekontroll kliendis; vigane fail → inline viga "Lubatud on PDF, JPG, PNG kuni 10 MB". Üleslaadimine käivitub alles koos vormi saatmisega (multipart).
- Vormi mustand localStorage'is failita (faili ei säilitata).
- Kui kumbki teenuse märkeruut märkimata → valideerimisviga mõlema grupi all: "Vali vähemalt üks teenus".

## Data & API
- `POST /api/service-requests` (multipart/form-data) `{type:"hooldusraie", payload:{name, phone, email, county, cadastres[], provisions, services:["hooldamine","valgusraie"], comment}, attachments[], consent_at, form_name:"hooldusraie-1"}`.
- Fail salvestatakse allkirjastatud URL-iga, edastatakse partneritele linkidena (mitte manusena, kui > 5 MB).
- Maakondade loend: `GET /api/v1/counties` (SSG-aegne) või staatiline ref-tabel buildis (piisab).

## States
- Faili üleslaadimise edenemine: progressiriba nupu sees ("Saadan… 40%").
- Edu: nagu 10 ("Päring edastati N pakkujale").
- Faili serveritõrge → vormi andmed jäävad, viga faili välja all, kasutaja saab uuesti proovida.

## Copy (Estonian, draft)
- H1: "Hooldusraiete päring" · "Mis on hooldusraie?" · väljad: "Sinu nimi", "Telefoninumber", "E-mail", "Raielangi maakond", "Raielangi katastritunnus", "Eraldis/eraldised", "Kultuuride hooldamist", "Valgusraiet", "Lisa kava fail (valikuline)", "Lisa kommentaar", nõusolek nagu 10-s (sõnastus "hooldusraie teenuse pakkujatele"), "SAADA", "Pakkujad vastavad 7 päeva jooksul."

## SEO & analytics
- Title: "Hooldusraie päring — hooldus- ja valgusraie | Eametsad"; desc: "hooldusraie, valgusraie, päring, pakkujad, 7 päeva".
- JSON-LD: `Service` + `BreadcrumbList`.
- Sündmused: `tab_switch{to}`, `service_request_start`, `file_upload_attach{ext,size_bucket}`, `service_request_validation_error{field}`, `service_request_complete`, `content_link_click{target}`.

## Accessibility & performance
- Faili väli: nupu + failinime kombinatsioon loetav ekraanilugejale (`aria-describedby` formaadi piiranguga).
- Üleslaadimise progress `aria-live`; keelatud nupp + "Saadan…" tekst.
- Muu valideerimine ja fookuse haldus nagu 10-failis.

## Open questions
- Kas lubada mitu faili (viites 1; kliendiküsimus — soovitus: 1 fail piisab, kava on üks dokument)?

## Dependencies & change log
- Sõltub: 00-global-shell (kate, LeadForm, CookieBanner), README tokenid.
- Muudatused: v1 2026-08-27 (esimene draft).
- Seotud admin: admin/09-leads-crm (vormi esitused), admin/11-cms-content (sisu).

