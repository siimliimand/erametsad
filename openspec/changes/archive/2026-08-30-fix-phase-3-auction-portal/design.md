## Context

The archived phase-3 change built the full `(portal)` route group against
the phase-2 services: listing with SSE, dossier, BidPanel, sealed panel,
auth pages, customer area, and the signing flows. The verification behind
this change found the defects listed in proposal.md. Most sit at the
wiring layer: the components and endpoints exist, but page props, request
bodies, or settings reads drop the data between them.

Key existing pieces this change builds on:

- `lib/bidding/sealed-bid.ts` `submitSealedBid` already implements
  encryption plus the revision cap, but nothing calls it in production.
- `lib/encryption.ts` provides the AES-256-GCM primitives both the DO and
  the Node fallback use.
- `lib/data/schema/` is Drizzle over D1; migrations run through Drizzle
  Kit (`apps/platform/drizzle/`).
- `AuctionStreamProvider` (`_lib/use-auction-stream.ts`) already receives
  `auction:extended` and `auction:ended`; only consumers are missing.
- `packages/ui` `Countdown` computes from `Date.now()` with no server
  reference.

Page-level truth stays in `docs/design/portal/01..13`. The committed
specs under `openspec/specs/` are the source for the deltas in `specs/`.

## Goals / Non-Goals

**Goals:**

- Close every P0 defect so the sealed, registration, and recovery flows
  work end to end on a fresh `seed:reset`.
- Make the two dead UI paths (alapakkumine toggle, autobidder edit or
  delete) live without changing bid admission, which already works.
- Bring the portal to the committed [M] requirements and the agreed [S]
  items (Telli teavitus entry, archive statistics band).
- Serve the portal at `oksjonid.erametsad.ww0.dev` on the same Worker.

**Non-Goals:**

- Admin UI work (phase 5) and marketing site (phase 4).
- Real eID or signing providers; the demo simulator and mock ceremony
  stay.
- Register email-token verification (deferred, see proposal).
- CSV exports, digests, GDPR jobs, TOTP (deferred, see proposal).
- Any change to bid admission rules, anti-sniping math, or the ending
  worker.

## Decisions

### D1: Identity snapshot travels the existing bid path

`bids/create` gains a validated `identitySnapshot` body field and forwards
it through both admission paths (AuctionDO RPC and the `placeBid`
fallback). `placeBid` and the DO encrypt it with the existing
`encryptSealedData` and write the `identity_snapshot` column on sealed
bids. We do not resurrect `submitSealedBid` as a parallel path; its cap
and validation logic moves into the shared path instead. This keeps one
admission code path, which is what the guardrails require
(AuctionDO owns bid admission).

### D2: Revision cap enforced where the bid is admitted

The cap (`1 + settings.sealedRevisionCap`) is checked in the same
transaction or DO turn that appends the bid, counting the user's existing
sealed bids on that auction. The DO path and the fallback must behave the
same; a shared helper counts prior bids and both call sites enforce. The
response uses error code `revision_cap_exceeded`; `SealedBidPanel` maps it
to an inline Estonian message and locks the form.

### D3: descriptionSecondary is a new column

The "Lisainfo" card gets a real source: a nullable `description_secondary`
TEXT column on `auctions` via a Drizzle migration, surfaced in the admin
auction editor next to the existing public description, and rendered as a
second rich-text card on the lot page. Mapping `descriptionInternal` was
rejected: it would leak an internal field into public output and diverge
from the design spec. The renderer upgrade (headings kept) applies to
both cards.

### D4: Countdown drift correction via an optional prop

`packages/ui` `Countdown` gains an optional `serverNow` prop (epoch ms
captured during SSR). When present, the tick computes
`serverNow + (Date.now() - mountTime)` instead of `Date.now()`, which
corrects client clock drift without a new component. An optional `onEnd`
callback fires once at zero; the lot page uses it to refresh bid state.

### D5: Preferences as a JSON column with a PATCH allowlist entry

`profiles` gains `notificationPreferences` (TEXT-JSON: `{ [event]:
{ email: boolean, sms: boolean } }`). The profiles PATCH allowlist accepts
it, the matrix toggles become live, and the dispatcher consults it before
queueing a channel. Missing keys default to current behavior (email on,
SMS off), so existing sends do not change. The eighth event
(`auction.published`) is added to the matrix set; SMS stays gated on a
verified phone, which the prototype does not have, so SMS toggles remain
display-only with their existing note.

### D6: Reset tokens move to D1

A `password_reset_tokens` table (token hash, user id, expires at, used
at) replaces the in-memory Map. `forgot-password` inserts, `reset-password`
marks used inside the same statement that succeeds once. This survives
restarts and works across isolates, which the Map does not.

### D7: Host routing by middleware on the same Worker

`oksjonid.erametsad.ww0.dev` maps to the `(portal)` area through
middleware that inspects the Host header and rewrites or blocks
accordingly; the default hostname keeps today's behavior. Cookies keep
their current host-only scope, so sessions work on both hostnames without
a shared parent domain. The Worker count stays at two (the app and the
queue consumer). DNS plus a Workers route or custom domain on the `ww0.dev`
zone is a one-time dashboard step recorded in the cutover runbook.
`api.` and `admin.` hostnames reuse the same mapping table later.

### D8: Demo eID reads the seed, not a hardcoded list

The demo provider accepts any isikukood that hashes to an existing user
(the same lookup `complete` already does), keeping the pending-then-
completed poll dance. The hardcoded demo list stays as fallback for
empty databases, and `.env.example` documents `EID_DEMO_ISIKUKOOD`. The
login route returns `code: 'ACCOUNT_SUSPENDED'` for suspended users so
the existing `SuspendedBanner` renders; the generic 401 stays for unknown
credentials.

## Risks / Trade-offs

- The identity-snapshot change touches the DO admission path. Mitigation:
  the field is additive; open-bid requests without it behave exactly as
  before, and the sealed tests assert ciphertext at rest.
- Middleware host mapping affects every request. Mitigation: the default
  branch is a no-op unless the host matches the portal hostname; the
  smoke task tests both hostnames.
- The preferences column changes dispatcher behavior. Mitigation: missing
  keys default to the current send matrix, and the dispatcher test asserts
  both the default and the muted path.
