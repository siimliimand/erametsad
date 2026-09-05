import { and, count, desc, eq, gte, sql } from 'drizzle-orm'

import type { ServiceRequestStatus, ServiceRequestType } from '../schema'
import { serviceRequests } from '../schema'
import { DocumentNotFoundError } from './errors'
import { decodeJsonFields, encodeJsonFields } from './json-fields'
import { serviceRequestsJsonFields, type CreateDataFor, type DocFor } from './registry'
import type { CoreDatabase } from './repository'

export interface ServiceRequestListFilters {
  type?: ServiceRequestType
  status?: ServiceRequestStatus
  limit?: number
  offset?: number
}

export interface ServiceRequestRepositoryOptions {
  now?: () => string
}

const DEFAULT_LIMIT = 100

/**
 * Duplicate-throttle lookup expects the payload JSON produced by the shared
 * validators: `phone` (normalized string) and `cadastres` (string array).
 */
export function createServiceRequestsRepository(
  db: CoreDatabase,
  options: ServiceRequestRepositoryOptions = {},
) {
  const now = options.now ?? (() => new Date().toISOString())

  function decode(row: Record<string, unknown>): DocFor<'service-requests'> {
    return decodeJsonFields(row, serviceRequestsJsonFields) as DocFor<'service-requests'>
  }

  return {
    async create(data: CreateDataFor<'service-requests'>): Promise<DocFor<'service-requests'>> {
      const encoded = encodeJsonFields(data, serviceRequestsJsonFields)
      const timestamp = now()
      const values: Record<string, unknown> = {
        ...encoded,
        createdAt: encoded.createdAt ?? timestamp,
        updatedAt: encoded.updatedAt ?? timestamp,
      }
      const rows = await db
        .insert(serviceRequests)
        // repository.ts inserts through the same `as never` escape: the
        // concrete-table insert type cannot express a Record-built row.
        .values(values as never)
        .returning()
      const row = rows[0]
      if (!row) {
        throw new DocumentNotFoundError('service-requests', '(new)')
      }
      return decode(row)
    },

    async findById(id: string): Promise<DocFor<'service-requests'> | null> {
      const rows = await db
        .select()
        .from(serviceRequests)
        .where(eq(serviceRequests.id, id))
        .limit(1)
      const row = rows[0]
      return row ? decode(row) : null
    },

    async list(filters: ServiceRequestListFilters = {}): Promise<DocFor<'service-requests'>[]> {
      const condition = and(
        filters.type ? eq(serviceRequests.type, filters.type) : undefined,
        filters.status ? eq(serviceRequests.status, filters.status) : undefined,
      )
      let query = db
        .select()
        .from(serviceRequests)
        .where(condition)
        .orderBy(desc(serviceRequests.createdAt))
        .$dynamic()
      query = query.limit(filters.limit ?? DEFAULT_LIMIT)
      if (filters.offset !== undefined && filters.offset > 0) {
        query = query.offset(filters.offset)
      }
      const rows = (await query) as Record<string, unknown>[]
      return rows.map((row) => decode(row))
    },

    async countRecentByPhoneAndCadastre(
      phone: string,
      cadastre: string,
      sinceIso: string,
    ): Promise<number> {
      const rows = await db
        .select({ value: count() })
        .from(serviceRequests)
        .where(
          and(
            gte(serviceRequests.createdAt, sinceIso),
            sql`json_extract(${serviceRequests.payload}, '$.phone') = ${phone}`,
            sql`EXISTS (SELECT 1 FROM json_each(json_extract(${serviceRequests.payload}, '$.cadastres')) WHERE json_each.value = ${cadastre})`,
          ),
        )
      return rows[0]?.value ?? 0
    },
  }
}

export type ServiceRequestsRepository = ReturnType<typeof createServiceRequestsRepository>
