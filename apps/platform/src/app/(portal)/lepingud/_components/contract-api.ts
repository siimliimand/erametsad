export type EidMethod = 'smartid' | 'mobileid' | 'idcard'

export interface ContractFlowSnapshot {
  status: 'none' | 'prepared' | 'sent' | 'signed' | 'voided'
  contractId: string | null
  renderedHtml: string | null
  signedAt: string | null
  createdAt: string | null
  updatedAt: string | null
}

export interface PreparedContractResponse {
  id?: unknown
  status?: unknown
  renderedHtml?: unknown
  error?: unknown
}

export interface CompletedContractResponse {
  id?: unknown
  status?: unknown
  signedAt?: unknown
  error?: unknown
}

export type ContractCallResult =
  | { ok: true; contractId: string; renderedHtml: string | null }
  | { ok: false; httpStatus: number; message: string }

export type CompleteCallResult =
  | { ok: true; signedAt: string | null }
  | { ok: false; httpStatus: number; message: string }

function errorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === 'object') {
    const error = (body as Record<string, unknown>).error
    if (typeof error === 'string' && error !== '') return localizeError(error)
  }
  return fallback
}

/** The engine answers in English; the portal surfaces Estonian copy. */
function localizeError(message: string): string {
  if (message.startsWith('No active')) return 'Aktiivset lepingu malli ei leitud. Proovi varsti uuesti.'
  if (message.startsWith('Auction not found')) return 'Oksjonit ei leitud.'
  if (message.includes('cannot be signed in status')) {
    return 'Lepingu olek on vahepeal muutunud. Laadi leht uuesti.'
  }
  if (message.includes('expired')) return 'Allkirjastamise seanss aegus.'
  return message
}

/** POST /api/v1/bids/{framework-contract|contract}/prepare — 201 returns the rendered contract. */
export async function prepareContract(
  kind: 'framework' | 'auction',
  auctionId: string,
): Promise<ContractCallResult> {
  const path = kind === 'framework' ? 'framework-contract' : 'contract'
  let response: Response
  try {
    response = await fetch(`/api/v1/bids/${path}/prepare`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ auctionId }),
    })
  } catch {
    return { ok: false, httpStatus: 0, message: 'Võrguühendus ei ole saadaval. Proovi uuesti.' }
  }
  const body = (await response.json().catch(() => null)) as PreparedContractResponse | null
  if (response.status === 201 && typeof body?.id === 'string') {
    return {
      ok: true,
      contractId: body.id,
      renderedHtml: typeof body.renderedHtml === 'string' ? body.renderedHtml : null,
    }
  }
  return {
    ok: false,
    httpStatus: response.status,
    message: errorMessage(body, 'Lepingu koostamine ebaõnnestus. Proovi uuesti.'),
  }
}

/** POST /api/v1/bids/{framework-contract|contract}/complete — 410 marks an expired signing session. */
export async function completeContract(
  kind: 'framework' | 'auction',
  contractId: string,
): Promise<CompleteCallResult> {
  const path = kind === 'framework' ? 'framework-contract' : 'contract'
  let response: Response
  try {
    response = await fetch(`/api/v1/bids/${path}/complete`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ contractId }),
    })
  } catch {
    return { ok: false, httpStatus: 0, message: 'Võrguühendus ei ole saadaval. Proovi uuesti.' }
  }
  const body = (await response.json().catch(() => null)) as CompletedContractResponse | null
  if (response.ok && body !== null && body.status === 'signed') {
    return { ok: true, signedAt: typeof body.signedAt === 'string' ? body.signedAt : null }
  }
  return {
    ok: false,
    httpStatus: response.status,
    message: errorMessage(body, 'Allkirjastamine ei õnnestunud. Proovi uuesti.'),
  }
}

export function downloadContractDocument(html: string, filename: string): void {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function randomControlCode(): string {
  const code = crypto.getRandomValues(new Uint32Array(1))[0] ?? 0
  return String(1000 + (code % 9000))
}
