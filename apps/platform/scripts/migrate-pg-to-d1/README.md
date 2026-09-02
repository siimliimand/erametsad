# Postgres to D1 migration path

Decision 0001 (docs/decisions) records that no production Postgres data exists.
The expected cutover is a fresh seed. This directory still provides the full
export, transform, and import path, so the tooling exists if real data appears.

## Decision tree

1. No production Postgres data exists (the expected case). Use the fresh-seed
   cutover. From `apps/platform`, run:

   ```
   pnpm db:migrate:local
   pnpm seed:reset
   ```

   `pnpm seed:reset` wipes the local D1 database and loads the current
   fixtures. It is idempotent. Stop here. Do not use the rest of this file.

2. Production Postgres data exists. Run the three steps below in order:
   export, transform, import. Plan a maintenance window. The import replaces
   every row in each imported table.

## Mapping rules

The rules come from the Option B design and have no exceptions:

| Postgres shape | D1 shape | Where applied |
|---|---|---|
| `numeric` money in euros | INTEGER cents (`x` or `x_eur` becomes `x_cents`) | transform |
| `timestamptz`, any offset | TEXT ISO-8601 UTC (`...Z`) | transform |
| `jsonb` object or array | TEXT JSON string | transform |
| enum, uuid, other TEXT | TEXT, value unchanged | transform (pass-through) |
| boolean | INTEGER 0 or 1 | transform |

For a target column `x_cents`, the transform reads the source value from the
first present key of `x_cents` (already cents), `x_eur` (euros), `x` (euros).
Rows keep the same primary-key ids. Euro amounts round half-up to whole cents
(`8100.005` euros becomes `810001` cents).

## Files

| File | Purpose |
|---|---|
| `export-pg.ts` | Reads Postgres, writes one NDJSON file per table |
| `transform.ts` | Pure mapping rules, NDJSON to D1 rows. Also a CLI |
| `import-d1.ts` | Loads transformed rows into a D1 database, or writes SQL |
| `tables.ts` | Table list and FK-safe insert and delete order, from the schema |
| `fixtures/` | Small Postgres-shaped NDJSON samples for tests and smoke runs |
| `transform.test.ts` | Unit tests for every mapping rule (`pnpm test:migrate-tool`) |

## Step 1: export

Run from `apps/platform`:

```
SOURCE_DATABASE_URL=postgres://user:pass@host:5432/dbname pnpm migrate:pg:export
```

The script dumps all 28 D1-schema tables (27 plus `sessions`) to
`.export/pg/<table>.ndjson`, 1000 rows per query batch. Use `--out DIR` to
change the output directory and `--tables a,b` to limit the run. A table that
is missing in Postgres is skipped with a warning. Expect this for `sessions`:
the old Payload setup kept sessions outside Postgres.

## Step 2: transform

```
pnpm migrate:pg:transform --in .export/pg --out .export/transformed
```

The step writes `.export/transformed/<table>.ndjson`. A row that misses a NOT
NULL column without a default stops the run with the table, line, and column
name. Columns with schema defaults are omitted, so D1 applies the default.
Unknown source columns are dropped and listed for review.

## Step 3: import

Local D1 (the database used by `pnpm dev` and the seed):

```
pnpm db:migrate:local
pnpm migrate:pg:import --in .export/transformed
```

Scratch database for a dry run, schema included:

```
pnpm migrate:pg:import --in .export/transformed --db-file scratch.sqlite --migrate
```

Generated SQL file instead of a direct connection:

```
pnpm migrate:pg:import --in .export/transformed --sql-file import-d1.sql
```

The import deletes each table first (children before parents) and then inserts
in FK order (parents first), one transaction per table, 500 rows per INSERT
statement (`--batch-rows N` to change). Re-running it is idempotent per table.
Foreign-key checking is on by default. Pass `--no-fk-check` only to diagnose
legacy referential drift.

## Remote D1 notes

The remote database needs a real `database_id` in `wrangler.jsonc`. Create it
first if task 2.8 has not done so:

```
pnpm exec wrangler d1 create erametsad-db
```

Apply the schema, then load the generated SQL file:

```
pnpm db:migrate:remote
pnpm exec wrangler d1 execute DB --remote --file import-d1.sql
```

The SQL file carries no transaction wrapper. A remote import over a live
database is not atomic across tables. Schedule it inside the maintenance
window. `wrangler d1 execute` rejects files above 5 MB. For larger data sets,
split the file or import table by table with `--tables`.

## Smoke proof (recorded 2026-08-29)

No Postgres instance exists for this change, so the smoke run feeds the
fixtures through the real transform and import code against a scratch D1
file. Commands, run from `apps/platform`:

```
pnpm migrate:pg:transform --in scripts/migrate-pg-to-d1/fixtures --out .export/smoke
pnpm migrate:pg:import --in .export/smoke --db-file .export/smoke.sqlite --migrate
```

Transform output (skipped-tables lines removed):

```
media: 2 rows transformed
users: 2 rows transformed
auctions: 2 rows transformed
bids: 2 rows transformed
statistics_snapshots: 2 rows transformed
```

Import output:

```
Applied 2 drizzle migration(s)
media: deleted + inserted 2 rows
users: deleted + inserted 2 rows
auctions: deleted + inserted 2 rows
bids: deleted + inserted 2 rows
statistics_snapshots: deleted + inserted 2 rows
```

Verification queries and results:

```
users: 2 rows
media: 2 rows
auctions: 2 rows
bids: 2 rows
statistics_snapshots: 2 rows

SELECT id, min_bid_cents, bid_step_cents, reserve_price_cents, starts_at, cadastres
FROM auctions ORDER BY id;

{"id":"a1-...0001","min_bid_cents":500000,"bid_step_cents":5000,"reserve_price_cents":550050,"starts_at":"2026-05-01T06:00:00.000Z","cadastres":"[\"001:001:001\",\"001:001:002\"]"}
{"id":"a1-...0002","min_bid_cents":750000,"bid_step_cents":10000,"reserve_price_cents":null,"starts_at":"2026-06-01T05:00:00.000Z","cadastres":"[]"}

SELECT id, amount_cents, status, created_at FROM bids ORDER BY id;

{"id":"b1-...0001","amount_cents":510000,"status":"leading","created_at":"2026-05-10T08:00:00.123Z"}
{"id":"b2-...0002","amount_cents":810001,"status":"won","created_at":"2026-06-14T13:59:59.999Z"}

SELECT id, eur_cents, area, volume, created_at FROM statistics_snapshots ORDER BY id;

{"id":"s1-...0001","eur_cents":183400000,"area":120.75,"volume":3450.5,"created_at":"2026-06-30T20:59:59.000Z"}
{"id":"s1-...0002","eur_cents":2750055,"area":9.1,"volume":null,"created_at":"2026-06-30T20:59:59.000Z"}

orphan bids (FK check): 0
```

The results show every rule working: euros to cents (`"5000.00"` to `500000`,
`"8100.005"` to `810001` half-up), cents pass-through (`min_bid_cents`
sourced from `min_bid_cents`), offsets to UTC (`+03:00` and `+0300` to `Z`),
jsonb to JSON text, empty array to `[]`, REAL non-money decimals kept, and
ids unchanged. A second import run reproduced the same counts, which proves
idempotency. The generated SQL file was also applied to a fresh migrated
database with foreign keys on. All rows loaded.
