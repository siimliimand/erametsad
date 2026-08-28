## MODIFIED Requirements

### Requirement: Queue and cache
The app SHALL dispatch background jobs through Cloudflare Queues and
SHALL use KV for ephemeral cache and feature flags. SSE broadcast SHALL
run through Durable Objects, not KV. The interface SHALL be common with
local BullMQ/Redis.

#### Scenario: Job dispatch
- **WHEN** a domain event enqueues a job
- **THEN** the job runs on Cloudflare Queues in production and on BullMQ
  locally

### Requirement: Wrangler bindings
The app SHALL declare environment bindings (D1 `DB`, Durable Objects,
Queues, KV, R2, `send_email`) in `wrangler.jsonc`. The KV binding SHALL
use the provisioned namespace id. A `/health` route SHALL exist for smoke
checks.

#### Scenario: Health check
- **WHEN** a deploy completes
- **THEN** `/health` returns success and the bindings resolve

## REMOVED Requirements

### Requirement: Serverless Postgres
**Reason**: Option B consolidates all state inside Cloudflare. D1
replaces Neon Postgres as the relational store; the Neon HTTP driver and
DSN bindings are removed.
**Migration**: Data moves through the Postgres-to-SQLite mapping rules
from the change design (integer cents, TEXT enums with CHECK, TEXT
jsonb). No production data exists today; the Phase 0 decision record
confirms whether an export-transform-import path is needed.
