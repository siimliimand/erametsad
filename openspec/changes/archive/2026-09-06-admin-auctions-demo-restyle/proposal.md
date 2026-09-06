# Proposal: admin-auctions-demo-restyle

## Why

The archived `admin-demo-design-shell` change landed the demo design system in
the admin shell, tokens, and shared primitives, but explicitly deferred the
per-screen walkthrough. `/admin/auctions` — the operational control room —
still renders in the pre-demo utility style while the approved prototype
`docs/design/demo/admin/02-auctions-list.html` (and its written spec
`docs/design/admin/02-auctions-list.md`) defines the target: pill type tabs
with count badges, a chip-based filter bar, a card table with working
sortable headers, hover row actions, a selection-driven bulk bar, a guarded
manual-end modal, and live countdowns.

The page already has the correct logic: URL-shareable filters, tab counts,
bulk scheduling, CSV export, manual end with reason + outcome, archive,
re-list, permission gating, and pagination. The gap is presentation and the
demo's interaction layer.

Decisions confirmed with the user:

- Shared `DataTable` is restyled so every admin screen inherits the demo
  card look; page-local pieces stay on the auctions page.
- Full demo interactivity: ticking countdown with a critical state under
  five minutes, selection-driven bulk bar, and the manual-end modal.
- The demo's "ha / m³" column is skipped — the auctions table has no
  area/volume columns (revisit when the schema gains them).
- Sortable headers are working sort, not decoration.

## What Changes

- **Shared `DataTable`**: demo card treatment (white surface, 8px radius,
  card shadow) plus optional sortable-column support — sort buttons with
  asc/desc arrow icons and `aria-sort` on the active `th`.
- **`admin.css`**: the demo's countdown critical-blink keyframes.
- **Auctions page presentation** rebuilt to the demo: breadcrumb line +
  page actions ("Uus oksjon" with a ⌘N hint, "Ekspordi CSV" ghost action),
  pill type tabs with counts, chip filter bar (chip-wrapped selects
  including the multi-select Olek, inline date-range chip, pill search,
  "Tühjenda (n)" active-filter count), type chips with icon + A/S letter
  badge, quick-auction zap marker, specialist initials avatar, bid count
  with the pending alapakkumine marker, hover-revealed row actions
  including the portal "Vaata" link.
- **Working column sort** on ID, Nimi, Alghind, Pakkumisi, and Lõpp
  through the existing JS sort layer; sort and countdown helpers extracted
  to `auctions/_lib/list-view.ts` with vitest coverage.
- **New client components**: `Countdown` (ticking, critical state under
  five minutes, `aria-label` with the full end time), `AuctionsTable`
  wrapper (row selection state, fixed dark bulk bar with "Ajasta
  avaldimine" and "Ekspordi valitud", selected-row highlight, ⌘N
  shortcut), and `EndAuctionModal` (irreversibility warning, auction
  context line, outcome radio rows, required reason of at least five
  characters, danger confirm) wrapping the existing
  `endAuctionManuallyAction`.
- **Server actions and their contracts are unchanged**: bulk schedule
  keeps the same `ids` + datetime fields; end-manual keeps reason +
  outcome; archive, re-list, duplicate, and export are untouched.

## Non-goals (deferred)

- ha/m³ column — no area/volume fields on the auctions schema.
- "Veerud" column chooser — decorative in the demo prototype.
- SSE live row refresh — the written spec's live updates; this change
  ships client-side countdown ticking only.
- Keyboard row navigation (↑/↓, Enter, E, X) — first pass ships ⌘N only.
- Anti-snipe extension flash and ⏱ icon — needs the extension event feed
  the list does not consume yet.
- Archive as a modal — keeps the inline dropdown, restyled to the demo
  action-button look.

## Impact

- **Specs**: `admin-ui` (MODIFIED shared-component demo density to add the
  card treatment; ADDED sortable table headers), `admin-auction-management`
  (MODIFIED auctions list operations to add demo presentation parity and
  the interaction layer).
- **Code**: `apps/platform/src/app/(admin)/_components/DataTable.tsx`,
  `apps/platform/src/app/(admin)/_components/icons.tsx`,
  `apps/platform/src/app/(admin)/admin.css`,
  `apps/platform/src/app/(admin)/admin/auctions/page.tsx`, new
  `apps/platform/src/app/(admin)/admin/auctions/_lib/list-view.ts` (+test),
  new `apps/platform/src/app/(admin)/admin/auctions/_components/` client
  components. No data layer, schema, API, or auth changes.
- **Risk**: the `DataTable` restyle touches every admin screen — verified
  with a visual check across representative screens. The client wrapper
  must preserve the server-action form contracts (`ids`, `startsAt`,
  `endsAt`; `reason`, `outcome`).
- **Agents**: `.opencode/agents/` contains only `fullstack-engineer`
  alongside the `build`/`plan` primaries (which are never spawned), so all
  tasks are annotated with it; no missing specialization.
