import { lookupCompany } from '@/lib/company-lookup-fixtures'

/**
 * Registry panel model for company access requests (design 07). The live
 * Äriregister is stood in by `company-lookup-fixtures`; the panel derives
 * the fields the review UI needs deterministically from that fixture set.
 */
export interface RegistryBoardMember {
  name: string
  role: string
  /** Present when the registry payload carries personal codes (not in fixtures). */
  idCode?: string | undefined
}

export type RegistryEntryStatus = 'REGISTREERITUD' | 'KUSTUTATUD'

export interface RegistrySnapshot {
  /** null = the registry has no entry for the code; data is unverified. */
  status: RegistryEntryStatus | null
  legalName: string | null
  legalForm: string | null
  boardMembers: RegistryBoardMember[]
  /** When the lookup data was cached for this request. */
  fetchedAt: string | null
  verified: boolean
}

// Fixture-land stand-in for the registry's KUSTUTATUD flag: the shared
// fixture lib carries only active companies, so deleted entries are listed
// here to keep the hard-block path demonstrable without editing shared code.
const FIXTURE_DELETED_REG_CODES: ReadonlySet<string> = new Set(['45678901'])

const LEGAL_FORMS: readonly { suffix: string; form: string }[] = [
  { suffix: 'osaühing', form: 'Osaühing' },
  { suffix: 'oü', form: 'Osaühing' },
  { suffix: 'ou', form: 'Osaühing' },
  { suffix: 'aktsiaselts', form: 'Aktsiaselts' },
  { suffix: 'as', form: 'Aktsiaselts' },
  { suffix: 'mittetulundusühing', form: 'Mittetulundusühing' },
  { suffix: 'mtü', form: 'Mittetulundusühing' },
  { suffix: 'tulundusühistu', form: 'Tulundusühistu' },
  { suffix: 'ühistu', form: 'Tulundusühistu' },
  { suffix: 'sihtasutus', form: 'Sihtasutus' },
  { suffix: 'sa', form: 'Sihtasutus' },
]

export function deriveLegalForm(companyName: string | null | undefined): string | null {
  if (!companyName) return null
  const tokens = companyName.trim().toLowerCase().split(/\s+/)
  const last = tokens[tokens.length - 1]
  if (!last) return null
  const match = LEGAL_FORMS.find((entry) => entry.suffix === last)
  return match?.form ?? null
}

/**
 * Snapshot for one request. Lookup results are cached per request at
 * submission time, so `fetchedAt` is the moment the row was written; an
 * unknown reg code renders the manual-verification fallback (kinnitamata).
 */
export function resolveRegistrySnapshot(
  regCode: string,
  submittedName: string | null | undefined,
  fetchedAt: string | null,
): RegistrySnapshot {
  const deleted = FIXTURE_DELETED_REG_CODES.has(regCode)
  const fixture = lookupCompany(regCode)
  if (deleted || fixture) {
    const legalName = fixture?.name ?? submittedName ?? null
    return {
      status: deleted ? 'KUSTUTATUD' : 'REGISTREERITUD',
      legalName,
      legalForm: deriveLegalForm(legalName),
      boardMembers: (fixture?.boardMembers ?? []).map((member) => ({
        name: member.name,
        role: member.role,
      })),
      fetchedAt,
      verified: true,
    }
  }
  return {
    status: null,
    legalName: submittedName ?? null,
    legalForm: deriveLegalForm(submittedName),
    boardMembers: [],
    fetchedAt: null,
    verified: false,
  }
}

export interface BoardMembershipCheck {
  /** strong = isikukood match, weak = exact name match, none = no match. */
  level: 'strong' | 'weak' | 'none'
  matchedName: string | null
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function nameVariants(value: string): string[] {
  const flat = normalizeName(value)
  const parts = flat.split(' ')
  const first = parts[0]
  if (parts.length < 2 || !first) return [flat]
  return [flat, `${parts.slice(1).join(' ')} ${first}`]
}

/**
 * Board-member cross-check (design 07): strong when the registry payload
 * carries a personal code equal to the applicant's; weak on exact name
 * (marked "kinnita käsitsi" in the UI). Fixtures carry no codes, so the
 * weak path is the one exercised against seeded data.
 */
export function crossCheckBoardMembership(
  applicantName: string | null | undefined,
  applicantIsikukood: string | null | undefined,
  boardMembers: readonly RegistryBoardMember[],
): BoardMembershipCheck {
  if (!applicantName) return { level: 'none', matchedName: null }
  const nameSet = new Set(nameVariants(applicantName))
  for (const member of boardMembers) {
    if (
      member.idCode &&
      applicantIsikukood &&
      normalizeName(member.idCode) === normalizeName(applicantIsikukood)
    ) {
      return { level: 'strong', matchedName: member.name }
    }
  }
  for (const member of boardMembers) {
    if (nameVariants(member.name).some((variant) => nameSet.has(variant))) {
      return { level: 'weak', matchedName: member.name }
    }
  }
  return { level: 'none', matchedName: null }
}
