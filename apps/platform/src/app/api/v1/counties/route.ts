import { NextResponse } from 'next/server'

import { getRepositories } from '@/lib/data/runtime'

/**
 * Public reference data for the county → parish cascade filter. Rows change
 * only with Estonian administrative reform, so a short shared cache is fine.
 */
export async function GET(): Promise<Response> {
  const repos = await getRepositories()

  const [{ docs: counties }, { docs: parishes }] = await Promise.all([
    repos.find({ collection: 'counties', sort: 'name', pagination: false }),
    repos.find({ collection: 'parishes', sort: 'name', pagination: false }),
  ])

  const parishesByCounty = new Map<string, { id: string; name: string }[]>()
  for (const parish of parishes) {
    const list = parishesByCounty.get(parish.countyId) ?? []
    list.push({ id: parish.id, name: parish.name })
    parishesByCounty.set(parish.countyId, list)
  }

  const result = counties.map((county) => ({
    id: county.id,
    name: county.name,
    parishes: parishesByCounty.get(county.id) ?? [],
  }))

  return NextResponse.json(result, {
    headers: { 'cache-control': 'public, s-maxage=300' },
  })
}
