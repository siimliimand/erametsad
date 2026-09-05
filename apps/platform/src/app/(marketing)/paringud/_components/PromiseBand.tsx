import type { ReactNode } from 'react'

export interface PromiseBandProps {
  message?: string
  /** Extra links (e.g. FAQ links from the page content columns). */
  children?: ReactNode
}

export function PromiseBand({
  message = 'Pakkujad vastavad 7 päeva jooksul. Päringu esitamine on tasuta ega sidu sind.',
  children,
}: PromiseBandProps) {
  return (
    <section className="bg-bgMist">
      <div className="mx-auto flex max-w-container-xl flex-col gap-xs px-md py-md md:flex-row md:items-center md:justify-between md:px-lg">
        <p className="text-body font-semibold text-primaryDark">{message}</p>
        {children ? (
          <div className="flex flex-wrap items-center gap-md text-bodySm">{children}</div>
        ) : null}
      </div>
    </section>
  )
}
