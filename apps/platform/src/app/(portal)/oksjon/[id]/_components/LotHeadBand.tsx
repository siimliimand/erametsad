import Link from 'next/link'
import type { ReactNode } from 'react'

import { DeadlineChip } from './DeadlineChip'

export interface LotHeadBandProps {
  title: string
  typeLabel: string
  typeHref: string
  /** Status pill and any extra badges (Kiiroksjon, sealed badge). */
  badges: ReactNode
  deadline: { endsAt: string; serverNow?: number } | null
}

// Demo mist lot-head band (docs/design/demo/portal/03-lot-detail-sealed.html
// .lot-head): crumbs, H1 with badge row, right-aligned "Tähtaeg" chip. The
// negative margins stretch the band over the portal layout's container
// padding so it reads as a full-bleed band.
export function LotHeadBand({
  title,
  typeLabel,
  typeHref,
  badges,
  deadline,
}: LotHeadBandProps) {
  return (
    <section
      aria-labelledby="lot-head-title"
      className="-mx-md -mt-lg mb-lg bg-bgMist px-md pb-xl pt-lg md:-mx-lg md:px-lg"
    >
      <nav aria-label="Jäljerida" className="mb-3.5">
        <ol className="m-0 flex list-none flex-wrap items-center gap-x-2 gap-y-1 p-0 text-bodySm">
          <li>
            <Link
              href="/"
              className="text-inkMuted no-underline transition-colors duration-hover hover:text-primary"
            >
              Oksjonid
            </Link>
          </li>
          <li aria-hidden="true" className="text-border">
            /
          </li>
          <li>
            <Link
              href={typeHref}
              className="text-inkMuted no-underline transition-colors duration-hover hover:text-primary"
            >
              {typeLabel}
            </Link>
          </li>
          <li aria-hidden="true" className="text-border">
            /
          </li>
          <li aria-current="page" className="font-semibold text-ink">
            {title}
          </li>
        </ol>
      </nav>
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          <h1
            id="lot-head-title"
            className="mb-3 break-words font-heading text-h1 font-extrabold leading-tight text-ink"
          >
            {title}
          </h1>
          <div className="flex flex-wrap items-center gap-2">{badges}</div>
        </div>
        {deadline !== null && (
          <DeadlineChip
            endsAt={deadline.endsAt}
            {...(deadline.serverNow !== undefined
              ? { serverNow: deadline.serverNow }
              : {})}
          />
        )}
      </div>
    </section>
  )
}
