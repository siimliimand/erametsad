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

export const contractTemplateTypeLabels: Record<ContractTemplateType, string> = {
  framework: 'Raamleping',
  auction: 'Oksjonileping',
}

export const leadStatusLabels: Record<LeadStatus, string> = {
  new: 'Uus',
  contacted: 'Ühenduses',
  qualified: 'Kvalifitseeritud',
  contract: 'Leping',
  disqualified: 'Diskvalifitseeritud',
}

export const companyAccessRequestStatusLabels: Record<CompanyAccessRequestStatus, string> = {
  pending: 'Ootel',
  approved: 'Nõustutud',
  rejected: 'Keeldutud',
  held: 'Hoitud',
}

const statusPillClass: Record<AuctionStatus, string> = {
  draft: 'bg-bg-mist text-ink-muted',
  scheduled: 'bg-info-light text-info',
  active: 'bg-primary-light text-primaryDark',
  ended: 'bg-bg-mist text-ink-muted',
  appraised: 'bg-info-light text-info',
  unsold: 'bg-danger-light text-danger',
  contract: 'bg-primary-light text-primaryDark',
  completed: 'bg-primary-light text-primaryDark',
  archived: 'bg-bg-mist text-ink-muted',
}

export function StatusPill({ status }: { status: AuctionStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-pill px-2 py-0.5 text-label font-semibold ${statusPillClass[status]}`}
    >
      {auctionStatusLabels[status]}
    </span>
  )
}

export function UserStatusPill({ status }: { status: UserStatus }) {
  const className =
    status === 'active' ? 'bg-primary-light text-primaryDark' : 'bg-danger-light text-danger'
  return (
    <span className={`inline-flex items-center rounded-pill px-2 py-0.5 text-label font-semibold ${className}`}>
      {userStatusLabels[status]}
    </span>
  )
}

export function ContentStatusPill({ status }: { status: ContentStatus }) {
  const className =
    status === 'published' ? 'bg-primary-light text-primaryDark' : 'bg-bg-mist text-ink-muted'
  return (
    <span className={`inline-flex items-center rounded-pill px-2 py-0.5 text-label font-semibold ${className}`}>
      {contentStatusLabels[status]}
    </span>
  )
}

export function ContractStatusPill({ status }: { status: ContractStatus }) {
  const className =
    status === 'signed'
      ? 'bg-primary-light text-primaryDark'
      : status === 'voided'
        ? 'bg-danger-light text-danger'
        : status === 'sent'
          ? 'bg-info-light text-info'
          : 'bg-bg-mist text-ink-muted'
  return (
    <span className={`inline-flex items-center rounded-pill px-2 py-0.5 text-label font-semibold ${className}`}>
      {contractStatusLabels[status]}
    </span>
  )
}

export function LeadStatusPill({ status }: { status: LeadStatus }) {
  const className =
    status === 'disqualified'
      ? 'bg-danger-light text-danger'
      : status === 'new' || status === 'contract'
        ? 'bg-primary-light text-primaryDark'
        : 'bg-info-light text-info'
  return (
    <span className={`inline-flex items-center rounded-pill px-2 py-0.5 text-label font-semibold ${className}`}>
      {leadStatusLabels[status]}
    </span>
  )
}

export function CompanyAccessRequestStatusPill({
  status,
}: {
  status: CompanyAccessRequestStatus
}) {
  const className =
    status === 'approved'
      ? 'bg-primary-light text-primaryDark'
      : status === 'rejected'
        ? 'bg-danger-light text-danger'
        : status === 'held'
          ? 'bg-bg-mist text-ink-muted'
          : 'bg-info-light text-info'
  return (
    <span className={`inline-flex items-center rounded-pill px-2 py-0.5 text-label font-semibold ${className}`}>
      {companyAccessRequestStatusLabels[status]}
    </span>
  )
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

export function formatEur(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '—'
  return (cents / 100).toLocaleString('et-EE', { style: 'currency', currency: 'EUR' })
}

export function formatEurAmount(euros: number | null | undefined): string {
  if (euros === null || euros === undefined) return '—'
  return euros.toLocaleString('et-EE', { style: 'currency', currency: 'EUR' })
}

/** Relative time in Estonian; `now` is injectable so client tickers stay live. */
export function formatRelativeTime(value: string, now: number = Date.now()): string {
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
