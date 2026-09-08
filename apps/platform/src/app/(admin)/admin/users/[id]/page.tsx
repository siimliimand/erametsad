import Link from 'next/link'
import { notFound } from 'next/navigation'

import { ErrorNotice } from '../../../_components/ErrorNotice'
import { PageHeader } from '../../../_components/PageHeader'
import { requireAdminRepositories } from '../../../_lib/admin'
import { userRoleLabels, userStatusLabels } from '../../../_lib/labels'
import { can } from '../../../_lib/permissions'
import { GdprTab } from '../_components/tabs/GdprTab'
import { UserTabPanel } from '../_components/tabs/UserTabPanel'
import { fetchUserTabPayload } from '../_components/tabs/userTabQueries'
import { userTabLabels } from '../_components/tabs/userTabs'
import type { UserTabId } from '../_components/tabs/userTabs'

import type { UserDoc } from '@/lib/data/repositories'

export const metadata = { title: 'Kasutaja' }

// The URL keeps the canonical five detail views plus GDPR; the drawer adds
// Teavitused on top of the same shared panels.
const PAGE_TAB_IDS = [
  'identiteet',
  'profiilid',
  'oigused',
  'lepingud',
  'pakkumised',
  'gdpr',
] as const satisfies readonly UserTabId[]

const TABS = PAGE_TAB_IDS.map((id) => ({ id, label: userTabLabels[id] }))

type TabId = (typeof PAGE_TAB_IDS)[number]

function parseTab(raw: string): TabId {
  const match = PAGE_TAB_IDS.find((tab) => tab === raw)
  return match ?? 'identiteet'
}

function DetailTabs({ userId, active }: { userId: string; active: TabId }) {
  return (
    <nav className="mb-md flex flex-wrap gap-xs border-b border-border pb-xs" aria-label="Kasutaja detaili vaated">
      {TABS.map((tab) => (
        <Link
          key={tab.id}
          href={`/admin/users/${userId}?tab=${tab.id}`}
          aria-current={tab.id === active ? 'page' : undefined}
          className={`rounded-pill px-3 py-1.5 text-label font-semibold transition-colors duration-hover ease-hover ${
            tab.id === active
              ? 'bg-primary text-ink-inverse'
              : 'text-ink-muted hover:bg-bg-mist hover:text-ink'
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  )
}

function SuccessNotice({ message }: { message: string }) {
  return (
    <div
      role="status"
      className="mb-md rounded-input border border-l-4 border-info bg-info-light px-md py-sm text-bodySm text-info"
    >
      {message}
    </div>
  )
}

function userStatusPillFor(user: UserDoc): string {
  return user.status === 'active' ? userStatusLabels.active : userStatusLabels.suspended
}

export default async function UserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ viga?: string; teade?: string; tab?: string }>
}) {
  const { id } = await params
  const { viga, teade, tab: rawTab } = await searchParams
  const tab = parseTab(rawTab ?? '')

  const { session, repositories } = await requireAdminRepositories()
  if (!can(session.role, 'users:read')) {
    return (
      <div>
        <PageHeader title="Kasutaja" backHref="/admin/users" />
        <ErrorNotice message="Ainult administraatorile." />
      </div>
    )
  }

  const user = await repositories.findByID({ collection: 'users', id })
  if (!user) notFound()

  const canWrite = can(session.role, 'users:write')

  // GDPR has no data payload; the tab renders its audited server actions.
  if (tab === 'gdpr') {
    return (
      <div>
        {viga ? <ErrorNotice message={viga} /> : null}
        {teade ? <SuccessNotice message={teade} /> : null}
        <PageHeader
          title={user.name ?? user.email}
          description={`Kasutaja haldus · roll ${userRoleLabels[user.role]} · olek ${userStatusPillFor(user)}`}
          backHref="/admin/users"
        />
        <DetailTabs userId={user.id} active={tab} />
        <GdprTab userId={user.id} canWrite={canWrite} />
      </div>
    )
  }

  const payload = await fetchUserTabPayload(repositories, id, tab)
  if (!payload) notFound()

  return (
    <div>
      {viga ? <ErrorNotice message={viga} /> : null}
      {teade ? <SuccessNotice message={teade} /> : null}
      <PageHeader
        title={user.name ?? user.email}
        description={`Kasutaja haldus · roll ${userRoleLabels[user.role]} · olek ${userStatusPillFor(user)}`}
        backHref="/admin/users"
      />
      <DetailTabs userId={user.id} active={tab} />

      <UserTabPanel payload={payload} canWrite={canWrite} />
    </div>
  )
}
