# Design: portal-demo-design-parity

## Context

The demo mockups in `docs/design/demo/portal/` (13 unique pages plus an `index.html` duplicate of the listing) define the approved design for the auction portal. The live portal (Next.js 15 App Router, `(portal)` route group, host `oksjonid.erametsad.ww0.dev`) covers every demo route but differs in three layers:

1. **Tokens.** The shared tokens in `packages/ui/src/styles/tokens.css` drifted from the demo palette: primary `#012d1d` vs demo `#2E6B4F`, lavender page/mist backgrounds vs demo white/`#F1F5F2`, heavy border `#c1c8c2` vs demo `#E3E7E4`, and Public Sans headings vs demo Manrope 700/800. Accent, CTA, danger, info, radii, and shadows already match.
2. **Shell.** The portal header is a two-row non-sticky bar with marketing links; the demo has a sticky 72px header with inline tab nav, guest button pair, avatar user menu, and a mobile drawer. The footer is one dark band; the demo has four link columns, a social row, and a bottom bar with "Küpsisesätted". The portal has no cookie banner.
3. **Page layouts.** Listing tabs, filter sidebar, lot cards, lot detail structure, archive presentation (cards vs the demo table), auth cards, and the whole user area (sidebar shell and data tables vs demo page heads, tab rows, and rich cards) differ.

`DESIGN.md` records five accepted deviations from an earlier mockup round. This change supersedes that baseline: the demo is now the target, and only functional deviations remain.

## Goals / Non-Goals

**Goals:**

- Visual and layout parity with the demo for all portal routes mapped to demo pages.
- All functional behavior preserved: SSE live updates, bid rules, sealed-bid encryption flow, alapakkumine, autobidder, session and consent handling, saved searches, GDPR export and delete.
- Marketing and admin surfaces pixel-unchanged.

**Non-Goals:**

- No global token unification (marketing keeps its current look; a follow-up can revisit).
- No new dependencies. Font Awesome from the demo is not added; Lucide stays.
- No backend, API, schema, or CSP changes.
- No new user flows; register keeps its functional 4-step structure.

## Decisions

### 1. Portal-scoped token override via `.portal-scope`

`apps/platform/src/app/(portal)/portal.css` (new) redefines the color custom properties under `.portal-scope`, and `(portal)/layout.tsx` wraps its tree in that class. The `(admin)` group already uses this layering pattern with `.admin-scope`, so the mechanism is proven.

- Alternative considered: change `tokens.css` globally. Rejected because it would restyle the marketing site in the same release, far beyond the requested scope.

### 2. Manrope loads in the portal layout

`(portal)/layout.tsx` loads Manrope (700, 800) through `next/font/google` and maps it to `--font-heading` inside `.portal-scope`. Inter (body) and JetBrains Mono (prices, countdowns) stay from the root layout. Fonts stay self-hosted through `next/font`, so the CSP gains no hosts.

### 3. Lucide stays; demo icons map to Lucide equivalents

Every demo icon has a Lucide substitute (tree, bars, bell, gavel, user, shield, bolt, and so on). This avoids a new dependency and a new CSP host, and follows the icon discipline rule.

### 4. Shared primitives change additively; the portal gets its own card

- `Countdown` gains a `format` prop (or portal preset) producing the demo form `2p 04:12:00`, with the existing warn (<1h) and critical (<5min) tiers and a "Lõpeb varsti" swap. Defaults keep the current `{d}p {h}h {m}m {s}s` output so admin and marketing render unchanged.
- `StatusPill` gains the demo labels the portal needs (for example "Ootel avamine", "Võitsid", "Ei võitnud", "Müümata", "Lugemata").
- The listing gets `PortalLotCard` in `(portal)/_components/` with the demo anatomy. The shared `LotCard` stays untouched so `AuctionTicker` (marketing) and other consumers keep their presentation.

### 5. Functional deviations from the demo (kept on purpose)

The demo is a static mockup and lacks some working features. These stay, presented in the demo design language:

- **Bid confirm modal on open auctions.** The demo submits directly; the implementation restates the amount before an API call. The modal is restyled, not removed.
- **Profile switcher in the user menu.** The demo dropdown has only navigation items; the switcher entries (active marked, POST `/api/v1/profiles/:id/select`) stay inside the dropdown.
- **Unread badge** on the "Teavitused" menu item (the demo shows none).
- **Sealed-bid identity snapshot fields** (name, isikukood, address, email, phone) render inside the sealed panel above the amount form.
- **Alapakkumine toggle** on the open bid panel (demo has no equivalent).
- **Saved searches panel** on the notifications page (third panel below the demo's two).
- **`q` free-text filter** keeps working as a URL parameter; the visible search box goes away with the shell header (the demo has no search UI).
- **Register keeps 4 steps** (Tuvastus, Profiili tüüp, Andmed ja nõusolekud, Valmis) with the demo step-bar visuals. The demo's 3-step flow would change function, not just design.

### 6. Listing filters match the demo exactly

The sidebar drops the Maht (m³) range and adds "Raietähtaeg (aasta)". Species chips align to the demo forestry codes MA Mänd, KU Kuusk, KS Kask, HB Haab, LM Lehis, SA Saar; cut chips to VR, HR Harvendusraie, SR Sanitaarraie, LR Lageraie, RD Rekonstruktsiooniraie. `_lib/species.ts` and `filter-params.ts` reconcile the chip codes with the data layer so URL params stay stable where values already match.

### 7. Map view returns as a toggle

The demo alternates between card grid (Loendivaade) and map (Kaardivaade) with an `aria-pressed` toggle. The current spec mandates an always-visible map; this change restores the demo toggle. Pin popups show Pindala, Alghind, Katastritunnus, Aega jäänud, and a "Vaata" action, closing on Escape.

### 8. Archive becomes a stats band plus a results table

The page head gains four stat cards (Edukalt lõppenud oksjonit, Metsa- ja põllumaad kokku, Raiemaht kokku, Kogumaksumus kokku). The card grid becomes the demo results table (Objekt, Tüüp, Maakond, Pindala, Lõppkuupäev, Lõpphind, Alghind, Ülepakkumine) with color-coded type chips, amber final prices, uplift pills, and muted Müümata rows. The sidebar simplifies to the demo set: Lõppemise aasta select, Tüüp chips, Olek chips, Tühjenda. County, parish, species, price, and area filters leave the archive UI; sort keeps the demo labels including final-price directions.

### 9. User area reuses the public shell

`user/layout.tsx` drops ShellHeader, Sidebar, and BottomTabBar. User pages render under the standard portal header (with the user menu), a demo page head (crumb "Minu keskkond / <page>", H1, summary), and a sub-nav tab row (Pakkumised, Objektid, Teavitused, Profiil). Bids and objects switch from tables to demo cards. The demo's four object chips (Kõik, Käimasolevad, Lõppenud, Mustandid) fold "Plaanis" into "Käimasolevad" (both are pre-end states); the status filter still supports all underlying states. Lepingud stays reachable from the header dropdown and the footer.

### 10. Contract signing adopts the demo 4-step wizard layout

Steps card (Andmed, Kontroll, Allkiri, Valmis, progress "Allkirjastamine 1/4"), status rail, price summary (lõpphind, teenustasu 3%, käibemaks 22% on the fee, kokku), document viewer with the agree checkbox, vertical eID buttons with the PIN2 control-code waiting state, success card, and the "Mis edasi?" next-steps card. Resume, timeline, version short-circuit, and the deadline chip all keep working. The `/lepingud` list (no demo page) restyles in the same language: raamleping status card plus the contract table with `ContractPill` tones.

## Risks / Trade-offs

- [Shared component drift breaks admin or marketing] → `Countdown` and `StatusPill` changes are additive with current defaults; existing tests plus `pnpm build` verify both surfaces.
- [Token override leaks outside the portal] → every override sits under `.portal-scope`; the marketing host never renders that class.
- [Functional regressions from removed UI (search box, archive filters, Maht filter)] → URL parameters keep working where cheap; removals are recorded here and in DESIGN.md for a product follow-up.
- [Large diff across 20+ files] → tasks run in file-disjoint waves; a final screenshot pass compares each portal page against its demo page.
- [Demo data has no real source] (for example watch counters) → cards render only values the data layer provides; missing values collapse their cells as today.

## Migration Plan

Single branch, wave-ordered commits, no data migration. Deploy follows the normal `wrangler` path. Rollback is a branch revert; the token override is isolated in two portal files, which makes a partial rollback cheap.

## Open Questions

- Should a later change unify the demo tokens globally (marketing included)?
- Should the free-text search return with a visible input outside the demo layout?
- Estonian microcopy: demo uses both "ID-kaart" (05, 06) and "ID-kort" (13). The implementation standardizes on "ID-kaart".
