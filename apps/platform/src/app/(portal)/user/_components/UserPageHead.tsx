import { ChevronRight } from 'lucide-react'
import Link from 'next/link'

import { UserSubNav } from './UserSubNav'

interface UserPageHeadProps {
  /** H1 and the crumb label after "Minu keskkond /". */
  title: string
  /** Demo .page-summary sentence under the H1. */
  summary?: string
}

// Demo .page-head + .tabs-wrap (09-user-bids.html): full-bleed mist band with
// the Minu keskkond crumb, H1 and summary, then the white sub-nav strip. The
// negative margins cancel the (portal) layout main padding (px-md py-lg
// md:px-lg) so the band runs edge to edge, mirroring the listing page head.
// Pages pass their own title/summary; head renders above the tab row as in
// the demo, so user pages drop this one component at the top of their content.
export function UserPageHead({ title, summary }: UserPageHeadProps) {
  return (
    <>
      <section
        aria-labelledby="user-page-title"
        className="-mx-md -mt-lg bg-bgMist px-md pb-[28px] pt-[32px] md:-mx-lg md:px-lg md:pb-[40px] md:pt-[48px]"
      >
        <nav
          aria-label="Asukoht"
          className="mb-3.5 flex items-center gap-2 overflow-x-auto whitespace-nowrap text-bodySm text-inkMuted"
        >
          <Link
            href="/user/bids"
            className="transition-colors duration-hover hover:text-primary hover:underline motion-reduce:transition-none"
          >
            Minu keskkond
          </Link>
          <ChevronRight aria-hidden="true" size={11} className="shrink-0" />
          <span aria-current="page" className="font-semibold text-ink">
            {title}
          </span>
        </nav>
        <h1
          id="user-page-title"
          className="mb-[10px] font-heading text-[34px] font-extrabold leading-[1.15] text-ink md:text-h1"
        >
          {title}
        </h1>
        {summary !== undefined && (
          <p className="max-w-[52em] font-body text-body text-inkMuted md:text-[18px]">
            {summary}
          </p>
        )}
      </section>
      <UserSubNav />
    </>
  )
}
