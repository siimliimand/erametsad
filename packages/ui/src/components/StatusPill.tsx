'use client'

const STATUS_MAP = {
  active: { label: 'Aktiivne', color: 'status-active' },
  endingSoon: { label: 'Lõppemas', color: 'status-ending-soon' },
  critical: { label: 'Kriitiline', color: 'status-critical' },
  ended: { label: 'Lõppenud', color: 'status-ended' },
  draft: { label: 'Mustand', color: 'status-draft' },
  scheduled: { label: 'Plaanitud', color: 'status-scheduled' },
} as const

type StatusKey = keyof typeof STATUS_MAP

interface StatusPillProps {
  status: StatusKey
  size?: 'sm' | 'md'
}

const sizeClasses = {
  sm: 'px-1.5 py-0.5 text-[11px]',
  md: 'px-2 py-0.5 text-xs',
} as const

export function StatusPill({ status, size = 'md' }: StatusPillProps) {
  const { label, color } = STATUS_MAP[status]
  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${sizeClasses[size]} bg-${color}/10 text-${color}`}
    >
      {label}
    </span>
  )
}