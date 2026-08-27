# Phase 0 — Foundations

## Why

Eametsad is a greenfield platform with a fully specified plan and design
system, but no code exists yet. Phase 0 establishes the repository, tooling,
CMS foundation, and Cloudflare deployment path that every later phase builds
on. Getting the foundation right first prevents rework across the marketing
site, portal, and admin backend.

## What Changes

- Monorepo scaffold: pnpm workspaces + Turborepo, single Next.js 15 (App
  Router) app `apps/platform` embedding Payload CMS 3 with the Postgres
  adapter.
- Shared packages `ui`, `types`, `config`, `emails` wired for later phases.
- Lint, formatting, and strict TypeScript config applied repo-wide.
- Local dev via docker-compose (postgres 16, redis 7, Mailpit SMTP) with
  zod-validated env loading.
- CI pipeline: typecheck, lint, build, unit tests on every PR.
- Payload scaffold: auth-disabled default users, media collection (local
  disk in dev, R2 in prod), 7-role access-control helper, CORS + security
  headers + rate-limit skeleton, draft-preview versioning.
- Cloudflare production path: `@cloudflare/next-on-pages` build, Neon
  serverless Postgres, Cloudflare Queues + KV for jobs/cache, R2 for media,
  `wrangler.jsonc` bindings, and deploy CI.

## Capabilities

### New Capabilities

- `repo-tooling`: monorepo layout, shared packages, lint/TS config, local
  dev compose, CI, README, logging conventions.
- `payload-foundation`: Payload bootstrap, role-based access control,
  security middleware, CMS versioning.
- `cloudflare-deployment`: next-on-pages build, Neon connection,
  Queues/KV, R2 media, wrangler bindings, deploy pipeline.

### Modified Capabilities

(none — greenfield)

## Impact

- New repo structure: `apps/platform`, `packages/*`, root configs.
- New dependencies: Payload CMS 3, `@cloudflare/next-on-pages`,
  `@neondatabase/serverless`.
- Cloudflare account resources: Pages project, Workers, Queues, KV
  namespace, R2 bucket, Neon database project.
- Local dev environment: docker-compose for postgres, redis, Mailpit.
