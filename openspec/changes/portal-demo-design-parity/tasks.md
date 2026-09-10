# Tasks: portal-demo-design-parity

## 1. Foundations

- [x] 1.1 Add `.portal-scope` token overrides (demo palette) in new `(portal)/portal.css`, wrap the portal layout tree, load Manrope 700/800 via `next/font` in `(portal)/layout.tsx` <!-- agent: fullstack-engineer.build, depends_on: [], touches: [apps/platform/src/app/(portal)/layout.tsx, apps/platform/src/app/(portal)/portal.css] -->
- [x] 1.2 Rewrite PortalHeader: sticky 72/60px, logo wordmark, inline nav (Kõik oksjonid, Raieõigused, Metskinnistud, Ajalugu, KKK, Kontakt) with active state, guest button pair, user menu with avatar initials + switcher + unread badge, mobile drawer <!-- agent: fullstack-engineer.build, depends_on: [1.1], touches: [apps/platform/src/app/(portal)/_components/PortalHeader.tsx] -->
- [x] 1.3 Rewrite PortalFooter: Oksjonid/Ajalugu/Erametsad/Jälgi meid columns with social row and bottom bar (© Erametsad OÜ, Privaatsuspoliitika, Küpsisesätted) <!-- agent: fullstack-engineer.build, depends_on: [1.1], touches: [apps/platform/src/app/(portal)/_components/PortalFooter.tsx] -->
- [x] 1.4 Add portal CookieBanner (Nõustun kõigiga / Ainult vajalikud / Sätete muutmine) wired to `erametsad_consent` + `POST /api/v1/consent`, render in the portal layout, footer Küpsisesätted reopens it <!-- agent: fullstack-engineer.build, depends_on: [1.1], touches: [apps/platform/src/app/(portal)/_components/CookieBanner.tsx, apps/platform/src/app/(portal)/layout.tsx] -->
- [x] 1.5 Extend `Countdown` with the portal format `2p HH:MM:SS` + "Lõpeb varsti" swap (defaults unchanged); extend `StatusPill` labels (Ootel avamine, Võitsid, Ei võitnud, Müümata, Lugemata, Juhtiv pakkumine) <!-- agent: fullstack-engineer.build, depends_on: [1.1], touches: [packages/ui/src/components/Countdown.tsx, packages/ui/src/components/StatusPill.tsx] -->

## 2. Listing (/)

- [x] 2.1 Mist page-head band with per-tab H1 + summary, pill tab bar with count badges <!-- agent: fullstack-engineer.build, depends_on: [1.1], touches: [apps/platform/src/app/(portal)/page.tsx, apps/platform/src/app/(portal)/_components/ListingTabs.tsx] -->
- [x] 2.2 Filter sidebar to demo structure: Maakond/Vald cascade, Puuliigid MA/KU/KS/HB/LM/SA, Raieliigid VR/HR/SR/LR/RD, Pindala + Hind ranges, Raietähtaeg (aasta) select, Tühjenda + Telli teavitus inline sub-form (drop Maht range, align `_lib/species.ts` + `filter-params.ts`) <!-- agent: fullstack-engineer.build, depends_on: [1.1], touches: [apps/platform/src/app/(portal)/_components/ListingFilters.tsx, apps/platform/src/app/(portal)/_lib/species.ts, apps/platform/src/app/(portal)/_lib/filter-params.ts] -->
- [x] 2.3 Toolbar: Kaardivaade/Loendivaade aria-pressed toggle, mobile "Filtrid (n)" disclosure, Sorteeri labels (Varem lõppevad eespool default) + demo pagination styling <!-- agent: fullstack-engineer.build, depends_on: [2.1], touches: [apps/platform/src/app/(portal)/_components/ListingResultsBar.tsx, apps/platform/src/app/(portal)/page.tsx] -->
- [x] 2.4 PortalLotCard with demo anatomy (Kiiroksjon flag, type + status pill, name, cadastre mono, meta line, amber Alghind, countdown) in auto-fill grid (min 270px, 24px gap); wire into LiveListing; demo empty state <!-- agent: fullstack-engineer.build, depends_on: [1.5], touches: [apps/platform/src/app/(portal)/_components/PortalLotCard.tsx, apps/platform/src/app/(portal)/_components/LiveListing.tsx] -->
- [x] 2.5 Map view on Kaardivaade: MapEstonia pins + demo popup card (Pindala, Alghind, Katastritunnus, Aega jäänud, Vaata), Escape closes, `view=kaart`/legacy `view=kart` param <!-- agent: fullstack-engineer.build, depends_on: [2.3], touches: [apps/platform/src/app/(portal)/_components/ListingMap.tsx, apps/platform/src/app/(portal)/page.tsx] -->

## 3. Lot detail, open (/oksjon/[id])

- [x] 3.1 Main column: breadcrumb row + status pill, anchor tabs (Ülevaade/Asukoht/Dokumendid/Pakkumised), gallery + lightbox (arrows, Escape), zebra facts table (230px label col), map card with coordinates + Katastrikaart/Metsaregister, document list with PDF icons + Laadi alla <!-- agent: fullstack-engineer.build, depends_on: [1.1], touches: [apps/platform/src/app/(portal)/oksjon/[id]/page.tsx, apps/platform/src/app/(portal)/oksjon/[id]/_components/**] -->
- [x] 3.2 Sticky bid rail: type line, countdown + "Oksjon lõppeb ... kell ..." end line, Hetke hind row + Pakkumisi, Samm/Anonüümsed pakkujad chips, next-bid box, form + confirm modal, Automaatpakkuja switch + limit, snipe banner, fee line, guest gate modal; bid history table with Liidab/Käsitsi/Automaat chips + "Kuvame N viimast..." note <!-- agent: fullstack-engineer.build, depends_on: [3.1, 1.5], touches: [apps/platform/src/app/(portal)/oksjon/[id]/_components/**] -->

## 4. Lot detail, sealed

- [x] 4.1 Mist lot-head band: crumbs, H1, "Suletud pimepakkumine" badge + Tähtaeg chip; Põhiandmed 2-col facts card, Info card, Dokumendid card <!-- agent: fullstack-engineer.build, depends_on: [1.1], touches: [apps/platform/src/app/(portal)/oksjon/[id]/page.tsx] -->
- [x] 4.2 Sealed panel: dark "Pimepakkumine" head, explanation box, deadline box + absolute deadline, Pakkumuste arv, identity snapshot fields, amount form + Kinnita pakkumine modal, locked state + Muuda pakkumist, fee-on-win line + confidentiality footnote, lõppenud/tulemus phase cards with large Lõpphind <!-- agent: fullstack-engineer.build, depends_on: [4.1], touches: [apps/platform/src/app/(portal)/oksjon/[id]/_components/SealedBidPanel.tsx] -->

## 5. Ajalugu (/ajalugu)

- [x] 5.1 Page head with 4-card stats band (Edukalt lõppenud oksjonit, Metsa- ja põllumaad kokku, Raiemaht kokku, Kogumaksumus) + summary + pill tabs <!-- agent: fullstack-engineer.build, depends_on: [1.1], touches: [apps/platform/src/app/(portal)/ajalugu/page.tsx] -->
- [ ] 5.2 Demo sidebar (Lõppemise aasta select, Tüüp chips, Olek chips + hint, Tühjenda), toolbar with "N oksjonit" count + Sorteeri labels (Uuemad eespool default), results table (Objekt/Tüüp/Maakond/Pindala/Lõppkuupäev/Lõpphind/Alghind/Ülepakkumine) with type chips, amber Lõpphind, +N% uplift pill, muted Müümata rows, privacy footnote, demo pagination <!-- agent: fullstack-engineer.build, depends_on: [5.1], touches: [apps/platform/src/app/(portal)/ajalugu/page.tsx, apps/platform/src/app/(portal)/_components/ArchiveCard.tsx] -->

## 6. Auth pages

- [ ] 6.1 Login: 440px card, eID buttons with hints, või divider, fallback form + "Unustasid salasõna?", control-code pending view, success state, privacy line + Tagasi oksjonitele, suspended banner restyle <!-- agent: fullstack-engineer.build, depends_on: [1.1], touches: [apps/platform/src/app/(portal)/login/**] -->
- [ ] 6.2 Register: demo mist section + step-bar visual on the existing 4-step wizard, eid-cards with Soovitatav marker, honeypot, demo validation messages, success view "Konto loodud!" <!-- agent: fullstack-engineer.build, depends_on: [1.1], touches: [apps/platform/src/app/(portal)/register/**] -->
- [ ] 6.3 Select-profile: mist head, radio profile cards (type chip, AKTIIVNE/Ülevaatamisel pill, rights check list, dashed pending card), Lisa ettevõtte profiil ghost, Jätka/Jäta vahele, arrow-key selection <!-- agent: fullstack-engineer.build, depends_on: [1.1], touches: [apps/platform/src/app/(portal)/select-profile/**] -->
- [x] 6.4 Update-password: 480px card, eye toggles, caps-lock warnings, 5-segment strength meter (Nõrk/Keskmine/Tugev), rules checklist with green ticks, gated submit, success view; restyle PasswordForm/PasswordStrengthMeter <!-- agent: fullstack-engineer.build, depends_on: [1.1], touches: [apps/platform/src/app/(portal)/update-password/page.tsx, apps/platform/src/app/(portal)/_components/PasswordForm.tsx, apps/platform/src/app/(portal)/_components/PasswordStrengthMeter.tsx] -->
- [x] 6.5 Reset-password request + token pages restyled to the auth card language <!-- agent: fullstack-engineer.fast, depends_on: [6.4], touches: [apps/platform/src/app/(portal)/reset-password/**] -->

## 7. User area

- [x] 7.1 User layout: remove ShellHeader/Sidebar/BottomTabBar; add page-head component (Minu keskkond crumbs, H1, summary) + sub-nav tab row (Pakkumised, Objektid, Teavitused, Profiil); keep unread badge feed <!-- agent: fullstack-engineer.build, depends_on: [1.2], touches: [apps/platform/src/app/(portal)/user/layout.tsx, apps/platform/src/app/(portal)/user/_components/**] -->
- [ ] 7.2 Minu pakkumised: bid cards (juhtiv/pime/võitnud/kaotatud variants, autobidder switch + Muuda on card), chips Käimasolevad/Lõppenud/Võidetud/Kaotatud, hint banner, sealed masking + tooltip, SSE toast behaviors <!-- agent: fullstack-engineer.build, depends_on: [7.1, 1.5], touches: [apps/platform/src/app/(portal)/user/bids/**] -->
- [ ] 7.3 Minu objektid: obj cards (active/signed/unsold/draft, stats Hetke hind-Lõpphind/Pakkumisi/Vaatamisi +Jälgijaid), chips Kõik/Käimasolevad/Lõppenud/Mustandid, "Paku oma objekti" CTA, keep alapakkumine banner + drawer + relist/review actions <!-- agent: fullstack-engineer.build, depends_on: [7.1], touches: [apps/platform/src/app/(portal)/user/objects/**] -->
- [ ] 7.4 Teavitused: stacked panels — inbox (44px icons, category badges, unread mist + amber dot, mark-read, Märgi loetuks, chips, Laadi veel), preference matrix (switch/E-post/SMS + channel note + Saada test-teavitus), Otsingute tellimused panel <!-- agent: fullstack-engineer.build, depends_on: [7.1], touches: [apps/platform/src/app/(portal)/user/notifications/**] -->
- [ ] 7.5 Minu profiil: five stacked cards (Andmed with masked isikukood Näita/Peida + audit, Profiilid, Oksjoniõigused chips, Turve with sessions, Privaatsus ja andmed with export + Kustuta konto modal with 7-year retention note) <!-- agent: fullstack-engineer.build, depends_on: [7.1], touches: [apps/platform/src/app/(portal)/user/profile/**] -->

## 8. Contracts

- [ ] 8.1 /lepingud list: raamleping status card (allkirjastatud/allkirjastamata) + contract table with ContractPill tones (Koostatud/Saadetud/Allkirjastatud/Tühistatud) + Jätka/Vaata actions <!-- agent: fullstack-engineer.build, depends_on: [1.1], touches: [apps/platform/src/app/(portal)/lepingud/page.tsx] -->
- [ ] 8.2 Signing flows to demo 13 layout: steps card + status rail, deadline banner + chip, Andmed context card with Hinna kokkuvõte (3% + km breakdown), document viewer with agree checkbox, eID column buttons + PIN2 control-code waiting state, success card + Mis edasi card; keep resume/timeline/version short-circuit <!-- agent: fullstack-engineer.build, depends_on: [1.1], touches: [apps/platform/src/app/(portal)/lepingud/_components/**, apps/platform/src/app/(portal)/lepingud/raamleping/**, apps/platform/src/app/(portal)/lepingud/oksjonileping/**] -->

## 9. Verification and docs

- [ ] 9.1 Formatting sweep across portal (euro, countdown `2p HH:MM:SS`, dates D.M.YYYY, pill labels); run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`; confirm marketing/admin render unchanged <!-- agent: fullstack-engineer.fast, depends_on: [2.5, 3.2, 4.2, 5.2, 6.5, 7.2, 7.3, 7.4, 7.5, 8.1, 8.2], touches: [] -->
- [ ] 9.2 Update DESIGN.md: portal token section + rewritten Mockup deviations section (parity baseline + remaining functional deviations) <!-- agent: fullstack-engineer.fast, depends_on: [9.1], touches: [DESIGN.md] -->
- [ ] 9.3 Visual comparison: screenshot each portal page (`/`, `/oksjon/:id` open + sealed, `/ajalugu`, `/login`, `/register`, `/select-profile`, `/update-password`, `/user/*`, `/lepingud`, signing flow) against its demo HTML and fix remaining deltas <!-- agent: fullstack-engineer.build, depends_on: [9.1], touches: [] -->
