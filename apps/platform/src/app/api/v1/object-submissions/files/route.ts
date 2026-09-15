import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { getMediaBucket } from '@/app/(admin)/admin/media/_lib/media-upload'
import { verifyAccessToken } from '@/lib/auth/jwt'
import { resolveAccessTokenSession } from '@/lib/auth/session'
import { storeSubmissionFiles, validateSubmissionFiles } from '@/lib/object-submission/uploads'

async function authenticate(request: NextRequest): Promise<string | null> {
  const token = request.cookies.get('access_token')?.value
  if (!token) return null

  const payload = verifyAccessToken(token)
  if (!payload) return null

  const ref = await resolveAccessTokenSession(token)
  if (ref.state === 'revoked') return null

  return payload.userId
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = await authenticate(request)
  if (!userId) {
    return NextResponse.json({ error: 'Autentimine ebaõnnestus' }, { status: 401 })
  }

  const contentType = request.headers.get('content-type') ?? ''
  if (!contentType.includes('multipart/form-data')) {
    return NextResponse.json(
      { error: 'Toetatakse ainult multipart-form-data-päringuid' },
      { status: 415 },
    )
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Vigased vormiandmed' }, { status: 400 })
  }

  const files = form.getAll('files').filter((value): value is File => value instanceof File)

  // The whole batch is validated before the bucket is touched, so one invalid
  // file fails the request and nothing is written to R2.
  const validationError = validateSubmissionFiles(files)
  if (validationError) {
    return NextResponse.json({ errors: { files: validationError } }, { status: 422 })
  }

  const bucket = await getMediaBucket()
  if (!bucket) {
    return NextResponse.json(
      {
        errors: {
          files: 'Faili salvestamine pole praegu saadaval. Proovige mõne aja pärast uuesti.',
        },
      },
      { status: 503 },
    )
  }

  try {
    const keys = await storeSubmissionFiles(bucket, files)
    return NextResponse.json({ keys }, { status: 201 })
  } catch (error) {
    console.error('[object-submissions] file upload failed:', error)
    return NextResponse.json(
      { errors: { files: 'Faili salvestamine ebaõnnestus. Proovige uuesti.' } },
      { status: 503 },
    )
  }
}
