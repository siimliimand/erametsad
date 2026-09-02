## Why

A line-by-line verification of Phase 3 (docs/tasks.md "Phase 3 — Auction
portal") against `docs/design/portal/01..13` and the committed specs found
the [M] scope only partially implemented. The pages exist and much of the
spec passes review, but four of the five demo flows have defects. The
defects below were confirmed by direct code inspection.

1. Sealed bids store no identity snapshot. `SealedBidPanel` sends
   `identitySnapshot`, but `POST /api/v1/bids/create` extracts only
   `auctionId, amount, type, idempotencyKey` and drops it. The encrypting
   `submitSealedBid` (`lib/bidding/sealed-bid.ts`) has no production caller.
   `identity_snapshot` stays empty, and the sealed revision cap is enforced
   only in the browser.
2. Registration drops the isikukood. `RegisterWizard.handleRegister` sends
   only `identifier` (email); `api/v1/auth/register` stores no isikukood
   hash. New accounts can never log in by isikukood, and `completeEidLogin`
   (which matches by `isikukoodHash`) can never find them.
3. The password-reset email links to `/parooli-taastamine?token=...`
   (`forgot-password/route.ts:98`). No route, page, or redirect exists at
   that path. Password recovery is broken end to end.
4. New users hit a password dead-end. `StepDone` links to plain
   `/update-password`, which demands the current password the user never
   received. The `?first=1` variant exists but nothing links to it.
5. The alapakkumine toggle is dead code on the lot page. `page.tsx` never
   passes `allowUnderStart` and never reads `settings.alapakkumineEnabled`.
   Server-side admission (AuctionDO) works; the UI never offers the path.
6. Autobidder edit and delete are broken on the lot page. The page passes
   only `hasAutobidder`; no row id or stored max reaches
   `AutobidderControl`, so "Eemalda" never renders and the input never
   prefills. The Minu pakkumised inline editor has the same blind start.
7. The lot page ignores `auction:extended` and `auction:ended` SSE events.
   The header countdown does not move on an extension and the panel does
   not lock when the auction ends. Only the listing consumes these events.
8. The demo eID simulator cannot complete a login out of the box. Its
   default isikukoods (`38803160272` etc.) do not overlap the seed users
   (`10000000001`..`10000000008`), so `complete` returns 401 after the
   control-code screen.

Additional gaps against committed [M] requirements: the portal header has
no Ajalugu or register link; the sealed identity form has 2 of the 5 spec
fields; the "Lisainfo" (secondaryInfo) card has no schema field to render;
the password rule "not equal to isikukood" is enforced nowhere; the login
route collapses suspended accounts into a generic 401 so the suspended
banner is unreachable; the notification preference matrix is read-only
(toggles disabled, no persistence, 7 of 8 events); password reset tokens
live in an in-memory Map that does not survive restarts; the lot-page
Countdown has no server-clock drift correction and no `onEnd` wiring.

Missing [S] items: the "Telli teavitus" entry point on the listing (the
backend and the notifications-page UI exist), the archive statistics band
(the statistics aggregation exists, the page never calls it), and two of
six archive sort options.

Finally, the prototype serves one hostname while the architecture reserves
`oksjonid.erametsad.ww0.dev` for the portal. This change adds host-based
routing for that hostname on the same Worker, so no new deployment unit
appears.

## What Changes

- **Sealed-bid identity**: the bid route reads and validates
  `identitySnapshot` and forwards it to the DO path and the `placeBid`
  fallback; both encrypt it with the existing AES-256-GCM module and write
  `identity_snapshot`; the sealed revision cap from Settings is enforced
  server-side with a `revision_cap_exceeded` error the panel renders; the
  form gains the missing aadress, e-post, and telefon fields.
- **Registration**: checksum-validated isikukood is hashed and stored at
  registration; step 3 gains phone and address fields; the done screen
  links to `/update-password?first=1` and to the raamleping flow, and the
  register route issues a session so the first-password page passes auth.
- **Password flows**: the reset email links to `/reset-password/:token`;
  reset tokens move from the in-memory Map to a D1 table; change and reset
  endpoints enforce the character classes and the "not equal to isikukood"
  rule server-side; the change page passes the viewer's isikukood to the
  strength meter.
- **Lot page live behavior**: the page reads `alapakkumineEnabled` from
  Settings and passes `allowUnderStart` to the panel; a new
  `GET /api/v1/auto-bidders?auction=` returns the caller's own row so the
  panel and the Minu pakkumised editor prefill and can delete; handlers
  for `auction:extended` and `auction:ended` update the countdown and lock
  the panel; `Countdown` gains an optional `serverNow` prop for drift
  correction and an `onEnd` callback.
- **Auth polish**: the demo eID provider accepts the seeded isikukoods;
  the login route returns a distinguishable code for suspended accounts so
  the existing banner renders; the portal header gains Ajalugu and
  Registreeru links; the shell dropdown gains the profile switcher.
- **Dossier**: a new `descriptionSecondary` D1 column (Drizzle migration)
  feeds the "Lisainfo" card; the rich-text renderer keeps headings; the
  SpecialistCard shows the stored photo and role.
- **Notifications**: a `notificationPreferences` column on profiles plus a
  PATCH allowlist entry make the preference matrix functional; the eighth
  event (auction published) joins the matrix; the dispatcher consults
  preferences before sending.
- **Listing and archive [S]**: "Telli teavitus" entry point on the filter
  panel (authed prefilled modal, guest email + consent); archive statistics
  band from the existing aggregation; the two missing archive sorts and an
  active-filter count badge.
- **Small fixes**: arrow-key amount stepping, species tooltips, the stale
  `/contracts/framework` redirect strings in `contract-gate.ts` and
  `place-bid.ts`, county GeoJSON outlines on `MapEstonia`.
- **Host routing**: host-aware middleware maps `oksjonid.erametsad.ww0.dev`
  to the `(portal)` area on the existing `erametsad-api` Worker, with cookie
  domain handling; `api.` and `admin.` hostnames are documented as a
  follow-up, not built here.
- **Docs**: Phase 3 checkboxes in `docs/tasks.md` are corrected to verified
  reality after the fixes land, with deferrals recorded in writing.

## Deferrals (accepted in writing)

- Register email-token verification (double opt-in for the non-eID path):
  deferred by user decision in this session's planning. eID stays the
  primary prototype path.
- CSV exports in Minu pakkumised: already deferred in writing by the
  archived phase-3 change; this change does not reopen it.
- Digest jobs, GDPR export/delete jobs, Web Push, TOTP 2FA: stay [L].
- `api.erametsad.ww0.dev` and `admin.erametsad.ww0.dev` host routing: the
  middleware extension point is documented; only the portal hostname is
  implemented.

## Missing specialization

`.opencode/agents/` contains only `build`, `plan`, and
`fullstack-engineer`. No specialist engineer exists for backend, data, or
auth work, so all tasks are annotated `fullstack-engineer` (fallback
worker). Consider `/make-engineer` for a backend/auth engineer.
