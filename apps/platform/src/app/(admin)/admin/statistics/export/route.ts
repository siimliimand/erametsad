import { requireAdminRepositories } from '../../../_lib/admin'
import { can } from '../../../_lib/permissions'
import {
  getStatisticsData,
  statisticsToCsv,
  STATISTICS_PERIODS,
  type StatisticsPeriod,
} from '../_lib/statistics'

export const dynamic = 'force-dynamic'

/**
 * Statistics CSV download: one aggregated sheet per request, period taken
 * from the same `period` query param the page uses so the file always
 * matches what the operator sees. Access requires a staff session with
 * `statistics:read`; the export contains counts and sums only.
 */
export async function GET(request: Request): Promise<Response> {
  const { session } = await requireAdminRepositories()
  if (!can(session.role, 'statistics:read')) {
    return Response.json({ error: 'Ligipääs statistikale puudub.' }, { status: 403 })
  }

  const rawPeriod = new URL(request.url).searchParams.get('period')
  const parsed = Number.parseInt(rawPeriod ?? '', 10)
  const period: StatisticsPeriod = (STATISTICS_PERIODS as readonly number[]).includes(parsed)
    ? (parsed as StatisticsPeriod)
    : STATISTICS_PERIODS[0]

  const data = await getStatisticsData(period)
  // UTF-8 BOM so Excel detects the encoding of the semicolon-separated file.
  return new Response(`\uFEFF${statisticsToCsv(data)}`, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="statistika-${String(period)}.csv"`,
    },
  })
}
