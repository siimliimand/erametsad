## Context

Greenfield project. The full build plan is in `docs/EAMETSAD-PLAN.md` and the
design system in `docs/design/README.md`. The prototype task list is in
`docs/tasks.md`. No code exists. The reference product (timber.ee) was built
on Next.js + Payload + PostgreSQL, so this mirrors a proven shape. The
prototype must be deployable to Cloudflare.

## Goals / Non-Goals

**Goals:**
- One repo runs marketing, portal, and admin via route groups.
- Payload CMS 3 is embedded in the Next.js app for collections, REST, and
  media.
- Local dev matches production behaviour (same Postgres dialect, same
  queue/cache interface).
- Cloudflare deployment works for all three areas from day one.

**Non-Goals:**
- No Phase 1+ work: design system components, bidding engine, seed data,
  page specs.
- No Turbo remote cache (post-protocol [L]).
- No subdomain split yet (single deploy with path prefixes).

## Decisions

1. **Single app, three route groups.** The app `apps/platform` uses
   `(marketing)`, `(portal)`, `(admin)` route groups. One deploy for the
   prototype. Subdomain split is a post-prototype concern.
2. **Cloudflare as the production target.** Next.js runs via
   `@cloudflare/next-on-pages` on Pages + Workers. The `nodejs_compat`
   flag handles Payload's Node.js internals.
3. **Neon serverless Postgres in production.** The Payload Postgres adapter
   connects to a Neon pooler over HTTP (`@neondatabase/serverless`). Local
   dev uses the same Postgres 16 dialect from docker-compose, so SQL stays
   identical.
4. **Queue/cache behind an interface.** BullMQ + Redis locally. Cloudflare
   Queues + KV in production. A common job/cache interface keeps the
   bidding engine environment-agnostic.
5. **R2 for media.** The Payload media collection uses local disk in dev
   and R2 (S3-compatible) in staging and production, with signed URLs.
6. **SSE over Workers.** Realtime uses Server-Sent Events
   (`/api/auctions/stream`, `/api/my/stream`). No WebSockets.

## Risks / Trade-offs

- **Payload 3 on next-on-pages** uses file system and sharp for image
  resizing. The `nodejs_compat` flag may not cover everything. Mitigation:
  isolate Payload admin and media on a Node.js Worker if needed.
- **SSE over Workers** has per-request limits and needs connection-aware
  binding. Mitigation: validate early (task 3.1).
- **Neon HTTP driver** differs subtly from a TCP pooler. Mitigation: keep
  SQL portable, test locally against Postgres 16.
- **R2 signed URLs** differ from Payload's default local adapter.
  Mitigation: use Payload's S3 plugin.

## Migration Plan

Greenfield. Rollback is "delete the scaffold" until Phase 1 begins.

## Open Questions

- Does `nodejs_compat` fully cover Payload 3, or must the admin panel move
  to a separate Node.js Worker? (task 3.1 verifies this.)
- Who owns the Cloudflare account, billing, and the Neon project?
