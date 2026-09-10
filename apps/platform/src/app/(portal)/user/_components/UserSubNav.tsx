'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface UserTab {
  href: string
  label: string
}

// Demo .tabs: one pill row shared by every Minu keskkond page. Lepingud stays
// reachable from the header dropdown and the footer (design D9).
export const USER_TABS: readonly UserTab[] = [
  { href: '/user/bids', label: 'Pakkumised' },
  { href: '/user/objects', label: 'Objektid' },
  { href: '/user/notifications', label: 'Teavitused' },
  { href: '/user/profile', label: 'Profiil' },
]

// Same rule as the removed user-area Sidebar: exact match, or a child path.
export function isUserTabActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}

// Demo .tabs-wrap: white strip with a bottom border. Negative margins cancel
// the (portal) layout main padding (px-md md:px-lg) so the strip runs edge to
// edge under the mist page-head band, matching the demo page anatomy.
export function UserSubNav() {
  const pathname = usePathname()

  return (
    <div className="-mx-md border-b border-border bg-bgPage px-md md:-mx-lg md:px-lg">
      <nav
        aria-label="Minu keskkond"
        className="flex gap-2 overflow-x-auto py-4"
      >
        {USER_TABS.map(({ href, label }) => {
          const active = isUserTabActive(pathname, href)
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`inline-flex flex-none items-center whitespace-nowrap rounded-pill border px-4 py-[9px] text-[15px] font-semibold transition-colors duration-hover ease-hover motion-reduce:transition-none ${
                active
                  ? 'border-primary bg-primary text-inkInverse'
                  : 'border-border bg-bgPage text-ink hover:border-primary hover:text-primary'
              }`}
            >
              {label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
