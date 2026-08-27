import { Pool as NeonPool, neon as neonQuery } from "@neondatabase/serverless"
import { Pool as PgPool } from "pg"

type DbClient = {
  pool: NeonPool | PgPool
  query: typeof PgPool.prototype.query
  neon?: ReturnType<typeof neonQuery>
}

function createDbClient(): DbClient {
  const isNeon =
    process.env.NEON_DATABASE_URL || process.env.DB_TYPE === "neon"

  if (isNeon) {
    const connectionString =
      process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL!

    const pool = new NeonPool({ connectionString })

    return {
      pool,
      query: pool.query.bind(pool),
      neon: neonQuery(connectionString),
    }
  }

  const pool = new PgPool({ connectionString: process.env.DATABASE_URL })

  return {
    pool,
    query: pool.query.bind(pool),
  }
}

export const db = createDbClient()