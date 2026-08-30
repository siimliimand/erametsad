// Minimal ambient types for the experimental `node:sqlite` built-in.
// @types/node 20 does not ship them (Node >= 22.5 only). Keep this local to
// the seed runner; delete it once @types/node catches up or the repo moves
// to a supported SQLite driver.
declare module 'node:sqlite' {
  interface StatementSync {
    get(...anonymousParameters: unknown[]): unknown
    all(...anonymousParameters: unknown[]): unknown[]
    run(...anonymousParameters: unknown[]): {
      changes: number | bigint
      lastInsertRowid: number | bigint
    }
    setReturnArrays(enabled: boolean): void
  }

  class DatabaseSync {
    constructor(location: string, options?: { readOnly?: boolean })
    prepare(sql: string): StatementSync
    exec(sql: string): void
    close(): void
  }
}
