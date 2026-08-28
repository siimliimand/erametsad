## Why

Validation of Phase 2 (docs/tasks.md "Phase 2", archived change
2026-08-28-phase-2-core-backend) found the [M] requirements only partially
implemented. The unit suite is green (45 tests) but it mocks exactly the
integration points where the defects live.

Blocking defects:

1. `placeBid` runs without a transaction or row lock. The file states this
   in a comment. Concurrent bids can both read the same leading bid and
   both create `leading` rows.
2. Anti-snipe, autobidder evaluation, and alapakkumine are dead code. The
   bid route calls only `placeBid`, and `placeBid` rejects under-minimum
   bids outright, so alapakkumine is unreachable through the API.
3. The autobidder loop lets the chosen autobidder bid against its own
   leading bid up to its full max, and auto-vs-auto never resolves to
   `secondMax + bidStep`. The existing test named "resolves to secondMax +
   step" asserts 110 where the spec requires 210.
4. AES-256-GCM encryption discards the auth tag. Node was verified to
   throw on `final()` without `setAuthTag`. The Users `afterRead` hook
   therefore throws for every seeded user (all have an isikukood), and
   sealed-bid decryption silently reports every amount as 0.
5. The Auction collection has no open/sealed `type` field. The ending
   worker branches on `auction.type`, so sealed auctions are always
   processed as open ones and the ceremony is bypassed. The worker test
   mocks a field the schema cannot store.
6. The ending worker is never started (no callers, no instrumentation, no
   queue), and two of its branches use invalid transitions
   (`active → unsold`, `active → appraised`) that the collection hook
   rejects.
7. The access token expires after 5 minutes and no refresh endpoint
   exists. The refresh cookie points at `/api/auth`, where no route lives.
   The JWT hardcodes `role: 'user'`, so the admin sealed-opening routes
   return 403 for everyone.
8. eID has no `complete` endpoints and never creates a session. There is
   no forgot-password or change-password endpoint, and `createResetToken`
   has no caller.
9. `signContract` never writes `signedBy`, so the framework-contract gate
   (which queries `signedBy`) can never pass. The gate also sits behind a
   feature flag that seeds never enable.
10. Only `auction:ended` is ever broadcast, and only from the worker that
    never runs. `bid:created`, `auction:extended`, `auction:published`,
    and every `my/stream` event are never emitted. The notification
    dispatcher is never started, and worker events carry no `userId`, so
    dispatch would no-op anyway.
11. Sealed seed fixtures store plaintext amounts and `ENC::dummy…`
    identity strings, which breaks "unreadable at rest" and the live
    opening demo.
12. The leads endpoint uses the 100/min API limiter instead of 5/min/IP
    and accepts `ipHash` from the client body instead of computing it.

## What Changes

- **Crypto**: store and verify the AES-256-GCM auth tag in both crypto
  modules; tampered ciphertext throws; Users `afterRead` never throws.
- **Auction schema & worker**: required `type` (open|sealed) field on
  Auction; ending worker performs `active → ended` first, then
  `ended → appraised|unsold`; reserve-price outcome check; sealed branch
  keyed on the schema field; worker and notification listener started
  from Next.js `instrumentation.ts`.
- **Bidding engine**: `placeBid` in a serializable transaction with a row
  lock; the bid route wired to anti-snipe, autobidder evaluation,
  alapakkumine, audit, and SSE broadcast; `ipHash` and `source` computed
  server-side; autobidder evaluation rewritten to the spec algorithm.
- **Sealed flow**: rights check on submission; persisted two-person
  opening sessions with 30-minute expiry; `confirmWinner` validates the
  top-ranked bid, compares the reserve price, publishes `finalPrice`,
  notifies losers, and queues the contract.
- **Auth & sessions**: JWT carries real role and `activeProfileId`;
  refresh endpoint with rotation and reuse detection; eID `complete`
  endpoints that create sessions; forgot-password and change-password
  endpoints; suspended users blocked at login; three consents stored with
  timestamps; session list and revoke endpoints.
- **Contracts**: `signedBy` recorded from the token at signing; gate
  active by default.
- **Realtime & notifications**: all four public SSE events emitted;
  my-stream outbid/notification events; dispatcher started; email sent
  through Mailpit SMTP (adds `nodemailer`); SMS stays a log stub.
- **Forms & stats**: leads endpoint at 5/min/IP with `@eametsad/types`
  validation; sealed completion backfills the statistics snapshot from
  `finalPrice`.
- **Seed & docs**: sealed auctions flagged `type: 'sealed'`; sealed bids
  created through the real encrypted path; `requireFrameworkContract`
  seeded on; `docs/tasks.md` Phase 2 checkboxes corrected to reality.

## Deferrals (accepted in writing)

Per the Definition of Done in docs/tasks.md, these remain deferred and are
out of scope: ServiceRequest + Partner directory [S], NewsletterSubscriber
[S], saved-search matcher + digests [S]/[L], media renditions pipeline
[S], TOTP 2FA [L].

BullMQ / Cloudflare Queues stays deferred behind the existing queue
interface. For the prototype the ending worker runs on a 30-second
interval registered in `instrumentation.ts`. This keeps the ending
server-authoritative and idempotent, which is the requirement that
matters; the queue transport swap is a post-prototype deployment concern.

## Missing specialization

`.opencode/agents/` contains only `build`, `plan`, and `fullstack-engineer`.
No specialist engineer exists for backend, data, or security work, so all
tasks are annotated `fullstack-engineer` (fallback worker). Consider
`/make-engineer` for a backend/data engineer before Phase 3.
