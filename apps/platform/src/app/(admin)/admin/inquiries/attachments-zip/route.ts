import { buildGdprZip } from '../../users/_components/gdpr-zip'

import { loadRequestAttachmentsZipData } from '@/app/(admin)/_actions/ops'

export const dynamic = 'force-dynamic'

/**
 * Attachment ZIP download for one service request (task 8.5). The data
 * loader owns the permission gate and the audit entry; this handler only
 * shapes the response. Store-method ZIP keeps the Workers runtime happy
 * and mirrors the GDPR export pattern.
 */
export async function GET(request: Request): Promise<Response> {
  const requestId = new URL(request.url).searchParams.get('paaring') ?? ''
  if (requestId === '') {
    return Response.json({ error: 'Päringu identifikaator puudub.' }, { status: 400 })
  }

  const result = await loadRequestAttachmentsZipData(requestId)
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 403 })
  }

  const zip = buildGdprZip(
    result.entries.map((entry) => ({ name: entry.name, data: entry.bytes })),
  )
  return new Response(zip.buffer as ArrayBuffer, {
    headers: {
      'content-type': 'application/zip',
      'content-disposition': `attachment; filename="manused-${result.requestLabel}.zip"`,
    },
  })
}
