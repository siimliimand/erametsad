import { formatDateTime, leadStatusLabels } from '@/app/(admin)/_lib/labels'
import type { Lead } from '@/lib/data/schema'

/**
 * Pure helpers for the leads CSV export route (task 5.3). The CSV uses a
 * semicolon delimiter because Estonian Excel treats the comma as the decimal
 * separator, and a UTF-8 BOM so Estonian labels open correctly. Contact data
 * (name, phone, email) is blanked for leads whose latest consent decision has
 * marketing === false; non-contact fields stay. Isikukood is never exported —
 * the leads collection does not even carry one.
 */

export interface ConsentEntryLike {
  ipHash: string | null
  categories: unknown
  createdAt: string
}

/**
 * Latest consent decision per IP hash wins (the log is append-only).
 * Returns ipHash -> withdrawal timestamp, only for hashes whose latest
 * decision has categories.marketing === false. Mirrors the lead detail
 * page's derivation.
 */
export function resolveConsentWithdrawnAt(
  entries: readonly ConsentEntryLike[],
): ReadonlyMap<string, string> {
  const latestByIpHash = new Map<string, ConsentEntryLike>()
  for (const entry of entries) {
    if (!entry.ipHash) continue
    const latest = latestByIpHash.get(entry.ipHash)
    if (!latest || entry.createdAt > latest.createdAt) {
      latestByIpHash.set(entry.ipHash, entry)
    }
  }

  const withdrawnAtByIpHash = new Map<string, string>()
  for (const [ipHash, entry] of latestByIpHash) {
    const categories = entry.categories as { marketing?: unknown } | null
    if (categories?.marketing === false) {
      withdrawnAtByIpHash.set(ipHash, entry.createdAt)
    }
  }
  return withdrawnAtByIpHash
}

export interface LeadExportContext {
  consentWithdrawnAtByIpHash: ReadonlyMap<string, string>
  specialistNames: ReadonlyMap<string, string>
  nextActionAtByLeadId: ReadonlyMap<string, string>
  noteCountsByLeadId: ReadonlyMap<string, number>
}

export interface LeadExportRow {
  id: string
  createdAt: string
  contactName: string
  phone: string
  email: string
  cadastr: string
  source: string
  status: string
  specialist: string
  consent: string
  nextAction: string
  noteCount: string
}

export const LEAD_CSV_HEADERS = [
  'ID',
  'Loodud',
  'Nimi',
  'Telefon',
  'E-post',
  'Katastrid',
  'Allikas',
  'Olek',
  'Spetsialist',
  'Nõusolek',
  'Järgmine tegevus',
  'Märkmeid',
] as const

const CSV_DELIMITER = ';'
const CSV_BOM = '\uFEFF'
const CSV_ROW_SEPARATOR = '\r\n'

function formatCsvField(value: string): string {
  return /[";\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value
}

export function buildLeadExportRows(
  leads: readonly Lead[],
  context: LeadExportContext,
): LeadExportRow[] {
  return leads.map((lead) => {
    const withdrawnAt = lead.ipHash
      ? context.consentWithdrawnAtByIpHash.get(lead.ipHash)
      : undefined
    return {
      id: lead.id,
      createdAt: formatDateTime(lead.createdAt),
      // Contact fields go blank once marketing consent is withdrawn.
      contactName: withdrawnAt ? '' : lead.contactName,
      phone: withdrawnAt ? '' : (lead.phone ?? ''),
      email: withdrawnAt ? '' : (lead.email ?? ''),
      cadastr: lead.cadastr ?? '',
      source: `${lead.formName}${lead.pageSlug ? ` · ${lead.pageSlug}` : ''}`,
      status: leadStatusLabels[lead.status],
      specialist: lead.assignedSpecialistId
        ? (context.specialistNames.get(lead.assignedSpecialistId) ?? '—')
        : 'määramata',
      consent: withdrawnAt
        ? `tagasi võetud ${formatDateTime(withdrawnAt)}`
        : formatDateTime(lead.consentAt),
      nextAction: context.nextActionAtByLeadId.get(lead.id) ?? '',
      noteCount: String(context.noteCountsByLeadId.get(lead.id) ?? 0),
    }
  })
}

export function buildLeadsCsv(rows: readonly LeadExportRow[]): string {
  const lines = [
    LEAD_CSV_HEADERS.join(CSV_DELIMITER),
    ...rows.map((row) =>
      [
        row.id,
        row.createdAt,
        row.contactName,
        row.phone,
        row.email,
        row.cadastr,
        row.source,
        row.status,
        row.specialist,
        row.consent,
        row.nextAction,
        row.noteCount,
      ]
        .map(formatCsvField)
        .join(CSV_DELIMITER),
    ),
  ]
  return `${CSV_BOM}${lines.join(CSV_ROW_SEPARATOR)}${CSV_ROW_SEPARATOR}`
}

export function buildLeadsExportFilename(now: Date): string {
  return `juhtloimed-${now.toISOString().slice(0, 10)}.csv`
}
