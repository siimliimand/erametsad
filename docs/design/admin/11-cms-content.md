# Sisuhaldus — CMS content
| Area | admin |
|---|---|
| **Route** | `/sisu` (collections sidebar), `/sisu/:collection`, `/sisu/:collection/:id` |
| **Access** | content-editor = admin, superadmin (marketing collections); specialists read-only for their own Specialist profile |
| **In nav** | sidebar "Sisu" |

## Purpose & user goals
Manage every marketing-site collection (eametsad.ee): build pages from blocks, write articles with SEO control, maintain FAQ/testimonials/legal/redirects/menus and the media library — with draft/preview/publish workflow and revisions.

## Wireframe (desktop)
```
┌────────────┬──────────────────────────────────────────────────────────────┐
│ KOGUMIKUD  │ Lehekülg: /teenused/raieoiguse-muuk   ● avaldatud · v2        │
│ ◧ Leheküljed│ [Blokid] [SEO] [Ajavedu]                                     │
│ 📄 Artiklid │ ┌─────────────────────────────┬─────────────────────────────┐│
│ ? KKK      │ │ Blokiloend (Lohista)        │ Eelvaade                    ││
│ 👤 Spets-  │ │ 1 ▤ Hero            [↑↓⠿✎✕] │ ┌───────────────────────┐   ││
│ 💬 Tagasiside│ 2 ▤ Tekst "Miks oksjon?"[↑↓⠿✎✕]│ │ hero: Müü mets…      │   ││
│ 🌲 Toetused│ │ 3 ▤ Protsess-akordeon   […] │ │ tekstiplokk           │   ││
│ ⚖ Õigusdok-│ │ 4 ▤ Vorm (põhivorm)     […] │ │ (live iframe preview) │   ││
│ 🖼 Meedia   │ │ + Lisa blokk ▾             │ └───────────────────────┘   ││
│ ⇄ Suunamine│ └─────────────────────────────┴─────────────────────────────┘│
│ ☰ Menüüd   │ [Salvesta mustand] [Eelvaade ↗] [Avalda]                      │
└────────────┴──────────────────────────────────────────────────────────────┘
```

## Block-by-block spec
1. **Collections sidebar** — Leheküljed, Artiklid, KKK, Spetsialistid, Tagasiside (testimonials), Toetuste programmid (Phase 5 single-source), Õigusdokumendid (legal), Meedia, Suunamised (redirects), Menüüd. Counts per collection. Selection drives list view (DataTable: pealkiri, olek (mustand/avaldatud/plaanitud), uuendatud, autor).
2. **Page block-builder**:
   - Block types ▾: Hero (H1, intro, 2 CTA'd, taustapilt+focal), Tekst (rich text + ankur), Kaardid (up to 3: pealkiri, ikoon, tekst, link), Akordeon (section title + items[] question/answer), Vorm (vali vorm: põhivorm/kava/hooldusraie/istutamine + pealkiri), Oksjonite ticker (objectType filter, kaartide arv), Statistika (numbriks + allikas: live/ Staatiline), CTA (pealkiri+nupp), Tagasiside (vali testimonial-id'd).
   - List: drag reorder (⠿), per-block collapse, ✎ opens field form in drawer, ✕ remove (confirm). Per-block "Näita ainult: [kõik/mobiil/desktop]" advanced toggle.
   - Draft/publish: Salvesta mustand / Eelvaade (preview URL with token, device switcher) / Avalda (makes live; immutable published snapshot + revision).
3. **Article editor** — pealkiri, slug (auto, editable, uniqueness), kaanepilt (media picker, alt required), sisu rich text (H2/H3, images, embeds, tables), kategooria (Uudised/Klientide lood/…), autor (specialist select), avaldamise aeg (kohe või planeeritud datetime).
   - **SEO panel**: SEO pealkiri (char counter /60), kirjeldus (/160), OG pilt (fallback hero), kanoniline URL, robots (index/noindex, follow/nofollow). Serp-preview snippet.
   - Revisions tab: version list (aeg, autor), vaata diff, taasta (creates new revision — never overwrite).
4. **KKK manager** — categories list (name, slug, order, aktiivne) → items table per category: küsimus, lühitekst, täistekst (rich, "Loe edasi…" expander), järjekord (drag), aktiivne. Ordering persists to portal chip-nav order.
5. **Media library** — grid thumbnails; upload (drag-drop multi); detail: focal point picker (crops 16:10/1:1/350×175 thumb auto), **alt text required** (publish gate), credits, kasutuskohad (which pages reference), replace-file (keeps id, new rendition). Search by name/alt.
6. **Redirect manager** — table: Siit (path) → Sinna (path/URL), tüüp 301/302, aktiivne, tabamusi (hit count from redirect middleware), loodud. Create validates loops & chains (max 2 hops warn). Import bulk CSV.
7. **Menu builder** — trees for header dropdowns + footer columns; nodes: label, link (internal page/article picker or URL), alammenüü nested drag; aktiivne toggle. Publishing a menu is instant (no draft).
8. **Õigusdokumendid / Spetsialistid / Testimonials / Toetused** — standard collection forms: legal docs (title, kehtiv alates, PDF media, näita privaatuspõhimõttes link), specialists (nimi, amet, foto, telefon, e-post, bio, aktiivne — feeds portal lot specialist cards), testimonials (klient, tekst, rating?, foto, avaldatud), subsidy programs (nimi, tähtaeg, määrad tabel, tingimused rich, dokumendid, kanal e-PORIA/ühisavaldus).

## Interactions & edge cases
- Publish gate: missing alt texts, empty required blocks (hero), broken internal links block with summary.
- Slug changes auto-suggest creating a redirect (checkbox default on).
- Scheduled publish via queue; timezone Europe/Tallinn.
- Concurrent edit: last-save-wins warning banner like 03.
- Keyboard: ⌘S save draft, ⌘⇧P preview.

## Data & API
Payload-style collections `GET/POST/PATCH /api/admin/pages|articles|faq|specialists|testimonials|subsidy-programs|legal|media|redirects|menus`; publish flow `_status` draft/published + versions collection; public read via `GET /api/pages|articles|faq` (marketing SSG/ISR).

## States
New collection empty: "Lisa esimene {üksus}" EmptyState. Preview token expires 24h. Publish blocked state shows itemised errors.

## Copy (Estonian, draft)
"Sisuhaldus" · "Leheküljed" · "Lisa blokk" · "Salvesta mustand" · "Avalda" · "Eelvaade" · "Ajavedu" · "Taasta versioon" · "SEO pealkiri" · "Otsingumootri kirjeldus" · "Kanoniline URL" · "Alternatiivtekst on kohustuslik" · "Suunamine" · "Tabamusi" · "Menüü" · "Planeeritud avaldamine".

## Permissions & audit
Audit-logged: publish, schedule, version restore, redirect create/delete, menu publish, media replace. Specialists may edit only their own Specialist record (proposal to admin for approval at launch).

## Page block-builder field forms (per block, in drawer)
- **Hero**: H1*, intro (max 300), CTA1 label+URL*, CTA2 optional, background image (media picker, focal), overlay strength (0–80%).
- **Tekst**: pealkiri (H2), rich text, ankur slug (auto from title, editable).
- **Kaardid**: items[1–3] each: pealkiri, ikoon (Lucide select), tekst, link; section title.
- **Akordeon**: section title, items[] {küsimus, vastus (rich), avatud-vaikimisi}.
- **Vorm**: vormi tüüp select (põhivorm / kava / hooldusraie / istutamine), ploki pealkiri, paigutus (kaardil/heledal taustal).
- **Ticker**: objectType filter, kaartide arv (2–8), automaatvärskendus (s).
- **Statistika**: items[] {number väärtus, sufiks (+/€/%), silt, allikas: live-metric select | staatiline}.
- **CTA**: pealkiri, tekst, nupu label+URL, stiil (amber/green).
- **Tagasiside**: testimonial multiselect (from collection), paigutus (grid/ sliders).

## Draft/publish model (all collections)
`_status`: mustand → avaldatud (+planeeritud `published_at`). Publish snapshots full JSON as revision; live site reads published only. Unpublish returns page to draft (warning: URL 404s — suggest redirect creation checkbox).

## Media detail fields
Fail, laius×kõrgus, suurus, formaat · **Alt-tekst*** (publish gate) · focal point (visual pin; crops 16:10 hero, 1:1, 350×175 thumb) · autor/koostaja · kasutuskohad (referencing pages list) · asendatud (replace keeps ID + renditions regenerated, logged).

## Redirect validation rules
- From must be internal path (starts /), no query (fragment stripping note).
- To internal path or absolute URL; no self-redirect; chain depth >2 warn; loops block save.
- Deleting a redirect requires typed reason; hit counts retained.

## Keyboard & workflow shortcuts
⌘S save draft · ⌘⇧P open preview · in block list: Alt+↑/↓ move focused block · Enter edit focused block. "Vaata avaldatud versiooni" diff link on every draft.

## Accessibility
Block reorder via Alt+arrows (keyboard parity with drag); alt-text gate improves output site; rich editors expose raw-HTML source view (power users) with sanitise on save; preview iframe respects reduced-motion.

## Collections list-view columns
| Collection | Columns |
|---|---|
| Leheküljed | pealkiri, tee (path), olek, uuendatud, autor |
| Artiklid | pealkiri, kategooria, autor, avaldatud/planeeritud, olek |
| KKK | (per category) küsimus, järjekord, aktiivne, uuendatud |
| Spetsialistid | nimi, amet, aktiivne, oksjoneid (lots referencing) |
| Tagasiside | klient, hinnang, avaldatud |
| Toetused | nimi, tähtaeg, avaldatud |
| Õigusdokumendid | pealkiri, kehtiv alates, tüüp |
| Meedia | grid; filter: kasutamata (orphan-cleanup tool) |
| Suunamised | siit, sinna, tüüp, tabamuid, aktiivne |
| Menüüd | nimi, asukoht (header/footer), uuendatud |

## States (full)
- New collection: "Lisa esimene {üksus}" with per-collection hint.
- Publish blocked: itemised error list with jump links.
- Preview token expired: "Eelvaade aegus — loo uus" button.
- Concurrent edit banner (as 03).

## Open questions
- Workflow approval (editor proposes → admin publishes) needed at launch or single-role editing suffices?
- Subsidy programs collection frozen until Phase 5 or seeded now?
- Long-tail SEO landing pages (plan §4.1, ~20) — same Page builder + dedicated SEO template preset?
