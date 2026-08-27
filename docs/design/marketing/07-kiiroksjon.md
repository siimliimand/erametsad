# Kiiroksjon — 48h quick auction

> **In brief:** Explains the 48-hour quick auction and its guaranteed backup offer.
| Area | marketing |
|---|---|
| **Route** | `/kiiroksjon` |
| **Access** | public |
| **In nav** | "Kiiroksjonid" (ilma dropdownita, navigatsiooni 3. üksus) |

## Purpose & user goals
Omanik, kes tahab kiiresti raha (pärisus, laen, ootamatu kulu), mõistab 48-tunnist toodet: salajane piirhind, 1 €-st alghind, garantiseeritud varupakkumine; jätab kontakti. Teisene eesmärk: eristada tavalisest oksjonist.

## Wireframe (desktop)

```
┌──────────────────────────────────────────────────────────────────────┐
│ HERO (--primary-dark, või foto + tume overlay)                       │
│  silte "48 H"  H1  "48 tunniga reaalsed pakkumised sinu metsale"     │
│  [Btn-cta: Alusta — jäta kontakt]                                    │
├──────────────────────────────────────────────────────────────────────┤
│ LEADFORM #1 (#kontaktvorm): "Soovid 48 tunniga pakkumised?"          │
├──────────────────────────────────────────────────────────────────────┤
│ KUIDAS TOIMIB — 5 sammu (Steps, numbrid + ikoonid)                   │
│  ① Võta ühendust   ② Sõlmime salajase piirhinna                      │
│  ③ 48h pakkumised (alates 1 €)  ④ Notariaalne tehe (3% + km tasu)    │
│  ⑤ Pole pakkumisi? Meie ise teeme ostupakkumise                      │
├──────────────────────────────────────────────────────────────────────┤
│ MIKS KIIROKSJON? — ✓-nimekiri (2 veergu)                             │
├──────────────────────────────────────────────────────────────────────┤
│ SOBIB SULLE, KUI: — asukohatäpsed tingimused (nimekiri)              │
├──────────────────────────────────────────────────────────────────────┤
│ LEADFORM #2 + lõpetav CTA                                            │
└──────────────────────────────────────────────────────────────────────┘
```
**Mobiil:** 5 sammu → vertikaalne nummerdatud nimekiri; ✓-nimekiri 1 veerg; vormid täislaius.

## Block-by-block spec
1. **Hero** — väga tume, kesksetatud; suur "48 H" tähist (Manrope 800, `--cta`); H1 (draft) "48 tunniga reaalsed pakkumised sinu metsale"; alapealkiri: "Kiire, turvaline ja ilma eelkuludeta." Üks `Btn`-cta → `#kontaktvorm`.
2. **LeadForm #1** (`kiiroksjon-1`, `#kontaktvorm`) — kõrval 3 punkti: vastame samal päeval; oksjon algab 24h jooksul; eelhindamine tasuta.
3. **Kuidas kiiroksjon toimib?** — `Steps` (5 sammu, meie originaalsed pealkirjad):
   1. **"Võta ühendust"** — kõne või vorm; spetsialist hindab metsa põhiandmetest.
   2. **"Sõlmime salajase piirhinna"** — sinu ja Eametsad'i vahel kokkulepitud minimaalne aktsepteeritav hind, ostjatele nähtamatu.
   3. **"48 tundi pakkumisi, alates 1 €"** — oksjon avaldatakse portaalis; madal alghind tõmbab maksimaalselt pakkujaid.
   4. **"Notariaalne tehe"** — piirhind ületatud → tehing; teenustasu 3% + km lõpphinnast.
   5. **"Garanteeritud varupakkumine"** — kui pakkumisi piirhinnani ei jõua, teeb ostupakkumise Eametsad OÜ ise (kohustuslik tagatis — vt EAMETSAD-PLAN §14/6).
4. **Miks kiiroksjon?** — ✓-nimekiri (Lucide `Check` `--accent`-is, mitte emoji): "Alustamine tasuta", "Ei ole eelkulud", "Kiirus — nädala jooksul raha juures", "Ostjad eelkontrollitud", "Läbipaistev protsess portaalis", "Varupakkumine tagatud".
5. **Kiiroksjon sobib sulle, kui:** — `--bg-mist` sektsioon, tingimused: "Mets on müügivalmis (kava/teatis olemas või võimalik)", "Soovid kindlat tähtaega", "Hind kiiremini kui maksimum", "Müüdav mahud kuni ~X m³" (küsi kliendilt piir — vt Open questions). Kui ei sobi → viide `/teenused/raieoiguse-muuk` ("Klassikaline oksjon annab tavaliselt kõrgema hinna").
6. **LeadForm #2** (`kiiroksjon-2`) — H2 "Räägime täna läbi" + `tel:` link.

## Interactions & edge cases
- 5. samm on edasimüügi tuum — visuaalselt rõhutatud (ääris `--cta`), ka eraldi `kiiroksjon_step5_view` analüütika.
- Hero CTA ja mõlemad vormid → sama eesmärk; vahe analüütikas form_name abil.

## Data & API
- Sisu CMS `Page`; numbrid (tasu 3%) seotud globaalse seadistusega admin/13 (sisu uueneb, mitte kõvasti kodeeritud).
- Vormid: `POST /api/leads`, `form_name=kiiroksjon-1|kiiroksjon-2` — CRM-is automaatselt `type=quick_auction` eelne eelistus? Ei — tavaline juhtlõige, märgend jääb form_name sisse.

## States
- Kui varupakkumise kohustus ajutiselt peatatud (ära otsus) — admin saab 5. sammu peita/lippuda; vorm töötab edasi.

## Copy (Estonian, draft)
- H1: "48 tunniga reaalsed pakkumised sinu metsale" · "Kuidas kiiroksjon toimib?" · "Miks kiiroksjon on metsaomanikule hea lahendus?" · "Kiiroksjon sobib sulle, kui:" · "Räägime täna läbi" · "Soovid 48 tunniga pakkumised oma metsale?"

## SEO & analytics
- Title: "Kiiroksjon — metsa müük 48 tunniga | Eametsad"; desc: "kiiroksjon, metsa kiirmüük, 48 tundi, metsa müük, ostupakkumine".
- JSON-LD: `Service` + `HowTo` (5 sammu) + `BreadcrumbList`.
- Sündmused: `hero_cta_click`, `step_view{index}`, `step5_view`, `benefit_list_view`, `suitability_check_fail → raieoiguse_link_click` (nimi lihtsustatud: `alt_offer_click`), `lead_form_submit_start/complete{form_name}`, `phone_click`.

## Accessibility & performance
- "48 H" silte ei kanna teavet üksi — H1 kordab sisu ("48 tunniga") ekraanilugejale.
- ✓-nimekiri kasutab Lucide `Check` ikoone tähendusega (`aria-hidden="true"` + tekst kannab sisu) — mitte emoji (viite defekt, mida me ei kopeeri).
- 5. sammu rõhutus ka mitte-värviliselt (äänise + ikoon `ShieldCheck`) — värvipimeduse turvaline.
- Leht OLE hreflang/väga liiklussuure (maksmata kanal) — piisab staatilisest ISR 24h.

## Open questions
- Mahu ülempiir sobivuse jaoks (hetkel kohatühi "X m³")?
- Kas varupakkumise tingimused (hinna alammäär, mis Eametsad ise pakub) avalikustada?

## Dependencies & change log
- Sõltub: 00-global-shell (kate, LeadForm, CookieBanner), README tokenid.
- Muudatused: v1 2026-08-27 (esimene draft).
- Seotud admin: admin/09-leads-crm (vormi esitused), admin/11-cms-content (sisu).
- Varupakkumise kohustus eeldab kliendi kapitalikohustust (plan §14/6) — kinnitada.
- '48 H' silte on küll silmatorkav, kuid ei kanna a11y teavet üksi.
