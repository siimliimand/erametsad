import { getPayloadClient } from '../../payload/payloadClient'

export interface StatisticsResult {
  objectType: string
  totalCount: number
  totalArea: number
  totalVolume: number
  totalEur: number
}

export async function computeStats(): Promise<StatisticsResult[]> {
  const payload = await getPayloadClient()

  const snapshots = await payload.find({
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