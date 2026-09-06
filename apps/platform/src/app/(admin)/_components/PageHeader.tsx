import type { ReactNode } from 'react'

import { secondaryButtonClass } from './FormField'

export interface PageHeaderProps {
  title: string
  breadcrumb?: ReactNode
  description?: string
  backHref?: string
  actions?: ReactNode
}

export function PageHeader({ title, breadcrumb, description, backHref, actions }: PageHeaderProps) {
  return (
    <header className="mb-md flex flex-wrap items-end justify-between gap-sm">
      <div className="min-w-0">
        {backHref ? (
          <a href={backHref} className={`${secondaryButtonClass} mb-xs h-8 px-3 text-label`}>
            Tagasi
          </a>
        ) : null}
        {breadcrumb ? (
          <nav aria-label="Asukoht" className="mb-1.5 flex items-center gap-1.5 text-label font-medium text-inkMuted">
            {breadcrumb}
          </nav>
        ) : null}
        <h1 className="font-heading text-[28px] font-bold leading-[34px] text-ink">{title}</h1>
        {description ? <p className="mt-xs text-bodySm text-inkMuted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-sm">{actions}</div> : null}
    </header>
  )
}
