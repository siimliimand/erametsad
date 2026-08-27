## 1. Repository & tooling

- [x] 1.1 Initialize pnpm workspace + Turborepo; scaffold `apps/platform` (Next 15) with Payload 3 + Postgres adapter <!-- agent: fullstack-engineer.build, depends_on: [], touches: [pnpm-workspace.yaml, turbo.json, package.json, apps/platform/**] -->
- [x] 1.2 Create shared packages `ui`, `types`, `config`, `emails` (empty but wired) <!-- agent: fullstack-engineer.build, depends_on: [1.1], touches: [packages/**] -->
- [x] 1.3 ESLint + Prettier + strict TS config in `packages/config`, applied everywhere <!-- agent: fullstack-engineer.build, depends_on: [1.2], touches: [packages/config/**, eslint.config.mjs, .prettierrc, tsconfig.json] -->
- [x] 1.4 docker-compose for local dev (postgres 16, redis 7, Mailpit SMTP) + `.env.example` with zod-validated env loading <!-- agent: fullstack-engineer.build, depends_on: [1.1], touches: [docker-compose.yml, .env.example, apps/platform/src/env.ts] -->
- [x] 1.5 CI pipeline: typecheck, lint, build, unit tests on PR <!-- agent: fullstack-engineer.build, depends_on: [1.3], touches: [.github/workflows/ci.yml] -->
- [x] 1.6 Root README: dev setup, seed, reset, demo accounts <!-- agent: fullstack-engineer.fast, depends_on: [1.4], touches: [README.md] -->
- [x] 1.7 Logger + request-id + error boundary conventions <!-- agent: fullstack-engineer.build, depends_on: [1.1], touches: [apps/platform/src/lib/logger.ts, apps/platform/src/lib/request-id.ts] -->

## 2. Payload scaffold

- [x] 2.1 Payload bootstrap: adapter, auth-disabled default users, media collection (local disk dev / R2 prod via S3 plugin) <!-- agent: fullstack-engineer.build, depends_on: [1.1], touches: [apps/platform/src/payload.config.ts, apps/platform/src/payload/**] -->
- [x] 2.2 Access-control helper layer mapping 7 roles (guest/private/company/seller/specialist/admin/superadmin) <!-- agent: fullstack-engineer.build, depends_on: [2.1], touches: [apps/platform/src/payload/access/**] -->
- [x] 2.3 CORS + security headers + API rate-limit middleware skeleton <!-- agent: fullstack-engineer.build, depends_on: [2.1], touches: [apps/platform/src/middleware.ts, apps/platform/src/lib/rate-limit.ts] -->
- [x] 2.4 Versioning/draft-preview wiring for CMS collections <!-- agent: fullstack-engineer.build, depends_on: [2.1], touches: [apps/platform/src/payload/collections/**] -->

## 3. Cloudflare prototype operations

- [x] 3.1 Wire `@cloudflare/next-on-pages` build pipeline; validate Pages Functions rewrites for API routes + SSE streams <!-- agent: fullstack-engineer.build, depends_on: [2.1], touches: [apps/platform/next.config.ts, apps/platform/wrangler.toml, apps/platform/src/app/api/**] -->
- [x] 3.2 Neon serverless Postgres provisioning + pooler connection; `.env` toggles between local PG and Neon <!-- agent: fullstack-engineer.build, depends_on: [1.4, 2.1], touches: [apps/platform/src/lib/db.ts, .env.example, .dev.vars] -->
- [x] 3.3 Cloudflare Queues job dispatch (auction-ending, notifications) + KV for ephemeral cache + SSE broadcast <!-- agent: fullstack-engineer.build, depends_on: [2.1], touches: [apps/platform/src/lib/queue.ts, apps/platform/src/lib/cache.ts] -->
- [x] 3.4 R2 bucket for media uploads + signed URLs (replace Payload local-disk media adapter) <!-- agent: fullstack-engineer.build, depends_on: [2.1], touches: [apps/platform/src/lib/storage.ts, apps/platform/src/payload/media/**] -->
- [x] 3.5 `wrangler.jsonc` with env bindings (Queues, KV, R2, Neon DSN); smoke-deploy a `/health` route <!-- agent: fullstack-engineer.build, depends_on: [3.1, 3.2, 3.3, 3.4], touches: [apps/platform/wrangler.jsonc, apps/platform/src/app/health/route.ts] -->
- [x] 3.6 CI deploy step: wrangler deploy preview on PR, production on merge to main <!-- agent: fullstack-engineer.build, depends_on: [1.5, 3.5], touches: [.github/workflows/deploy.yml] -->
