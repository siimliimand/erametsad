# Spike 1.1: Drizzle ORM on Cloudflare D1, run locally

Status: completed. Date: 2026-08-28. Branch: `feature/option-b-cloudflare-only`.

## Goal

Test Drizzle ORM against a local D1 database. Cover CRUD and the `batch()` atomicity rules. Confirm the Postgres-to-SQLite mapping rules from the change design.

## Environment

| Package | Version |
| --- | --- |
| drizzle-orm | 0.45.2 |
| drizzle-kit | 0.31.10 |
| @cloudflare/vitest-pool-workers | 0.8.71 |
| vitest | 3.2.7 |
| wrangler | 4.127.0 |

The test runtime is workerd through `@cloudflare/vitest-pool-workers`. Miniflare provides the D1 database. This matches the local `wrangler d1 --local` engine, because both use the same embedded SQLite.

## Files

- `schema.ts`: Drizzle SQLite dialect schema for `users`, `auctions`, `bids`.
- `drizzle.config.ts`: drizzle-kit config for `generate`.
- `migrations/0000_salty_zodiak.sql`: generated DDL.
- `vitest.config.ts`: workers pool config with a `DB` D1 binding.
- `apply-migrations.ts`: setup file that applies the migrations inside each test runtime.
- `d1-drizzle.test.ts`: the demo. CRUD, CHECK enforcement, batch atomicity, batch ordering, concurrency, `FOR UPDATE` rejection, money typing.
- `wrangler.jsonc`: D1 binding for the `wrangler` CLI workflow.
- `spike-env.d.ts`: minimal ambient types for `cloudflare:test` and `D1Database`.

## Commands used

Run from `apps/platform`:

```
pnpm add drizzle-orm
pnpm add -D drizzle-kit @cloudflare/vitest-pool-workers@~0.8.71
pnpm exec drizzle-kit generate --config=spikes/d1-drizzle/drizzle.config.ts
pnpm test:spike-d1
```

Run from `apps/platform/spikes/d1-drizzle` for the CLI workflow:

```
../../node_modules/.bin/wrangler d1 migrations apply spike-d1-drizzle --local
../../node_modules/.bin/wrangler d1 execute spike-d1-drizzle --local \
  --command "INSERT INTO users (id, email, display_name, status, created_at)
             VALUES ('cli-user-1', 'cli@example.com', 'CLI User', 'active', '2026-08-28T12:00:00.000Z')"
../../node_modules/.bin/wrangler d1 execute spike-d1-drizzle --local --json \
  --command "SELECT id, typeof(status) AS status_type FROM users"
```

All test evidence below comes from `pnpm test:spike-d1`: 9 tests, all passing.

## Mapping rules honored

| Rule | How the schema applies it |
| --- | --- |
| Money as INTEGER cents | `starting_price_cents`, `current_price_cents`, `amount_cents` are `integer`. No REAL columns exist. |
| Enums as TEXT plus CHECK | `status` columns are `text` with `CHECK (col IN (...))`, for example `users_status_check`. |
| UUID as app-generated TEXT | Every `id` is `crypto.randomUUID()` stored in `text`. |
| timestamptz as TEXT ISO-8601 UTC | `created_at` and `ends_at` store `new Date().toISOString()`. |
| No `SELECT ... FOR UPDATE` | Confirmed unsupported. See findings. |
| Multi-statement transactions via `batch()` only | Verified. See findings. |

The generated migration keeps all six rules. Drizzle `text({ enum: [...] })` also narrows the TypeScript type, so most bad values fail at compile time. The CHECK constraint catches raw SQL and batch statements at runtime.

## Findings

1. `batch()` is atomic. A batch of two inserts, where the second violates `bids_amount_check` or a foreign key, rejects as a whole. A `SELECT` after the failed batch returns zero rows. The first statement leaves no partial write. Error text contains `CHECK constraint failed: bids_amount_check: SQLITE_CONSTRAINT (extended: SQLITE_CONSTRAINT_CHECK)` and `FOREIGN KEY constraint failed` for FK cases, wrapped by Drizzle in a `Failed query: ...` message on the `cause` chain.
2. `batch()` runs in order and later statements see earlier writes. A batch of `[INSERT bid, SELECT count, SELECT bid]` returns count 1 and the inserted row. Use this for read-your-writes inside one transaction instead of an interactive transaction. D1 offers no interactive transactions at all, so `batch()` is the only multi-statement unit.
3. Concurrent writes serialize. Thirty parallel single inserts all land (count 30). Ten parallel batches, each with two `current_price_cents = current_price_cents + n` updates, end at exactly 10,000 plus 10 times 101. No lost updates and no write errors. D1 has a single writer per database, so `UPDATE ... SET x = x + n` is safe without `FOR UPDATE`.
4. `SELECT ... FOR UPDATE` fails at parse time. The CLI returns `near "FOR": syntax error at offset 45: SQLITE_ERROR`. The test path rejects the same way. Locking moves to Durable Objects per the change design.
5. CRUD works through Drizzle with typed results. `insert().values().returning()`, typed `select()`, `update().set().returning()`, and `delete().returning()` all pass. D1 supports `RETURNING`, which Drizzle uses for inserts.
6. Constraints are on by default. Foreign keys enforce without any pragma, both in single statements and inside batches. A raw `INSERT` with status `bogus` fails with `CHECK constraint failed: users_status_check`.
7. `typeof(amount_cents)` returns `integer`. Money stays integer cents from Drizzle through SQLite storage. `typeof(status)` returns `text`.
8. Migrations apply two ways with the same files. In tests, `readD1Migrations()` feeds `applyD1Migrations(env.DB, ...)` from a setup file. In the CLI, `wrangler d1 migrations apply spike-d1-drizzle --local` runs the same SQL file. Both record state in a `d1_migrations` table.

## Notes and limits

- `pnpm test:spike-d1` runs with per-test isolated storage (pool default). Each test seeds its own rows, so no test depends on another.
- The spike did not run against remote D1. All claims cover the local SQLite engine behind `wrangler d1 --local` and miniflare.
- The spike stores its wrangler state under `spikes/d1-drizzle/.wrangler/`. The directory is git-ignored through `spikes/.gitignore`.
- Ambient types: the spike declares a minimal `D1Database` shape in `spike-env.d.ts`. Installing `@cloudflare/workers-types` breaks `pnpm typecheck`, because wrangler's own type entry imports it and its global `R2Bucket` clashes with the hand-rolled declaration in `src/lib/storage.ts`. Keep the minimal ambient types until that conflict is resolved.
