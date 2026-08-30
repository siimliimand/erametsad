// Client wrappers for the register wizard's backend contracts: company
// lookup, account registration, and company access requests.

export interface CompanyLookupResult {
  name: string
  regCode: string
  boardMembers: { name: string; role: string }[]
}

export type CompanyLookup =
  | { ok: true; company: CompanyLookupResult }
  | { ok: false; reason: 'not-found' | 'error' }

export async function lookupCompany(regCode: string): Promise<CompanyLookup> {
  let response: Response
  try {
    response = await fetch(
      `/api/v1/company-lookup?regCode=${encodeURIComponent(regCode)}`,
    )
  } catch {
    return { ok: false, reason: 'error' }
  }
  if (response.status === 404) {
    return { ok: false, reason: 'not-found' }
  }
  if (!response.ok) {
    return { ok: false, reason: 'error' }
  }

  let body: unknown
  try {
    body = await response.json()
  } catch {
    return { ok: false, reason: 'error' }
  }

  const record =
    body && typeof body === 'object' ? (body as Record<string, unknown>) : null
  const rawCompany =
    record &&
    typeof record.company === 'object' &&
    record.company !== null
      ? (record.company as Record<string, unknown>)
      : null
  if (
    !rawCompany ||
    typeof rawCompany.name !== 'string' ||
    typeof rawCompany.regCode !== 'string' ||
    !Array.isArray(rawCompany.boardMembers)
  ) {
    return { ok: false, reason: 'error' }
  }

  const boardMembers = rawCompany.boardMembers.filter(
    (member): member is { name: string; role: string } => {
      if (!member || typeof member !== 'object') return false
      const record = member as Record<string, unknown>
      return typeof record.name === 'string' && typeof record.role === 'string'
    },
  )

  return {
    ok: true,
    company: {
      name: rawCompany.name,
      regCode: rawCompany.regCode,
      boardMembers,
    },
  }
}

export interface RegistrationInput {
  identifier: string
  isikukood?: string
  profileType: 'private' | 'company'
  consents: { terms: string; privacy: string; marketing: string }
  regCode?: string
  companyName?: string
  phone?: string
  address?: string
}

export interface RegisteredProfile {
  displayName: string
  approvalStatus: string
}

export type RegisterResult =
  | { ok: true; profile: RegisteredProfile | null }
  | { ok: false; message: string; existingAccount: boolean }

// The register contract requires a password, but the wizard has no password
// step. The account starts with this throwaway value and the user sets a
// real one afterwards via /update-password.
function generateTemporaryPassword(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  let password = ''
  for (const byte of bytes) {
    password += (byte % 36).toString(36)
  }
  return password
}

export async function submitRegistration(
  input: RegistrationInput,
): Promise<RegisterResult> {
  let response: Response
  try {
    response = await fetch('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...input, password: generateTemporaryPassword() }),
    })
  } catch {
    return {
      ok: false,
      message: 'Võrguühendus ei ole saadaval. Proovi uuesti.',
      existingAccount: false,
    }
  }

  let body: unknown
  try {
    body = await response.json()
  } catch {
    body = null
  }

  if (!response.ok) {
    const record = body as { error?: unknown } | null
    const message =
      record && typeof record.error === 'string'
        ? record.error
        : 'Registreerimine ei õnnestunud. Proovi uuesti.'
    return { ok: false, message, existingAccount: response.status === 409 }
  }

  const record = body as { profile?: unknown } | null
  const profile =
    record && typeof record.profile === 'object' && record.profile !== null
      ? (record.profile as Record<string, unknown>)
      : null
  const registeredProfile =
    profile &&
    typeof profile.displayName === 'string' &&
    typeof profile.approvalStatus === 'string'
      ? {
          displayName: profile.displayName,
          approvalStatus: profile.approvalStatus,
        }
      : null

  return { ok: true, profile: registeredProfile }
}

export interface AccessRequestInput {
  regCode: string
  companyName?: string
  requesterName: string
  requesterEmail: string
  requesterPhone?: string
  reason?: string
}

export type AccessRequestResult = { ok: true } | { ok: false; message: string }

export async function sendAccessRequest(
  input: AccessRequestInput,
): Promise<AccessRequestResult> {
  let response: Response
  try {
    response = await fetch('/api/v1/business/request-access', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    })
  } catch {
    return {
      ok: false,
      message: 'Võrguühendus ei ole saadaval. Proovi uuesti.',
    }
  }

  if (!response.ok) {
    let message = 'Juurdepääsutaotluse saatmine ei õnnestunud. Proovi uuesti.'
    try {
      const body = (await response.json()) as { error?: unknown }
      if (typeof body.error === 'string') {
        message = body.error
      }
    } catch {
      // Keep the fallback copy.
    }
    return { ok: false, message }
  }

  return { ok: true }
}
