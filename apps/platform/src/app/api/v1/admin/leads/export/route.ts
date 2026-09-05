import { buildLeadsCsv, buildLeadsExportFilename } from './_lib/leads-export'

import { loadLeadExportData } from '@/app/(admin)/_actions/ops'

export const dynamic = 'force-dynamic'

/**
 * Leads CSV download (task 5.3, D2 keeps downloads on routes). Redirects to
 * the login page when the admin cookie is missing or invalid; returns 403
 * for staff roles without the export permission. The audit entry is written
 * inside loadLeadExportData before the CSV is returned.
 */
export async function GET(): Promise<Response> {
  const result = await loadLeadExportData()
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 403 })
  }

  return new Response(buildLeadsCsv(result.rows), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${buildLeadsExportFilename(new Date())}"`,
    },
  })
}
