import type { ObjectWizardData } from './types'
import { salePayload, servicePayload } from './wizard-validation'

export const SALE_FILES_URL = '/api/v1/object-submissions/files'
export const SALE_SUBMISSION_URL = '/api/v1/object-submissions'
export const SERVICE_REQUESTS_URL = '/api/v1/service-requests'

/** Drafts and the Teenused section both live on the object list. */
export const SUBMIT_REDIRECT_URL = '/user/objects'

// The route treats a filled honeypot as a bot hit, so wizard posts carry the
// field empty exactly like the marketing form does.
const HONEYPOT_FIELD = 'company_website'
const WIZARD_PAGE_SLUG = '/user/objects/paku'

const NETWORK_ERROR = 'Ei õnnestunud saata. Kontrollige võrguühendust ja proovige uuesti.'
export const GENERIC_ERROR = 'Saatmine ebaõnnestus. Proovige mõne aja pärast uuesti.'

const FALLBACK_ERRORS: Record<number, string> = {
  400: 'Päring oli vigane. Proovige uuesti.',
  401: 'Sessioon on aegunud. Värskendage lehte ja logige uuesti sisse.',
  422: 'Sisestatud andmed olid vigased. Kontrollige andmeid ja proovige uuesti.',
  429: 'Liiga palju päringuid. Oodake mõni minut ja proovige siis uuesti.',
  503: 'Teenused pole praegu saadaval. Proovige mõne aja pärast uuesti.',
}

export interface WizardSubmitDeps {
  fetchImpl: typeof fetch
  redirect: (href: string) => void
}

/** Submission failure whose message is ready to render in the summary alert. */
export class WizardSubmitError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WizardSubmitError'
  }
}

interface SubmissionResponse {
  status: number
  body: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function readBody(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown
  } catch {
    return null
  }
}

/** The server's field errors are already Estonian; prefer them over generic text. */
function responseError(status: number, body: unknown): string {
  if (isRecord(body)) {
    if (isRecord(body.errors)) {
      const first = Object.values(body.errors).find(
        (value): value is string => typeof value === 'string' && value.trim() !== '',
      )
      if (first !== undefined) return first
    }
    if (typeof body.error === 'string' && body.error.trim() !== '') return body.error
  }
  return FALLBACK_ERRORS[status] ?? GENERIC_ERROR
}

async function sendJson(
  url: string,
  payload: unknown,
  fetchImpl: typeof fetch,
): Promise<SubmissionResponse> {
  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
    return { status: response.status, body: await readBody(response) }
  } catch {
    throw new WizardSubmitError(NETWORK_ERROR)
  }
}

/** Uploads the sale batch; 201 answers with the R2 keys in input order. */
async function uploadSaleFiles(
  files: readonly File[],
  fetchImpl: typeof fetch,
): Promise<string[]> {
  const form = new FormData()
  for (const file of files) form.append('files', file)
  let response: Response
  try {
    response = await fetchImpl(SALE_FILES_URL, { method: 'POST', body: form })
  } catch {
    throw new WizardSubmitError(NETWORK_ERROR)
  }
  const body = await readBody(response)
  const keys =
    isRecord(body) && Array.isArray(body.keys)
      ? body.keys.filter((key): key is string => typeof key === 'string')
      : []
  if (response.status !== 201 || keys.length !== files.length) {
    throw new WizardSubmitError(responseError(response.status, body))
  }
  return keys
}

async function submitSale(
  data: ObjectWizardData,
  deps: WizardSubmitDeps,
): Promise<SubmissionResponse> {
  const keys =
    data.sale.files.length > 0 ? await uploadSaleFiles(data.sale.files, deps.fetchImpl) : []
  const payload = salePayload(data)
  if (keys.length > 0) payload.files = keys
  return sendJson(SALE_SUBMISSION_URL, payload, deps.fetchImpl)
}

/** Multipart only carries the single hooldusraie attachment; JSON otherwise. */
function usesServiceMultipart(data: ObjectWizardData): boolean {
  return data.service.serviceType === 'hooldusraie' && data.service.file !== null
}

/** Flat strings per the route's multipartToPayload contract. */
function serviceMultipartForm(data: ObjectWizardData): FormData {
  const { service, contact } = data
  const fields: Record<string, string> = {
    type: service.serviceType ?? '',
    name: contact.name.trim(),
    phone: contact.phone.trim(),
    email: contact.email.trim(),
    cadastres: service.cadastreInput,
    consentAt: data.consentAt ?? '',
    formName: '',
    pageSlug: WIZARD_PAGE_SLUG,
    [HONEYPOT_FIELD]: '',
  }
  if (service.serviceType === 'kava') {
    fields.paper_copy = service.paperCopy ? 'true' : 'false'
  } else {
    fields.county = service.county
    fields.provisions = service.provisions.trim()
    fields.services = service.services.join(',')
  }
  const comment = service.comment.trim()
  if (comment !== '') fields.comment = comment

  const form = new FormData()
  for (const [key, value] of Object.entries(fields)) form.set(key, value)
  if (service.file) form.set('file', service.file)
  return form
}

async function submitService(
  data: ObjectWizardData,
  deps: WizardSubmitDeps,
): Promise<SubmissionResponse> {
  // The summary step enforces consent before onSubmit fires; keep the guard
  // so a direct call can never post without it.
  if (data.consentAt === null) {
    throw new WizardSubmitError('Nõusolek on kohustuslik')
  }
  if (usesServiceMultipart(data)) {
    try {
      const response = await deps.fetchImpl(SERVICE_REQUESTS_URL, {
        method: 'POST',
        body: serviceMultipartForm(data),
      })
      return { status: response.status, body: await readBody(response) }
    } catch {
      throw new WizardSubmitError(NETWORK_ERROR)
    }
  }
  const { branch: _branch, ...payload } = servicePayload(data)
  return sendJson(
    SERVICE_REQUESTS_URL,
    {
      ...payload,
      [HONEYPOT_FIELD]: '',
      consentAt: data.consentAt,
      formName: '',
      pageSlug: WIZARD_PAGE_SLUG,
    },
    deps.fetchImpl,
  )
}

/**
 * Submits the wizard: sale uploads files first and posts the returned keys,
 * service posts to the service-request API, then the caller is redirected.
 * Throws WizardSubmitError with a user-facing message on any failure, so the
 * caller stays on the summary step.
 */
export async function submitWizard(
  data: ObjectWizardData,
  deps: WizardSubmitDeps,
): Promise<void> {
  const response =
    data.branch === 'sale' ? await submitSale(data, deps) : await submitService(data, deps)
  if (response.status === 201) {
    deps.redirect(SUBMIT_REDIRECT_URL)
    return
  }
  throw new WizardSubmitError(responseError(response.status, response.body))
}
