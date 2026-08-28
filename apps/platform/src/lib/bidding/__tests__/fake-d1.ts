import type {
  DbDatabase,
  DbPreparedStatement,
  DbResult,
  SqlParam,
} from '../../db'

export interface RecordedStatement {
  sql: string
  params: unknown[]
}

export interface FakeD1 extends DbDatabase {
  /** Rows reported by the unique-constraint check on each UPDATE. */
  updateChanges: number
}

/**
 * D1-compatible stub for the bidding suites: records every executed
 * statement into `log`, answers `insert into bids` with a RETURNING row,
 * and reports `updateChanges` rows changed for every other statement.
 * Inject with setD1ForTests(fakeD1(log)).
 */
export function fakeD1(log: RecordedStatement[]): FakeD1 {
  const fake: FakeD1 = {
    updateChanges: 1,
    prepare(sql: string) {
      let params: SqlParam[] = []
      const statement: DbPreparedStatement = {
        bind(...values: SqlParam[]) {
          params = values
          return statement
        },
        all<T>(): Promise<DbResult<T>> {
          log.push({ sql, params })
          if (sql.includes('insert into bids')) {
            const row = {
              id: `bid-${String(log.length)}`,
              created_at: '2026-01-01T00:00:00.000Z',
              updated_at: '2026-01-01T00:00:00.000Z',
            }
            return Promise.resolve({ results: [row as unknown as T], success: true, meta: {} })
          }
          return Promise.resolve({
            results: [],
            success: true,
            meta: { changes: fake.updateChanges },
          })
        },
      }
      return statement
    },
    batch<T>(prepared: DbPreparedStatement[]): Promise<DbResult<T>[]> {
      return Promise.all(prepared.map((statement) => statement.all<T>()))
    },
  }
  return fake
}
