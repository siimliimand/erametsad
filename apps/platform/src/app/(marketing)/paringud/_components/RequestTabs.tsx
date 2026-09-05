'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { SERVICES } from './ServiceCards'

import { track } from '@/lib/analytics/track'

// Design specs 10-12 fix the visible tab order: kava, istutamine, hooldusraie.
const TAB_ORDER = ['kava', 'istutamine', 'hooldusraie'] as const

const TABS: readonly { href: string; title: string }[] = TAB_ORDER.flatMap((type) => {
  const service = SERVICES.find((candidate) => candidate.type === type)
  return service ? [{ href: service.href, title: service.title }] : []
})

export function RequestTabs() {
  const pathname = usePathname()

  return (
    <nav aria-label="Teenuste päringud">
      <div className="flex gap-lg overflow-x-auto border-b border-border">
        {TABS.map(({ href, title }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              onClick={() => {
                if (!active) track('tab_switch', { to: href })
              }}
              className={`-mb-px whitespace-nowrap border-b-2 px-1 pb-3 pt-2 text-body transition-colors duration-hover ease-hover motion-reduce:transition-none ${
                active
                  ? 'border-primary font-semibold text-primary'
                  : 'border-transparent text-inkMuted hover:text-primary'
              }`}
            >
              {title}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
