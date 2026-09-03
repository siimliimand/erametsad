# Cutover runbook — Cloudflare-only stack

Change: `option-b-cloudflare-only` · Worker: `erametsad-api`
Branch: `feature/option-b-cloudflare-only`

## 1. Prerequisites

- [ ] Workers Paid plan active on account `29f50b2c797dc5cd6ccd0cff405adb43`
- [ ] API token has these permissions:
  | Scope | Permission |
  |---|---|
  | Workers Scripts | Edit |
  | D1 | Edit |
  | Queues | Edit |
  | R2 | Edit |
  | Email Sending | Edit |
  | Email Routing | Edit |
  | DNS | Edit (`ww0.dev` zone) |
  | Billing | Read (optional, for plan verification) |
- [ ] D1 database created — run once from `apps/platform`:

  ```bash
  pnpm exec wrangler d1 create erametsad-db
  ```

  Copy the returned `database_id` into `wrangler.jsonc` → `d1_databases[0].database_id`, replacing `REPLACE-WITH-REAL-D1-DATABASE-ID`.
- [ ] DLQ queue exists:

  ```bash
  pnpm exec wrangler queues create erametsad-dlq
  ```

  (`erametsad-jobs` is created by `wrangler deploy` if missing, but create it explicitly to confirm permissions.)
- [ ] Email Service enabled for sending subdomain `erametsad` on zone `ww0.dev` (id `8761a52640daef70b6cf6f14d38e6dd9`). Onboarding creates SPF/DKIM records automatically.
- [ ] eID Easy sandbox (or production) credentials ready: `EIDEASY_CLIENT_ID`, `EIDEASY_SECRET`. Optionally `EIDEASY_API_URL` if not using the default `https://id.eideasy.com`.

## 2. Secrets

Set every secret below with `pnpm exec wrangler secret put <NAME>` from `apps/platform`:

```bash
# Auth & crypto
pnpm exec wrangler secret put JWT_SECRET
pnpm exec wrangler secret put PAYLOAD_SECRET          # used as IP hash salt, not Payload CMS
pnpm exec wrangler secret put PAYLOAD_PREVIEW_SECRET
pnpm exec wrangler secret put ISIKUKOOD_ENCRYPTION_KEY

# Cloudflare Email Service
pnpm exec wrangler secret put CLOUDFLARE_EMAIL_TOKEN
pnpm exec wrangler secret put CLOUDFLARE_ACCOUNT_ID

# SMTP fallback (EMAIL binding → CF API → SMTP chain)
pnpm exec wrangler secret put SMTP_HOST
pnpm exec wrangler secret put SMTP_PORT
pnpm exec wrangler secret put SMTP_USER
pnpm exec wrangler secret put SMTP_PASS
pnpm exec wrangler secret put SMTP_FROM

# eID Easy
pnpm exec wrangler secret put EIDEASY_CLIENT_ID
pnpm exec wrangler secret put EIDEASY_SECRET
pnpm exec wrangler secret put EIDEASY_API_URL        # optional, defaults to https://id.eideasy.com

# Public app URL (reset links, newsletter confirm links, canonical URLs)
pnpm exec wrangler secret put NEXT_PUBLIC_APP_URL
```

`DATABASE_URL` and `REDIS_URL` are not needed: the app reads D1 through the
`DB` binding and rate limiting is in-memory or DO-backed. An earlier version
of this runbook set placeholder values for them to satisfy the removed
module-scope validation in `src/env.ts`; that validation no longer exists.

## 3. Deploy

```bash
pnpm build:cf
pnpm exec wrangler deploy
pnpm db:migrate:remote
```

Seed or import data (decision tree: `scripts/migrate-pg-to-d1/README.md`):

- **No production Postgres data** (expected): `pnpm seed:reset` for local; for remote use `pnpm migrate:pg:import` with `--remote`.
- **Production Postgres data exists:** follow the export → transform → import path in the README.

Queue consumers (`erametsad-jobs`, `max_retries: 3`, DLQ `erametsad-dlq`) deploy with the Worker config — active immediately after `wrangler deploy`. Cron trigger (`* * * * *`) runs the auction-ending safety sweep.

## 4. DNS

All prototype hostnames attach as Workers custom domains — no pre-existing DNS records on these names (verified in the email spike report).

### Web hostnames

From the Cloudflare dashboard → Workers → `erametsad-api` → Settings → Domains & Routes → Add:

| Route | Custom domain |
|---|---|
| `erametsad.ww0.dev/*` | Marketing / portal |
| `oksjonid.erametsad.ww0.dev/*` | Auction portal |
| `api.erametsad.ww0.dev/*` | API |
| `admin.erametsad.ww0.dev/*` | Admin UI |

Workers custom domains provision TLS automatically. Alternatively, add routes in `wrangler.jsonc`.

### Portal hostname routing

The `oksjonid.erametsad.ww0.dev` custom domain serves the `(portal)` route group. The host-aware middleware in `apps/platform/src/middleware.ts` does the mapping (change `fix-phase-3-auction-portal`, design D7).

Before you send traffic to the portal hostname, deploy the app with this middleware. The middleware redirects portal routes and app routes to their mapped host. Redirects use HTTP 308, which keeps path and query.

Session cookies are host-only. No `domain:` attribute is set in `src/lib/auth/session.ts`, so each hostname keeps an independent session.

The `api.` and `admin.` hostnames attach to this same Worker. The middleware no-ops on them today. Mapping them to their own areas is a documented follow-up, not part of this change.

### Email DNS

Onboarding the `erametsad` sending subdomain on `ww0.dev` creates SPF, DKIM (`cf-bounce.erametsad.ww0.dev`), and DMARC (`_dmarc.erametsad.ww0.dev`) records automatically. Verify with `dig` after onboarding. Prototype sender: `noreply@erametsad.ww0.dev`.

## 5. Post-cutover verification

Use `wrangler tail` for direct access if DNS has not propagated. Full checklist in task 8.6 (publish, bid, anti-snipe, end, win, contract, email).

```bash
# Health
curl -s https://erametsad.ww0.dev/api/health

# Login and extract token
TOKEN=$(curl -s -X POST https://api.erametsad.ww0.dev/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"identifier":"private@erametsad.ee","password":"demo1234"}' \
  | jq -r '.access_token')

# List auctions
curl -s https://api.erametsad.ww0.dev/api/v1/auctions \
  -H "Authorization: Bearer $TOKEN" | jq '.length'

# Place a bid (AuctionDO path)
curl -s -X POST https://api.erametsad.ww0.dev/api/v1/bids/create \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"auctionId":"<AUCTION_ID>","amountCents":500000}'

# SSE stream (anti-snipe / auction end events)
curl -sN https://api.erametsad.ww0.dev/api/v1/auctions/stream?auctionId=<AUCTION_ID>
```

## 6. Rollback

### Worker version rollback

```bash
pnpm exec wrangler rollback
```

Or dashboard: Workers & Pages → `erametsad-api` → Deployments → previous version → Rollback.

### Queue consumer disable

Remove consumer block from `wrangler.jsonc` and redeploy, or disable in dashboard under Queues → `erametsad-jobs` → Consumers.

### DNS revert

Remove custom domain routes from Workers dashboard (Settings → Domains & Routes). Previous DNS records return.

### Rollback scope

- **Before production cutover:** trivial — Option A stays on its branch. No production data exists (decision record `0001-option-b-phase0-decisions.md`).
- **After production cutover:** previous Worker version is instant. D1 data persists. Queue messages reprocess by the rolled-back consumer.
- **eID Easy production cutover** is a separate future runbook — this covers only the prototype on `ww0.dev`.
