'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { useState } from 'react'

import { AdminNav } from './AdminNav'
import { NotificationBell, type BellNotification } from './NotificationBell'
import { LogOutIcon } from './icons'
import type { AdminModuleDefinition } from '../_lib/permissions'

import { logoutAction } from '@/app/(portal)/_actions/logout'

export interface AdminShellProps {
  /** Role-gated module list from `visibleModules(session.role)`. */
  modules: readonly AdminModuleDefinition[]
  roleLabel: string
  userName: string
  /** Non-production environment name; null hides the badge. */
  environmentLabel: string | null
  notifications: { unreadCount: number; items: BellNotification[] }
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
        <span className="hidden max-w-32 truncate md:inline">{userName}</span>
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
 * Mobile keeps a horizontal labeled nav under the topbar.
 */
export function AdminShell({
  modules,
  roleLabel,
  userName,
  environmentLabel,
  notifications,
  children,
}: AdminShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-bgMist md:flex-row">
      <aside className="hidden w-14 shrink-0 flex-col items-center bg-primaryDark text-inkInverse md:flex">
        <Link
          href="/admin"
          aria-label="Erametsa halduspaneel"
          className="flex h-14 w-14 items-center justify-center border-b border-white/10"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-button bg-white/10 font-heading text-h4 font-extrabold">
            E
          </span>
        </Link>
        <AdminNav modules={modules} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-sm border-b border-border bg-bgPage px-md py-2xs md:py-sm">
          <p className="font-heading text-h4 font-extrabold text-primaryDark md:hidden">Haldus</p>
          {environmentLabel && (
            <span className="rounded-pill bg-infoLight px-2 py-0.5 text-label font-semibold uppercase text-info">
              {environmentLabel}
            </span>
          )}
          <div className="ml-auto flex items-center gap-sm">
            <NotificationBell items={notifications.items} unreadCount={notifications.unreadCount} />
            <UserMenu roleLabel={roleLabel} userName={userName} />
          </div>
        </header>
        <div className="border-b border-border bg-bgPage px-md py-sm md:hidden">
          <AdminNav modules={modules} orientation="horizontal" />
        </div>
        <main className="mx-auto w-full max-w-container-xl flex-1 px-md py-lg md:px-lg">
          {children}
        </main>
      </div>
    </div>
  )
}
