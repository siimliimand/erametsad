# Phase 4 Exit Verification

**Date:** 2026-08-28
**Branch:** feature/option-b-cloudflare-only
**Worker:** eametsad-api (local wrangler dev, port 8787)

## Evidence Table

| # | Test | Command | Result | Status |
|---|------|---------|--------|--------|
| 1 | Worker build | `pnpm build:cf` | OpenNext build complete, worker.js generated | PASS |
| 2 | App reachable | `curl http://localhost:8787/` | 200 OK | PASS |
| 3 | Credential login | `POST /api/v1/auth/login` with `{"identifier":"private@eametsad.ee","password":"demo1234"}` | 200 OK, user returned, access_token + refresh_token cookies set | PASS |
| 4 | Token refresh | `POST /api/v1/auth/refresh` with refresh_token cookie | 200 OK, new access_token + refresh_token issued | PASS |
| 5 | Session persistence | `wrangler d1 execute DB --local --command "SELECT * FROM sessions"` | Session row exists with correct user_id, token_family, hashes, revoked_at=NULL | PASS |
| 6 | Token-family rotation | Three consecutive refresh calls on same session | Each returned 200 OK with rotated tokens; D1 shows updated access_token_hash and refresh_token_hash after each rotation | PASS |
| 7 | Framework contract | `POST /api/v1/bids/framework-contract/prepare` + `POST .../complete` | 201 OK, contract signed for auction | PASS |
| 8 | Bid via AuctionDO | `POST /api/v1/bids/create` with access_token cookie | 201 OK, bid created with status=pending_approval (under-start bid) | PASS |
| 9 | Logout (session revoke) | `DELETE /api/v1/my/sessions?id=<sessionId>` | 200 OK, session revoked | PASS |
| 10 | Revoked session check | `SELECT ... FROM sessions WHERE revoked_at IS NOT NULL` | Session row has revoked_at set | PASS |
| 11 | Revoked token rejected | `GET /api/v1/my/sessions` with revoked access_token | 401 Unauthorized | PASS |

## Token-Family Rotation Survival

The session row persists in D1 across token rotations:

- **Session ID:** `8e0ec7f4-60b2-4ebe-834f-98445fa410da`
- **Token family:** `20b605c4-a134-4564-b0a6-0c110b889f5b`
- **D1 row:** `revoked_at = NULL`, `access_token_hash` and `refresh_token_hash` updated after each rotation
- **Reuse detection:** Old refresh token returns 401 (token-family reuse blocked)

D1-backed sessions survive isolate restarts because the session state lives in D1, not in-memory.

## Notes

- The D1 remote placeholder id (`REPLACE-WITH-REAL-D1-DATABASE-ID`) is still in wrangler.jsonc; local dev uses miniflare and ignores it.
- Queue consumer is registered in wrangler.jsonc with `eametsad-jobs` producer and consumer bindings; wrangler dev includes the queue handler automatically.
- The bid returned `status: pending_approval` because the test user's profile has `approvalStatus: pending` (under-start bid requires seller approval). This is correct business behavior.
- No `/api/v1/auth/logout` route exists; logout is done via `DELETE /api/v1/my/sessions?id=<sessionId>` which revokes the session in D1 and clears cookies.
