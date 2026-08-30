# cloudflare-deployment Specification

## Purpose
TBD - created by archiving change option-b-cloudflare-only. Update Purpose after archive.
## Requirements
### Requirement: next-on-pages build
The app SHALL build and run via `@cloudflare/next-on-pages`. Pages Functions
SHALL handle API routes and SSE streams.

#### Scenario: API routes on Workers
- **WHEN** a request hits an API route in the Cloudflare deployment
- **THEN** the route runs on Workers and an SSE stream stays open

### Requirement: Queue and cache
The app SHALL dispatch background jobs through Cloudflare Queues and
SHALL use KV for ephemeral cache and feature flags. SSE broadcast SHALL
run through Durable Objects, not KV. The interface SHALL be common with
local BullMQ/Redis.

#### Scenario: Job dispatch
- **WHEN** a domain event enqueues a job
- **THEN** the job runs on Cloudflare Queues in production and on BullMQ
  locally

### Requirement: R2 media storage
The app SHALL store media uploads in an R2 bucket with signed URLs in
production.

#### Scenario: Media upload
- **WHEN** a file uploads in production
- **THEN** the file is stored in R2 and served via a signed URL

### Requirement: Wrangler bindings
The app SHALL declare environment bindings (D1 `DB`, Durable Objects,
Queues, KV, R2, `send_email`) in `wrangler.jsonc`. The KV binding SHALL
use the provisioned namespace id. A `/health` route SHALL exist for smoke
checks.

#### Scenario: Health check
- **WHEN** a deploy completes
- **THEN** `/health` returns success and the bindings resolve

### Requirement: Deploy CI
CI SHALL deploy a preview via `wrangler` on pull requests. CI SHALL deploy
to production on merge to main. (Should-priority.)

#### Scenario: Preview deploy
- **WHEN** a pull request opens
- **THEN** a Cloudflare preview deployment runs and returns a linkable URL
