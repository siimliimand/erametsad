# Bid-burst load test (task 8.3)

Drives bid bursts at auction close against a Cloudflare Worker and validates
D1 single-writer behavior plus AuctionDO admission serialization.

Three subcommands, all run from `apps/platform`:

```bash
pnpm exec tsx scripts/loadtest/loadtest.ts <setup|run|verify> [options]
```

## What it does

1. `setup` rewrites a seeded auction into the close-time scenario: status
   `active`, `ends_at` inside the anti-snipe window (default 90 s), no bids,
   no autobidders. Every accepted leading bid then extends the end time by
   the anti-snipe window, so the auction stays open while bids land, exactly
   like a real close-time duel.
2. `run` logs in N virtual users (VUs), signs a framework contract per
   bidder (the seeded settings gate open bids), then fires two phases:
   - a steady trickle (worker pool, default concurrency 1), then
   - a burst: all requests outstanding at once (`--ramp-ms 0`) or staggered
     (`--ramp-ms 20` fires one bid every 20 ms).
     Bid amounts form a ladder: floor + step, floor + 2*step, ... (floor and
     step come from the auction row, or `--start-floor-euros`/`--step-euros`).
     Each request carries a unique idempotency key `<runId>-<n>` so the run's
     rows are identifiable in D1.
3. `verify` re-reads D1 and checks invariants: every HTTP-201 bid has
   exactly one row, no duplicate idempotency keys, exactly one `leading`
   bid at the maximum accepted amount, one `bid_placed` audit entry per
   row, auction still `active`, and no 5xx/network errors recorded.

## Local run (wrangler dev = the deployed-worker equivalent)

The D1 remote id is still a placeholder, so the local equivalent is
`pnpm build:cf` + `wrangler dev` (miniflare, local D1). Full sequence from
`apps/platform`:

```bash
rm -rf .wrangler/state                 # optional: fully fresh miniflare state
pnpm db:migrate:local                  # create schema in local D1
pnpm seed:reset                        # wipe + seed demo data
pnpm exec tsx scripts/loadtest/loadtest.ts setup --close-in 90
pnpm build:cf
pnpm exec wrangler dev --port 8787     # separate terminal; wait for Ready
pnpm exec tsx scripts/loadtest/loadtest.ts run \
  --base http://localhost:8787 --vus 24 --trickle 25 --burst 150 --ramp-ms 0 \
  --label runA --out scripts/loadtest/last-run.json
pnpm exec tsx scripts/loadtest/loadtest.ts verify
```

`setup` writes D1 directly and is meant to run before the dev server, or
between runs (SQLite WAL allows it beside a live server). If the auction
ended because a run window expired, re-run `setup` and continue.

## Options that matter

- `--base` any worker URL; `--auction <id>` (or `--slug`) selects the auction.
- `--vus`, `--pool`, `--password`: VU count, bidder emails (default
  guest/private/company, the seeded right-holders), shared demo password.
  Each VU logs in with a distinct spoofed `x-forwarded-for`, because the
  login route rate-limits 5/min per IP.
- `--trickle`, `--trickle-concurrency`, `--burst`, `--ramp-ms`, `--timeout-ms`.
- `--skip-contracts` when the target already has signed framework contracts.
- `--d1 local|remote` (default local): where setup/verify SQL runs. Remote
  shells out to `wrangler d1 execute DB --remote --json`.

## Reading the numbers

- `acc/rej/err`: accepted (201), business-rejected (400), errors (5xx or
  network). In a simultaneous burst, 400 `Bid must be at least X EUR`
  rejections are correct behavior: the DO admits serialized, the leader
  floor rises, and lower ladder amounts fail the step rule. Accepted bids
  form the increasing subsequence of the arrival order.
- `p50/p95/p99/max`: client-side latency per phase. Burst tail latency is
  dominated by the DO admission queue (the last request waits for every
  admission ahead of it), so `p99 ~= burst_size / serialized_admission_rate`.
- `rps` per phase approximates the serialized admission ceiling of one
  AuctionDO over local D1 (~16-20/s on this machine; see analysis.md).
- `verify` output is the D1 single-writer evidence: exactly-once bid rows,
  single leader at max, intact audit chain.

## After real deployment

Replace `--base` with the deployed URL and `--d1 remote` for setup/verify:

```bash
pnpm exec tsx scripts/loadtest/loadtest.ts run \
  --base https://api.eametsad.ee --auction <id> --vus 50 --burst 300 \
  --skip-contracts
pnpm exec tsx scripts/loadtest/loadtest.ts verify --d1 remote
```

Remote D1 (one writer per database, per-statement network cost) will show a
different admission rate than local miniflare; that comparison is the real
D1 single-writer ceiling measurement. Re-record analysis.md numbers then.

## Unit tests

Pure parts (percentile math, histograms, phase aggregation) have a fast
node-pool vitest suite:

```bash
pnpm exec vitest run --config scripts/loadtest/vitest.config.ts
```

The app's own `pnpm test` (include `src/**/*.test.ts`) does not pick this
directory up, and `scripts/migrate-pg-to-d1` owns its own files.
