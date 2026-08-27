# Lepingud — Contract templates download page

> **In brief:** Downloads of the contract templates.
| Area | marketing |
|---|---|
| **Route** | `/lepingud` |
| **Access** | public (ei nõua sisselogimist ega nõusolekut allalaadimiseks) |
| **In nav** | jalus "Kasulik teada" → Lepingud |

## Purpose & user goals
Ostjad ja müüjad (ning nende nõustajad) laadivad alla lepingu mallid (oksjonileping, raamleping, metsa müügi leping jms), et tutvuda tingimustega enne registreerimist või oksjonile asumist. Läbipaistvus langetab oksjonihirmu.

## Wireframe (desktop)

```
┌──────────────────────────────────────────────────────────────────────┐
│ HERO: H1 "Lepingute mallid" + intro (miks avalikud, mida pole)       │
├──────────────────────────────────────────────────────────────────────┤
│ FAILIDE NIMEKIRI (DataTable või lihtsalt read):                      │
│ ┌──────────────────────────────────────────────────────────────┐     │
│ │ Tüüp            Versioon  Kuupäev     Formaat   [Allalaadimine]│   │
│ │ Oksjonileping   v2.1      01.03.2026  PDF 245KB [↓ Laadi alla]│   │
│ │ Raamleping      v1.4      12.01.2026  PDF 180KB [↓ Laadi alla]│   │
│ │ Metsa müügi …   v1.0      …           DOCX 90KB [↓ Laadi alla]│   │
│ │ …                                                            │   │
│ └──────────────────────────────────────────────────────────────┘     │
├──────────────────────────────────────────────────────────────────────┤
│ TEAVITUS: "Uue versiooni puhul" → uudiskirja väli                    │
├──────────────────────────────────────────────────────────────────────┤
│ ÕIGUSLIK HOIATUS + viide kasutustingimustele                         │
├──────────────────────────────────────────────────────────────────────┤
│ ContactBand + Footer                                                 │
└──────────────────────────────────────────────────────────────────────┘
```
**Mobiil:** tabel → kaardirea nimekiri (tüüp + versioon/kuupäev rida + allalaadimisnupp); ei lehe horisontaalset scrolli.

## Block-by-block spec
1. **Hero** — H1 (draft) "Lepingute mallid"; intro: "Kõik oksjoniprotsessi lepingud on avalikud — loe enne registreerumist rahulikult läbi. Kehtiv versioon kehtestatakse oksjoni alguseks."
2. **Failide nimekiri** — read CMS kogumist `LegalDocument(type, title, version, date, file, format, active)`; väljad: tüüp (nt Oksjonileping / Raamleping / Metsa müügi leping / Vollikiri / Muud), versioon, kuupäev, formaat + suurus, `Btn-secondary` "Laadi alla" (`<a download>` allkirjastatud URL-ile, `rel="noopener"`). Ainult `active:true` versioonid nähtavad; vana versiooni allalaadimist pakkuda ei ole.
3. **Versiooniteavituse väli** — e-posti sisestus → `POST /api/newsletter` (grupp `lepingud`); "Saadame teate, kui mall uueneb." Double opt-in (vt 00).
4. **Õiguslik hoiatus** — `Card` väikse `Scale` ikooniga (draft): "Mallid on näidised. Oksjonil osalemiseks kehtib portaalis allkirjastatav leping; müüjana pöördu nõu saamiseks spetsialisti poole. Tingimused: link `/artiklid/kasutustingimused`."
5. LeadForm puudub (nagu viitel) — Conversion on allalaadimine; ContactBand viib kontaktini.

## Interactions & edge cases
- Allalaadimise link on otsene (ei nõua e-posti, ei küsi nõusolekut — e-posti gate ei tohiks lepingute puhul olla (usaldus + õiguslik risk); küll aga pannakse allalaadimiste arv serveris kokku).
- Fail avaneb uuel kaardil või laaditakse — `<a download>`; mobiilis teavitus "Allalaadimine algas".
- Uus versioon avaldatakse → vana lehekülg saab `active:false`, ajalugu jääb admini (admin/08-lepingud adminis).

## Data & API
- `GET /api/legal-documents` (SSG + ISR 1h; failid CDNil allkirjastatud URL-idega, cache 24h).
- Allalaadimise sündmus ei tee API-kutset (server log loendab CDN-hits; analüütika Plausible's/GA4-s, vt all).
- Teavituse liitumine `POST /api/newsletter` `{email, group:"lepingud"}`.

## States
- Kogum tühi (klient pole faile üles andnud) → `EmptyState` "Mallid lisanduvad enne esimest oksjonit" + viide kasutustingimustele.
- Fail rikutud (404 CDN-lt) → rida hallil, teavitus adminile (Sentry), mitte kasutajale.

## Copy (Estonian, draft)
- H1: "Lepingute mallid" · veerud: "Tüüp", "Versioon", "Kuupäev", "Formaat" · "Laadi alla" · "Saadame teate, kui mall uueneb." · hoiatus: "Mallid on näidised — oksjonil osalemiseks kehtib allkirjastatud leping."

## SEO & analytics
- Title: "Lepingute mallid | Eametsad"; desc: "oksjonileping, raamleping, metsa müügi leping, mallid, allalaadimine".
- JSON-LD: `ItemList` dokumentidest; ei ole `Product`.
- Sündmused (ainult nõusolekul, vt 00 CookieBanner — lehe külastuse näitaja laieneb ka ilma): `document_download{type, version}`, `version_notify_signup`, `legal_notice_click`.

## Accessibility & performance
- Tabeli read mobiilis kaardistatud (`display:block` + `data-label` atribuudid) — pole horisontaalset scrolli.
- Faili suurus näidatud — kasutaja teab enne laadimist; failid CDN-il (EU piirkond).
- Leht on staatiline (SSG), alla 50 KB kriitiline JS.

## Open questions
- Kas registreerunud ostjad vajavad teistsugust (täidetava) malli portaalis — jah, vt portal/13; siin ainult näidis-PDF-id.
- Failide allkirjastamine (digitaalselt kooskõlastatud PDF) vs puhas PDF — õiguslikult soovitatav, kuid kallis hooldada; otsus Phase 2.

## Dependencies & change log
- Sõltub: 00-global-shell (kate, LeadForm, CookieBanner), README tokenid.
- Muudatused: v1 2026-08-27 (esimene draft).
- Seotud admin: admin/09-leads-crm (vormi esitused), admin/11-cms-content (sisu).
- LegalDocument CMS kogum; ainult active:true versioonid nähtavad.
- Allalaadimine ei nõua nõusolekut; analüütika sündmus küll (nõusolekul).
- Vana versiooni ajalugu jääb admini (admin/08 contracts).
- Failid CDN-il EU piirkonnas, allkirjastatud URL-idega (24h).
