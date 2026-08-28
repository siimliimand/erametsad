import type {
  AuctionObjectType,
  AuctionStatus,
  AuthMethod,
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
