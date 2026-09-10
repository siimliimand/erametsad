import type { ReactNode } from 'react'

interface ProfileCardShellProps {
  labelledBy: string
  title: string
  subtitle?: string
  /** Aside content in the head row (for example the auth chip on Andmed). */
  aside?: ReactNode
  children: ReactNode
}

// Demo .profile-card + .card-head: one white card per section inside the
// 880px .profile-wrap column.
export function ProfileCardShell({
  labelledBy,
  title,
  subtitle,
  aside,
  children,
}: ProfileCardShellProps) {
  return (
    <article
      aria-labelledby={labelledBy}
      className="flex flex-col rounded-card border border-border bg-bgPage p-md shadow-card"
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-sm">
        <div className="min-w-0">
          <h2
            id={labelledBy}
            className="font-heading text-[22px] font-bold leading-tight text-ink"
          >
            {title}
          </h2>
          {subtitle !== undefined && (
            <p className="mt-1 text-bodySm text-inkMuted">{subtitle}</p>
          )}
        </div>
        {aside}
      </div>
      {children}
    </article>
  )
}
