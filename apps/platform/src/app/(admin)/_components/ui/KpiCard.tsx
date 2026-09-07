import Link from 'next/link'
import type { ReactNode } from 'react'

export interface KpiCardProps {
  label: string
  value: ReactNode
  sub?: ReactNode
  // Amber attention badge count next to the value (06 demo .kpi-alert).
  alert?: number
  danger?: boolean
  href?: string
}

const shellClass =
  'flex flex-col gap-0.5 rounded-card border border-border bg-bgPage p-md shadow-card transition-[border-color,box-shadow,transform] duration-hover ease-hover hover:-translate-y-px hover:border-primary hover:shadow-card-hover'

// KPI strip card (01/06 demo .kpi-card): label, mono tabular value, optional
// attention badge, sub line; renders as a link when href is given.
export function KpiCard({ label, value, sub, alert, danger, href }: KpiCardProps) {
  const body = (
    <>
      <span className="text-label font-medium text-inkMuted">{label}</span>
      <span
        className={`flex items-center gap-2 font-mono text-count font-bold tracking-[-0.01em] tabular-nums ${
          danger ? 'text-danger' : 'text-ink'
        }`}
      >
        {value}
        {alert === undefined ? null : (
          <span className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-pill bg-cta font-body text-[12px] font-bold leading-none text-ink">
            {alert}
          </span>
        )}
      </span>
      {sub === undefined ? null : <span className="text-label text-inkMuted">{sub}</span>}
    </>
  )
  if (href) {
    return (
      <Link href={href} className={`${shellClass} text-inherit no-underline`}>
        {body}
      </Link>
    )
  }
  return <div className={shellClass}>{body}</div>
}
