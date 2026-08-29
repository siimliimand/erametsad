'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ComponentType, SVGProps } from 'react'

import {
  DashboardIcon,
  FileTextIcon,
  GavelIcon,
  NewspaperIcon,
  SettingsIcon,
  UsersIcon,
  WrenchIcon,
} from './icons'

export interface AdminNavItem {
  href: string
  label: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  soon?: boolean
}

// Screen groups follow (admin)/INVENTORY.md "Screen summary". Items marked
// `soon` ship in tasks 7.3-7.7; they stay visible but are not linked yet.
const items: readonly AdminNavItem[] = [
  { href: '/admin', label: 'Töölaud', icon: DashboardIcon },
  { href: '/admin/auctions', label: 'Oksjonid', icon: GavelIcon },
  { href: '/admin/users', label: 'Kasutajad', icon: UsersIcon },
  { href: '/admin/contracts', label: 'Lepingud', icon: FileTextIcon },
  { href: '/admin/content', label: 'Sisu', icon: NewspaperIcon },
  { href: '/admin/leads', label: 'Tegevused', icon: WrenchIcon },
  { href: '/admin/settings', label: 'Seaded', icon: SettingsIcon, soon: true },
]

function isActive(pathname: string, href: string): boolean {
  return href === '/admin' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)
}

export function AdminNav({ orientation = 'vertical' }: { orientation?: 'vertical' | 'horizontal' }) {
  const pathname = usePathname()
  if (orientation === 'horizontal') {
    return (
      <nav aria-label="Halduse peamenüü" className="flex items-center gap-xs overflow-x-auto">
        {items.map((item) =>
          item.soon ? (
            <span
              key={item.href}
              title="Varsti saadaval"
              className="whitespace-nowrap rounded-pill px-3 py-1 text-label font-semibold text-ink-muted opacity-60"
            >
              {item.label}
            </span>
          ) : (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(pathname, item.href) ? 'page' : undefined}
              className={`whitespace-nowrap rounded-pill px-3 py-1 text-label font-semibold transition-colors duration-hover ease-hover ${
                isActive(pathname, item.href)
                  ? 'bg-primaryLight text-primaryDark'
                  : 'text-ink-muted hover:text-primary'
              }`}
            >
              {item.label}
            </Link>
          ),
        )}
      </nav>
    )
  }
  return (
    <nav aria-label="Halduse peamenüü" className="flex flex-col gap-1 px-sm py-md">
      {items.map((item) => {
        const Icon = item.icon
        if (item.soon) {
          return (
            <span
              key={item.href}
              title="Varsti saadaval"
              className="flex items-center gap-xs rounded-button px-sm py-2 text-label font-semibold text-ink-inverse opacity-40"
            >
              <Icon />
              {item.label}
            </span>
          )
        }
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive(pathname, item.href) ? 'page' : undefined}
              className={`flex items-center gap-xs rounded-button px-sm py-2 text-label font-semibold transition-colors duration-hover ease-hover ${
                isActive(pathname, item.href)
                  ? 'bg-white/10 text-ink-inverse'
                  : 'text-ink-inverse opacity-70 hover:bg-white/5 hover:opacity-100'
              }`}
          >
            <Icon />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
