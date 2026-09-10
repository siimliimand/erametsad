## Why

The static design mockups in `docs/design/demo/portal/` are the approved design for the auction portal. The live pages at `oksjonid.erametsad.ww0.dev` cover the same routes but have drifted from the mockups in tokens (palette, heading font), shell (header, footer, cookie banner), and page layouts (tabs, cards, tables, user area). This change brings every portal page to visual and layout parity with the demo.

## What Changes

- Add a portal-scoped design token override (`.portal-scope`) with the demo palette: `--primary #2E6B4F`, `--primary-hover #25573F`, `--primary-light #E9F0EC`, `--bg-page #FFFFFF`, `--bg-mist #F1F5F2`, `--ink #1B211D`, `--ink-muted #6B7570`, `--border #E3E7E4`, and Manrope 700/800 as the heading font. Marketing and admin stay on current tokens.
- Rebuild the portal shell to the demo layout: sticky 72px header that shrinks to 60px on scroll, inline nav (Kõik oksjonid, Raieõigused, Metskinnistud, Ajalugu, KKK, Kontakt), guest button pair (Logi sisse + Paku oma metsa), avatar user menu with dropdown, mobile drawer, 4-column footer with social row and Küpsisesätted, cookie banner wired to `erametsad_consent` and `POST /api/v1/consent`.
- Listing `/`: mist page-head band, pill tab bar with counts, demo-shaped filter sidebar (species MA/KU/KS/HB/LM/SA, cut VR/HR/SR/LR/RD, Raietähtaeg year select, Telli teavitus sub-form), Kaardivaade/Loendivaade toggle, demo-anatomy lot cards in a dense auto-fill grid, map view with pins and popup, empty state, pagination.
- Lot detail open: anchor tabs, gallery lightbox, zebra facts table, map card with coordinates and external links, bid history table with Liidab/Käsitsi/Automaat chips, sticky bid rail with next-bid box, autobidder switch, snipe banner, guest gate modal.
- Lot detail sealed: mist lot-head band with Suletud pimepakkumine badge and deadline chip, dark sealed panel, confirm modal, locked post-submit state with Muuda pakkumist, lõppenud/tulemus phase displays.
- Ajalugu: 4-card stats band in the page head, demo sidebar (year select, Tüüp and Olek chips), results table with 8 columns, type chips, amber Lõpphind, uplift pill, Müümata rows, replacing the card grid.
- Auth pages: login, register, select-profile, update-password restyled to the demo layouts, including the 5-segment password strength meter with rules checklist and radio profile cards. Register keeps the existing functional 4-step flow. Reset-password pages restyle to the same auth card language.
- User area: remove the sidebar/search shell; use the standard portal header, Minu keskkond page heads, and a sub-nav tab row. Minu pakkumised and Minu objektid switch from tables to demo bid/object cards. Teavitused becomes an inbox list plus preference matrix plus saved searches panel. Minu profiil becomes five stacked cards with masked isikukood reveal and a delete-account modal.
- Contracts: `/lepingud` list restyled; both signing flows restyled to the demo 4-step wizard (Andmed, Kontroll, Allkiri, Valmis) with status rail, price summary, document viewer with agree checkbox, eID column buttons, and Mis edasi card.
- Countdown on the portal uses the demo format `2p 04:12:00` with the Lõpeb varsti pill swap below one hour. Status pills extended with the demo set.
- Listing filters match the demo exactly: the Maht (m³) range is dropped and Raietähtaeg (aasta) is added.
- DESIGN.md token and Mockup deviations sections updated to the new parity baseline.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `design-tokens`: portal-scoped token override with the demo palette and Manrope heading font, layered over the shared tokens without changing marketing or admin.
- `portal-shell`: header, footer, mobile drawer, cookie banner, and toast requirements change to the demo shell.
- `portal-listing`: page head, tab bar, filter sidebar, toolbar, lot card anatomy, map view, empty state, and pagination requirements change to the demo layout.
- `portal-lot-detail`: open and sealed detail layout requirements change to the demo, including bid history table, sticky bid rail, sealed panel, and phase displays.
- `portal-archive`: ajalugu stats band, sidebar, and results table requirements change to the demo.
- `portal-auth`: login, register, select-profile, update-password, and reset-password layout requirements change to the demo auth designs.
- `portal-customer-area`: user area shell, bids, objects, notifications, and profile layout requirements change from sidebar/tables to the demo page heads, tab row, and card layouts. The contract list and both signing flows restyle to the demo contract signing design (the signing UI requirement lives in this spec).

## Impact

- Code: `apps/platform/src/app/(portal)/**` (layout, all pages, `_components`, `_lib`), `packages/ui/src/components/Countdown.tsx` and `StatusPill.tsx` (additive props only), `apps/platform/src/app/(portal)/portal.css` (new).
- No API, schema, or dependency changes. No new icon set; Lucide stays. CSP unchanged.
- Marketing and admin surfaces must remain visually unchanged; portal token overrides stay inside `(portal)`.
- Docs: `DESIGN.md` updated; ARCHITECTURE.md unaffected.
- Verification: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, plus screenshot comparison of portal pages against the demo HTML.
