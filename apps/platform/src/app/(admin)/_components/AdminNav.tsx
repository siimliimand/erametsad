'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ComponentType, SVGProps } from 'react'

import {
  BuildingIcon,
  ChartColumnIcon,
  DashboardIcon,
  FileTextIcon,
  GavelIcon,
  LockIcon,
  MessageSquareIcon,
  NewspaperIcon,
  ScrollTextIcon,
  SettingsIcon,
  TargetIcon,
  TrendingUpIcon,
  UsersIcon,
} from './icons'
import type { AdminModuleDefinition, AdminModuleId } from '../_lib/permissions'

const moduleIcons: Record<AdminModuleId, ComponentType<SVGProps<SVGSVGElement>>> = {
  workspace: DashboardIcon,
  auctions: GavelIcon,
  bids: TrendingUpIcon,
  'sealed-opening': LockIcon,
  users: UsersIcon,
  companies: BuildingIcon,
  contracts: FileTextIcon,
  leads: TargetIcon,
  inquiries: MessageSquareIcon,
  content: NewspaperIcon,
  statistics: ChartColumnIcon,
  settings: SettingsIcon,
  'audit-log': ScrollTextIcon,
}

function isActive(pathname: string, href: string): boolean {
  return href === '/admin' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)
}

/**
 * Renders the role-gated module list from `visibleModules(session.role)`.
 * Vertical = icon-only 56px sidebar links with hover/focus tooltips;
 * horizontal = labeled pills for the mobile header.
 */
export function AdminNav({
  modules,
  orientation = 'vertical',
}: {
  modules: readonly AdminModuleDefinition[]
  orientation?: 'vertical' | 'horizontal'
}) {
  const pathname = usePathname()

  if (orientation === 'horizontal') {
    return (
      <nav aria-label="Halduse peamenüü" className="flex items-center gap-xs overflow-x-auto">
        {modules.map((module) => {
          const active = isActive(pathname, module.href)
          return (
            <Link
              key={module.id}
              href={module.href}
              aria-current={active ? 'page' : undefined}
              className={`whitespace-nowrap rounded-pill px-3 py-1 text-label font-semibold transition-colors duration-hover ease-hover ${
                active ? 'bg-primaryLight text-primaryDark' : 'text-inkMuted hover:text-primary'
              }`}
            >
              {module.label}
            </Link>
          )
        })}
      </nav>
    )
  }

  return (
    <nav aria-label="Halduse peamenüü" className="flex w-full flex-col items-center gap-1 py-md">
      {modules.map((module) => {
        const Icon = moduleIcons[module.id]
        const active = isActive(pathname, module.href)
        return (
          <Link
            key={module.id}
            href={module.href}
            aria-label={module.label}
            aria-current={active ? 'page' : undefined}
            className={`group relative flex h-10 w-10 items-center justify-center rounded-button transition-colors duration-hover ease-hover ${
              active
                ? 'bg-white/15 text-inkInverse'
                : 'text-inkInverse opacity-70 hover:bg-white/10 hover:opacity-100'
            }`}
          >
            <span
              aria-hidden="true"
              className={`absolute -left-2 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-pill transition-colors duration-hover ${
                active ? 'bg-inkInverse' : 'bg-transparent'
              }`}
            />
            <Icon className="h-5 w-5 shrink-0" />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-full z-20 ml-2 whitespace-nowrap rounded-button bg-ink px-2 py-1 text-label font-semibold text-inkInverse opacity-0 shadow-card transition-opacity duration-hover ease-hover group-focus-within:opacity-100 group-hover:opacity-100"
            >
              {module.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
