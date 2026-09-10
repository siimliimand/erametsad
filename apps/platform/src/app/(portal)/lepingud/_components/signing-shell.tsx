import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'

import { UserSubNav } from '../../user/_components/UserSubNav'

interface SigningShellProps {
  /** H1 of the flow ("Raamlepingu allkirjastamine" / demo "Lepingu allkirjastamine"). */
  title: string
  /** Demo .page-summary sentence under the H1. */
  summary: string
  children: ReactNode
}

/**
 * Full-page chrome for the signing flows (demo 13): the mist page-head band
 * with the Minu keskkond / Lepingud crumbs, the user sub-nav strip, then the
 * 1040px contract wrap. The signing pages run inside the (portal) layout, so
 * the demo header/footer come from there; the negative margins cancel the
 * layout main padding for the full-bleed bands, mirroring the user pages.
 */
export function SigningShell({ title, summary, children }: SigningShellProps) {
  return (
    <div className="flex flex-col">
      <section
        aria-labelledby="signing-page-title"
        className="-mx-md -mt-lg bg-bgMist px-md pb-[28px] pt-[32px] md:-mx-lg md:px-lg md:pb-[40px] md:pt-[48px]"
      >
        <div className="mx-auto w-full max-w-container-xl">
          <nav
            aria-label="Asukoht"
            className="mb-3.5 flex items-center gap-2 text-bodySm text-inkMuted"
          >
            <Link
              href="/user/bids"
              className="transition-colors duration-hover hover:text-primary hover:underline motion-reduce:transition-none"
            >
              Minu keskkond
            </Link>
            <ChevronRight aria-hidden="true" size={11} className="shrink-0" />
            <Link
              href="/lepingud"
              className="transition-colors duration-hover hover:text-primary hover:underline motion-reduce:transition-none"
            >
              Lepingud
            </Link>
            <ChevronRight aria-hidden="true" size={11} className="shrink-0" />
            <span aria-current="page" className="font-semibold text-ink">
              {title}
            </span>
          </nav>
          <h1
            id="signing-page-title"
            className="mb-[10px] font-heading text-[34px] font-extrabold leading-[1.15] text-ink md:text-h1"
          >
            {title}
          </h1>
          <p className="max-w-[52em] font-body text-body text-inkMuted md:text-[18px]">{summary}</p>
        </div>
      </section>
      <UserSubNav />
      <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-5 pt-5">{children}</div>
    </div>
  )
}
