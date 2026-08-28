import type { ReactNode } from 'react'

import { secondaryButtonClass } from './FormField'

export interface PageHeaderProps {
  title: string
  description?: string
  backHref?: string
  actions?: ReactNode
}

export function PageHeader({ title, description, backHref, actions }: PageHeaderProps) {
  return (
    <header className="mb-md flex flex-wrap items-start justify-between gap-sm">
      <div className="min-w-0">
        {backHref ? (
          <a href={backHref} className={`${secondaryButtonClass} mb-xs h-8 px-3 text-label`}>
            Tagasi
          </a>
        ) : null}
        <h1 className="font-heading text-h3 font-bold text-ink">{title}</h1>
        {description ? <p className="mt-xs text-bodySm text-ink-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-sm">{actions}</div> : null}
    </header>
  )
}
