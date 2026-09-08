import type { Metadata } from 'next'

import './admin.css'

import type { AdminNavBadge } from './_components/AdminNav'
import { AdminShell } from './_components/AdminShell'
import { requireAdminRepositories } from './_lib/admin'
import { userRoleLabels } from './_lib/labels'
import { visibleModules } from './_lib/permissions'
import type { AdminModuleId } from './_lib/permissions'

import type { CoreRepositories, RepositorySlug } from '@/lib/data/repositories'
import type { WhereClause } from '@/lib/data/repositories/where'
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

// Pending-queue reads for the rail badges run as system context: badge
// counts are global operational signals and request-level guards would
// reject collections a staff role cannot list (e.g. rights-request has no
// user-context rule at all). Rendering stays gated by module visibility.
async function countWhere(
  repositories: CoreRepositories,
  collection: RepositorySlug,
  where: WhereClause,
): Promise<number> {
  const { docs } = await repositories.find({ collection, where, pagination: false })
  return docs.length
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { session, repositories } = await requireAdminRepositories()
  // users reads are admin-only at the guard level, so the operator's own
  // row for the user menu runs as system context scoped to the session id.
  const systemRepositories = await getRepositories()

  const visible = new Set(visibleModules(session.role).map((module) => module.id))
  const badgeTasks: Promise<[AdminModuleId, AdminNavBadge]>[] = []
  if (visible.has('companies')) {
    badgeTasks.push(
      countWhere(systemRepositories, 'company-access-request', { status: { equals: 'pending' } }).then(
        (count) => ['companies', { count }],
      ),
    )
  }
  if (visible.has('users')) {
    badgeTasks.push(
      countWhere(systemRepositories, 'rights-request', { status: { equals: 'pending' } }).then(
        (count) => ['users', { count }],
      ),
    )
  }
  if (visible.has('leads')) {
    badgeTasks.push(
      countWhere(systemRepositories, 'leads', { status: { equals: 'new' } }).then((count) => [
        'leads',
        { dot: count > 0 },
      ]),
    )
  }
  if (visible.has('inquiries')) {
    badgeTasks.push(
      countWhere(systemRepositories, 'service-requests', { status: { equals: 'new' } }).then((count) => [
        'inquiries',
        { dot: count > 0 },
      ]),
    )
  }
  if (visible.has('sealed-opening')) {
    // Sealed auctions whose end time passed and whose ceremony has not
    // advanced (the sealed-opening index queue).
    badgeTasks.push(
      countWhere(systemRepositories, 'auctions', {
        and: [{ type: { equals: 'sealed' } }, { status: { equals: 'ended' } }],
      }).then((count) => ['sealed-opening', { dot: count > 0 }]),
    )
  }

  const [operator, unread, badgeEntries] = await Promise.all([
    systemRepositories.findByID({ collection: 'users', id: session.userId }),
    repositories.find({
      collection: 'notifications',
      where: { userId: { equals: session.userId }, readAt: { exists: false } },
      sort: '-createdAt',
      pagination: false,
    }),
    Promise.all(badgeTasks),
  ])

  const badges = Object.fromEntries(badgeEntries) as Partial<Record<AdminModuleId, AdminNavBadge>>
  const roleLabel = userRoleLabels[session.role]

  return (
    <AdminShell
      modules={visibleModules(session.role)}
      roleLabel={roleLabel}
      userName={operator?.name ?? operator?.email ?? roleLabel}
      environmentLabel={environmentBadgeLabel()}
      badges={badges}
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
