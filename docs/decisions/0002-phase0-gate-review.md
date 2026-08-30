# 0002: Phase 0 gate review

Status: GO (conditional)
Date: 2026-08-28
Change: `option-b-cloudflare-only`

## Context

Phase 0 produced three spikes, an email investigation, a KV namespace fix,
and the design document. This gate review verifies exit criteria and
records the go/no-go decision for Phases 1-7.

## Exit criteria

| # | Criterion | Evidence | Verdict |
|---|-----------|----------|---------|
| 1 | D1 batch() atomic and ordered | Spike 1.1: 9 tests pass. batch() rejects partial writes, runs in order, concurrent writes serialize. | PASS |
| 2 | SELECT ... FOR UPDATE unsupported on D1 | Spike 1.1: fails at parse time with `near "FOR": syntax error`. Locking moves to Durable Objects. | PASS |
| 3 | Mapping rules hold end to end | Spike 1.1: INTEGER cents, TEXT+CHECK enums, TEXT uuid via crypto.randomUUID(), TEXT ISO-8601 UTC timestamps. All confirmed. | PASS |
| 4 | Durable Object with counter + WebSocket works | Spike 1.2: 6 tests pass. DO registration, storage persistence, WebSocket echo, getCloudflareContext() binding access. | PASS |
| 5 | vitest-pool-workers wired into pnpm test | Spike 1.2: `pnpm test:spike-do` runs under `@cloudflare/vitest-pool-workers` 0.8.71. | PASS |
| 6 | Admin scope signed off | 0001-decisions.md: full replacement with minimal admin, no Payload drafts/versioning. | PASS |
| 7 | KV namespace id restored | Task 1.4 done: namespace `5b67cd2c595f4d31b3b1be5db76e9bef` in wrangler.jsonc. | PASS |
| 8 | Launch email volume under initial daily quota or warm-up plan | Spike 1.3: 3,000 emails/month included, verified destinations are quota-exempt. Warm-up plan recorded in 0001-decisions.md. | CONDITIONAL |
| 9 | Email enablement precondition | Spike 1.3: token lacks `Email Sending : Edit`, `Email Routing : Edit`, and `DNS : Read` on `ww0.dev`. Workers Paid state unknown. | BLOCKED |

## Decision

**GO with one condition.**

Phases 1-3 (data layer, Durable Objects, email transport code) have no
dependency on email enablement. They proceed now.

Email enablement is a precondition for Phase 4 (auth and sessions) and
Phase 5 (jobs and queue). The token permissions and Workers Paid plan must
be confirmed before those phases start. Task 4.2 will re-verify the
email configuration.

## Risks carried forward

- Email Service beta daily quota ramp is the main launch-day risk.
  Mitigation: warm-up plan, monitor `E_DAILY_LIMIT_EXCEEDED`, transport
  abstraction allows Postmark or Resend swap at config level.
- Workers Paid state is unknown. Must be confirmed before email enablement
  and before Durable Objects deploy (DO requires Workers Paid).
- `@cloudflare/workers-types` conflicts with the hand-rolled `R2Bucket`
  declaration in `src/lib/storage.ts`. Minimal ambient types stay until
  that conflict is resolved.
- `getCloudflareContext()` was tested in workerd but not inside a built
  OpenNext worker. Integration check remains open for the next wave.
