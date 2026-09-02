import type { Metadata } from 'next'

import { AdminNav } from './_components/AdminNav'
import { requireAdminRepositories } from './_lib/admin'
import { userRoleLabels } from './_lib/labels'

import type { UserRole } from '@/lib/data/schema'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: {
    default: 'Haldus',
    template: '%s – Haldus',
  },
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { session } = await requireAdminRepositories()
  const roleLabel =
    session.role in userRoleLabels ? userRoleLabels[session.role as UserRole] : session.role

  return (
    <div className="flex min-h-screen flex-col bg-bg-mist md:flex-row">
      <aside className="hidden w-sidebar shrink-0 flex-col bg-primaryDark text-ink-inverse md:flex">
        <div className="border-b border-white/10 px-md py-lg">
          <p className="font-heading text-h4 font-extrabold">Erametsad</p>
          <p className="text-label text-ink-inverse opacity-70">Halduspaneel</p>
        </div>
        <AdminNav />
        <div className="mt-auto border-t border-white/10 px-md py-md">
          <p className="text-label text-ink-inverse opacity-70">Sisse logitud: {roleLabel}</p>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-col gap-xs border-b border-border bg-bgPage px-md py-sm md:hidden">
          <p className="font-heading text-h4 font-extrabold text-primaryDark">Haldus</p>
          <AdminNav orientation="horizontal" />
        </header>
        <main className="mx-auto w-full max-w-container-xl flex-1 px-md py-lg md:px-lg">
          {children}
        </main>
      </div>
    </div>
  )
}
