import { setTemplateActiveAction } from '../../../_actions/contracts'
import { DataTable } from '../../../_components/DataTable'
import { ErrorNotice } from '../../../_components/ErrorNotice'
import { PageHeader } from '../../../_components/PageHeader'
import { requireAdminRepositories } from '../../../_lib/admin'
import {
  contractTemplateTypeLabels,
  formatDateTime,
} from '../../../_lib/labels'

import type { ContractTemplateType } from '@/lib/data/schema'

export const metadata = { title: 'Lepingu mallid' }

interface TemplateRow {
  id: string
  name: string
  type: string
  version: string
  active: boolean
  updatedAt: string
}

const smallButtonClass =
  'inline-flex h-8 items-center rounded-button border border-border bg-bgPage px-3 text-label font-semibold text-ink transition-colors duration-hover ease-hover hover:border-primary hover:text-primary'

export default async function ContractTemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ viga?: string }>
}) {
  const { viga } = await searchParams
  const { repositories } = await requireAdminRepositories()

  const { docs: templates } = await repositories.find({
    collection: 'contract-templates',
    sort: '-updatedAt',
    pagination: false,
  })

  const rows: TemplateRow[] = templates.map((template) => ({
    id: template.id,
    name: template.name,
    type: template.type,
    version: template.version,
    active: template.active,
    updatedAt: template.updatedAt,
  }))

  return (
    <div>
      {viga ? <ErrorNotice message={viga} /> : null}
      <PageHeader
        title="Lepingu mallid"
        description="Üks aktiivne mall tüübi kohta; aktiveerimine peatab eelmise."
        backHref="/admin/contracts"
      />
      <DataTable
        columns={[
          { key: 'name', label: 'Nimi' },
          {
            key: 'type',
            label: 'Tüüp',
            render: (row) => contractTemplateTypeLabels[row.type as ContractTemplateType],
          },
          { key: 'version', label: 'Versioon' },
          {
            key: 'active',
            label: 'Olek',
            render: (row) =>
              row.active ? (
                <span className="text-label font-semibold text-primaryDark">Aktiivne</span>
              ) : (
                <span className="text-label font-semibold text-ink-muted">Peatatud</span>
              ),
          },
          { key: 'updatedAt', label: 'Muudetud', render: (row) => formatDateTime(row.updatedAt) },
          {
            key: 'actions',
            label: 'Tegevused',
            render: (row) => (
              <form action={setTemplateActiveAction}>
                <input type="hidden" name="id" value={row.id} />
                <input type="hidden" name="active" value={row.active ? 'false' : 'true'} />
                <button type="submit" className={smallButtonClass}>
                  {row.active ? 'Desaktiveeri' : 'Aktiveeri'}
                </button>
              </form>
            ),
          },
        ]}
        rows={rows}
        emptyLabel="Malle ei ole."
      />
    </div>
  )
}
