# Metsateatise esitamine — Metsateatis guide (state-portal tutorial)
| Area | marketing |
|---|---|
| **Route** | `/metsateatis` (ka `/metsateatise-juhend` suunatakse 301-ga siia) |
| **Access** | public |
| **In nav** | "Metsa müümine" → 4. item |

## Purpose & user goals
Omanik, kes peab enne raiet esitama metsateatise metsaportaalis register.metsad.ee, saab screenshot-sammusammulise juhendi; kui ta ei jaksa ise, helistab või jätab kontakti (tehingu eeltingimuse kaudu teenusele viiv püünis).

## Wireframe (desktop)

```
┌──────────────────────────────────────────────────────────────────────┐
│ HERO: H1 "Metsateatise esitamine metsaportaalis" + 2-lauseline intro │
├──────────────────────────────────────────────────────────────────────┤
│ [8-col juhend]                    │ [4-col külgriba]                 │
│ VAHEKAARDID: Esitamine | Muutmine │ ┌──────────────────────────┐     │
│ ───────────────────────────────── │ │ VAATA LISA               │     │
│ SAMM 1 [screenshot]  tekst        │ │ · /metsateatise-muutmine │     │
│ SAMM 2 [screenshot]  tekst        │ │ · /kahjustusest-teatamine│     │
│ SAMM 3 …SAMM 8                    │ │ · KKK: raie              │     │
│ (vahelduv --bg-mist/readus)       │ └──────────────────────────┘     │
│                                   │ ┌──────────────────────────┐     │
│                                   │ │ LEADFORM #1 (sticky      │     │
│                                   │ │ mobiilis pole)           │     │
│                                   │ └──────────────────────────┘     │
├──────────────────────────────────────────────────────────────────────┤
│ TELEFONI CTA-BÄND: "Helista, täidame koos" + number                 │
├──────────────────────────────────────────────────────────────────────┤
│ ContactBand + Footer                                                 │
└──────────────────────────────────────────────────────────────────────┘
```
**Mobiil:** külgriba liigub juhendi alla; sammud ühe veeruna, screenshot klikitav suurenduseks (`Modal` lightbox); telefonibänd numbriliseks `tel:`-nupuks.

## Block-by-block spec
1. **Hero** — H1 + intro (draft): "Metsateatis on digitaalne teatis, millega teavitad Keskkonnaametit kavandatavast raiejast. Juhend viib sind portaalist esitamiseni samm-sammult."
2. **Vahekaardid (Tabs)** — "Esitamine" (vaikenähtav) / "Muutmine" (lühem juhend, viide `/metsateatise-muutmine` SEO-artiklile). Kui muutmise sisu on lühike, piisab lingist külgribas — otsus adminis.
3. **Screenshot-tutorial (Steps)** — nummerdatud `Steps` komponent: iga samm = number + pealkiri + 2–4 lauset + screenshot (register.metsad.ee kasöiliõige; originaal-kuvatõmmised teeme ise viiteportaali väljanägemist muutmata; alt-tekstid kohustuslikud). Originaalsed 8 sammu (draft, meie oma sõnastus, mitte viite tekst):
   1. "Logi sisse metsaportaali" — register.metsad.ee, ID-kaart / Mobiil-ID / Smart-ID.
   2. "Ava MINU ava" — sinu metsade loend.
   3. "Vali raielangid" — katastriüksuse ja eraldiste valimine kaardilt või loendist.
   4. "Alusta metsateatist" — nupp "Sisesta metsateatis"; eeltäidetud andmed takseerist, kontrolli mahuid.
   5. "Lisa raielangi aadress" — ja salvesta ("Salvesta aadress").
   6. "Märgi raiemahu avalikustamine" — märkeruut, kas mahu avalikustad.
   7. "Kontrolli ja esita" — "Esita"; teatis saab numbrid.
   8. "Jälgi staatumist" — kinnituse ootel / kinnitatud; edasi liikumise võimalus.
4. **Külgriba "Vaata lisa"** — `Card`: `/metsateatise-muutmine`, `/kahjustusest-teatamine` (mõlemad SEO-artiklid mallist 04), KKK raie kategooria, `/teenused/raieoiguse-muuk` ristlink.
5. **LeadForm #1** (`metsateatis-1`, `#kontaktvorm`) külgribas — pealkiri "Vajad abi metsateatise täitmisel?"
6. **Telefoni CTA-bänd** — `--primary-dark`: "Ei tule välja? Helista — täidame teatise koos läbi." + suur `tel:` link.

## Interactions & edge cases
- Screenshot-klikk → `Modal` suurendus (pilt zoomable); `Esc` sulgeb.
- Kui riikportaal muudab UI-t — screenshotidel kuupäev ja "kontrollitud" märgis (CMS-i väli), admin saab meeldetuletuse 6 kuu pärast (vt admin/11).
- Väline viide portaali avamiseks uuel kaardil (`rel="noopener"`), teavitus "Avaneb uuel kaardil".

## Data & API
- Kogu juhend CMS-is (`Page` → `Steps` plokk piltidega).
- Vorm `POST /api/leads`, `form_name=metsateatis-1`.

## States
- Pilti pole veel üles laaditud → sammu placeholder (`--bg-mist` + "Kuvatõmmis tuleb pärast testimist" — mitte tühi lünk).
- Lightbox ei toimi ilma JS-ita → `<a href="pilt">` fallback.

## Copy (Estonian, draft)
- H1: "Metsateatise esitamine metsaportaalis" · "Samm-sammult koos piltidega" · "Vajad abi metsateatise täitmisel?" · "Helista — täidame teatise koos läbi." · külgriba pealkiri "Vaata lisa".

## SEO & analytics
- Title: "Metsateatise esitamine — juhend piltidega | Eametsad"; desc: "metsateatis, register.metsad.ee, metsaportaal, raieluba, kuidas esitada".
- JSON-LD: `HowTo` (8 sammu, iga sammuga `HowToImage`) + `BreadcrumbList`. — tugev rich-result võimalus.
- Sündmused: `tutorial_step_view{step_index}`, `screenshot_zoom{step_index}`, `tab_switch{tab}`, `phone_band_click`, `sidebar_link_click{target}`, `lead_form_submit_start/complete`, `outbound_click{register.metsad.ee}`.

## Accessibility & performance
- Screenshottide `alt`-tekstid kirjeldavad portaali seisundit ("Metsaportaal: ava MINU menüü on üleval paremal").
- Nummerdatud `Steps` on ka OCR-nähtavad (numbrid HTML-is, mitte pildis).
- Kuvatõmmised WebP + lazy; juhendi leht sihib <500 KB kriitilist JS-i.

## Open questions
- Kas "Muutmine" jääb vahekaardiks või eraldi SEO-artikliks (kui sisu > 6 sammu)?
- Kuvatõmmiste legaalsus viiteportaalist (avaliku võrgu UI) — juriidiline kinnitus.
