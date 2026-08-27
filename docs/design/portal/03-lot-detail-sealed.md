# Suletud pakkumise leht — Sealed-bid (pimepakkumine) auction detail
| Area | portal |
|---|---|
| **Route** | `/oksjon/:id` (shared lot-detail layout, `auctionType: "sealed"` — all metskinnistu, põllumaa, pakett lots; some raieõigus) |
| **Access** | public browsing; sealed bid = authed + per-type rights |
| **In nav** | listing tabs Metskinnistud / Põllumaad / Paketid; marketing kinnistu-müük page |

## Purpose & user goals
A buyer reviews the property dossier and submits exactly one confidential offer (amount + identity data) before the deadline; after the deadline they learn only whether they won and the published final price.

## Wireframe (desktop)
```
┌──────────────────────────────────────────────────────────────────────────┐
│ ‹ Kõik oksjonid  ÖÖVIIULI · Metskinnistu  [Aktiivne]      ⏱ 5p 12:00:00  │
├───────────────────────────────┬──────────────────────────────────────────┤
│ [gallery]                     │  PIMEPAKKUMINE PANEL                      │
│ Alghind 28 000 €              │  "Kõik saabunud pakkumised avatakse       │
├───────────────────────────────┤   üheaegselt peale tähtaja lõppemist."    │
│ ASUKOHT & KAART               │  ─ authed+rights ─                        │
│ Harju mk · Kernu vl · kaart   │  Pakkuja nimi*        [____________]      │
│ ┌ Kataster ↗ · Metsaregister ↗┤  Isikukood/registrikood* [___________]   │
├───────────────────────────────┤  Pakkuja aadress*     [____________]      │
│ ANDMETABEL                    │  E-mail*              [____________]      │
│ katastrid, register nr,       │  Telefon*             [____________]      │
│ pindala, puuliigid, metsateat…│  Pakkumise summa €*   [___________]       │
│ (no bidStep — sealed)         │  [ ESITA PIMEPAKKUMINE ]                  │
├───────────────────────────────┤  ⓘ Teenustasu rakendub vaid oksjoni       │
│ INFO (rich text) │ FAILID     │    võitmise korral.                       │
├───────────────────────────────┼──────────────────────────────────────────┤
│ [SpecialistCard + alias mail] │  SINU PAKKUMINE: locked card / empty      │
└───────────────────────────────┴──────────────────────────────────────────┘
```
Mobile: single column; bid form in sticky bottom sheet that expands from "Esita pimepakkumine" peek bar; identity fields prefilled from profile (editable).

## Block-by-block spec
1–7. **Identical to 02-lot-detail-open.md blocks 1–7** (header/countdown, gallery, map + kataster/Metsaregister links, full field table — omit `bidStep`; include `propertyCount`, `packageDescription`, `packageTable` rows for package lots — rich-text blocks, files, SpecialistCard + alias e-mail).
8. **Sealed bid panel** (replaces BidPanel):
   - Explanation copy card: "Pimepakkumine: kõik saabunud pakkumised avatakse üheaegselt peale tähtaja lõppemist. Ühtegi pakkumist ei näe ei müüja ega teised pakkujad enne avamist."
   - Identity fields (snapshot stored with bid): Pakkuja nimi, Isikukood/registrikood (validate 11 vs 8 digits), Pakkuja aadress, E-mail, Telefon — prefilled from active profile, editable.
   - Pakkumise summa € — numeric, ≥ minBid unless lot allows under-reserve (not typical; show hint "Soovitame alghinnast madalamat pakkumist vältida — reservhind ei ole avalik").
   - Submit → confirm Modal "Pakkumine on siduv ja pärast esitamist muuta ei saa. Kinnita summa {X} €." → success state.
   - Notice: "Teenustasu rakendub vaid oksjoni võitmise korral."
9. **No bid list.** Instead a "Pakkumuste arv: N" counter only (no amounts, no times beyond "viimane eest {t}" — optional; recommend count only).
10. **Your-bid card** — states below (none / submitted / revision window / ended).

## Interactions & edge cases
- Isikukood checksum validation client-side + server; registrikood 8 digits; error "Isikukood peab olema 11 numbrit või registrikood 8 numbrit."
- Single-bid rule default: after submit the form locks (sum blurred as ••• •••) with timestamp; revision policy state (if auction allows N revisions): "Sul on õigus pakkumist muuta {k} korda enne tähtaega" — amount input reopens, earlier snapshot kept in audit.
- Countdown hits zero client-side: form disables immediately; server SSE `auction:ended` authoritative — if user raced the clock, server response wins ("Pakkumine jõudis kohale / tähtaeg möödus").
- Double-submit guarded (button disabled + idempotency key).
- Draft autosave of identity fields (not amount) per browser.

## Data & API
| Field | Source |
|---|---|
| lot dossier | `GET /api/auctions/:id` (sealed: no `leadingBidAmount`, no bids subcollection payloads) |
| bid count | `bidCount` on auction response |
| submit sealed bid | `POST /api/bids/create` {auctionId, amount, type:"sealed", identity_snapshot{name, id_code, address, email, phone}} — encrypted at rest until opening |
| my submitted flag/timestamp | `GET /api/with-user-bids` filtered, or `GET /api/auctions/:id` personalized flag |
| revision | subsequent `POST /api/bids/create` while revision window open |
| result | `finalPrice` on auction after admin opening (`POST /api/admin/auctions/:id/open-sealed`) |
| realtime | SSE: `auction:ended` (no bid events — nothing to stream) |
Caching: page cacheable until end (no bid data in response).

## States
- **Guest**: "Pakkumise esitamiseks logi sisse" CTA + explanation copy still shown.
- **Authed, no rights**: "Sul puuduvad õigused seda tüüpi oksjonil pakkumist teha. Pöördu info@eametsad.ee poole."
- **Authed, not submitted**: full form.
- **Submitted**: locked card "Pakkumine on esitatud {dd.mm.aaaa hh:mm}. Pakkumist ei saa enne avamist vaadata." (+ revision button if allowed).
- **Ended, not opened**: "Tähtaeg on möödas. Pakkumised avatakse — tulemus teatatakse e-postiga."
- **Ended, opened**: public: "Lõpphind {finalPrice} €" — no winner identity anywhere. Loser (authed own view): "Sinu pakkumine ei olnud edukaim." Winner: banner + link to `/lepingud/oksjonileping/:auctionId` contract flow.
- **Unsold** (top bid < reserve): "Oksjon jäi müümata." (+ kiiroksjon variant: "Eametsad esitab varupakkumise" handled by admin flow).
- Loading skeleton / error retry as usual.

## Copy (Estonian, draft)
"Pimepakkumine" · "Kõik saabunud pakkumised avatakse üheaegselt peale tähtaja lõppemist." · "Esita pimepakkumine" · "Pakkumine on esitatud" · "Pakkumine on siduv" · "Lõpphind" · "Oksjon jäi müümata" · "Sinu pakkumine ei olnud edukaim"

## SEO & analytics
SSR fully (no dynamic data until end). Title "{name} — {metskinnistu/põllumaa/pakett} oksjon | Eametsad". Events: sealed_bid_submitted, sealed_form_validation_error, result_viewed.

## Open questions
- Show live bid *count* or hide entirely until end? (Reference shows nothing; count builds trust — recommend showing count only.)
- Identity fields for already-verified eID users: prefill + lock, or keep editable snapshot? (Recommend lock isikukood, editable contact fields.)
