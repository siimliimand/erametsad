'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, type ComponentType, type SVGProps } from 'react'

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
    <Svg className="h-4 w-4 shrink-0" {...props}>
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </Svg>
  )
}

function GavelIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg className="h-4 w-4 shrink-0" {...props}>
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
    <Svg className="h-4 w-4 shrink-0" {...props}>
      <path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z" />
      <path d="M12 22V12" />
      <polyline points="3.29 7 12 12 20.71 7" />
      <path d="m7.5 4.27 9 5.15" />
    </Svg>
  )
}

function BellIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg className="h-4 w-4 shrink-0" {...props}>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </Svg>
  )
}

function UserIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg className="h-4 w-4 shrink-0" {...props}>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </Svg>
  )
}

function FileTextIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg className="h-4 w-4 shrink-0" {...props}>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
      <path d="M10 9H8" />
    </Svg>
  )
}

function ChevronsLeftIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg className="h-4 w-4 shrink-0" {...props}>
      <path d="m11 17-5-5 5-5" />
      <path d="m18 17-5-5 5-5" />
    </Svg>
  )
}

function ChevronsRightIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg className="h-4 w-4 shrink-0" {...props}>
      <path d="m6 17 5-5-5-5" />
      <path d="m13 17 5-5-5-5" />
    </Svg>
  )
}

interface SidebarItem {
  href: string
  label: string
  Icon: ComponentType<SVGProps<SVGSVGElement>>
}

const items: readonly SidebarItem[] = [
  { href: '/', label: 'Avaleht', Icon: HomeIcon },
  { href: '/user/bids', label: 'Pakkumised', Icon: GavelIcon },
  { href: '/user/objects', label: 'Müügid', Icon: PackageIcon },
  { href: '/user/notifications', label: 'Teavitused', Icon: BellIcon },
  { href: '/user/profile', label: 'Profiil', Icon: UserIcon },
  { href: '/lepingud', label: 'Lepingud', Icon: FileTextIcon },
]

function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)
}

export function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={`sticky top-md hidden shrink-0 flex-col rounded-card border border-border bg-bgPage transition-[width] duration-reveal ease-reveal md:flex ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      <nav
        aria-label="Minu keskkond"
        className="flex flex-1 flex-col gap-2xs p-2xs"
      >
        {items.map(({ href, label, Icon }) => {
          const active = isActive(pathname, href)
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center gap-xs rounded-button px-sm py-2 text-label font-semibold transition-colors duration-hover ease-hover ${
                collapsed ? 'justify-center' : ''
              } ${
                active
                  ? 'bg-primaryLight text-primaryDark'
                  : 'text-inkMuted hover:bg-bgMist hover:text-primary'
              }`}
            >
              <Icon />
              {!collapsed && <span className="truncate">{label}</span>}
            </Link>
          )
        })}
      </nav>
      <div className="border-t border-border p-2xs">
        <button
          type="button"
          onClick={() => {
            setCollapsed((value) => !value)
          }}
          aria-label={collapsed ? 'Laienda menüüd' : 'Ahenda menüüd'}
          className="flex w-full items-center justify-center gap-xs rounded-button px-sm py-2 text-label font-semibold text-inkMuted transition-colors duration-hover ease-hover hover:bg-bgMist hover:text-primary"
        >
          {collapsed ? <ChevronsRightIcon /> : <ChevronsLeftIcon />}
          {!collapsed && <span>Ahenda</span>}
        </button>
      </div>
    </aside>
  )
}
