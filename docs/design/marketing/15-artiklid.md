# Artiklid — Articles hub + artikli mall

> **In brief:** The articles hub (news and customer stories) and the article detail template.
| Area | marketing |
|---|---|
| **Route** | `/artiklid` (hub) + `/artiklid/<slug>` (artikli mall) + `/artiklid/uudised`, `/artiklid/klientide-lood`, `/artiklid/kasutustingimused` |
| **Access** | public |
| **In nav** | "Uudised" → `/artiklid` |

## Purpose & user goals
Lugeja sirvib uudiseid, kliendilugusid ja teadmist; iga artikkel lõpeb konversiooniga (CTA-bänd + LeadForm). Hub on ka SEO sisukorje punkt (~200+ artikli planeeritud, vt ERAMETSAD-PLAN §13).

## Wireframe (desktop)

```
┌──────────────────────────────────────────────────────────────────────┐
│ H1 "Artiklid ja uudised"                                             │
│ KIIP-NAV: [Kõik] [Uudised] [Kliendilood] [Teadmised] [Õigusakte]     │
├──────────────────────────────────────────────────────────────────────┤
│ ESILEHE TÖÖD: 1 suur feature Card (viimane featured artikkel)        │
├──────────────────────────────────────────────────────────────────────┤
│ ARTIKLITE RUUDUSTIK (3 veergu, Card: kuupäev, kategooria,            │
│  pealkiri, lühikokkuvõte, thumb 16:10)                               │
│ [Vanemad artiklid ▼] (nupp-paginatsioon)                             │
├──────────────────────────────────────────────────────────────────────┤
│ UUDISKIRI (sama komponent nagu avalehel)                             │
├──────────────────────────────────────────────────────────────────────┤
│ ContactBand + Footer                                                 │
└──────────────────────────────────────────────────────────────────────┘
```
**Mobiil:** kiibid horisontaalne scroll; ruudustik 1 veerg; feature-kaart täislaius; "Vanemad artiklid" laadib järgmise lehe (nupp, mitte lõpmatu scroll — lihtsam ja kiirem).

## Block-by-block spec
1. **Hub** — H1 (draft) "Artiklid ja uudised"; kiip-kategooriad (CMS `Article.category`: Uudised / Kliendilood / Teadmised / Õigusaktid — viimane sisaldab kasutustingimusi jms; "Kõik" vaikenähtav).
2. **Feature-kaart** — kõige uuem `featured:true` artikkel: pool lehe lauses, suur foto, pealkiri 28px, kokkuvõte, `Btn` "Loe artiklit".
3. **Ruudustik** — 9 kaarti lehel; `Card` komponent; sorteering kuupäeva desc; serveripoolne lehekülje pookimine `/artiklid?page=2` (SEO-sõbralik; nupp "Vanemad artiklid" laadib täislehe, mitte AJAX-i — crawlability).
4. **Kategooria vaated** — `/artiklid/uudised`, `/artiklid/klientide-lood` jne — sama leht eelfiltriga, kiip aktiivne; `canonical` kategooria URL-ile.
5. **Uudiskiri** — identne avalehe plokuga 8 (taaskasutatud komponent).

### Artikli lehe mall — `/artiklid/<slug>`
- Hero: kategooria kiip + kuupäev + autor (link spetsialisti profiilile, kui `Article.author` määratud) + H1 (36px) + sotsiaalne jagamine (FB/X/LinkedIn copy-link nupp).
- Keha: rich text, H2/H3, pildid 16:10 (lazily), tsitaadid, failid (nt statistika PDF); laius 8-col; lauaarvuti paremal sisukord kui > 4 H2 (kordab 04 malli kõrvalmenüüd).
- **CTA-bänd** artikli sees või lõpus (valitav CMS-is): "Konsultatsioon on tasuta" → `#kontaktvorm` (taaskasutatud 04 plokist 5).
- **LeadForm** (`artikkel-<slug>-1`) — artikli lõpus.
- **Seotud artiklid** — 3 `Card` (sama kategooria või ühised märksõnad, CMS-i väli `related[]`; automaatne tagasiulatuvalt kategooria järgi).

## Interactions & edge cases
- Share-nupud ei laadi sotsiaalvõrgu skripte enne klõpsu ( privaatsus + jõudlus — vaid link-aken + copy-link).
- Paginatsiooni nupp muutub "Laadin…" state'i; lehe vahetus scrollib ruudustiku tippu.

## Data & API
- CMS `Article(slug, title, category, date, author→Specialist, summary, body, hero, featured, related[], seo)`; hub SSG + ISR 10 min; artiklid SSG.
- Hubi lehitsemine serveripoolne (page query); kogu lugemine `GET /api/articles?category&page&limit=9`.
- Vorm: `POST /api/leads`, `form_name=artikkel-<slug>-1`; uudiskiri `POST /api/newsletter`.

## States
- Kategoorias 0 artiklit → `EmptyState` "Selles kategoorias pole veel artikleid" + viide "Kõik".
- Kujutis puudub → gradient-placeholder kategooria ikooniga.

## Copy (Estonian, draft)
- H1: "Artiklid ja uudised" · "Loe artiklit" · "Vanemad artiklid" · "Seotud artiklid" · "Jaga" · "Kopeeri link" · "Konsultatsioon on tasuta" (CTA-bänd).

## SEO & analytics
- Title: hub "Artiklid ja uudised | Erametsad"; artikkel "[Pealkiri] | Erametsad". Igal artiklis canonical + `og:image` (hero).
- JSON-LD: artikkel `Article` (+ `author` Person kui määratud); hub `CollectionPage` + `BreadcrumbList`.
- Sündmused: `article_card_click{slug}`, `chip_category_click{category}`, `pagination_next{page}`, `share_click{network}`, `copy_link_click`, `read_progress{25|50|75|100}`, `lead_form_submit_start/complete`, `related_article_click{slug}`.

## Accessibility & performance
- Jagamisnupud `aria-label`-iga ("Jaga Facebookis"); copy-link annab `Toast` kinnituse.
- Feature/kaardi pildid `aspect-ratio: 16/10` reserveeritud — CLS 0.
- Artikli keha tüpograafia 18px/1.6, maks laius 68 tähemärki (loetavus).
- Hub lehitsemine serveripoolne — JS ei ole vajalik sirvimiseks.

## Open questions
- Kategooria "Õigusaktid" vs eraldiseisev `/artiklid/kasutustingimused` leht (viitel on viimane juriidiline leht) — soovitus: kasutustingimused eraldi staatilise lehena ilma hubi paginatsioonita.
- ~200 SEO-artikli migratsioon/valmistamise plaan eraldi sisutootmise dokumendis.

## Dependencies & change log
- Sõltub: 00-global-shell (kate, LeadForm, CookieBanner), README tokenid.
- Muudatused: v1 2026-08-27 (esimene draft).
- Seotud admin: admin/09-leads-crm (vormi esitused), admin/11-cms-content (sisu).
- Jagamisnupud on lihtsad lingid + copy-link (skripte ei laadita).
- Sisutootmise programm: ~200 artiklit, vt plan §13 'Ongoing'.
- Artikli CTA-bändi tekst on CMS-i sisestatav, vaikeväärtus 'Konsultatsioon on tasuta'.
