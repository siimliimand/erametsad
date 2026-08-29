import Link from 'next/link'

import { formatFileSize, allowedMediaMimeTypes } from './_lib/media-upload'
import { deleteMediaAction, uploadMediaAction } from '../../_actions/media'
import { DataTable } from '../../_components/DataTable'
import { ErrorNotice } from '../../_components/ErrorNotice'
import { FormField, primaryButtonClass, secondaryButtonClass } from '../../_components/FormField'
import { PageHeader } from '../../_components/PageHeader'
import { requireAdminRepositories } from '../../_lib/admin'
import { formatDateTime } from '../../_lib/labels'

import type { MediaAsset } from '@/lib/data/schema'

export const metadata = { title: 'Meediakogu' }

export default async function AdminMediaPage({
  searchParams,
}: {
  searchParams: Promise<{ viga?: string; q?: string }>
}) {
  const { viga, q } = await searchParams
  const { repositories } = await requireAdminRepositories()

  const { docs } = await repositories.find({
    collection: 'media',
    sort: '-createdAt',
    pagination: false,
  })
  const query = (q ?? '').trim().toLowerCase()
  const rows: MediaAsset[] = query
    ? docs.filter((asset) => asset.filename.toLowerCase().includes(query))
    : docs

  return (
    <div>
      {viga ? <ErrorNotice message={viga} /> : null}
      <PageHeader
        title="Meediakogu"
        description="Pildid ja PDF-failid R2 salvestusruumis. Faile kasutatakse artiklite, lehtede ja spetsialistide juures."
      />
      <div className="mb-md grid grid-cols-1 gap-sm lg:grid-cols-2">
        <form
          action={uploadMediaAction}
          className="space-y-sm rounded-card border border-border bg-bgPage p-md"
        >
          <p className="text-label font-semibold text-ink">Laadi fail üles</p>
          <FormField
            label="Fail"
            name="file"
            type="file"
            required
            accept={allowedMediaMimeTypes.join(',')}
            hint="JPEG, PNG, WebP, GIF või AVIF pilt või PDF, kuni 5 MiB."
          />
          <FormField
            label="Alt-tekst"
            name="alt"
            hint="Kirjeldus pildile ekraanilugejatele."
          />
          <button type="submit" className={primaryButtonClass}>
            Laadi üles
          </button>
        </form>
        <form className="space-y-sm rounded-card border border-border bg-bgPage p-md">
          <p className="text-label font-semibold text-ink">Otsi</p>
          <FormField
            label="Failinimi"
            name="q"
            type="search"
            defaultValue={q ?? ''}
            hint="Otsing failinime järgi."
          />
          <button type="submit" className={secondaryButtonClass}>
            Otsi
          </button>
        </form>
      </div>
      <DataTable
        columns={[
          {
            key: 'preview',
            label: 'Pilt',
            render: (row) =>
              row.url && (row.mimeType ?? '').startsWith('image/') ? (
                <img
                  src={row.url}
                  alt={row.alt ?? row.filename}
                  className="h-10 w-10 rounded-input object-cover"
                  loading="lazy"
                />
              ) : (
                <span>—</span>
              ),
          },
          {
            key: 'filename',
            label: 'Failinimi',
            render: (row) => (
              <Link
                href={`/admin/media/${row.id}`}
                className="text-label font-semibold text-primary transition-colors duration-hover ease-hover hover:text-primaryHover"
              >
                {row.filename}
              </Link>
            ),
          },
          {
            key: 'mimeType',
            label: 'Tüüp',
            render: (row) => row.mimeType ?? '—',
          },
          {
            key: 'filesize',
            label: 'Suurus',
            render: (row) => formatFileSize(row.filesize),
          },
          {
            key: 'alt',
            label: 'Alt-tekst',
            render: (row) => row.alt ?? '—',
          },
          {
            key: 'createdAt',
            label: 'Lisatud',
            render: (row) => formatDateTime(row.createdAt),
          },
          {
            key: 'actions',
            label: 'Tegevused',
            render: (row) => (
              <form action={deleteMediaAction}>
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
        emptyLabel="Faile ei ole. Laadi esimene fail üles."
      />
    </div>
  )
}
