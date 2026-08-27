# oksjonid.timber.ee — Structure, Functionality & Data Model Map

> **In brief (for the client):** this reverse-engineers the reference auction platform's rules and data so our version can be fair and complete. We keep the proven mechanics — four lot types, open vs sealed bidding, anti-sniping, anonymised bid history, no deposits — and add what the reference hides: a proper customer area and a staff admin, both specified in the main plan.


Reverse-engineered 2026-08-27 from public HTTP endpoints (no scraping of authenticated views).
Artifacts in `/tmp/`: `oksjon-*.html` (SPA shells), `oksj-app.js` (React bundle), `b-*.json` (API samples).

## 1. Platform overview & auction lifecycle

**Two systems live side by side:**

1. **Legacy WordPress** (`oksjonid.timber.ee`, WP with custom theme `oksjonid`, plugins: Redirection, Wordfence Login Security, WP Staging, Site Kit by Google, ACF + Better Featured Image): serves only a thin SPA shell (`<div id="app">`), `/wp-login.php`, uploads, and a legacy read-only REST API. Site description: *"Timberi oksjonite koondleht"*. Timezone Europe/Tallinn.
2. **Current system** = React SPA (Vite + React 18, Bootstrap 4, react-intl, FontAwesome, Google Maps, d3/Leaflet-style zoom, react-select) bundled inside the WP theme, talking to a **separate headless backend at `https://backend.timber.ee`** which is a **Payload CMS** ( unmistakeable signatures: `/api/...` routes, `docs/hasNextPage/totalDocs` mongoose pagination, Lexical rich-text (`extraInfo.root.children`), `admins` auth collection, `_status: "published"`, drafts+versions).

**Auction lifecycle (forest/raieõigus lot):** specialist creates auction (`startTime`) → published as `auctionStatus: "active"` with `endTime` countdown → bidding (open ascending or sealed) → auto-extension (anti-sniping) → ends → `auctionStatus: "archived"`, `finalPrice` recorded, winner gets contract flow. Property/field lots follow the same status machine with `auctionType: "sealed"` (pimepakkumine) and no `bidStep`.

**Object types (4 tabs / categories):**
- `forest` — **Raieõiguste oksjonid** (standing timber / logging rights; stats copy: *"AS Timber veebikeskkond on loodud raieõiguse müüjate ja ostjate … enampakkumisel raieõiguse omandamise eesmärgil."*)
- `property` — **Metsakinnistud / Kinnistuoksjonid** (forest real estate, sealed-bid)
- `field` — **Põllumaad / Põllumaade oksjonid** (farmland)
- `package` — **Kinnistute pakettide oksjonid** (bulk property packages)
- plus `isQuickAuction` flag — **Kiiroksjonid** (quick auctions; *"Kiiroksjonil olevale kinnistule saab alates oksjoni avaldamisest…"*; currently 0 active — *"Hetkel ei ole käimasolevaid kiiroksjoneid."*)

**Scale (from `/api/v1/statistics`):** Active now: 18 forest (94 ha, 11 976 m³, €428 700), 14 property (214 ha, €956 800), 4 field, 0 quick/package — 36 active total of 2 660 auctions in DB (2 614 archived). Archive totals: 1 984 forest (9 041 ha, 1.54 M m³, €56.4 M), 1 394 property (11 891 ha, €68.0 M), 68 field, 11 package (€8.4 M).

## 2. Listing page (SPA route `/:tab?`)

Landing is tabbed sections per object type, each with a headline counter, e.g.:
- *"Hetkel on aktiivseid raieõiguste oksjoneid {count}, kokku {totalArea} raiutavat mahtu {totalVolume} ja {totalPrice} väärtuses."*
- Property variant: *"Hetkel on aktiivseid kinnistuoksjoneid käimas {count}, kokku {totalArea} ja {totalPrice} väärtuses."*
- Empty states: *"Hetkel ei ole käimasolevaid põllumaade oksjoneid."* etc.

**Landing map**: `landing-map-property__*` classes — a map of Estonia (county GeoJSON chunk `maakonnad-*.js` with `MNIMI`/`MKOOD` properties) where properties pin by `coordinates`; each pin popup shows area (`__area-value`), price (`__price-value`), registry number (`__registry-value`), end date (`__bottom-date-value`).

**Hero copy:** *"Maa müük või kinnistute ostmine Timber.ee oksjonikeskkonnas – leia parimad kinnistud üle Eesti!"*, *"Maa oksjonid toimuvad pimepakkumise meetodil, mis tagab kõigile osalejatele võrdsed tingimused"*, SEO title *"Maaoksjon | Põllu- ja metsamaa oksjonid Timber.ee keskkonnas"*.

**Filters panel** (i18n keys `filters.*`, collapsible — `filters.toggle`, "Tühjenda" = clear, active-filter count badge): maakond (`Kõik maakonnad`), vald (`Kõik vallad`), puuliigid `forestType` (`Kõik puuliigid`), raieliigid `loggingType` (`Kõik raieliigid`), pindala/raiemahu vahemik (`filters.area.label`, *"Raiemahu vahemik"*), hind (`filters.price.label`), aasta (`years`, `filters.year.all`). Query built as Payload `where` (e.g. `forestType:{in:[...]}`, `area:{greater_than_equal, less_than_equal}`). Sorting: *"Alghind kasvavalt / Alghind kahanevalt"*, *"Lõpphind kasvavalt / Lõpphind kahanevalt"*, *"Varem lõppevad eespool / Hiljem lõppevad eespool"* (maps to `sort: endTime asc/desc`). Server pagination (`page`, `limit`, `totalPages`).

**Per-auction card** (from list API + card classes): name (lot name, e.g. "Lepsi"), image/thumbnail, `Alghind` (minBid), `Maakond`/county, pindala ha, mahu (m³, forest only), `Oksjoni lõpp`/endTime with countdown (*"Aega jäänud"*, "päev/päeva"), status badge (*"Aktiivsed oksjonid"*, *"Lõppenud"*).

**Notification subscription** from the list: *"Teavituste lisamiseks ava oksjonite nimekirjas filtrite paneel ja vajuta Telli teavitus"* — **"Telli teavitus"** button (`api/auction-subscriptions`).

**Global nav** links out to marketing site timber.ee: *Metsa müümine*, *Raieõiguse müümine*, *Kinnistu müümine*, *Päringud* (Hooldusraiete päring, Metsa istutamise päring, Metsamajandamiskava koostamise päring), *Metsaühistu* (metsauhistu.timber.ee), *Hindamisaktide koostamine*, *Metsateatise esitamine*, *Metsaspetsialistid*. User entry: **"Logi sisse"** (`/login`), user menu: *Minu pakkumised*, *Minu müügid*, *Minu profiil*, *Minu andmed*, *Teavitused*, *"Logi välja"*.

## 3. Auction detail field inventory (route `/oksjon/:auctionId`)

Complete field set from `backend.timber.ee/api/auctions/{id}` (Payload `auctions` collection) — sample lot 4760 "Lepsi" (forest, open) and 2078 "Ööviiuli" (forest, archived), 4764 (property, sealed), 4784 (field, sealed), 4390 (package):

| Field | Type | Notes / UI label |
|---|---|---|
| `id` | int | sequential lot id (URL slug `/oksjon/4760`) |
| `name` | string | lot display name ("Lepsi", "Ööviiuli", "Saarte pakett") |
| `auctionStatus` | enum | `active` / `archived` |
| `objectType` | enum | `forest` / `property` / `field` / `package` |
| `auctionType` | enum | `open` (ascending enampakkumine) / `sealed` (pimepakkumine) — all property/field/package lots observed are `sealed` |
| `isQuickAuction` | bool | kiiroksjon flag |
| `startTime` / `endTime` | ISO datetime | *"Oksjon lõppeb"*, countdown "Aega jäänud" |
| `endYear` | int | year bucket for archive filtering |
| `area` | number | hectares (pindala) |
| `volume` | int | m³, forest only (raiemahu; property=null) |
| `cadastres` | string[] | **"Katastritunnus/Katastritunnused"** — e.g. "34801:001:0217" |
| `registryNumbers` | string[] | kinnistu register numbers (e.g. "150934") |
| `county` / `parish` / `address` | string | maakond / vald / "Hakjala küla" |
| `coordinates` | string | "58.415300, 22.456500" → Google Maps embed |
| `forestType` | string[] | **"Puuliigid"**; codes from fixed list `MA.KU.NU.LH.SD.TS.TA.SA.VA.JA.KP.KS.HB.LM.LV.PN.PP.PA.SP.PK.TY.KL.KD.RE.TM.PI` (24 stand-type codes; MA, KU, HB observed) |
| `loggingType` | string[] | **"Raieliik"**; codes from `AR,HL,HR,KR,LR,RD,SR,TR,VE,VR` (LR=lageraie, VR=valikraie, HR=hooldusraie observed) |
| `loggingCompartments` | string[] | forest stands — **"Eraldised"/kvartal-eraldis**, e.g. "1 VR", "4 VR", "2 HR", "3 HR" |
| `forestNotifications` | string[] | **"Metsateatise nr"** (metsateatis numbers, e.g. "50001182112") |
| `loggingDeadline` | datetime | **"Raie teostamise tähtaeg"** |
| `removalDeadline` | datetime | **"Väljaveo tähtaeg"** |
| `storageLocationApproval` | enum | **"Kooskõlastused"**: `buyer` → "Kooskõlastab ostja" (ladustamise kohad) |
| `removalRoads` | enum | väljaveoteed — `buyer` → "Kooskõlastab ostja" |
| `hasRentalAgreement` / `rentalAgreementDeadline` | bool/date | rent/giving agreement on land |
| `minBid` | number | **"Alghind"** (€) |
| `bidStep` | number | **"Pakkumise samm"** (forest/open only, e.g. 250) |
| `finalPrice` | number | **"Lõpphind"** — populated on archived lots |
| `antiSnipingEnabled` | bool | **"Automaatselt pikenev lõpp"** — *"Juhul kui viimane pakkumine on tehtud vähem kui 5 minutit enne enampakkumise tähtaega, pikeneb lõpp automaatselt 5 minuti võrra."* |
| `extraInfo` | Lexical rich text | **"Enampakkumise info ja erisused"** — free-form lot description (seed/retention trees, restrictions, e.g. protected-species timing conditions, "Raietähtaeg", "Metsateatise number", "Metsaeraldised", "Ladustamise kohad", "Väljaveoteed", "Seemne- ja säilikpuud", "Muud piirangud / tingimused") |
| `secondaryInfo` | Lexical rich text | secondary notes (e.g. *"Lubatud on teha ka alghinnast madalam pakkumine…"*) |
| `email` | string | anonymized per-lot contact alias, e.g. `mt1308202601@timber.ee`, `hl1911202501@timber.ee` |
| `specialist` | relation → `admins` collection | Metsaspetsialist: name, phone, email, avatar, position |
| `image` / `images[]` | media relation | hero image + gallery (map screenshots, 350×175 thumbnails) |
| `files[]` | media[] (PDF) | **"Enampakkumisega seotud failid"** — e.g. `Lepsi Takseer Metsaportaal.pdf` (taxation report), `Lepsi Metsateatised.pdf` (forest notifications) |
| `propertyCount` | int | package lots only (e.g. 16) |
| `packageDescription` / `packageTable` | text/table | package lots ("Ühe paketina 16 metsakinnistut Saaremaal ja Hiiumaal.") |
| `externalUrl` | string | link-out for external auctions |
| `bids` | subcollection (paginated `docs`) | anonymized to logged-out users: only `id`, `auction`, `isUnderbid`, `source: "manual"`, `isAutobidderLimitReached`, timestamps — **no amounts, no bidder identity** |
| `leadingBidAmount` / `leadingCurrentProfileBid` | number/bool | null for anonymous (personalized when authed) |
| `createdAt/updatedAt/deletedAt`, `_status` | audit | Payload drafts+soft-delete |

Deep links seen in bundle: kataster map `https://ky.kataster.ee/ky/`, **Metsaregister** `http://register.metsad.ee/` (`https://register.metsad.ee/v1/` API hint).

## 4. Bidding mechanics & rules

- **Two modes**: `open` (ascending English auction with `bidStep`, "Pakkumise samm") and `sealed` (pimepakkumine — *"Kõik saabunud pakkumised avatakse üheaegselt peale enampakkumise lõppemise tähtaega."*).
- **Login wall**: bidding requires auth (`POST api/bids/create` → *"Unauthorized, you must be logged in"*). Forest open auctions additionally require a signed framework contract: *"Enampakkumise tegemiseks tuleb esmalt allkirjastada raamleping."* — **"Allkirjasta raamleping"** flow (`api/bids/framework-contract/prepare|complete`); per-bid contract flow `api/bids/contract/prepare|complete` — *"Sisesta enda andmed oksjonist osavõtmise lepingu koostamiseks, seejärel tutvu dokumendiga ja allkirjasta see pakkumise esitamiseks"*. Bidding form asks: **"Pakkuja nimi", "Pakkuja isikukood/registrikood", "Pakkuja aadress", "Pakkuja email", "Pakkuja telefon"** (validation: *"Isikukood peab olema 11 numbrit või registrikood 8 numbrit"*).
- **Confirm dialog**: *"Kas oled kindel, että soovid teha pakkumist …"*; next-bid hint: *"Järgmisena pakutakse {bid} € juhul, kui sinu pakkumine ei ole praegu juba kõrgeim."*
- **Under-bidding (alapakkumine)** — bids below `minBid` allowed on some lots: *"Alapakkumised on Pakkujaale siduvad. Alapakkumise aktsepteerimisel Müüja poolt …"*; UI: *"Alapakkumise tegemiseks logi sisse ja klõpsi miinusnupuga soovitud hinnani, seejärel vajuta nuppu 'tee alapakkumine'."*
- **Autobidder** ("Automaatpakkuja"): *"Seadista automaatpakkuja"* — *"Automaatpakkuja pakub automaatselt summani …"* (max amount); `api/auto-bidders` endpoints; bid flag `isAutobidderLimitReached`. Disabled when inactive: *"Oksjon ei ole aktiivne. Automaatpakkujat ei saa seadistada ega muuta."*
- **Anti-sniping**: `antiSnipingEnabled` — auto-extension by 5 min if bid in last 5 min (quote in §3).
- **Outbid feedback**: *"Sinu pakkumine pakuti teise pakkuja poolt üle. Tee uus pakkumine."* / *"Sinu pakkumine on hetkel kõrgeim"* / *"Pakkumist ei ole tehtud või sinu pakkumine ei ole kõrgeim. Tee pakkumine."*
- **Permissions by auction type**: *"Sul puuduvad õigused teha vastava oksjoni tüübi juures pakkumisi. Pöördu palun info@timber.ee õiguste saamiseks."*
- **Service fee**: *"Teenustasu rakendub vaid oksjoni võitmise korral."*
- **No deposit/tagatisraha** anywhere — no deposit field exists; the gate is contract signing + approved account instead.
- **No public bid history/leaderboard**: anonymous users see only anonymized bid stubs; winner identity never exposed.

## 5. Archive / history (route `/ajalugu/:tab?` = "Oksjonite ajalugu")

- Tabs per object type; shows `finalPrice` ("Lõpphind"), sortable by it. Public outcome data = final price only — **no winner identity, no bid count, no bid history table**.
- Same filter panel (county, year, price, …) + `endYear` filter; server pagination (2 614 archived lots).
- Status badges: "Lõppenud" / "Lõppes". Lot detail of archived auction shows "Oksjon on lõppenud".
- Stats lines on landing: *"Raieõiguse oksjoneid on edukalt lõppenud {count}"*, *"Kinnistute oksjoneid on edukalt lõppenud …"*.
- WP legacy mirrors: `/wp-json/wp/v2/auction_history` (post type `property_history`, "Kinnistute ajalugu") and `/wp-json/wp/v2/auction_stats` (post type `auction_stats`, "Arhiivis raiete statistika") — the old WP archive pages, now superseded.

## 6. WordPress data model findings

**Legacy CPTs (still exposed, 2 539 posts in `wp/v2/auctions`):** REST base `auctions` = post type **`property`** (guid `?post_type=property&p=…`, links `/blog/property/{slug}/`). Plus `auction_history` (`property_history`), `auction_stats` (`auction_stats`), and a custom `/wp/v2/generate-pdf` route (GET 404s; presumably POST-only PDF generation). Taxonomies: only default (`category`, `post_tag`, `nav_menu`, `wp_pattern_category`) — **no custom taxonomies**.

**Legacy ACF field schema on `property`** (the pre-Payload data model — note the near 1:1 evolution into Payload fields):
`county` (slug e.g. "põlvamaa"), `parish`, `address`, `coordinates`, `area`, `registryNumber`, `cadastre`, `minPrice`, `finalPrice`, `endDate`, `email`, `specialistName`, `extraInfo` (+`_en`), `secondaryInfo` (+`_en`), `secondImage`, `participationForm`, `fileOne..fileSix`, `package` (bool), `packageDescription`(+`_en`), `packageTable`, `propertyCount`, `field` (bool), `quickAuction` (bool), `externalUrl`. (Bilingual _en suffixes were dropped in the new backend.)

**Current data model (Payload CMS at backend.timber.ee)** — collections/endpoints discovered in bundle:
- `api/auctions` (+`?where[auctionStatus][equals]=…`, sort, pagination), `api/auctions/{id}`, `api/auctions/my-auctions`, `api/auctions/with-user-bids`
- `api/bids/create`, `api/bids/contract/prepare|complete`, `api/bids/framework-contract/prepare|complete`
- `api/auto-bidders` (CRUD), `api/auction-subscriptions` (Telli teavitus), `api/notification-contacts`
- `api/contracts`, `api/profiles`, `api/users` (+`/me`, forgot/reset password), `api/media/file/{name}`
- `api/v1/counties` (all 15 counties + valds), `api/v1/statistics?status=active|archived` (per-objectType count/area/volume/cost), `api/v1/documents/`, `api/v1/company-lookup`, `api/v1/business/request-access`
- Auth collection `admins` (specialists) with API keys, sessions, soft delete.

**Theme/plugins:** theme `oksjonid` (Vite-built React dist inside); plugins Redirection, Wordfence, WP Staging, Site Kit, ACF; no WooCommerce. Rollbar (rollbar/v1 namespace) for error tracking. No sitemap (wp-sitemap.xml returns the SPA shell — WP sitemaps disabled). Google Maps key loaded (empty key in shell, injected at runtime).

## 7. Auth / registration / user flows

SPA routes: `/login`, `/register`, `/select-profile`, `/update-password`, `/user`, `/user/bids` (Minu pakkumised), `/user/objects` (Minu müügid), `/user/notifications` (Teavitused), `/user/profile` (Minu andmed), `/user/logout`, `/finish`, `/dev/buttons`.

- **eID-first login** (backend routes): `api/v1/auth/smartid/start|status`, `mobileid/start|status`, `idcard/start|complete`, plus `idcode-login` (isikukood + parool — *"Isikukood ja parool on kohustuslikud"*). Smart-ID UX: control number check — *"Kontrollige, et näete mobiiltelefoni ekraanil täpselt sama numbrit. Seejärel sisestage PIN 1 kood."*
- **Password reset**: email flow — *"Sisesta oma e-posti aadress. Saadame sulle e-kirja juhistega parooli lähtestamiseks."*
- **Profiles** (`/select-profile`, "Profiili valimine"): private vs company ("Ettevõte") profiles; create company profile with **"Äriregistri kood"** + **"Ettevõtte nimi"**; `api/v1/company-lookup` validates against business registry; *"See ettevõte on juba registreeritud. Ligipääsu saamiseks saada taotlus."* → `api/v1/business/request-access` (approval workflow: *"Sinu taotlus on ülevaatamisel. Timber.ee meeskond võtab Sinuga ühendust taotluse läbivaatamisel."*).
- **Bidding rights are granted per auction type** after framework-contract signing (see §4); WP `/wp-login.php` still exists (Wordfence-protected) but the SPA is the real auth surface.
- **Terms**: "AS Timber veebikeskkonna kasutustingimused" — identifies via ID-kaart/Smart-ID/Mobiil-ID, working language Estonian, contracts under Estonian law, admin privacy obligations ("Haldaja kohustub mitte avaldama kolmandatele isikutele Kasutaja…"), user liability for inputs.

## 8. Open questions a rebuild must answer

1. **Bid visibility rules** — are full bid history (amounts, timestamps) shown to authenticated bidders on open auctions? (Anonymous API strips everything except order/flags.)
2. **Winner determination for sealed auctions** — single-round sealed vs second round; tie-breaking; when `finalPrice` is published vs winner notified.
3. **Alapakkumine (under-start-price bid) acceptance workflow** — "Müüja poolt aktsepteerimine": how sellers approve/reject in practice; deadline.
4. **Auto-extension parameters** — 5 min/5 min observed in copy; configurable per auction? (`antiSnipingEnabled` is, duration unknown.)
5. **Contract signing backend** — who signs digitally (Digidocservice/eID Easy?), contract templates for raamleping vs osavõtmise leping vs package deals; service-fee percentage.
6. **Seller-side tooling** — `user/objects` "Minu müügid" suggests seller dashboard; how lots are created (Payload admin only?), approval chain, specialist assignment.
7. **Kiiroksjon economics** — fixed-price-first-come? ("Kiiroksjonil olevale kinnistule saab alates oksjoni avaldamisest…"); none active to inspect.
8. **Notification channels** — email only, or SMS (`notification-contacts`)? Digest vs per-auction.
9. **Metsaregister/kataster integrations** — is `register.metsad.ee/v1` fetched live for metsateatis validation or just linked?
10. **Media/CDN** — Payload local media (`/api/media/file/…`) vs WP uploads for static assets; thumbnail pipeline (350×175).
11. **Role model** — confirmed `admins` (specialists) and `users`/`profiles`; exact permission matrix (per-auctionType bidding rights) needs an authed account to probe.
12. **Legacy WP data** — 2 539 legacy `property` posts: were they migrated into Payload (IDs differ: WP ids ~16936 vs auction ids 4760/2078)? Migration/mapping strategy unknown.
