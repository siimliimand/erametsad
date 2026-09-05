import { and, asc, eq, sql } from 'drizzle-orm'

import type { ServiceRequestType } from '../schema'
import { partners } from '../schema'
import { DocumentNotFoundError } from './errors'
import { decodeJsonFields, encodeJsonFields } from './json-fields'
import { partnersJsonFields, type CreateDataFor, type DocFor, type UpdateDataFor } from './registry'
import type { CoreDatabase } from './repository'

export interface PartnerRepositoryOptions {
  now?: () => string
}

export function createPartnersRepository(db: CoreDatabase, options: PartnerRepositoryOptions = {}) {
  const now = options.now ?? (() => new Date().toISOString())

  function decode(row: Record<string, unknown>): DocFor<'partners'> {
    return decodeJsonFields(row, partnersJsonFields) as DocFor<'partners'>
  }

  return {
    async create(data: CreateDataFor<'partners'>): Promise<DocFor<'partners'>> {
      const encoded = encodeJsonFields(data, partnersJsonFields)
      const timestamp = now()
      const values: Record<string, unknown> = {
        ...encoded,
        createdAt: encoded.createdAt ?? timestamp,
        updatedAt: encoded.updatedAt ?? timestamp,
      }
      const rows = await db
        .insert(partners)
        // repository.ts inserts through the same `as never` escape: the
        // concrete-table insert type cannot express a Record-built row.
        .values(values as never)
        .returning()
      const row = rows[0]
      if (!row) {
        throw new DocumentNotFoundError('partners', '(new)')
      }
      return decode(row)
    },

    async listActive(): Promise<DocFor<'partners'>[]> {
      const rows = await db
        .select()
        .from(partners)
        .where(eq(partners.active, true))
        .orderBy(asc(partners.name))
      return (rows as Record<string, unknown>[]).map((row) => decode(row))
    },

    async listActiveByServiceType(serviceType: ServiceRequestType): Promise<DocFor<'partners'>[]> {
      const rows = await db
        .select()
        .from(partners)
        .where(
          and(
            eq(partners.active, true),
            sql`EXISTS (SELECT 1 FROM json_each(${partners.serviceTypes}) WHERE json_each.value = ${serviceType})`,
          ),
        )
        .orderBy(asc(partners.name))
      return (rows as Record<string, unknown>[]).map((row) => decode(row))
    },

    async update(id: string, data: UpdateDataFor<'partners'>): Promise<DocFor<'partners'>> {
      const encoded = encodeJsonFields(data, partnersJsonFields)
      const values: Record<string, unknown> = { updatedAt: now() }
      for (const [key, value] of Object.entries(encoded)) {
        if (value !== undefined) {
          values[key] = value
        }
      }
      const rows = await db
        .update(partners)
        .set(values)
        .where(eq(partners.id, id))
        .returning()
      const row = rows[0]
      if (!row) {
        throw new DocumentNotFoundError('partners', id)
      }
      return decode(row)
    },
  }
}

export type PartnersRepository = ReturnType<typeof createPartnersRepository>
