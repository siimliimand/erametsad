import Link from 'next/link'
import type { ReactNode } from 'react'

// Demo .card shell for the workspace grid: head with title and an aside
// slot, body, optional right-aligned footer link.
export function WorkspaceCard({
  title,
  titleId,
  aside,
  children,
  footHref,
  footLabel,
}: {
  title: string
  titleId: string
  aside?: ReactNode
  children: ReactNode
  footHref?: string
  footLabel?: string
}) {
  return (
    <section
      aria-labelledby={titleId}
      className="flex min-w-0 flex-col overflow-hidden rounded-card border border-border bg-bgPage shadow-card"
    >
      <div className="flex items-center justify-between gap-sm border-b border-border px-5 py-3.5">
        <h2 id={titleId} className="m-0 font-heading text-h4 font-semibold text-ink">
          {title}
        </h2>
        {aside}
      </div>
      {children}
      {footHref !== undefined && footLabel !== undefined ? (
        <div className="mt-auto border-t border-border px-5 py-3 text-right">
          <Link
            href={footHref}
            className="text-bodySm font-semibold text-primary transition-colors duration-hover ease-hover hover:text-primaryHover hover:underline"
          >
            {footLabel}
          </Link>
        </div>
      ) : null}
    </section>
  )
}
