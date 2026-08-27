# Metsaspetsialistid — Specialists (+ profiili lehe mall)
| Area | marketing |
|---|---|
| **Route** | `/meist/metsaspetsialistid` + profiilid `/meist/<nimi>` (6 tk) |
| **Access** | public |
| **In nav** | "Meist" → 1. alamleht |

## Purpose & user goals
Omanik valib enda piirkonna spetsialisti, kellega otse rääkida (telefon/e-mail), või klikib profiilile tutvumiseks. Leht on "näod, mitte firma" usaldusplokk.

## Wireframe (desktop)

```
┌──────────────────────────────────────────────────────────────────────┐
│ HERO: H1 "Meie metsaspetsialistid" + lühintro + LEADFORM #1 (kitsas) │
├──────────────────────────────────────────────────────────────────────┤
│ SPETSIALISTIDE RUUDUSTIK (3×2, 6 SpecialistCard'i):                  │
│ ┌────────────┐ ┌────────────┐ ┌────────────┐                         │
│ │ foto       │ │ foto       │ │ foto       │                         │
│ │ Nimi       │ │ Nimi       │ │ Nimi       │                         │
│ │ roll       │ │ roll       │ │ roll       │                         │
│ │ ☎ otsene  │ │ …          │ │ …          │                         │
│ │ ✉ otsene   │ │            │ │            │                         │
│ │ bio 2rida  │ │            │ │            │                         │
│ │ [Loe lähemalt →]│         │ │            │                         │
│ └────────────┘ └────────────┘ └────────────┘                         │
├──────────────────────────────────────────────────────────────────────┤
│ Ettevõtte blokk + missioon (samad komponendid nagu 13-meist)         │
├──────────────────────────────────────────────────────────────────────┤
│ LEADFORM #2 · ContactBand · Footer                                   │
└──────────────────────────────────────────────────────────────────────┘
```
**Mobiil:** kaardid 1 veerg (6 järjestikku); telefon/e-mail numbrid suured klõpsitavad nupud.

## Block-by-block spec
1. **Hero** — H1 (draft) "Meie metsaspetsialistid", intro: "Igas maakonnas oma inimene — helista või kirjuta otse." Kitsas `LeadForm #1` (`metsaspetsialistid-1`) paremal.
2. **SpecialistCard (6 tk)** — iga kaart: foto (16:10, ümarad nurkad), nimi (Manrope 22px), roll (nt "metsaspetsialist", kohatäited), **otsene telefon** (tel: link), **otsene e-mail** (mailto:), 2-realine bio, "Loe lähemalt" → profiil. Kaardid klõpsitavad tervelt profiilile (telefon/e-mail eraldi klikitavad — lõpetav `stopPropagation`).
3. **Ettevõtte + missiooniplokk** — sama komponent nagu 13-meist plokk 2–3 (taaskasutus, sisu jagatud).
4. **LeadForm #2** (`metsaspetsialistid-2`).

### Spetsialisti profiili lehe mall — `/meist/<nimi>`
- Slug: eesnimi-perenimi trankriteeritult (`/meist/eesnimi-perenimi`).
- Struktuur: hero (foto suures + nimi + roll + otsekontaktid kõrvuti) → täisbio (rich text: kogemus, piirkond, erialased teemad, keeled) → "Metsad, mida [nimi] müüb" — kuni 4 selle spetsialisti aktiivse `LotCard`i (`GET /api/auctions?specialist=<id>&status=active&limit=4`; tühi → plokk peidetud) → viited spetsialisti artiklitele (`Article.author`) → `LeadForm` **eelvalitud spetsialistiga** (vt Data) → teiste spetsialistide karussell (4 mini-kaarti).
- Välised sotsiaalingid (LinkedIn) valikulised.

## Interactions & edge cases
- Kaardil fookuses (klaviatuur) toimub `Enter` profiilile; telefon/e-mail on eraldi `tab`-peatused.
- Profiili LeadForm saadab varjatud välja `assigned_specialist` (soovitus CRM-is — admin saab määrata, aga eelnev täidab).

## Data & API
- `GET /api/specialists` (SSG; CMS `Specialist`: name, slug, role, phone, email, photo, bio, long_bio, region, active).
- Profiilil: `GET /api/auctions?specialist_id&status=active&limit=4`; artiklid `Article.author → specialist`.
- Vormid: `POST /api/leads` `{form_name:"meist-<nimi>-1", assigned_specialist_id?}`.

## States
- Spetsialist deaktiveeritud (`active:false`) → kaart kadub, profiil annab `301` → `/meist/metsaspetsialistid` (SEO tervis; `Redirect` CMS kogum).
- Fotota spetsialist → initsiaalidega placeholder.
- Profiili oksjonid 0 → plokk peidetud.

## Copy (Estonian, draft)
- H1: "Meie metsaspetsialistid" · "Igas maakonnas oma inimene." · "Loe lähemalt" · profiili CTA: "Küsi [nimi] käest — esimene nõu on tasuta." · "Metsad, mida [nimi] müüb" · "Teised spetsialistid".

## SEO & analytics
- Title: "Metsaspetsialistid | Eametsad"; profiilil "[Nimi], [roll] | Eametsad".
- JSON-LD: profiilil `Person` (töökoht, kontakt) + `BreadcrumbList`.
- Sündmused: `specialist_card_click{name}`, `specialist_phone_click{name}`, `specialist_email_click{name}`, `specialist_profile_lot_click{lot_id}`, `lead_form_submit{form_name, with_prefill:true|false}`.

## Accessibility & performance
- Kaardi klikitav pind ja sees olevad tel/mail lingid eraldatud (`stopPropagation` + eraldi tab-peatused).
- Fotodel `alt=""` (nimi kannab sisu; foto dekoratiivne), nimed H3-ena.
- Profiili leht SSG + ISR 1h; oksjonikaardid ei blokeeri esialgset renderdust.

## Open questions
- Kas spetsialistid näitavad ka WhatsAppi/ Messengerit? (Soovitus: ainult telefon + e-mail — hoitud ärikanalid.)
- Nimede kuvamine URL-is eesti tähestiku täppidega — kasutame ASCII sluge (trankri), ei tehta umlaute (SEO ja jagatavus).

## Dependencies & change log
- Sõltub: 00-global-shell (kate, LeadForm, CookieBanner), README tokenid.
- Muudatused: v1 2026-08-27 (esimene draft).
- Seotud admin: admin/09-leads-crm (vormi esitused), admin/11-cms-content (sisu).
- Profiili malli kasutatakse 6 leheks; deaktiveerimisel 301 -> spetsialistide leht.
- LeadForm profiilil saadab assigned_specialist_id eelvalikuna CRM-i.
