import { serviceRequestPayloadSchema, type ServiceRequestType } from '@erametsad/types'
import type { ZodError } from 'zod'
import { NextResponse } from 'next/server'

import {
  getMediaBucket,
} from '@/app/(admin)/admin/media/_lib/media-upload'
import { validateHoneypot } from '@/lib/leads/ingestion'
import { serviceRequestsRateLimiter } from '@/lib/rate-limit'
import { storeAttachment, validateAttachment } from '@/lib/service-requests/attachments'
import {
  DuplicateServiceRequestError,
  HoneypotTriggeredError,
  ServiceRequestValidationError,
  ingestServiceRequest,
} from '@/lib/service-requests/ingestion'

// Defaults per page; a formName field from the client wins.
const DEFAULT_FORM_NAMES: Record<ServiceRequestType, string> = {
  kava: 'metsamajanduskava-1',
  hooldusraie: 'hooldusraie-1',
  istutamine: 'metsa-istutamine-1',
}

function extractIp(request: Request): string {
  const raw = request.headers.get('x-forwarded-for')
  const first = raw?.split(',')[0]?.trim()
  return first && first.length > 0 ? first : 'unknown'
}

/** First message per dotted field path (contact.phone, services, ...). */
function fieldErrors(error: ZodError): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.map(String).join('.') || 'form'
    if (!(key in errors)) {
      errors[key] = issue.message
    }
  }
  return errors
}

function multipartToPayload(form: FormData): { body: Record<string, unknown>; file: File | null } {
  const text = (key: string): string => {
    const value = form.get(key)
    return typeof value === 'string' ? value.trim() : ''
  }
  const type = text('type')
  const services = form
    .getAll('services')
    .flatMap((value) => (typeof value === 'string' ? value.split(',') : []))
    .map((value) => value.trim())
    .filter((value) => value.length > 0)

  const payload: Record<string, unknown> = {
    type,
    contact: { name: text('name'), phone: text('phone'), email: text('email') },
    cadastres: text('cadastres'),
  }
  if (type === 'kava') {
    const paperCopy = text('paper_copy')
    if (paperCopy) payload.paper_copy = paperCopy === 'true'
  } else {
    payload.county = text('county')
    payload.provisions = text('provisions')
    payload.services = services
  }
  const comment = text('comment')
  if (comment) payload.comment = comment

  const body: Record<string, unknown> = {
    ...payload,
    company_website: text('company_website'),
    consentAt: text('consentAt'),
    formName: text('formName'),
    pageSlug: text('pageSlug'),
  }

  const fileField = form.get('file')
  const file =
    fileField instanceof File && (fileField.name !== '' || fileField.size > 0) ? fileField : null

  return { body, file }
}

export async function POST(request: Request): Promise<NextResponse> {
  const ip = extractIp(request)
  const rateCheck = serviceRequestsRateLimiter.check(`service-requests:${ip}`)
  if (!rateCheck.allowed) {
    return NextResponse.json({ error: 'Liiga palju päringuid' }, { status: 429 })
  }

  const contentType = request.headers.get('content-type') ?? ''
  let body: Record<string, unknown>
  let file: File | null = null

  if (contentType.includes('application/json')) {
    try {
      body = (await request.json()) as Record<string, unknown>
    } catch {
      return NextResponse.json({ error: 'Vigane JSON' }, { status: 400 })
    }
  } else if (contentType.includes('multipart/form-data')) {
    let form: FormData
    try {
      form = await request.formData()
    } catch {
      return NextResponse.json({ error: 'Vigased vormiandmed' }, { status: 400 })
    }
    const parsed = multipartToPayload(form)
    body = parsed.body
    file = parsed.file
  } else {
    return NextResponse.json(
      { error: 'Toetatakse ainult JSON- ja multipart-form-data-päringuid' },
      { status: 415 },
    )
  }

  if (!validateHoneypot(body)) {
    return NextResponse.json({ status: 'ok' })
  }

  const consentAt = typeof body.consentAt === 'string' ? body.consentAt.trim() : ''
  if (!consentAt) {
    return NextResponse.json(
      { errors: { consentAt: 'Nõusolek on kohustuslik' } },
      { status: 422 },
    )
  }

  const parsed = serviceRequestPayloadSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ errors: fieldErrors(parsed.error) }, { status: 422 })
  }

  let attachmentKey: string | null = null
  if (file) {
    if (parsed.data.type !== 'hooldusraie') {
      return NextResponse.json(
        { errors: { file: 'Faili saab lisada ainult hooldusraie päringule' } },
        { status: 422 },
      )
    }
    const fileError = validateAttachment({
      filename: file.name,
      mimeType: file.type,
      size: file.size,
    })
    if (fileError) {
      return NextResponse.json({ errors: { file: fileError } }, { status: 422 })
    }
    const bucket = await getMediaBucket()
    if (!bucket) {
      return NextResponse.json(
        { errors: { file: 'Faili salvestamine pole praegu saadaval. Proovige mõne aja pärast uuesti.' } },
        { status: 503 },
      )
    }
    try {
      attachmentKey = await storeAttachment(bucket, file)
    } catch (error) {
      console.error('[service-requests] attachment upload failed:', error)
      return NextResponse.json(
        { errors: { file: 'Faili salvestamine ebaõnnestus. Proovige uuesti.' } },
        { status: 503 },
      )
    }
  }

  const formName =
    typeof body.formName === 'string' && body.formName.trim().length > 0
      ? body.formName.trim()
      : DEFAULT_FORM_NAMES[parsed.data.type]
  const pageSlug =
    typeof body.pageSlug === 'string' && body.pageSlug.trim().length > 0
      ? body.pageSlug.trim()
      : undefined

  try {
    const { request: stored, routedCount } = await ingestServiceRequest({
      body,
      formName,
      ...(pageSlug ? { pageSlug } : {}),
      consentAt,
      requestIp: ip,
      ...(attachmentKey ? { attachments: [attachmentKey] } : {}),
    })

    return NextResponse.json(
      { status: 'ok', routedCount, request: { id: stored.id, status: stored.status } },
      { status: 201 },
    )
  } catch (error) {
    if (error instanceof HoneypotTriggeredError) {
      return NextResponse.json({ status: 'ok' })
    }
    if (error instanceof DuplicateServiceRequestError) {
      return NextResponse.json({ error: 'Päring on juba saadetud' }, { status: 409 })
    }
    if (error instanceof ServiceRequestValidationError) {
      return NextResponse.json({ errors: { form: error.message } }, { status: 422 })
    }
    console.error('[service-requests] ingestion failed:', error)
    return NextResponse.json({ error: 'Sisemine viga' }, { status: 500 })
  }
}
