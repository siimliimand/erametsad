import { and, eq, getTableColumns, ne } from 'drizzle-orm'
import type { Column, SQL } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core'

import type * as schema from '../schema'
import { DocumentNotFoundError, UnknownFieldError } from './errors'
import { applyIsikukoodOnRead, applyIsikukoodOnWrite, shouldDeactivateOtherTemplates, type IsikukoodCodec } from './hooks'
import { decodeJsonFields, encodeJsonFields } from './json-fields'
import {
  coreCollections,
  getCollectionConfig,
  type CoreCollectionSlug,
  type CreateDataFor,
  type DocFor,
  type UpdateDataFor,
} from './registry'
import { sortExpression } from './sort'
import { translateWhere, type WhereClause } from './where'

/**
 * Any async Drizzle SQLite database bound to the core schema. The Drizzle D1
 * driver instance satisfies this type; a better-sqlite3 instance can be
 * widened to it for vitest (task 8.1).
 */
export type CoreDatabase = BaseSQLiteDatabase<'async', unknown, typeof schema>

export type BatchStatement = BatchItem<'sqlite'>
export type BatchRunner = (statements: readonly [BatchStatement, ...BatchStatement[]]) => Promise<readonly unknown[]>

export interface RepositoryOptions {
  isikukoodCodec: IsikukoodCodec
  /**
   * Atomic multi-statement executor for the contract-template activation
   * swap. For D1 pass `(statements) => db.batch(statements)`. Without a
   * runner the statements run sequentially and are not atomic.
   */
  batch?: BatchRunner
  now?: () => string
}

export interface FindOptions<C extends CoreCollectionSlug = CoreCollectionSlug> {
  collection: C
  where?: WhereClause
  /** Leading '-' sorts descending; a bare field sorts ascending. */
  sort?: string
  /** Default 100. */
  limit?: number
  offset?: number
  /** 1-based; takes precedence over `offset`. */
  page?: number
  /** `false` returns all matching rows (seed reset). Default `true`. */
  pagination?: boolean
  /** Accepted for call-site compatibility; relationships are never populated. */
  depth?: number
}

export interface FindByIDOptions<C extends CoreCollectionSlug = CoreCollectionSlug> {
  collection: C
  id: string | number
  depth?: number
}

export interface CreateOptions<C extends CoreCollectionSlug = CoreCollectionSlug> {
  collection: C
  data: CreateDataFor<C>
}

export interface UpdateOptions<C extends CoreCollectionSlug = CoreCollectionSlug> {
  collection: C
  id: string | number
  data: UpdateDataFor<C>
  depth?: number
}

export interface DeleteOptions<C extends CoreCollectionSlug = CoreCollectionSlug> {
  collection: C
  id: string | number
}

export interface FindResult<TDoc> {
  docs: TDoc[]
}

export interface CoreRepositories {
  find<C extends CoreCollectionSlug>(options: FindOptions<C>): Promise<FindResult<DocFor<C>>>
  findByID<C extends CoreCollectionSlug>(options: FindByIDOptions<C>): Promise<DocFor<C> | null>
  create<C extends CoreCollectionSlug>(options: CreateOptions<C>): Promise<DocFor<C>>
  update<C extends CoreCollectionSlug>(options: UpdateOptions<C>): Promise<DocFor<C>>
  delete(options: DeleteOptions): Promise<void>
}

const DEFAULT_LIMIT = 100

function idHint(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'number') {
    return String(value)
  }
  return '(new)'
}

export function createCoreRepositories(db: CoreDatabase, options: RepositoryOptions): CoreRepositories {
  const now = options.now ?? (() => new Date().toISOString())

  function columnsOf(collection: CoreCollectionSlug): Record<string, Column> {
    return getTableColumns(coreCollections[collection].table) as Record<string, Column>
  }

  function requireColumn(collection: CoreCollectionSlug, name: string): Column {
    const column = columnsOf(collection)[name]
    if (!column) {
      throw new UnknownFieldError(collection, name)
    }
    return column
  }

  function decodeRow<C extends CoreCollectionSlug>(
    collection: C,
    row: Record<string, unknown>,
  ): DocFor<C> {
    const config = coreCollections[collection]
    let doc = decodeJsonFields(row, config.jsonFields)
    if (config.isikukood) {
      doc = applyIsikukoodOnRead(doc, options.isikukoodCodec)
    }
    return doc as DocFor<C>
  }

  function encodeWrite(
    collection: CoreCollectionSlug,
    data: Record<string, unknown>,
    mode: 'create' | 'update',
  ): Record<string, unknown> {
    const config = coreCollections[collection]
    const columns = columnsOf(collection)
    const out: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(data)) {
      if (value === undefined) {
        continue
      }
      const field = config.aliases[key] ?? key
      if (field !== 'isikukood' && !(field in columns)) {
        throw new UnknownFieldError(collection, key)
      }
      out[field] = value
    }
    let encoded = encodeJsonFields(out, config.jsonFields)
    if (config.isikukood) {
      encoded = applyIsikukoodOnWrite(encoded, options.isikukoodCodec)
    }
    const timestamp = now()
    if (mode === 'create') {
      encoded.createdAt ??= timestamp
    }
    encoded.updatedAt ??= timestamp
    return encoded
  }

  function tableUpdate(
    collection: CoreCollectionSlug,
    values: Record<string, unknown>,
    condition: SQL | undefined,
  ) {
    const config = coreCollections[collection]
    // The runtime table lookup erases the per-collection insert type; the
    // public API already validated the data shape for the given collection.
    return db.update(config.table).set(values).where(condition)
  }

  async function insertReturning(
    collection: CoreCollectionSlug,
    values: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const config = coreCollections[collection]
    const rows = await db
      .insert(config.table)
      .values(values as never)
      .returning()
    const row = rows[0]
    if (!row) {
      throw new DocumentNotFoundError(collection, idHint(values.id))
    }
    return row
  }

  async function updateContractTemplate(
    collection: 'contract-templates',
    id: string,
    data: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const currentRows = await db
      .select()
      .from(coreCollections[collection].table)
      .where(eq(requireColumn(collection, 'id'), id))
      .limit(1)
    const current = currentRows[0] as Record<string, unknown> | undefined
    if (!current) {
      throw new DocumentNotFoundError(collection, id)
    }
    const encoded = encodeWrite(collection, data, 'update')
    const nextActive = encoded.active === undefined ? undefined : encoded.active === true
    const activating =
      nextActive !== undefined && shouldDeactivateOtherTemplates(current.active === true, nextActive)
    const type = (encoded.type as string | undefined) ?? (current.type as string | undefined)
    const plainUpdate = async (): Promise<Record<string, unknown>> => {
      const rows = await tableUpdate(collection, encoded, eq(requireColumn(collection, 'id'), id)).returning()
      const row = rows[0] as Record<string, unknown> | undefined
      if (!row) {
        throw new DocumentNotFoundError(collection, id)
      }
      return row
    }
    if (!activating || !type) {
      return plainUpdate()
    }
    const deactivateOthers = tableUpdate(
      collection,
      { active: false, updatedAt: now() },
      and(
          eq(requireColumn(collection, 'type'), type),
          eq(requireColumn(collection, 'active'), true),
          ne(requireColumn(collection, 'id'), id),
        ),
    )
    const write = tableUpdate(collection, encoded, eq(requireColumn(collection, 'id'), id)).returning()
    let row: Record<string, unknown> | undefined
    if (options.batch) {
      const results = await options.batch([deactivateOthers, write])
      row = (results[1] as Record<string, unknown>[])[0]
    } else {
      await deactivateOthers
      row = (await write)[0]
    }
    if (!row) {
      throw new DocumentNotFoundError(collection, id)
    }
    return row
  }

  return {
    async find(findOptions) {
      const collection = findOptions.collection
      const config = getCollectionConfig(collection)
      const columns = columnsOf(collection)
      const condition = translateWhere(columns, findOptions.where, config.aliases)
      let query = db.select().from(config.table).where(condition).$dynamic()
      if (findOptions.sort !== undefined) {
        query = query.orderBy(sortExpression(columns, config.aliases, findOptions.sort))
      }
      if (findOptions.pagination !== false) {
        const limit = findOptions.limit ?? DEFAULT_LIMIT
        query = query.limit(limit)
        const offset =
          findOptions.offset ??
          (findOptions.page !== undefined && findOptions.page > 1
            ? (findOptions.page - 1) * limit
            : undefined)
        if (offset !== undefined) {
          query = query.offset(offset)
        }
      }
      const rows = (await query) as Record<string, unknown>[]
      return { docs: rows.map((row) => decodeRow(collection, row)) }
    },

    async findByID(findOptions) {
      const collection = findOptions.collection
      const config = getCollectionConfig(collection)
      const rows = (await db
        .select()
        .from(config.table)
        .where(eq(requireColumn(collection, 'id'), String(findOptions.id)))
        .limit(1)) as Record<string, unknown>[]
      const row = rows[0]
      return row ? decodeRow(collection, row) : null
    },

    async create(createOptions) {
      const collection = createOptions.collection
      const config = getCollectionConfig(collection)
      const encoded = encodeWrite(collection, createOptions.data, 'create')
      const effectiveActive = encoded.active === undefined ? true : encoded.active === true
      if (
        config.templateActivation &&
        shouldDeactivateOtherTemplates(undefined, effectiveActive) &&
        typeof encoded.type === 'string' &&
        encoded.type
      ) {
        const deactivateOthers = tableUpdate(
          collection,
          { active: false, updatedAt: now() },
          and(
            eq(requireColumn(collection, 'type'), encoded.type),
            eq(requireColumn(collection, 'active'), true),
          ),
        )
        const insert = db
          .insert(config.table)
          .values(encoded as never)
          .returning()
        let row: Record<string, unknown> | undefined
        if (options.batch) {
          const results = await options.batch([deactivateOthers, insert])
          row = (results[1] as Record<string, unknown>[])[0]
        } else {
          await deactivateOthers
          row = (await insert)[0]
        }
        if (!row) {
          throw new DocumentNotFoundError(collection, idHint(encoded.id))
        }
        return decodeRow(collection, row)
      }
      const row = await insertReturning(collection, encoded)
      return decodeRow(collection, row)
    },

    async update(updateOptions) {
      const collection = updateOptions.collection
      const id = String(updateOptions.id)
      const data = updateOptions.data as Record<string, unknown>
      let row: Record<string, unknown>
      if (collection === 'contract-templates') {
        row = await updateContractTemplate('contract-templates', id, data)
      } else {
        getCollectionConfig(collection)
        const encoded = encodeWrite(collection, data, 'update')
        const rows = await tableUpdate(collection, encoded, eq(requireColumn(collection, 'id'), id)).returning()
        const updated = rows[0] as Record<string, unknown> | undefined
        if (!updated) {
          throw new DocumentNotFoundError(collection, id)
        }
        row = updated
      }
      return decodeRow(collection, row)
    },

    async delete(deleteOptions) {
      const collection = deleteOptions.collection
      const config = getCollectionConfig(collection)
      const rows = await db
        .delete(config.table)
        .where(eq(requireColumn(collection, 'id'), String(deleteOptions.id)))
        .returning()
      if (!rows[0]) {
        throw new DocumentNotFoundError(collection, deleteOptions.id)
      }
    },
  }
}
