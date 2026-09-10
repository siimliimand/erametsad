'use client'

// Class strings stay literal so Tailwind's scanner can see them; the six
// legacy entries keep the exact classes they always rendered with.
const STATUS_MAP = {
  active: { label: 'Aktiivne', className: 'bg-status-active/10 text-status-active' },
  endingSoon: { label: 'Lõppemas', className: 'bg-status-ending-soon/10 text-status-ending-soon' },
  critical: { label: 'Kriitiline', className: 'bg-status-critical/10 text-status-critical' },
  ended: { label: 'Lõppenud', className: 'bg-status-ended/10 text-status-ended' },
  draft: { label: 'Mustand', className: 'bg-status-draft/10 text-status-draft' },
  scheduled: { label: 'Plaanitud', className: 'bg-status-scheduled/10 text-status-scheduled' },
  sealedOpeningPending: { label: 'Ootel avamine', className: 'bg-info/10 text-info' },
  won: { label: 'Võitsid', className: 'bg-statusActive/10 text-statusActive' },
  lost: { label: 'Ei võitnud', className: 'bg-bgMist text-inkMuted' },
  unsold: { label: 'Müümata', className: 'bg-statusEndingSoon/10 text-statusEndingSoon' },
  unread: { label: 'Lugemata', className: 'bg-cta/10 text-ctaHover' },
  leading: { label: 'Juhtiv pakkumine', className: 'bg-statusActive/10 text-statusActive' },
} as const

export type StatusKey = keyof typeof STATUS_MAP

interface StatusPillProps {
  status: StatusKey
  size?: 'sm' | 'md'
}

const sizeClasses = {
  sm: 'px-1.5 py-0.5 text-[11px]',
  md: 'px-2 py-0.5 text-xs',
} as const

export function StatusPill({ status, size = 'md' }: StatusPillProps) {
  const { label, className } = STATUS_MAP[status]
  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${sizeClasses[size]} ${className}`}
    >
      {label}
    </span>
  )
}