# Avatud oksjoni leht — Open (ascending) auction detail & bidding
| Area | portal |
|---|---|
| **Route** | `/oksjon/:id` (variant of shared lot-detail layout for `auctionType: "open"`, `auctionStatus: "active"`) |
| **Access** | public browsing; bidding = authed + per-type rights + signed raamleping |
| **In nav** | from listing cards/map, marketing ticker, e-mail links |

## Purpose & user goals
A buyer evaluates the full lot dossier (location, forest data, deadlines, files) and places, raises, or automates a bid. Guest/limited states must make the path to bidding obvious without leaking data.

## Wireframe (desktop)
```
┌──────────────────────────────────────────────────────────────────────────┐
│ ‹ Kõik oksjonid   LEPsi · Raieõigus  [Aktiivne]            ⏱ 2p 04:33:12 │
├───────────────────────────────┬──────────────────────────────────────────┤
│ [gallery 16:10  ○○○]          │  BID PANEL (sticky, 4-col right)         │
│ Alghind 4 500 € · samm 250 €  │  Hetkel kõrgeim: 6 250 € (12 pakkumist)  │
├───────────────────────────────┤  [ – ] 6 500 € [ + ]                     │
│ ASUKOHT & KAART               │  Automaatpakkuja max: [ ____ ] €  ⓘ      │
│ [MapEstonia w/ pin]           │  ☐ Alapakkumine (vajab müüja nõusolekut) │
│ Harju maakond · Kernu vald    │  [ TEE PAKKUMINE ]                       │
│ ┌─ Kataster ↗ ─ Metsaregister ↗ ─┐ │  ⓘ Teenustasu rakendub vaid võidu  │
├───────────────────────────────┤    korral.                               │
│ ANDMETABEL                    │  ⓘ Automaatselt pikenev lõpp: pakkumine  │
│ Katastritunnused 34801:001:…  │    viimase 5 min jooksul pikendab 5 min. │
│ Register nr 150934 · Pindala… ├──────────────────────────────────────────┤
│ Puuliigid MA.KU · Raieliigid… │  PAKKUMUSED (authed)                     │
│ Eraldised 1 VR, 2 HR…         │  #12 6 250 €  Pakkuja #4 · 2 min eest    │
│ Metsateatise nr 50001182112   │  #11 6 000 €  Pakkuja #2 · 14 min eest   │
│ Raietähtaeg · Väljaveo tähtaeg│  … (guest: ainult arv + ajad)            │
├───────────────────────────────┼──────────────────────────────────────────┤
│ INFO (rich text) │ FAILID     │  MÜÜJA KONTAKT                           │
│ extraInfo, secondaryInfo      │  [SpecialistCard] + alias e-mail         │
└───────────────────────────────┴──────────────────────────────────────────┘
```
Mobile: single column; BidPanel collapses to a sticky bottom sheet (peek bar: current bid + "Tee pakkumine" → expands full panel); bid list below via accordion.

## Block-by-block spec
1. **Header bar** — lot name, `<StatusPill>` (Aktiivne / Kiiroksjon), `<Countdown>` "Oksjon lõppeb {dd.mm.aaaa hh:mm}" + live "Aega jäänud", server-synced drift correction; anti-snipe extension animates new end time when SSE `auction:extended` arrives.
2. **Hero gallery** — `image` + `images[]`, thumbnails incl. map screenshots; lightbox on click.
3. **Location & map** — `<MapEstonia>` pin from `coordinates`; county/parish/address line; external links: "Katastrikaart" → `ky.kataster.ee`, "Metsaregister" → `register.metsad.ee`.
4. **Full field table** (`<DataTable>` static, label→value): Katastritunnused `cadastres[]`; Kinnistu register nr `registryNumbers[]`; Maakond/Vald/Aadress; Pindala `area` ha; Raiemahu `volume` m³; Puuliik `forestType[]` (24 codes, tooltip full names); Raieliik `loggingType[]`; Eraldised `loggingCompartments[]`; Metsateatise nr `forestNotifications[]`; Raie teostamise tähtaeg `loggingDeadline`; Väljaveo tähtaeg `removalDeadline`; Kooskõlastused (ladustamiskohad) `storageLocationApproval` → "Kooskõlastab ostja"; Väljaveoteed `removalRoads`; Üürileping `hasRentalAgreement` + `rentalAgreementDeadline`; Alghind `minBid`; Pakkumise samm `bidStep`. Rows hidden when field empty.
5. **Rich-text info blocks** — `extraInfo` ("Oksjoni info ja erisused") and `secondaryInfo` ("Lisainfo") rendered in `<Card>`s; headings preserved.
6. **Files** — `files[]` PDFs (takseer, metsateatised): filename, size, download via signed URL.
7. **SpecialistCard** — photo, nimi, amet, telefon, e-mail + per-lot anonymized alias `email` ("Küsimused oksjoni kohta: {alias}@oksjonid.eametsad.ee") with copy-to-clipboard.
8. **BidPanel** (variants, see States) — leading bid ("Hetkel kõrgeim: X €", `leadingBidAmount` if visible), amount input prefilled = current+`bidStep` with `[−]/[+]` stepping by `bidStep` (minus allowed below minBid only when alapakkumine enabled → toggle "Alapakkumine (vajab müüja nõusolekut)" with explanatory footnote from `secondaryInfo`); autobidder max input ("Seadista automaatpakkuja — pakub automaatselt kuni sinu maksimumini"); submit Btn "Tee pakkumine"; confirm `<Modal>`: "Kas oled kindel, et soovid teha pakkumist {sum} €? Järgmisena pakutakse {next} €, kui sinu pakkumine ei ole juba kõrgeim." Notice chips: "Teenustasu rakendub vaid oksjoni võitmise korral" · "Automaatselt pikenev lõpp" (when `antiSnipingEnabled`).
9. **Framework-contract gate** — if open forest auction and user has no signed raamleping: submit redirects to `/lepingud/raamleping?next=/oksjon/:id` (see 13-contract-signing.md); message "Enampakkumise tegemiseks tuleb esmalt allkirjastada raamleping."
10. **Bid list** — authed: rows "#N {amount} € · Pakkuja #k · suhteline aeg" (anonymized labels, ordered desc); highlight own bids ("Sinu pakkumine"). Guest: "Pakkumusi: 12, viimane 2 min eest" — no amounts. Live prepend on SSE `bid:created`.
11. **Outbid banner** — sticky top: "Sinu pakkumine pakuti üle. Tee uus pakkumine." with jump-to-panel; clears on new own leading bid; "Sinu pakkumine on hetkel kõrgeim" success state.

## Interactions & edge cases
- Keyboard: amount input arrow up/down = step; enter opens confirm modal.
- Autobidder create/update via `POST /api/auto-bidders`; if user already has one, input shows current max with "Uuenda" / "Eemalda".
- Bid rejected (below current+step): inline error "Pakkumine peab olema vähemalt {min} €".
- Auction ends while viewing: panel locks, ticker flips to "Oksjon on lõppenud", redirect prompt to result state; SSE `auction:ended`.
- Last-5-min bid: banner "Oksjoni lõppu pikendati 5 minuti võrra" + countdown resets.
- Alapakkumine submission → status `pending_seller_approval`: panel shows pending chip "Alapakkumine ootab müüja kinnitust".

## Data & API
| Field | Source |
|---|---|
| all §4-block fields | `GET /api/auctions/:id` |
| bids (role-shaped) | `GET /api/auctions/:id/bids` — authed: amount + anonymized bidder slot + submitted_at; guest: count/timestamps only |
| leading bid | `leadingBidAmount` on auction response (authed only) |
| place bid | `POST /api/bids/create` {auctionId, amount, source} |
| autobidder | `POST/GET/DELETE /api/auto-bidders` |
| files | signed URLs from media endpoints |
| realtime | SSE: `bid:created`, `auction:extended`, `auction:ended` |
Caching: lot page SSR/cached until first bid; after that client-fresh via SSE.

## States
- **Guest**: BidPanel shows "Logi sisse pakkumise tegemiseks" `<Btn cta>` + "või registreeri"; bid list anonymized (count+times).
- **Authed, no rights for objectType**: "Sul puuduvad õigused teha selle tüübi oksjonil pakkumisi. Kirjuta info@eametsad.ee õiguste saamiseks." Bid list visible with amounts.
- **Authed with rights, no raamleping**: bid form visible, submit → gate (block 8/9).
- **Full**: form + autobidder + alapakkumine toggle (if enabled).
- **Loading** skeleton; **error** retry; **ended** (see archive detail: finalPrice, "Oksjon on lõppenud"); **outbid**, **leading**, **pending approval**, **not started** ("Oksjon algab {time}" — form disabled).

## Copy (Estonian, draft)
"Oksjon lõppeb" · "Aega jäänud" · "Hetkel kõrgeim pakkumine" · "Pakkumise samm" · "Tee pakkumine" · "Seadista automaatpakkuja" · "Alapakkumine" · "vajab müüja nõusolekut" · "Automaatselt pikenev lõpp: pakkumine viimase 5 minuti jooksul pikendab oksjoni lõppu 5 minuti võrra." · "Sinu pakkumine on hetkel kõrgeim" · "Pakkumise tegemiseks logi sisse"

## SEO & analytics
Title: "{name} — raieõiguse oksjon | Eametsad". SSR until first bid (then noindex, dynamic). JSON-LD `Product`+`Offer` variant for lot. Events: bid_submitted, autobidder_set, outbid_view, file_download, specialist_contact_click.

## Open questions
- Show leading bid to all authed users or only bidders? (Recommend: all authed, drives competition.)
- Alapakkumine visibility: show in bid list to others? (Recommend: amount hidden until approved.)
