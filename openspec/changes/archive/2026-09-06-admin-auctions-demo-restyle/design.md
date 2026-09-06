# Design: admin-auctions-demo-restyle

## Context

The admin shell, token layer (`admin.css` with the full `--st-*` triads,
shadows, tints), `StatusChip`, and shared primitives already follow the demo
system. The auctions page (`apps/platform/src/app/(admin)/admin/auctions/page.tsx`)
is a single server component that renders tabs, filters, a shared `DataTable`,
inline bulk-schedule form, `<details>`-based row actions, and pagination. All
server actions live in `(admin)/_actions/auctions.ts` and keep their contracts.

Target: `docs/design/demo/admin/02-auctions-list.html`, translated onto
Tailwind utilities plus the existing admin tokens.

## Goals

- Pixel-close presentation parity with the demo for `/admin/auctions`.
- Working sort, live countdown, selection-driven bulk bar, guarded manual-end
  modal.
- No changes to server actions, schema, permissions, or URL parameter
  contracts (filters stay shareable).

## Decisions

### D1. One client wrapper for the table, not scattered islands

Row selection (checkboxes), the fixed bulk bar, selected-row highlight, and
the modal triggers share state. Instead of synchronizing islands with DOM
events, the table body + bulk bar + modal live in one client component
`AuctionsTable` that receives serialized rows and the server actions as
props (`duplicateAuctionAction`, `endAuctionManuallyAction`,
`archiveAuctionAction`, `relistAuctionAction`,
`bulkScheduleAuctionsAction`). Forms with server-action props work inside
client components, so the form contracts are unchanged: bulk schedule still
submits `ids`, `startsAt`, `endsAt`; end-manual still submits `id`,
`reason`, `outcome`.

Trade-off accepted: the table markup renders on the client after hydration.
The rows arrive fully serialized (strings, numbers, booleans, preformatted
labels), so the wrapper needs no data access.

### D2. Native `<dialog>` for the manual-end modal

`EndAuctionModal` uses the native `<dialog>` element with `showModal()`:
free focus trap, Escape handling, and backdrop styling via `::backdrop`.
Content mirrors the demo: warning banner ("Lõpetamine on pöördumatu"),
context line built from row data, outcome radio rows (winner / unsold),
required reason (`minLength={5}`), danger confirm button. The same pattern
is available to the archive dropdown later; for now archive keeps its
inline dropdown restyled to the demo `ra-btn` look.

### D3. Countdown as a small client component

`Countdown` receives `endsAt` (ISO string) and renders the ticking
remaining time for active auctions; it applies the critical class under
five minutes (`cd-blink` keyframes added to `admin.css` — the only custom
CSS in this change, matching the project rule that Tailwind utilities carry
styling) and shows "lõppenud" at zero. The server renders the initial value
as `children`, so there is no layout shift before hydration. Full end time
is exposed via `aria-label` (the demo's accessibility requirement).

### D4. Sort stays in the JS layer, helpers extracted

The page already fetches a bounded set (limit 5000) and sorts in JS. The
sort comparator, sort-key whitelist (`id`, `title`, `minBidCents`,
`bidCount`, `endsAt`, `createdAt`), countdown text, and initials helper move
to `auctions/_lib/list-view.ts` with vitest tests. Sort toggles are Links
built by `buildUrl({ sort })`, so sort state stays URL-shareable like the
filters. Defaults are unchanged: `endsAt` ascending when exactly the active
status is filtered, otherwise `-createdAt`. `DataTable` stays presentational:
it accepts optional per-column sort descriptors (current key/direction plus
an href for the opposite direction) and renders the demo's `th-sort` button
look with `aria-sort` on the active `th`.

### D5. Filter parity, not filter regression

The demo's Olek chip shows a single select; the current page supports a
multi-select status filter (`status=a,b` joined in the URL). The multi-select
stays, wrapped in the demo chip styling. All other filters (Tüüp, Mehaanika,
Spetsialist, Maakond, date range, freetext) map one-to-one onto demo chips.
The filter form keeps its GET submit so "shareable filters" survives.

### D6. Row presentation details

- Type cell: icon chip (tree-pine / map-pin-house / wheat / package via the
  existing shared icon set, extended if needed) plus the A/S letter badge
  for open/sealed mechanics, tooltip carries the full label.
- Quick auctions: zap marker next to the name.
- Specialist: 26px initials avatar with the full name in `sr-only` + title.
- Bid count: `(p)` amber marker when pending alapakkumised exist.
- Row actions (Vaata portal link, Muuda, Dupl., ⌫ for end/archive/relist)
  are hidden until row hover or focus-within, always visible on
  touch devices (`@media (hover: none)` equivalent via Tailwind).

### D7. ha/m³ column skipped

The auctions schema has no area/volume columns; the demo's "12 / 980" data
would require parsing `compartments`/`packageRows` TEXT-JSON. Deferred per
confirmed decision; the column order skips it without renumbering others.

## Risks / trade-offs

- `DataTable` restyle is shared: every admin table changes chrome. Mitigated
  by keeping the density classes from the previous change and verifying
  representative screens visually.
- Client-rendered table body: first paint shows the server-rendered skeleton
  area; acceptable for an internal admin tool, and rows are serialized
  props so hydration is cheap.
- `hover:none` styling for touch: Tailwind's `hover-none` variant covers the
  demo's media query.

## Migration plan

Single deployable change; no data migration. Rollback is a revert — no
persisted state is touched.

## Open questions

None blocking. (Deferred items listed in proposal.md Non-goals.)
