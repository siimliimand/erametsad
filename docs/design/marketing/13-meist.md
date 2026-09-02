# Meist — About

> **In brief:** The company story, mission and registry details, with a lead form.
| Area | marketing |
|---|---|
| **Route** | `/meist` |
| **Access** | public |
| **In nav** | "Meist" (dropdown peaüksus) |

## Purpose & user goals
Kahtlev omanik saab usalduse allika: kes me oleme (juridiline blokk, missioon, juhtkond), miks teeme seda tööd ja kuidas meiega ühendust võtta. Konversioon: LeadForm üleval + all.

## Wireframe (desktop)

```
┌──────────────────────────────────────────────────────────────────────┐
│ HERO: H1 "Sul on metsa majandamist puudutav küsimus?" + LEADFORM #1  │
├──────────────────────────────────────────────────────────────────────┤
│ ETTEVÕTTE BLOKK (Card, --bg-mist):                                   │
│  Erametsad OÜ · Registrikood [koht] · KMKR [koht]                     │
│  telefon · e-mail · aadress [koht]                                   │
├──────────────────────────────────────────────────────────────────────┤
│ MISSIJOON "Miks me seda teeme?" — tekst + 3 väikse pildi/proovi      │
├──────────────────────────────────────────────────────────────────────┤
│ JUHATUSE TSITAAT: suur sitaat + juhi foto + nimi + tiitel            │
├──────────────────────────────────────────────────────────────────────┤
│ AREEN: spetsialistide viide (3 SpecialistCard + "Vaata kõiki")       │
├──────────────────────────────────────────────────────────────────────┤
│ LEADFORM #2 (#kontaktvorm)                                           │
├──────────────────────────────────────────────────────────────────────┤
│ ContactBand + Footer                                                 │
└──────────────────────────────────────────────────────────────────────┘
```
**Mobiil:** juriblokk ja tsitaat ühe veeruna; spetsialistide rida → horisontaalne scroll; vormid täislaius.

## Block-by-block spec
1. **Hero** — foto + overlay; H1 (draft) "Sul on metsa majandamist puudutav küsimus?"; intro 1 lause ("Vastame metsa, hinna ja oksjoni kohta — tasuta."). Parem `LeadForm #1` (`meist-1`, ankur `#kontaktvorm`).
2. **Ettevõtte blokk** — `Card` andmetega (kohatäited, kliendi täita): juriidiline nimi (Erametsad OÜ), registrikood, KMKR number, registreeritud aadress, telefon, e-mail. Välimus nagu ametlik teabekaart (monospace numbrid, väikene `Landmark` ikoon).
3. **Missioon "Miks me seda teeme?"** — 2 lõiku (draft): Erametsad alustas veendumusest, et metsaomanik saab õiglase hinna vaid siis, kui pakkumised konkureerivad avatult; meie töö on teha sellest protsessist lihtne ja turvaline; meeskonnas kokku üle [N] aasta metsanduse kogemust (kohatäide).
4. **Juhi tsitaat** — suur tsitaat (Manrope 28px, jutumärgid `--accent`), juhi foto, nimi ja tiitel (kohatäited: "[Juhi nimi], tegevjuht"). Draft-tsitaat: "Mets on pikaajaline investeering — meie ülesanne on tagada, et selle võõrandamisel langetaks otsuseid teave, mitte ärevus."
5. **Spetsialistide eelvaade** — 3 `SpecialistCard` (mini) → `/meist/metsaspetsialistid` (+ `Btn` "Vaata kõiki spetsialiste").
6. **LeadForm #2** (`meist-2`) — "Kirjuta meile — vastame 1 tööpäevaga."

## Interactions & edge cases
- Registriandmed CMS-i globaalsest seadistusest (üks allikas ka jaluse ja lepingute jaoks — admin/13).
- Juhi foto laisklaadimine, asenduspilt `--bg-mist` initsiaalidega kui puudub.

## Data & API
- Ettevõtte andmed: CMS `Settings` (globaalne).
- Spetsialistid: `GET /api/specialists?limit=3&featured=true` (SSG; CMS `Specialist` kogum).
- Vormid: `POST /api/leads`, `form_name=meist-1|meist-2`.

## States
- Kui juhi tsitaat sisestamata → plokk peidetud (ei rikuta sisu).
- Spetsialiste < 3 → näita mis on; 0 → plokk peidetud.

## Copy (Estonian, draft)
- H1: "Sul on metsa majandamist puudutav küsimus?" · "Miks me seda teeme?" · "Vaata kõiki spetsialiste" · "Kirjuta meile — vastame 1 tööpäevaga." · ettevõtte bloki väljade pealkirjad: "Registrikood", "Käibemaksukohustuslase nr", "Aadress".

## SEO & analytics
- Title: "Meist | Erametsad"; desc mainigu usaldusmärke ("kogemus, spetsialistid, metsaoksjonid").
- JSON-LD: `Organization` (registrikood, aadress, kontaktid — footeri `Organization`-iga sama, kasutada ühte) + `BreadcrumbList`.
- Sündmused: `lead_form_submit_start/complete{form_name}`, `specialist_preview_click{name}`, `ceo_quote_view` (kesksele vaatele jõudmine).

## Accessibility & performance
- Juhi tsitaat blokktsitaadina (`<blockquote>` + `<cite>`).
- Ettevõtte andmed on tekstina (mitte ainult pildil) — NAP järjepidevus otsingumootoritele.
- Pildid lazy; spetsialistide eelvaate fotod WebP 400px (thumbnails).

## Analüütiline pööre
- Kui `meist` lehe vormi esitused on kõrged, aga konversioon madal → kaaluda ülemise vormi eemaldamist (vorm A/B: lehe all ainult).

## Open questions
- "Juhtkond" eraldi leht (viitel on) või piisab juhi tsitaadist siin? Soovitus: piisab — juhtkond = juht + link spetsialistide lehele; vähem hooldatavat sisu. (Kui klient nõuab, lisada `/meist/juhtkond` samal mallil.)

## Dependencies & change log
- Sõltub: 00-global-shell (kate, LeadForm, CookieBanner), README tokenid.
- Muudatused: v1 2026-08-27 (esimene draft).
- Seotud admin: admin/09-leads-crm (vormi esitused), admin/11-cms-content (sisu).
- Ettevõtte andmed on ühes allikas (CMS Settings) — korduvad 16/17-failides.
- Juhtkonna eraldi lehte pole (otsus dokumenteeritud Open questions all).
- Missiooni kogemusaastate kohatäide täidab klient.
- Spetsialistide eelvaate data: featured=true lipp CMS-is.
