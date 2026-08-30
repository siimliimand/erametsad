export type EidMethod = 'smartid' | 'mobileid' | 'idcard'

export type EidPollState = 'pending' | 'completed' | 'failed'

export interface EidStartSuccess {
  ok: true
  sessionRef: string
  controlCode: string | null
}

export interface AuthFailure {
  ok: false
  message: string
  suspended: boolean
}

const NETWORK_ERROR = 'Võrguühendus ei ole saadaval. Proovi uuesti.'

// The auth endpoints collapse suspended accounts into a generic 401 today.
// If the backend starts signalling suspension explicitly (suspended: true or
// code: ACCOUNT_SUSPENDED), the login page shows the suspended banner.
async function signalsSuspension(response: Response): Promise<boolean> {
  try {
    const body: unknown = await response.clone().json()
    if (body && typeof body === 'object') {
      const record = body as Record<string, unknown>
      return record.suspended === true || record.code === 'ACCOUNT_SUSPENDED'
    }
  } catch {
    // No JSON body: treat as a plain failure.
  }
  return false
}

async function failureFrom(
  response: Response,
  fallback: string,
  preferServerMessage: boolean,
): Promise<AuthFailure> {
  let message = fallback
  if (preferServerMessage) {
    try {
      const body: unknown = await response.clone().json()
      if (
        body &&
        typeof body === 'object' &&
        typeof (body as Record<string, unknown>).error === 'string'
      ) {
        message = (body as Record<string, unknown>).error as string
      }
    } catch {
      // Keep the fallback copy.
    }
  }
  return { ok: false, message, suspended: await signalsSuspension(response) }
}

export async function startEid(
  method: EidMethod,
  isikukood: string,
): Promise<EidStartSuccess | AuthFailure> {
  let response: Response
  try {
    response = await fetch(`/api/v1/auth/${method}/start`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ isikukood }),
    })
  } catch {
    return { ok: false, message: NETWORK_ERROR, suspended: false }
  }
  if (!response.ok) {
    return failureFrom(
      response,
      'Autentimine ei õnnestunud. Kontrolli isikukoodi ja proovi uuesti.',
      false,
    )
  }
  const body = (await response.json()) as { sessionRef?: unknown; controlCode?: unknown }
  if (typeof body.sessionRef !== 'string' || !body.sessionRef) {
    return { ok: false, message: NETWORK_ERROR, suspended: false }
  }
  return {
    ok: true,
    sessionRef: body.sessionRef,
    controlCode: typeof body.controlCode === 'string' ? body.controlCode : null,
  }
}

// null marks a transient failure (network, HTTP error): the caller retries a
// limited number of times before giving up. A 'failed' state from the API is
// definitive (rejected or expired session).
export async function pollEidStatus(
  method: EidMethod,
  sessionRef: string,
): Promise<EidPollState | null> {
  try {
    const response = await fetch(
      `/api/v1/auth/${method}/status?sessionRef=${encodeURIComponent(sessionRef)}`,
    )
    if (!response.ok) return null
    const body = (await response.json()) as { status?: unknown }
    if (body.status === 'pending' || body.status === 'completed' || body.status === 'failed') {
      return body.status
    }
    return null
  } catch {
    return null
  }
}

export async function completeEid(
  method: EidMethod,
  sessionRef: string,
): Promise<{ ok: true } | AuthFailure> {
  let response: Response
  try {
    response = await fetch(`/api/v1/auth/${method}/complete`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionRef }),
    })
  } catch {
    return { ok: false, message: NETWORK_ERROR, suspended: false }
  }
  if (!response.ok) {
    return failureFrom(
      response,
      'Autentimine ei õnnestunud. Kasutajat ei leitud või konto on peatatud.',
      false,
    )
  }
  return { ok: true }
}

export async function loginWithPassword(
  identifier: string,
  password: string,
): Promise<{ ok: true } | AuthFailure> {
  let response: Response
  try {
    response = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ identifier, password }),
    })
  } catch {
    return { ok: false, message: NETWORK_ERROR, suspended: false }
  }
  if (!response.ok) {
    // The login endpoint already answers with neutral Estonian copy.
    return failureFrom(response, 'Vale kasutajanimi või parool', true)
  }
  return { ok: true }
}

export interface ProfileSummary {
  id: string
  type: 'private' | 'company'
  approvalStatus: 'pending' | 'approved' | 'rejected'
}

function isProfileSummary(value: unknown): value is ProfileSummary {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return (
    typeof record.id === 'string' &&
    (record.type === 'private' || record.type === 'company') &&
    (record.approvalStatus === 'pending' ||
      record.approvalStatus === 'approved' ||
      record.approvalStatus === 'rejected')
  )
}

// Cookie-authenticated; null means the check failed and routing falls back
// to the plain next target.
export async function fetchMyProfiles(): Promise<ProfileSummary[] | null> {
  try {
    const response = await fetch('/api/v1/profiles')
    if (!response.ok) return null
    const body = (await response.json()) as { profiles?: unknown }
    if (!Array.isArray(body.profiles)) return null
    return body.profiles.filter(isProfileSummary)
  } catch {
    return null
  }
}
