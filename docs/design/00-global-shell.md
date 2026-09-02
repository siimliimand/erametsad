# Globaalne kate (Global shell) — Header, footer, kontaktiriba, küpsised, vealehed

> **In brief:** The shared frame around every marketing page — header navigation, footer, contact band, cookie consent and the 404/500 error pages.
| Area | marketing |
|---|---|
| **Route** | kõik `erametsad.ee` leheküljed |
| **Access** | public |
| **In nav** | — (ümbritseb kõiki lehti) |

## Purpose & user goals
Ühtne ümbris kõigile turunduslehekülgedele: navigatsioon, jalus, ees-jaluse kontaktiriba, küpsisenõusoleku bänner ning 404/500 vealehed. Kasutaja saab igalt lehelt 2 klõpsuga oksjonikeskkonda, päringuvormi või telefonini.

## Wireframe (desktop)

```
┌────────────────────────────────────────────────────────────────────┐
│ LOGO  Metsa müümine▾ KKK▾ Kiiroksjonid Päringud▾ Uudised Meist▾   │
│                              Metsaühistu↗         [Oksjonikeskkond]│ ← sticky, valge, 72px
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│                        (lehe sisu)                                 │
│                                                                    │
├────────────────────────────────────────────────────────────────────┤
│ CONTACTBAND  ☎ +372 XXX XXXX · ✉ info@erametsad.ee · Jäta kontakt →│
├────────────────────────────────────────────────────────────────────┤
│ FOOTER: Aktiivsed | Ajalugu | Artiklid | Kasulik teada | Jälgi    │
│  oksjonid  | oksjonid | (uudised,   | (kasutusjuhend,  | meid     │
│  (4 tüüpi) | (4 tüüpi)| kliendilood)| lepingud, tingim.,| (FB IG  │
│            |          |             | privaatsus)      | YT)      │
│ ── © Erametsad OÜ · registrikood · KMKR ·_PLL privaatsuspoliitika ── │
└────────────────────────────────────────────────────────────────────┘
```

**Mobiil:** header 56px, nav → hamburger → täisekraani `Drawer` (paremalt), rühmad akordioonidena, välimised lingid ja CTA fikseeritud draweri jaluses. Kõik ≤768px.

## Block-by-block spec

### 1. Header
- Sticky (top-0), kõrgus 72px / mob 56px, taust `#FFFFFF`, alumine ääris `rgba(27,33,29,.08)`. Logo vasakul (SVG, `--primary-dark`).
- Peamenüü (Manrope 600, 16px) + dropdownid hoveril (desktop) ja fokusel (klaviatuur):
  - **Metsa müümine** → `/teenused/raieoiguse-muuk`, `/teenused/kinnistu-muuk`, `/teenused/metsa-hindamine`, `/metsateatis`, `/hindamisaktid` (5 alamlehte; viimased 2 eraldaja joonega, ikoonid Lucide `TreePine`, `Map`, `Ruler`, `FileText`, `ClipboardList`)
  - **KKK** → otse `/kkk` + dropdown 7 kategooriaga (`/kkk/oksjonid` … `/kkk/metsauhistu`)
  - **Kiiroksjonid** → `/kiiroksjon` (ilma dropdownita)
  - **Päringud** → `/paringud` + 3 alamlehte (kava, hooldusraie, istutamine)
  - **Uudised** → `/artiklid`
  - **Meist** → `/meist` + `/meist/metsaspetsialistid` (+ juhtkond, vt 13/14 fail)
- Välised lingid (näevad välja nagu tekstilink + `ExternalLink` ikoon): **Metsaühistu** → `metsauhistu.erametsad.ee`, **Oksjonikeskkond** → `Btn`-cta → `oksjonid.erametsad.ee`.
- Aktiivse lehe menüülink `--primary` + 2px alajoon. Skip-link "Otse sisuni" (WCAG).

### 2. Footer (5 veergu, taust `--primary-dark`, tekst `#FFFFFF`/`rgba(255,255,255,.72)`)
1. **Aktiivsed oksjonid** — Raieõigused / Kinnistud / Paketid / Põllumaa → `oksjonid.erametsad.ee/{...}`
2. **Oksjonite ajalugu** — samasugused 4 linki + `/ajalugu/...`
3. **Artiklid** — `/artiklid/uudised`, `/artiklid/klientide-lood`
4. **Kasulik teada** — Kasutusjuhend (PDF), `/lepingud`, `/artiklid/kasutustingimused`, privaatsuspoliitika
5. **Jälgi meid** — Facebook, Instagram, YouTube (ikoonid + `aria-label`)
- Jaluse alaveerg: © Erametsad OÜ · registrikood (koht) · KMKR (koht) · lingid privaatsuspoliitikale ja küpsiste seadetele (`#cookie-settings` modaal). Mobiilis veerud akordioonideks.

### 3. ContactBand (eel-jalus, igal lehel)
`Card` taustaga `--bg-mist`, 3 veergu: telefon (tel: link), e-mail (mailto:), CTA-link "Jäta enda kontaktid" → ankur `#kontaktvorm` lehe esimese `LeadForm`-ini. Mobiilis virn.

### 4. CookieBanner
- Ilmub alles pärast esimest interaktsiooni / kohe allservas, mitte modaalselt (ei blokeeri sisu — EU e-praktika). Taust valge `Card`, peal `--primary-dark` tekst.
- Nupud: `Nõustun kõigiga` (Btn-cta) · `Ainult vajalikud` (Btn-secondary) · `Sätete muutmine` (ghost → Modal kategooriatega: vajalikud (lukus), statistika/analüütika, turundus).
- Analüütika (GA4/Plausible) laaditakse AINULT nõusolekul; nõusolek salvestatakse (`erametsad_consent`, 12 kuu küpsis + serveripoolne logi consent-aega). Seadete taasavamise link jaluses.

### 5. Vealehed
- **404** ("Lehekülge ei leitud"): illustratiivne metsafoto, H1, tekst, otsinguväli (lihtne tekstotsing CMS-artiklitest) + `Btn` "Avalehele". Sündmus `error_404{path}`.
- **500**: neutraalne teade "Süsteemi häire, töötame selle kallal", telefon + e-mail (ContactBand-andmed), automaatne Sentry report.

## Interactions & edge cases
- Dropdown avaneb `mouseenter`/`focus` + klõps (puutetundlik), sulgub `Esc` + väljaklõps; fookuse lõks puudub (fokusubemenüü tab järjekorras).
- Välimised lingid: `target="_blank" rel="noopener"`, visuaalne ↗ ikoon.
- Sticky header kahandub skrollides 72→60px (desktop).
- Kui `oksjonid.erametsad.ee` hooldusrežiimis, CTA viib ikka portaalile (portaal näitab enda hoolduslehte).

## Data & API
- Menüü tuleb CMS-ist (`Page`/menüü-buuilder, vt admin/11) — staatilisse buildi SSG-aegselt.
- Jaluse oksjonilinkid filtriga tüübi järgi: lihtsalt haruteed, API-d pole vaja.
- CookieBanner loeb/kirjutab ainult küpsist; nõusolek saadetakse `POST /api/consent` (logi).

## States
- Analüütika keeldunud → skripte ei laadita, leht toimub täielikult.
- Footeri linkide puudumine (nt PDF veel üles laadimata) → linki ei renderdata (mitte tühi ankur).

## Copy (Estonian, draft)
- "Oksjonikeskkond", "Otse sisuni", "Jäta enda kontaktid", "Nõustun kõigiga", "Ainult vajalikud", "Küpsiste sätete muutmine", "Kasutame küpsiseid … Statistilised küpsised aitavad meil aru saada, milline sisu on kasulik." (lühendatud draft), 404: "Kahjuks seda lehekülge ei ole. Proovi otsida või naase avalehele."

## SEO & analytics
- Header/footer lingid `<a>` (mitte JS-redirectid) — crawlability.
- Sündmused: `cookie_consent{choice}` (ka ilma analüütika nõusolekuta — saadetakse alati, otse meie serverisse), `nav_click{item}`, `outbound_click{portal|uhistu}`, `error_404{path}`.

### 6. LeadForm — komponent (korduv kõigil lehtedel, vt ka 01–17)
- **Väljad:** `nimi` (kohustuslik, 2–70 tähemärki) · `telefon` (kohustuslik, Eesti vorming +372…, klientipoolne mustri valideerimine) · `email` (kohustuslik, RFC-vorming) · `katastrinumber` (valikuline, vihje "nt 77901:003:0410") · `ConsentCheck` (nähtav, märkimata, kohustuslik — tühistab viite saidi GDPR-vea) · nupp `SAADA` (`Btn`-cta, täislaius mobiilis).
- **Honeypot:** peidetud väli `company_website` (CSS `display:none`, `tabindex=-1`, `autocomplete=off`) — täidetuna esitatakse vaikse edu-petega, juhtlõime ei salvestata.
- **Source tracking:** peidetud `form_name` = `<lehe-slug>-<järjekorranr>` (nt `avaleht-2`, `kiiroksjon-1`) — kopeerib viite konventsiooni, mida viite CRUD jälgib.
- **Esitamine:** `POST /api/leads` JSON-iga `{form_name, page_slug, name, phone, email, cadastre, consent:true, honeypot}`; rate-limit serveris (IP + 5/min). Edu → `Toast` "Aitäh! Võtame ühendust 1 tööpäeva jooksul." + vorm lähtestatakse. Viga → inline väljavead, `--danger`.
- **Delikaatsus:** nupp lukustub esitamise ajaks ("Saadan…"); topeltklõpsu kaitse; ei sisalda reCAPTCHA-t (honeypot + rate-limit piisavad Phase 1).

## Open questions
- Logo/lõplik telefon/email (kohatäited `+372 XXX XXXX`, `info@erametsad.ee`).
- Kas "Juhtkond" eraldi leht või osa `/meist` (vt 13-meist.md otsus).
