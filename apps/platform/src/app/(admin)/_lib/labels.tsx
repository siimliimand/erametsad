import { StatusChip } from '../_components/StatusChip'
import type { StatusChipVariant } from '../_components/StatusChip'

import type {
  AuctionObjectType,
  AuctionStatus,
  AuthMethod,
  BidSource,
  BidStatus,
  CompanyAccessRequestStatus,
  ContractStatus,
  ContractTemplateType,
  ContentStatus,
  LeadStatus,
  LegalDocumentType,
  RedirectType,
  UserStatus,
  UserRole,
} from '@/lib/data/schema'

export const auctionStatusLabels: Record<AuctionStatus, string> = {
  draft: 'Mustand',
  scheduled: 'Ajastatud',
  active: 'Aktiivne',
  ended: 'Lõppenud',
  appraised: 'Hinnatud',
  unsold: 'Müümata',
  contract: 'Leping',
  completed: 'Teostatud',
  archived: 'Arhiivis',
}

export const auctionObjectTypeLabels: Record<AuctionObjectType, string> = {
  raieoigus: 'Raieõigus',
  kinnistu: 'Kinnistu',
  kiire: 'Kiire oksjon',
  pakett: 'Pakett',
}

export const auctionTypeLabels: Record<'open' | 'sealed', string> = {
  open: 'Avatud',
  sealed: 'Suletud',
}

export const bidStatusLabels: Record<BidStatus, string> = {
  leading: 'Juhtiv',
  outbid: 'Üle pakutud',
  won: 'Võitnud',
  lost: 'Kaotanud',
  pending_approval: 'Kinnitamisel',
  rejected: 'Tagasi lükatud',
}

export const bidSourceLabels: Record<BidSource, string> = {
  manual: 'Käsitsi',
  autobidder: 'Automaatpakkuja',
}

export const userRoleLabels: Record<UserRole, string> = {
  guest: 'Külaline',
  private: 'Eraisik',
  company: 'Ettevõte',
  seller: 'Müüja',
  specialist: 'Spetsialist',
  admin: 'Administraator',
  superadmin: 'Peakasutaja',
}

export const userStatusLabels: Record<UserStatus, string> = {
  active: 'Aktiivne',
  suspended: 'Peatatud',
}

export const authMethodLabels: Record<AuthMethod, string> = {
  eid: 'eID',
  password: 'Parool',
}

export const contentStatusLabels: Record<ContentStatus, string> = {
  draft: 'Mustand',
  published: 'Avaldatud',
}

export const legalDocumentTypeLabels: Record<LegalDocumentType, string> = {
  terms: 'Kasutustingimused',
  privacy: 'Privaatsuspoliitika',
  cookies: 'Küpsiste poliitika',
  contract: 'Leping',
}

export const redirectTypeLabels: Record<RedirectType, string> = {
  '301': 'Püsiv (301)',
  '302': 'Ajutine (302)',
}

export const contractStatusLabels: Record<ContractStatus, string> = {
  prepared: 'Koostatud',
  sent: 'Saadetud',
  signed: 'Allkirjastatud',
  voided: 'Tühistatud',
}

export const contractTemplateTypeLabels: Record<ContractTemplateType, string> =
  {
    framework: 'Raamleping',
    auction: 'Oksjonileping',
  }

export const leadStatusLabels: Record<LeadStatus, string> = {
  new: 'Uus',
  contacted: 'Võetud ühendust',
  qualified: 'Kvalifitseeritud',
  contract: 'Leping',
  disqualified: 'Mittekvalifitseeritud',
}

export const companyAccessRequestStatusLabels: Record<
  CompanyAccessRequestStatus,
  string
> = {
  pending: 'Ootel',
  approved: 'Nõustutud',
  rejected: 'Keeldutud',
  held: 'Hoitud',
}

/** Single lookup table for every StatusChip variant (spec admin-ui). */
export const statusChipLabels: Record<StatusChipVariant, string> = {
  ...auctionStatusLabels,
  ending: 'Lõpeb',
  'user:active': userStatusLabels.active,
  'user:suspended': userStatusLabels.suspended,
  'user:banned': 'Keelatud',
  'contract:prepared': contractStatusLabels.prepared,
  'contract:sent': contractStatusLabels.sent,
  'contract:signed': contractStatusLabels.signed,
  'contract:voided': contractStatusLabels.voided,
  'lead:new': leadStatusLabels.new,
  'lead:contacted': leadStatusLabels.contacted,
  'lead:qualified': leadStatusLabels.qualified,
  'lead:contract': leadStatusLabels.contract,
  'lead:disqualified': leadStatusLabels.disqualified,
  'content:draft': contentStatusLabels.draft,
  'content:published': contentStatusLabels.published,
  'company:pending': companyAccessRequestStatusLabels.pending,
  'company:approved': companyAccessRequestStatusLabels.approved,
  'company:rejected': companyAccessRequestStatusLabels.rejected,
  'company:held': companyAccessRequestStatusLabels.held,
}

/**
 * Deprecated shim to the unified StatusChip. Kept only so out-of-scope
 * consumers keep compiling; tasks 4.2/10.1/10.3 migrate their own files.
 */
export { StatusChip as StatusPill } from '../_components/StatusChip'

/** Deprecated shim: use `<StatusChip status="user:…" />`. */
export function UserStatusPill({ status }: { status: UserStatus }) {
  return <StatusChip status={`user:${status}`} />
}

/** Deprecated shim: use `<StatusChip status="content:…" />`. */
export function ContentStatusPill({ status }: { status: ContentStatus }) {
  return <StatusChip status={`content:${status}`} />
}

/** Deprecated shim: use `<StatusChip status="contract:…" />`. */
export function ContractStatusPill({ status }: { status: ContractStatus }) {
  return <StatusChip status={`contract:${status}`} />
}

/** Deprecated shim: use `<StatusChip status="lead:…" />`. */
export function LeadStatusPill({ status }: { status: LeadStatus }) {
  return <StatusChip status={`lead:${status}`} />
}

/** Deprecated shim: use `<StatusChip status="company:…" />`. */
export function CompanyAccessRequestStatusPill({
  status,
}: {
  status: CompanyAccessRequestStatus
}) {
  return <StatusChip status={`company:${status}`} />
}

/** GDPR: admins see only the last four digits of a personal ID. */
export function maskIsikukood(value: string | null | undefined): string {
  if (!value) return '—'
  return value.length <= 4 ? '••••' : `••••••${value.slice(-4)}`
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('et-EE', { dateStyle: 'medium', timeStyle: 'short' })
}

/**
 * Audit viewer formatter (task 4.7): millisecond precision, always in
 * Europe/Tallinn regardless of the server's zone. Milliseconds are
 * zone-independent (an epoch remainder), so only the wall clock needs the
 * explicit timeZone.
 */
export function formatAuditDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const wallClock = new Intl.DateTimeFormat('et-EE', {
    timeZone: 'Europe/Tallinn',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date)
  return `${wallClock}.${String(date.getUTCMilliseconds()).padStart(3, '0')}`
}

export function formatEur(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '—'
  return (cents / 100).toLocaleString('et-EE', {
    style: 'currency',
    currency: 'EUR',
  })
}

export function formatEurAmount(euros: number | null | undefined): string {
  if (euros === null || euros === undefined) return '—'
  return euros.toLocaleString('et-EE', { style: 'currency', currency: 'EUR' })
}

/** Relative time in Estonian; `now` is injectable so client tickers stay live. */
export function formatRelativeTime(
  value: string,
  now: number = Date.now(),
): string {
  const time = new Date(value).getTime()
  if (Number.isNaN(time)) return value
  const seconds = Math.round((now - time) / 1000)
  if (seconds < 10) return 'just nüüd'
  if (seconds < 60) return pluralEt(seconds, 'sekund', 'sekundit')
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return pluralEt(minutes, 'minut', 'minutit')
  const hours = Math.round(minutes / 60)
  if (hours < 24) return pluralEt(hours, 'tund', 'tundi')
  const days = Math.round(hours / 24)
  return pluralEt(days, 'päev', 'päeva')
}

function pluralEt(count: number, singular: string, plural: string): string {
  return `${String(count)} ${count === 1 ? singular : plural} tagasi`
}
