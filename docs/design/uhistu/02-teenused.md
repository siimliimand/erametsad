# Teenused — Services single-page scroll
| Area | uhistu |
|---|---|
| **Route** | `metsauhistu.eametsad.ee/teenused` (+ anchors `#istutamine` …) |
| **Access** | public |
| **In nav** | subsite header "Teenused"; home service chips link to anchors |

## Purpose & user goals
Owner wants to know which forestry works the association coordinates and what a given service involves; goal is a service enquiry (päring) or a phone call. Educational copy builds trust before the form.

## Wireframe (desktop)

```
┌──────────────────────────────────────────────────────────────────┐
│ H1 Teenused + intro (bg-mist band)                               │
│ [chip nav: 9 anchors, sticky under header on scroll]             │
├──────────────────────────────────────────────────────────────────┤
│ H2 #istutamine   Istutamine ──────────────── [Btn "Soovin päringut"]│
│   intro ¶ · steps list                     ┌ inline päring card │
│ H2 #hooldusraied Hooldusraied ─────────────┤ (collapsibleDrawer  │
│   "Miks teha hooldusraiet?" + eesmärgid    │  on mobile)        │
│ H2 #taimede-tellimine Metsataimede tellimine + list              │
│ H2 #noustamine Nõustamine — 11 teemat (2-col checklist) + kutseregister link│
│ H2 #taimekaitse Taimekaitse & ulukitõrje (Trico/Cervacol cards)  │
│ H2 #kavad Metsamajandamiskavad                                  │
│ H2 #taimede-hooldus Metsataimede hooldamine                     │
│ H2 #maapind Maapinna ettevalmistus                              │
│ H2 #oksjonid Enampakkumised → oksjonid.eametsad.ee (external band)│
├──────────────────────────────────────────────────────────────────┤
│ <ContactBand>                                                   │
└──────────────────────────────────────────────────────────────────┘
```
Mobile: sections full-width, päring CTA becomes sticky bottom bar after 2nd section; chip nav horizontal scroll.

## Block-by-block spec
1. **Header band** — H1 "Teenused", intro: many services are partly/fully compensable via metsatoetused; link to /toetused.
2. **Sticky chip nav** — 9 anchors matching home chips; `scroll-margin-top` for sticky header; active chip highlighted `--accent` via IntersectionObserver.
3. **Each service block** = H2 (with anchor id) + short intro (2–4 sentences, CMS rich text) + per-service extras below + CTA pair: `<Btn cta>` "Soovin päringut" (opens inline enquiry form drawer, see below) / ghost "Helista +372 …".
   - **Istutamine**: 3-step `Steps` (1 telli maapinna ettevalmistus → 2 telli taimed → 3 istutame või ise + tööriistad).
   - **Hooldusraied**: bullet list of goals (valgus juurdekasvuks, parem kvaliteet, segumetsa väärtesindus jne); note "Hind sõltub asukohast, tihedusest, pindalast — küsi pakkumist".
   - **Metsataimede tellimine**: bulk ordering w/ grower contracts, better price; species list (pot & bare-root kuusk/kask/männ/lepp).
   - **Nõustamine**: 11 advisory themes in a 2-col checklist: alustav metsaomanik; dokumendid ja õigused; metsamajandamiskava; metsauuendamine; noorendike hooldamine; raiete põhimõtted; tööde kvaliteedi kontroll; metsa- ja ulukikahjustused; ökonoomika ja kalkulatsioonid; toetused sh pindade määramine; Natura 2000 piirangud. Link to kutseregister.ee standard; note: office visits by pre-registration (→ /kontakt).
   - **Taimekaitse & ulukitõrje**: two product cards — Trico (looduslik hirvepelati, 6–10 l/ha, ~6 kuud) and Cervacol Extra (juhetõmblite kaitseks) — "telli ühistu kaudu".
   - **Metsamajandamiskavad**: "metsa pass", 10-aastane plaan, takseerandmed; link to main site kava päring.
   - **Metsataimede hooldamine**: umbrohutõrje/noorendike niitmine.
   - **Maapinna ettevalmistus**: harvendusraie-järgne pinna ettevalmistus (kaevukulturistid/kobestus).
   - **Enampakkumised**: distinct band (bg-mist) cross-selling `oksjonid.eametsad.ee` — raieõiguste ja kinnistute oksjonid; CTA external.
4. **Inline päring drawer** — one shared `<Drawer>` (not per-section forms): fields nimi, telefon, email, metsa asukoht (text), teenus (prefilled from clicked section, `Select` w/ 9 options), message optional, ConsentCheck (visible, unchecked, required). → `POST /api/leads` (`form_name=teenused-paering`, `page=/teenused`, `service=<slug>`).
5. **`<ContactBand>`**.

## Interactions & edge cases
- Anchor links update `location.hash` without jump (smooth scroll); back button returns to top of section.
- Drawer: ESC closes, focus trap, persists draft in sessionStorage.
- External oksjonid link: `rel="noopener noreferrer"`, new tab, icon.
- Phone CTA is `tel:` link.

## Data & API
- Content from CMS `Page` blocks (§4.5) — one `teenused` page with `serviceSection` repeatable block: `{anchor, title, body(rich), variant(steps|bullets|products|external)}`.
- Päring → `POST /api/leads` with `service` field → auto-assignment by service type (admin/10).

## States
- Drawer submit success: inline confirmation + "Sulgen" ; error: inline + retry.
- Missing CMS section: section skipped, chip nav rebuilt from present anchors.

## Copy (Estonian, draft)
- H1: "Teenused"; intro: "Teeme metsatööd algusest lõpuni — ja suur osa teenustest on toetustega kaetud."
- CTA: "Soovin päringut" / "Küsi nõu" / "Vaata oksjoneid".
- Drawer title: "Teenusepäring"; consent: "Olen nõus, et Erametsad Metsaühistu töötleb mu andmeid ja võtab ühendust." (unchecked, required).

## SEO & analytics
- Title: "Metsaühistu teenused — istutamine, hooldusraied, nõustamine | Erametsad Metsaühistu".
- One H1; service names in H2 → long-tail coverage ("metsataimede tellimine", "ulukitõrje Trico").
- `FAQPage` JSON-LD not used (no FAQ); consider `Service` JSON-LD list (v2).
- Events: `service_section_view{anchor}` (IntersectionObserver), `enquiry_open{service}`, `enquiry_submit{service}`, `auctions_crosslink_click`.

## States
- Drawer submit success: inline confirmation + "Sulgen"; error: inline + retry.
- Missing CMS section: section skipped, chip nav rebuilt from present anchors.
- Slow CMS: page renders with sections as they stream (SSG, so normally instant).

## Responsive notes
- ≥1024px: sections alternate bg white / bg-mist for rhythm; intro max-width 65ch.
- 768–1023px: päring CTA per-section inline (no drawer), form placed under CTA in `<Drawer>` from bottom.
- <768px: sticky bottom CTA bar "Soovin päringut · +372 …" appears after user scrolls past 2nd section; chip nav horizontal scroll with snap; steps become vertical `Steps`.
- Long-page navigation: chip nav sticky with backdrop blur; `scroll-behavior: smooth` guarded by `prefers-reduced-motion`.

## Accessibility
- Sticky chip nav is a `<nav aria-label="Teenuse jaotised">`; active chip `aria-current="true"`.
- Drawer: role=dialog, labelled by form title, focus trap, ESC close, background inert.
- Product names (Trico, Cervacol Extra) styled as text, logos only if supplier permits.

## Open questions
- Product cards (Trico/Cervacol): will the association actually resell, or only advise? Affects whether we show "telli" CTA or "küsi".
- Should Nõustamine 11 themes live as CMS checklist collection for reuse on /liitu?
- Per-service pricing hints (reference shows only "küsi") — do we ever publish price ranges?
