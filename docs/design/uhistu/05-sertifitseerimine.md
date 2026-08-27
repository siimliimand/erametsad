# Sertifitseerimine — PEFC group certification

> **In brief:** The PEFC certification document library.
| Area | uhistu |
|---|---|
| **Route** | `metsauhistu.eametsad.ee/sertifitseerimine` |
| **Access** | public |
| **In nav** | subsite header "Sertifitseerimine" |

## Purpose & user goals
Member (or prospective member) learns what PEFC group certification means for their forest, downloads the standards and the association's group principles, and understands their obligations; CTA is contact or join.

## Wireframe (desktop)

```
┌────────────────────────────────────────────────────────────────────┐
│ H2 PEFC grupisertifitseerimine                                     │
│ intro ¶ (miks ühiselt sertifitseerida — odavam, ühine audit)      │
├───────────────────────────────────────┬────────────────────────────┤
│ DOKUMENDIKOGU (7col)                  │ LIIGI KOHUSTUSED card(5col)│
│ ┌───────────────────────────────────┐ │ · järgima grupi põhimõtteid│
│ │ PEFC EST 1003 — standard     [PDF]│ │ · metsamajanduskava/kava    │
│ │ Kommenteeritud versioon       [PDF]│ │   kooskõlas standardiga    │
│ │ PEFC EST 1002 — grupinõuded   [PDF]│ │ · auditeerimisele ligipääs │
│ │ PEFC ST 2001 — kaubamärgid    [PDF]│ │ · andmete ajakohasus       │
│ │ Erametsad Metsaühistu — Grupi │ │ CTA [Btn "Küsi sertifitseerimisest"]│
│ │   põhimõtted (meie PDF, Media)│ │ → LeadForm drawer           │
│ └───────────────────────────────────┘ │                            │
├───────────────────────────────────────┴────────────────────────────┤
│ H3 Kuidas liituda grupiga — Steps (3) · <ContactBand>              │
└────────────────────────────────────────────────────────────────────┘
```
Mobile: single column, library list full-width, obligations card below.

## Block-by-block spec
1. **Header** — H2 "PEFC grupisertifitseerimine", intro: the association runs a PEFC group certificate so small private forest owners get certified timber price-premium and market access without individual audit costs.
2. **Document library** — list rows (icon + title + meta + `[PDF, suurus]` chip):
   - External standards (certification-body / Erametsaliit URLs, CMS `documents[]` with `source=external`): PEFC EST 1003 (jätkusuutliku metsamajandamise standard), kommenteeritud versioon selgitustega, PEFC EST 1002 (grupisertifitseerimise nõuded), PEFC ST 2001 (kaubamärkide reeglid).
   - Own document `source=internal` from CMS `Media`: "Erametsad Metsaühistu PEFC grupi põhimõtted" (self-hosted PDF).
   - External rows open new tab; internal rows download. All rows show file size + updated date.
3. **Liigi kohustused card** (bg-mist Card, right rail / below on mobile): 4-bullet summary of member obligations + link to full "Grupi põhimõtted" PDF; CTA opens the shared enquiry drawer (same as teenused): nimi, telefon, email, teema prefilled "Sertifitseerimine", ConsentCheck visible/unchecked/required → `POST /api/leads` (`form_name=sertifitseerimine`).
4. **Kuidas liituda grupiga** — `Steps`: 1) Astu ühistu liikmeks (link /liitu) → 2) Allkirjasta grupi põhimõtted → 3) Sinu mets arvatakse järgmise auditiga grupi sertifikaadi alla.
5. **`<ContactBand>`**.

## Interactions & edge cases
- External links: `rel="noopener noreferrer"`, target \_blank, external icon, `aria-label` with domain; we do NOT mirror third-party PDFs (avoid stale copies) except our own principles doc.
- Broken external URL: row shows "Allikas pole saadaval — kontrolli PEFC Eesti lehte" fallback link instead of dead link.
- PDF list keyboard navigable; file sizes formatted (`.toLocaleString('et-EE')`).

## Data & API
- CMS: `certification` Page with `documents[]` block: `{title, url|mediaId, source, size, updatedAt}`; own PDF in `Media` collection.
- Static generation; revalidate on CMS publish. Leads as per spec.

## States
- No documents configured: EmptyState with "Dokumendid lisanduvad" + contact link (never ship an empty shell page).
- Drawer success/error inline.

## Copy (Estonian, draft)
- H2: "PEFC grupisertifitseerimine"; intro: "Ühiselt sertifitseerides jõuab sertifitseeritud puiduni ka väikeomanik — ühe auditiga, jagatud kuluga."
- Obligations bullets: "Järgid grupi põhimõtteid ja PEFC standardit", "Sinu metsamajandamine põhineb kehtival kaval või puhtal raieplaanil", "Tagad auditi jaoks andmete kättesaadavuse", "Teavitad ühistu olulistest raietest ja kahjustustest".
- CTA: "Küsi sertifitseerimisest" / steps CTA: "Astu liikmeks".

## SEO & analytics
- Title: "PEFC grupisertifitseerimine metsaomanikule | Erametsad Metsaühistu".
- Target long-tail: "mis on grupisertifitseerimine", "PEFC metsasertifikaat erametsas".
- JSON-LD: none beyond Organization breadcrumb; `FAQPage` only if Q/A content added.
- Events: `doc_click{title, source}`, `obligations_view`, `enquiry_submit{sertifitseerimine}`, `join_crosslink_click`.

## Responsive notes
- ≥1024px: 7/5 library/obligations split; library rows single-line with right-aligned PDF chip.
- 768–1023px: obligations card moves above library (CTA earlier); rows wrap to 2 lines.
- <768px: library rows show icon + title (meta on second line); Steps vertical; external-target icon always visible.
- PDF chips sized ≥44px touch target.

## Accessibility
- Library is a semantic list (`<ul>`); each row's primary action is the row-level link.
- External vs internal distinguished by icon + visually-hidden text "(avaneb uues aknas)" / "(allub alla)".
- Steps component uses ordered list semantics.

## States (additional)
- Principles PDF missing in Media: row hidden entirely rather than 404 link (CMS required-field validation warns editors).

## Open questions
- Does the association have an actual certificate number / certifying body to cite (adds trust + allows official link instead of Erametsaliit mirrors)?
- Are member obligations legally reviewed against the statute (põhikiri)? Cross-link needed once statute PDF is in `LegalDocument`.
