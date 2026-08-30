import { requireAdminRepositories } from '@/app/(admin)/_lib/admin'
import { sampleImportFile } from '@/app/(admin)/admin/content/import-export/_lib/import-export'

export const dynamic = 'force-dynamic'

export async function GET() {
  // Redirects to the login page when the admin cookie is missing or invalid.
  await requireAdminRepositories()

  return new Response(JSON.stringify(sampleImportFile, null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': 'attachment; filename="sisu-naidis.json"',
    },
  })
}
