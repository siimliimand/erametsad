# Spike 1.2: Durable Object in the Workers runtime, with vitest-pool-workers

Status: completed. Date: 2026-08-28. Branch: `feature/option-b-cloudflare-only`.

## Goal

Stand up a minimal Durable Object (counter plus WebSocket echo). Confirm that `getCloudflareContext()` from `@opennextjs/cloudflare` reaches worker bindings. Set up `@cloudflare/vitest-pool-workers` so the tests run under `pnpm test`.

## Environment

| Package | Version |
| --- | --- |
| @cloudflare/vitest-pool-workers | 0.8.71 |
| @opennextjs/cloudflare | 1.20.4 |
| wrangler | 4.127.0 |

Version 0.8.71 of the pool matches vitest 3.2.x. Versions from 0.17 up require vitest 4.

## Files

- `counter.ts`: the `CounterDO` class. Storage-backed counter with `/increment`, `/value`, and `/echo` routes.
- `index.ts`: worker entry. Re-exports `CounterDO` and adds a `/counter/*` fetch proxy for `wrangler dev`.
- `wrangler.jsonc`: spike-only config with the `COUNTER` binding and the `v1` migration.
- `vitest.config.ts`: workers pool config with `main` and `wrangler.configPath`.
- `counter.test.ts`: persistence, name isolation, `runInDurableObject`, WebSocket echo.
- `context.test.ts`: `getCloudflareContext()` binding access.
- `spike-env.d.ts`: minimal ambient types for `cloudflare:test`, `DurableObjectNamespace`, `WebSocketPair`, and `CloudflareEnv`.

The production `apps/platform/wrangler.jsonc` is unchanged and stays deployable. The DO binding and its migration live in this spike config only. Nothing under `src/**` changed.

## Commands used

Run from `apps/platform`:

```
pnpm add -D @cloudflare/vitest-pool-workers@~0.8.71
pnpm test:spike-do
```

`pnpm test` runs the unit suite, then this spike, then the D1 spike.

Manual check from `apps/platform/spikes/do`:

```
../../node_modules/.bin/wrangler dev --port 8799
curl -s http://127.0.0.1:8799/counter/increment   # {"count":1}
curl -s http://127.0.0.1:8799/counter/increment   # {"count":2}
curl -s http://127.0.0.1:8799/counter/value       # {"count":2}
curl -s -X POST http://127.0.0.1:8799/counter/echo # websocket upgrade required
```

All test evidence below comes from `pnpm test:spike-do`: 6 tests, all passing.

## Findings

1. DO registration works through a spike wrangler config plus a `main` entry. The pool reads `durable_objects` and `migrations` from `wrangler.jsonc` and points the binding at the test worker. The class must be exported from the module named by `main` (`index.ts` re-exports `CounterDO`). The migration uses `new_sqlite_classes`. Production config is untouched.
2. Storage persists across stub instances. Two `get(idFromName('persist'))` calls in sequence return 1 then 2, and `/value` returns 2. Distinct names hold distinct state: object `isolate-b` reports 0 while `isolate-a` reports 2. `runInDurableObject(stub, cb)` runs a callback against the live instance and reads the stored value directly.
3. WebSocket echo works through a stub fetch. Send the `Upgrade: websocket` header, receive status 101, then use `response.webSocket` and call `accept()` on it before `send()`. The echoed text round-trips. The server side comes from `new WebSocketPair()` inside the DO and returns `new Response(null, { status: 101, webSocket: client })`.
4. `getCloudflareContext()` reads `globalThis[Symbol.for('__cloudflare-context__')]`. The built OpenNext worker sets that global per request, so server code can call `getCloudflareContext().env.COUNTER`. The test replicates the worker mechanism: it sets the symbol to `{ env, cf, ctx }` from `cloudflare:test`, then calls `getCloudflareContext()`. The returned context exposes the `COUNTER` namespace and increments through it. The same call throws when no context was set, which matches the library contract.
5. `isolatedStorage: false` is required for the echo test. The default per-test storage snapshot fails at suite teardown while a WebSocket is still open (`Isolated storage failed`). The spike tests use distinct object names, so shared storage is safe. Keep this caveat in mind for future WebSocket tests: close sockets or disable isolated storage per project.
6. Minimal ambient types replace `@cloudflare/workers-types`. Installing that package breaks `pnpm typecheck`: wrangler's type entry imports it, and its global `R2Bucket` then clashes with the hand-rolled declaration in `src/lib/storage.ts`. The spike declares only `DurableObjectNamespace`, `DurableObjectState`, `WebSocketPair`, `ExecutionContext`, and a `CloudflareEnv` augmentation in `spike-env.d.ts`. Resolve that conflict before any wider rollout of workers-types.

## Notes and limits

- The `getCloudflareContext` check runs in workerd but not inside a built OpenNext worker. The vitest pool does not run the OpenNext entrypoint, so the test sets the same global the entrypoint would set. A follow-up integration check against `opennextjs-cloudflare build && wrangler dev` remains open for the next wave.
- The 101 response carries the client half of the WebSocket pair. Call `accept()` on the socket you get from `response.webSocket` before using it in tests.
- Wrangler dev state lands in `spikes/do/.wrangler/`, which is git-ignored through `spikes/.gitignore`.
