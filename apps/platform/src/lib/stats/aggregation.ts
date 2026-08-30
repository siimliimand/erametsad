import type { CoreRepositories } from '../data/repositories'
import { getRepositories } from '../data/runtime'

export interface SnapshotDelta {
  objectType: string
  count?: number
  area?: number
  eur?: number
}

export async function upsertSnapshot(repos: CoreRepositories, delta: SnapshotDelta): Promise<void> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const count = delta.count ?? 0
  const area = delta.area ?? 0
  const eur = delta.eur ?? 0

  const existing = await repos.find({
    collection: 'statistics-snapshots',
    where: {
      and: [
        { date: { equals: today.toISOString() } },
        { objectType: { equals: delta.objectType } },
      ],
    },
    limit: 1,
  })

  if (existing.docs.length > 0) {
    const doc = existing.docs[0] as Record<string, unknown>
    await repos.update({
      collection: 'statistics-snapshots',
      id: doc.id as string,
      data: {
        count: (Number(doc.count) || 0) + count,
        area: (Number(doc.area) || 0) + area,
        eur: (Number(doc.eur) || 0) + eur,
      },
    })
  } else {
    await repos.create({
      collection: 'statistics-snapshots',
      data: {
        date: today.toISOString(),
        objectType: delta.objectType,
        count,
        area,
        eur,
      },
    })
  }
}

export interface StatisticsResult {
  objectType: string
  totalCount: number
  totalArea: number
  totalVolume: number
  totalEur: number
}

export async function computeStats(): Promise<StatisticsResult[]> {
  const repos = await getRepositories()

  const snapshots = await repos.find({
    collection: 'statistics-snapshots',
    limit: 1000,
    sort: '-date',
  })

  const grouped = new Map<string, StatisticsResult>()

  for (const doc of snapshots.docs) {
    const d = doc as Record<string, unknown>
    const objectType = d.objectType as string
    const count = (d.count as number | undefined) ?? 0
    const area = (d.area as number | undefined) ?? 0
    const volume = (d.volume as number | undefined) ?? 0
    const eur = (d.eur as number | undefined) ?? 0

    const existing = grouped.get(objectType)
    if (existing) {
      existing.totalCount += count
      existing.totalArea += area
      existing.totalVolume += volume
      existing.totalEur += eur
    } else {
      grouped.set(objectType, {
        objectType,
        totalCount: count,
        totalArea: area,
        totalVolume: volume,
        totalEur: eur,
      })
    }
  }

  return Array.from(grouped.values())
}
