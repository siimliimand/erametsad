# Load test analysis: bid bursts at auction close (task 8.3)

Date: 2026-08-29. Branch `feature/option-b-cloudflare-only`.
Target: local `wrangler dev` (wrangler 4.127.0, miniflare 5.20260826.0-alpha)
on `http://localhost:8787`, worker built with `pnpm build:cf`. Local D1 after
`pnpm db:migrate:local` + `pnpm seed:reset`. No production deployment exists
yet, so these numbers validate the DO serialization mechanics and the local
D1 single-writer behavior. They do not predict production latency. Re-run
this file's commands against the deployed worker (see README.md) and record
the remote numbers next to them.

## Scenario

Auction `raieoigus-rae` (id `6906f108-c4bc-427c-8ceb-4083f2d140ab`), open
type, min bid 3200.00 EUR, step 300.00 EUR. `setup` set it active with
`ends_at` 90 s out, no bids, no autobidders. Every accepted leading bid sat
inside the 5-minute anti-snipe window. Each one extended the end time by
5 minutes, so the auction stayed open for the whole run.

Bidders: 24 virtual users over the 3 seeded right-holders
(guest/private/company, password `demo1234`). Each VU logged in with its own
spoofed `x-forwarded-for`, because the login route allows 5 attempts per
minute per IP. Each bidder signed a framework contract first, because
seeded settings require one for open bids.

Amounts form a ladder: floor + k*step, one step apart, unique per request.
Each request carried idempotency key `<runId>-<n>`. The DO admits bids one
at a time. A bid passes only if it is at least the current leader plus one
step. In a simultaneous burst the arrival order is random, so accepted bids
form the increasing subsequence of that order. Expect 400 rejections in
bursts. That is correct business logic, not a defect.

## Results

| Run                  | Phase                   | n   | accepted | rejected 400 | 5xx | p50 ms | p95 ms  | p99 ms  | max ms  | wall s | rps  |
| -------------------- | ----------------------- | --- | -------- | ------------ | --- | ------ | ------- | ------- | ------- | ------ | ---- |
| A `lt-mte6wxyi-h9rv` | trickle (concurrency 1) | 25  | 25       | 0            | 0   | 58.4   | 63.2    | 64.7    | 64.7    | 1.50   | 16.7 |
| A                    | burst 150, ramp 0       | 150 | 9        | 141          | 0   | 4308.7 | 7484.2  | 7752.2  | 7794.7  | 7.81   | 19.2 |
| B `lt-mte6xuvc-1iom` | trickle (concurrency 1) | 25  | 25       | 0            | 0   | 61.8   | 68.9    | 79.9    | 79.9    | 1.59   | 15.7 |
| B                    | burst 150, ramp 20 ms   | 150 | 33       | 109          | 8   | 3911.3 | 5175.1  | 5521.0  | 5578.1  | 8.12   | 18.5 |
| C `lt-mte75k0j-mkqf` | trickle (concurrency 1) | 10  | 10       | 0            | 0   | 65.9   | 99.0    | 99.0    | 99.0    | 0.71   | 14.1 |
| C                    | burst 250, ramp 0       | 250 | 14       | 234          | 2   | 7580.9 | 12724.3 | 13161.7 | 13188.2 | 13.20  | 18.9 |

Accepted ladder tops: A 5570.00 EUR, B 5540.00 EUR, C 8120.00 EUR. Each is
the highest accepted amount of its run and equals the final leader price.

## D1 consistency (the single-writer evidence)

`verify` re-read D1 after each run. All consistency checks passed in every
run:

- HTTP 201 count equals D1 rows carrying the run's idempotency prefix
  (A: 34/34, B: 58/58, C: 24/24). Every accepted bid is reflected exactly
  once. No lost writes, no duplicate writes.
- Distinct idempotency keys equal row counts. No key wrote twice.
- Exactly one `leading` bid per auction, at the maximum accepted amount,
  in all three runs (for example C: leading 8120000 cents = max HTTP amount
  = max row amount). No multiple-leader anomaly.
- One `bid_placed` audit entry per run row, no missing, no doubled
  (A: 34, B: 58, C: 24).
- Auction stayed `active`; `ends_at` shows the anti-snipe extension from
  the last accepted bid (for example C: 09:48:48 + 5 min = 09:53:48).

116 accepted bids across three runs produced 116 rows, 116 audit entries,
and zero write anomalies. This is what the DO admission mutex plus D1
`batch()` transactions must guarantee under a burst, and it held.

## Max sustainable burst before rejections

There is no app-level burst ceiling at these sizes. No request failed for
capacity reasons. The observable ceiling is the serialized admission rate
of one AuctionDO over local D1: 14 to 19 admissions per second, the same
whether 150 or 250 bids queue at once. Step-rule 400 rejections begin with
the very first simultaneous burst by design: two bids one step apart cannot
both pass unless the lower one is admitted first. Counts confirm the model
(9 of 150 and 14 of 250 accepted at ramp 0, near the expected increasing-
subsequence length; 33 of 150 with a 20 ms ramp, which restores close to
ordered arrival).

Queueing dominates burst latency. The last request waits for every
admission ahead of it: burst p99 is close to burst_size divided by 19 per
second (A: 150/19.2 = 7.8 s, observed 7.75 s; C: 250/18.9 = 13.2 s,
observed 13.16 s). A close-time burst of 150 bids drains in about 8
seconds, 250 in about 13.

## Anomalies

- Ten HTTP 500s total (8 in run B, 2 in run C), all from the wrangler dev
  proxy, not from the app. The wrangler log shows `Error: Network connection
lost` in `ProxyController` (miniflare loopback fetch). Worker logs show
  zero `[bids/create] AuctionDO fetch failed` and zero `placeBid failed`
  entries, and D1 stayed consistent through every 500. In run B the proxy
  process died right after the burst; the server needed a restart before
  the next run. Known dev-tooling behavior for this wrangler/miniflare
  build under 20+ concurrent multi-second requests. The production edge
  runtime has no such proxy. Re-check 500 rates after deployment.
- Trickle latency crept from p50 58.4 ms (run A) to 65.9 ms (run C). The
  dev proxy had just restarted before run C. Treat single-digit
  millisecond drift as noise.
- Two login `fetch failed` errors when a run started against the dead
  proxy after run B. That run attempt aborted before any bid was sent.
  Restarting wrangler dev and re-running `setup` fixed it.

## Commands to reproduce

```bash
pnpm exec tsx scripts/loadtest/loadtest.ts setup --close-in 90
pnpm exec tsx scripts/loadtest/loadtest.ts run --base http://localhost:8787 \
  --auction 6906f108-c4bc-427c-8ceb-4083f2d140ab --vus 24 \
  --trickle 25 --burst 150 --ramp-ms 0 --label runA
pnpm exec tsx scripts/loadtest/loadtest.ts verify
```

## Re-run after real deployment

The wrangler.jsonc D1 id is still the placeholder, so nothing above touched
remote D1. After task 8.5 deploys the worker, repeat with
`--base https://api.eametsad.ee --d1 remote` and record: remote admission
rate per auction, burst p99, 500 rate, and the same six verify checks. The
remote D1 single-writer ceiling is expected to be lower than 19 admissions
per second, because every statement pays a network round trip.
