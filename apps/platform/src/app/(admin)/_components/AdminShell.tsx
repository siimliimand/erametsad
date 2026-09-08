'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { useState } from 'react'

import { AdminNav, type AdminNavBadge } from './AdminNav'
import { NotificationBell, type BellNotification } from './NotificationBell'
import { TopbarSearch } from './TopbarSearch'
import { LogOutIcon } from './icons'
import { ToastProvider } from './ui/Toast'
import type { AdminModuleDefinition, AdminModuleId } from '../_lib/permissions'

import { logoutAction } from '@/app/(portal)/_actions/logout'

export interface AdminShellProps {
  /** Role-gated module list from `visibleModules(session.role)`. */
  modules: readonly AdminModuleDefinition[]
  roleLabel: string
  userName: string
  /** Non-production environment name; null hides the badge. */
  environmentLabel: string | null
  notifications: { unreadCount: number; items: BellNotification[] }
  /** Server-computed pending markers per module id (rail badges). */
  badges?: Partial<Record<AdminModuleId, AdminNavBadge>> | undefined
  children: ReactNode
}

function UserMenu({ roleLabel, userName }: { roleLabel: string; userName: string }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Kasutaja menüü"
        onClick={() => {
          setOpen((value) => !value)
        }}
        className="flex items-center gap-2xs rounded-pill border border-border bg-bgPage py-1 pl-1 pr-2 text-label font-semibold text-ink transition-colors duration-hover ease-hover hover:border-primary hover:text-primary"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-pill bg-primary text-inkInverse">
          {userName.charAt(0).toUpperCase()}
        </span>
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Kasutaja menüü"
          className="absolute right-0 top-full z-20 mt-2xs w-56 rounded-card border border-border bg-bgPage py-2xs shadow-modal"
        >
          <div className="px-sm py-xs">
            <p className="truncate text-bodySm font-semibold text-ink">{userName}</p>
            <p className="text-label text-inkMuted">{roleLabel}</p>
          </div>
          <div className="mt-2xs border-t border-border pt-2xs">
            <form action={logoutAction}>
              <button
                type="submit"
                className="flex w-full items-center gap-2xs px-sm py-xs text-left text-bodySm text-danger transition-colors duration-hover ease-hover hover:bg-dangerLight"
              >
                <LogOutIcon className="h-4 w-4 shrink-0" />
                Logi välja
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Admin chrome: 56px icon sidebar with tooltips and the active-state rail,
 * topbar with the environment badge, notification bell, and user menu.
 * Mobile keeps a horizontal labeled nav under the topbar. The shell owns
 * the ToastProvider so every admin screen shares one feedback layer.
 */
export function AdminShell({
  modules,
  roleLabel,
  userName,
  environmentLabel,
  notifications,
  badges,
  children,
}: AdminShellProps) {
  return (
    <ToastProvider>
      <div className="admin-scope flex min-h-screen flex-col bg-bgMist md:flex-row">
        <aside className="hidden w-14 shrink-0 flex-col items-center border-r border-border bg-bgPage text-ink md:flex">
          <Link
            href="/admin"
            aria-label="Erametsa halduspaneel"
            className="flex h-14 w-14 items-center justify-center"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-button bg-bgMist font-heading text-h4 font-extrabold text-primary">
              E
            </span>
          </Link>
          <AdminNav modules={modules} badges={badges} />
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-[var(--z-topbar)] flex h-16 items-center gap-sm border-b border-border bg-bgPage px-md">
            <p className="min-w-0 truncate font-heading text-[15px] leading-[20px] font-semibold text-ink">
              Erametsad haldus
            </p>
            {environmentLabel && (
              <span
                className={`shrink-0 whitespace-nowrap rounded-pill px-2.5 py-[3px] font-heading text-[11px] leading-[14px] font-bold uppercase tracking-[0.04em] ${
                  environmentLabel === 'Test'
                    ? 'bg-[var(--st-ended-bg)] text-[var(--st-ended-text)]'
                    : 'bg-dangerLight text-danger'
                }`}
              >
                {environmentLabel}
              </span>
            )}
            <TopbarSearch />
            <div className="ml-auto flex shrink-0 items-center gap-sm">
              <NotificationBell items={notifications.items} unreadCount={notifications.unreadCount} />
              <div className="hidden items-center gap-2xs md:flex">
                <span className="max-w-40 truncate text-label font-medium text-ink">{userName}</span>
                <span className="rounded-pill bg-primaryLight px-2 py-0.5 text-label font-semibold text-primary">
                  {roleLabel}
                </span>
              </div>
              <UserMenu roleLabel={roleLabel} userName={userName} />
            </div>
          </header>
          <div className="border-b border-border bg-bgPage px-md py-sm md:hidden">
            <AdminNav modules={modules} badges={badges} orientation="horizontal" />
          </div>
          <main className="mx-auto w-full max-w-container-xl flex-1 px-md py-lg md:px-lg">
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  )
}
