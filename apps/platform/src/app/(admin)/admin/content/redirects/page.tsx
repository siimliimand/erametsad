
import { RedirectDeleteButton } from './_components/RedirectDeleteButton'
import { validateRedirect } from './_lib/redirect-validation'
import { AdminLink } from '../../../_components/AdminLink'
import { DataTable } from '../../../_components/DataTable'
import { ErrorNotice } from '../../../_components/ErrorNotice'
import { primaryButtonClass } from '../../../_components/FormField'
import { PageHeader } from '../../../_components/PageHeader'
import { PlusIcon } from '../../../_components/icons'
import { requireAdminRepositories } from '../../../_lib/admin'
import { redirectTypeLabels } from '../../../_lib/labels'

import type { RedirectType } from '@/lib/data/schema'

interface RedirectRow {
  id: string
  from: string
  to: string
  type: RedirectType
  active: boolean
  hits: number
  valid: boolean
  validationError: string | null
}

export const metadata = { title: 'Suunamised' }

export default async function AdminRedirectsPage({
  searchParams,
}: {
  searchParams: Promise<{ viga?: string }>
}) {
  const { viga } = await searchParams
  const { repositories } = await requireAdminRepositories()

  const { docs } = await repositories.find({
    collection: 'redirects',
    sort: 'from',
    pagination: false,
  })
  // Validation status is derived per row against the stored set (no extra
  // column): the same rules the save action enforces.
  const byFrom = new Map(docs.map((doc) => [doc.from, doc.to]))
  const rows: RedirectRow[] = docs.map((redirect) => {
    const workingMap = new Map(byFrom)
    workingMap.delete(redirect.from)
    const validationError = validateRedirect(redirect.from, redirect.to, workingMap)
    return {
      id: redirect.id,
      from: redirect.from,
      to: redirect.to,
      type: redirect.type,
      active: redirect.active,
      hits: redirect.hits,
      valid: validationError === null,
      validationError,
    }
  })

  return (
    <div>
      {viga ? <ErrorNotice message={viga} /> : null}
      <PageHeader
        title="Suunamised"
        description="Vanad URL-id suunatakse uutele aadressitele."
        backHref="/admin/content"
        actions={
          <AdminLink href="/content/redirects/new" className={primaryButtonClass}>
            <PlusIcon />
            Uus suunamine
          </AdminLink>
        }
      />
      <DataTable
        columns={[
          {
            key: 'from',
            label: 'Kust',
            render: (row) => (
              <AdminLink
                href={`/content/redirects/${row.id}`}
                className="text-label font-semibold text-primary transition-colors duration-hover ease-hover hover:text-primaryHover"
              >
                {row.from}
              </AdminLink>
            ),
          },
          { key: 'to', label: 'Kuhu' },
          {
            key: 'type',
            label: 'Tüüp',
            render: (row) => redirectTypeLabels[row.type],
          },
          {
            key: 'active',
            label: 'Aktiivne',
            render: (row) => (row.active ? 'Jah' : 'Ei'),
          },
          {
            key: 'hits',
            label: 'Tabamusi',
            render: (row) => String(row.hits),
          },
          {
            key: 'valid',
            label: 'Valideerimine',
            render: (row) =>
              row.valid ? (
                <span className="text-ink-muted">OK</span>
              ) : (
                <span className="font-semibold text-danger" title={row.validationError ?? undefined}>
                  Viga
                </span>
              ),
          },
          {
            key: 'actions',
            label: 'Tegevused',
            render: (row) => <RedirectDeleteButton id={row.id} from={row.from} />,
          },
        ]}
        rows={rows}
        emptyLabel="Suunamisi ei ole."
      />
    </div>
  )
}
