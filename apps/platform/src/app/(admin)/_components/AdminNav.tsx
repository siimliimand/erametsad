'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ComponentType, ReactNode, SVGProps } from 'react'

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

/** Rail badge marker fed by server pending counts (demo .rail-flag). */
export interface AdminNavBadge {
  /** Amber attention dot (demo .dot is-amber). */
  dot?: boolean
  /** Urgent queue count rendered as a red pill (demo .num is-red). */
  count?: number
}

function isActive(pathname: string, href: string): boolean {
  return href === '/admin' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)
}

function badgeCountLabel(count: number): string {
  return count > 99 ? '99+' : String(count)
}

/** Screen-reader/tooltip phrase for a pending marker; empty when unmarked. */
function badgeAnnouncement(badge: AdminNavBadge | undefined): string {
  if (!badge) return ''
  if (badge.count !== undefined && badge.count > 0) return ` — ${badgeCountLabel(badge.count)} ootel`
  if (badge.dot) return ' — töötlemata ülesandeid'
  return ''
}

function RailBadge({ badge }: { badge: AdminNavBadge | undefined }): ReactNode {
  if (!badge) return null
  if (badge.count !== undefined && badge.count > 0) {
    return (
      <span
        aria-hidden="true"
        className="absolute right-[2px] top-[3px] z-[1] flex h-[14px] min-w-[14px] items-center justify-center rounded-pill border-2 border-bgPage bg-danger px-[3px] text-[9px] font-bold leading-none text-inkInverse"
      >
        {badgeCountLabel(badge.count)}
      </span>
    )
  }
  if (badge.dot) {
    return (
      <span
        aria-hidden="true"
        className="absolute right-[5px] top-[5px] z-[1] h-2 w-2 rounded-pill bg-cta"
      />
    )
  }
  return null
}

function InlineBadge({ badge }: { badge: AdminNavBadge | undefined }): ReactNode {
  if (!badge) return null
  if (badge.count !== undefined && badge.count > 0) {
    return (
      <span
        aria-hidden="true"
        className="ml-1 inline-flex h-[14px] min-w-[14px] shrink-0 items-center justify-center rounded-pill bg-danger px-1 text-[9px] font-bold leading-none text-inkInverse"
      >
        {badgeCountLabel(badge.count)}
      </span>
    )
  }
  if (badge.dot) {
    return <span aria-hidden="true" className="ml-1 inline-block h-2 w-2 shrink-0 rounded-pill bg-cta" />
  }
  return null
}

/**
 * Renders the role-gated module list from `visibleModules(session.role)`.
 * Vertical = icon-only 56px sidebar links with hover/focus tooltips;
 * horizontal = labeled pills for the mobile header. `badges` carries the
 * server-computed pending markers per module id.
 */
export function AdminNav({
  modules,
  badges,
  orientation = 'vertical',
}: {
  modules: readonly AdminModuleDefinition[]
  badges?: Partial<Record<AdminModuleId, AdminNavBadge>> | undefined
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
                active ? 'bg-[var(--tint-primary-strong)] text-primary' : 'text-inkMuted hover:bg-[var(--tint-primary)] hover:text-primary'
              }`}
            >
              {module.label}
              <InlineBadge badge={badges?.[module.id]} />
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
            aria-label={`${module.label}${badgeAnnouncement(badges?.[module.id])}`}
            aria-current={active ? 'page' : undefined}
            className={`group relative flex h-10 w-10 items-center justify-center rounded-button transition-colors duration-hover ease-hover ${
              active
                ? 'bg-[var(--tint-primary-strong)] text-primary'
                : 'text-inkMuted hover:bg-[var(--tint-primary)] hover:text-primary'
            }`}
          >
            <span
              aria-hidden="true"
              className={`absolute -left-2 top-1.5 bottom-1.5 h-auto w-[3px] rounded-r-[2px] transition-colors duration-hover ${
                active ? 'bg-primary' : 'bg-transparent'
              }`}
            />
            <Icon className="h-5 w-5 shrink-0" />
            <RailBadge badge={badges?.[module.id]} />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-full z-20 ml-2 whitespace-nowrap rounded-[6px] bg-ink px-2 py-1 text-label font-medium text-inkInverse opacity-0 shadow-card transition-opacity duration-hover ease-hover group-focus-within:opacity-100 group-hover:opacity-100"
            >
              {module.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
