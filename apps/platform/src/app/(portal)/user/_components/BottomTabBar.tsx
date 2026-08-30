'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ComponentType, SVGProps } from 'react'

// Inline Lucide-geometry icons (ISC); apps/platform does not declare
// lucide-react as a direct dependency, so the few icons the shell needs are
// vendored. Keep in sync with lucide-react when the dependency lands.
function Svg({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  )
}

function HomeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg className="h-5 w-5 shrink-0" {...props}>
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </Svg>
  )
}

function GavelIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg className="h-5 w-5 shrink-0" {...props}>
      <path d="m14 13-7.5 7.5c-.83.83-2.17.83-3 0 0 0 0 0 0 0a2.12 2.12 0 0 1 0-3L11 10" />
      <path d="m16 16 6-6" />
      <path d="m8 8 6-6" />
      <path d="m9 7 8 8" />
      <path d="m21 11-8-8" />
    </Svg>
  )
}

function PackageIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg className="h-5 w-5 shrink-0" {...props}>
      <path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z" />
      <path d="M12 22V12" />
      <polyline points="3.29 7 12 12 20.71 7" />
      <path d="m7.5 4.27 9 5.15" />
    </Svg>
  )
}

function BellIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg className="h-5 w-5 shrink-0" {...props}>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </Svg>
  )
}

function UserIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg className="h-5 w-5 shrink-0" {...props}>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </Svg>
  )
}

interface TabItem {
  href: string
  label: string
  Icon: ComponentType<SVGProps<SVGSVGElement>>
}

// Lepingud stays in the profile dropdown per the portal-shell spec.
const items: readonly TabItem[] = [
  { href: '/', label: 'Avaleht', Icon: HomeIcon },
  { href: '/user/bids', label: 'Pakkumised', Icon: GavelIcon },
  { href: '/user/objects', label: 'Müügid', Icon: PackageIcon },
  { href: '/user/notifications', label: 'Teavitused', Icon: BellIcon },
  { href: '/user/profile', label: 'Profiil', Icon: UserIcon },
]

function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)
}

export function BottomTabBar() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Minu keskkond"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bgPage shadow-card md:hidden"
    >
      <div className="mx-auto flex max-w-container-xl">
        {items.map(({ href, label, Icon }) => {
          const active = isActive(pathname, href)
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-1 flex-col items-center gap-2xs py-2xs text-label font-semibold transition-colors duration-hover ease-hover ${
                active ? 'text-primaryDark' : 'text-inkMuted hover:text-primary'
              }`}
            >
              <Icon />
              <span>{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
