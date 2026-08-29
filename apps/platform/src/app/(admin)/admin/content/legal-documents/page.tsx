import Link from 'next/link'

import { deleteLegalDocumentAction } from '../../../_actions/content'
import { DataTable } from '../../../_components/DataTable'
import { ErrorNotice } from '../../../_components/ErrorNotice'
import {
  FormSelectField,
  primaryButtonClass,
  secondaryButtonClass,
} from '../../../_components/FormField'
import { PageHeader } from '../../../_components/PageHeader'
import { PlusIcon } from '../../../_components/icons'
import { requireAdminRepositories } from '../../../_lib/admin'
import {
  ContentStatusPill,
  legalDocumentTypeLabels,
} from '../../../_lib/labels'

import type { LegalDocument } from '@/lib/data/schema'
import { legalDocumentTypes } from '@/lib/data/schema'

interface LegalDocumentRow {
  id: string
  title: string
  type: LegalDocument['type']
  version: string | null
  status: LegalDocument['status']
}

export const metadata = { title: 'Õigusdokumendid' }

export default async function AdminLegalDocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ viga?: string; tuup?: string }>
}) {
  const { viga, tuup } = await searchParams
  const { repositories } = await requireAdminRepositories()

  const typeFilter =
    tuup && legalDocumentTypes.includes(tuup as (typeof legalDocumentTypes)[number])
      ? tuup
      : undefined
  const { docs } = await repositories.find({
    collection: 'legal-documents',
    ...(typeFilter ? { where: { type: { equals: typeFilter } } } : {}),
    sort: '-createdAt',
    limit: 50,
  })
  const rows: LegalDocumentRow[] = docs.map((document) => ({
    id: document.id,
    title: document.title,
    type: document.type,
    version: document.version,
    status: document.status,
  }))

  const typeOptions = [
    { value: '', label: 'Kõik tüübid' },
    ...legalDocumentTypes.map((type) => ({ value: type, label: legalDocumentTypeLabels[type] })),
  ]

  return (
    <div>
      {viga ? <ErrorNotice message={viga} /> : null}
      <PageHeader
        title="Õigusdokumendid"
        description="Kasutustingimused, privaatsus- ja küpsisepoliitika."
        backHref="/admin/content"
        actions={
          <Link href="/admin/content/legal-documents/new" className={primaryButtonClass}>
            <PlusIcon />
            Uus dokument
          </Link>
        }
      />
      <form className="mb-md flex flex-wrap items-end gap-sm">
        <div className="w-64">
          <FormSelectField
            label="Tüüp"
            name="tuup"
            options={typeOptions}
            defaultValue={typeFilter ?? ''}
          />
        </div>
        <button type="submit" className={secondaryButtonClass}>
          Filtreeri
        </button>
      </form>
      <DataTable
        columns={[
          {
            key: 'title',
            label: 'Pealkiri',
            render: (row) => (
              <Link
                href={`/admin/content/legal-documents/${row.id}`}
                className="text-label font-semibold text-primary transition-colors duration-hover ease-hover hover:text-primaryHover"
              >
                {row.title}
              </Link>
            ),
          },
          {
            key: 'type',
            label: 'Tüüp',
            render: (row) => (row.type ? legalDocumentTypeLabels[row.type] : '—'),
          },
          { key: 'version', label: 'Versioon', render: (row) => row.version ?? '—' },
          {
            key: 'status',
            label: 'Olek',
            render: (row) => <ContentStatusPill status={row.status} />,
          },
          {
            key: 'actions',
            label: 'Tegevused',
            render: (row) => (
              <form action={deleteLegalDocumentAction}>
                <input type="hidden" name="id" value={row.id} />
                <button
                  type="submit"
                  className="text-label font-semibold text-danger transition-colors duration-hover ease-hover hover:text-danger/80"
                >
                  Kustuta
                </button>
              </form>
            ),
          },
        ]}
        rows={rows}
        emptyLabel="Dokumente ei ole. Loo esimene dokument."
      />
    </div>
  )
}
