import Link from 'next/link'

import { DataTable } from '../../_components/DataTable'
import { ErrorNotice } from '../../_components/ErrorNotice'
import { PageHeader } from '../../_components/PageHeader'
import { requireAdminRepositories } from '../../_lib/admin'
import { formatDateTime, LeadStatusPill, leadStatusLabels } from '../../_lib/labels'

import { leadStatuses } from '@/lib/data/schema'

export const metadata = { title: 'Juhtlõimed' }

interface LeadRow {
  id: string
  contactName: string
  formName: string
  phone: string | null
  email: string | null
  status: string
  createdAt: string
}

export default async function AdminLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ olek?: string; viga?: string }>
}) {
  const { olek, viga } = await searchParams
  const { repositories } = await requireAdminRepositories()

  const statusFilter = leadStatuses.includes(olek as (typeof leadStatuses)[number])
    ? (olek as (typeof leadStatuses)[number])
    : null

  const { docs: leads } = await repositories.find({
    collection: 'leads',
    ...(statusFilter ? { where: { status: { equals: statusFilter } } } : {}),
    sort: '-createdAt',
    limit: 50,
  })

  const rows: LeadRow[] = leads.map((lead) => ({
    id: lead.id,
    contactName: lead.contactName,
    formName: lead.formName,
    phone: lead.phone,
    email: lead.email,
    status: lead.status,
    createdAt: lead.createdAt,
  }))

  const filterClass = (active: boolean) =>
    `rounded-pill px-3 py-1 text-label font-semibold transition-colors duration-hover ease-hover ${
      active
        ? 'bg-primaryLight text-primaryDark'
        : 'border border-border bg-bgPage text-ink-muted hover:text-primary'
    }`

  return (
    <div>
      {viga ? <ErrorNotice message={viga} /> : null}
      <PageHeader
        title="Juhtlõimed"
        description="Sissetulekud vormidelt koos kontaktide ja olekuga."
        actions={
          <Link
            href="/admin/leads/requests"
            className="inline-flex h-10 items-center rounded-button border border-border bg-bgPage px-4 text-label font-semibold text-ink transition-colors duration-hover ease-hover hover:border-primary hover:text-primary"
          >
            Ettevõtte taotlused
          </Link>
        }
      />
      <div className="mb-sm flex flex-wrap items-center gap-xs">
        <Link href="/admin/leads" className={filterClass(statusFilter === null)}>
          Kõik
        </Link>
        {leadStatuses.map((status) => (
          <Link
            key={status}
            href={`/admin/leads?olek=${status}`}
            className={filterClass(statusFilter === status)}
          >
            {leadStatusLabels[status]}
          </Link>
        ))}
      </div>
      <DataTable
        columns={[
          { key: 'contactName', label: 'Kontakt' },
          { key: 'formName', label: 'Vorm' },
          { key: 'phone', label: 'Telefon' },
          { key: 'email', label: 'E-post' },
          { key: 'status', label: 'Olek', render: (row) => <LeadStatusPill status={row.status as (typeof leadStatuses)[number]} /> },
          { key: 'createdAt', label: 'Loodud', render: (row) => formatDateTime(row.createdAt) },
          {
            key: 'actions',
            label: 'Tegevused',
            render: (row) => (
              <Link
                href={`/admin/leads/${row.id}`}
                className="text-label font-semibold text-primary transition-colors duration-hover ease-hover hover:text-primaryHover"
              >
                Vaata
              </Link>
            ),
          },
        ]}
        rows={rows}
        emptyLabel="Juhtlõike ei ole."
      />
    </div>
  )
}
