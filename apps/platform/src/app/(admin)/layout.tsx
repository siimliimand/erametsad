import type { Metadata } from 'next'

import { AdminShell } from './_components/AdminShell'
import { requireAdminRepositories } from './_lib/admin'
import { userRoleLabels } from './_lib/labels'
import { visibleModules } from './_lib/permissions'

import { getRepositories } from '@/lib/data/runtime'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: {
    default: 'Haldus',
    template: '%s – Haldus',
  },
}

function environmentBadgeLabel(): string | null {
  if (process.env.NODE_ENV === 'development') return 'Arendus'
  if (process.env.NODE_ENV === 'test') return 'Test'
  return null
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { session, repositories } = await requireAdminRepositories()
  // users reads are admin-only at the guard level, so the operator's own
  // row for the user menu runs as system context scoped to the session id.
  const systemRepositories = await getRepositories()

  const [operator, unread] = await Promise.all([
    systemRepositories.findByID({ collection: 'users', id: session.userId }),
    repositories.find({
      collection: 'notifications',
      where: { userId: { equals: session.userId }, readAt: { exists: false } },
      sort: '-createdAt',
      pagination: false,
    }),
  ])

  const roleLabel = userRoleLabels[session.role]

  return (
    <AdminShell
      modules={visibleModules(session.role)}
      roleLabel={roleLabel}
      userName={operator?.name ?? operator?.email ?? roleLabel}
      environmentLabel={environmentBadgeLabel()}
      notifications={{
        unreadCount: unread.docs.length,
        items: unread.docs.slice(0, 5).map((doc) => ({
          id: doc.id,
          title: doc.title,
          createdAt: doc.createdAt,
        })),
      }}
    >
      {children}
    </AdminShell>
  )
}
