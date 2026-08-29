import { notFound } from 'next/navigation'

import { deleteMediaAction, updateMediaAction } from '../../../_actions/media'
import { ErrorNotice } from '../../../_components/ErrorNotice'
import {
  FormField,
  FormTextareaField,
  primaryButtonClass,
  secondaryButtonClass,
} from '../../../_components/FormField'
import { PageHeader } from '../../../_components/PageHeader'
import { requireAdminRepositories } from '../../../_lib/admin'
import { formatDateTime } from '../../../_lib/labels'
import { formatFileSize } from '../_lib/media-upload'

export const metadata = { title: 'Muuda meediafaili' }

export default async function EditMediaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ viga?: string }>
}) {
  const { id } = await params
  const { viga } = await searchParams
  const { repositories } = await requireAdminRepositories()

  const asset = await repositories.findByID({ collection: 'media', id })
  if (!asset) notFound()

  const isImage = (asset.mimeType ?? '').startsWith('image/')

  return (
    <div>
      {viga ? <ErrorNotice message={viga} /> : null}
      <PageHeader
        title={asset.filename}
        description="Muuda failinime ja alt-teksti või kustuta fail koos R2 objektiga."
        backHref="/admin/media"
      />
      <div className="grid grid-cols-1 gap-sm lg:grid-cols-2">
        <form
          action={updateMediaAction}
          className="space-y-sm rounded-card border border-border bg-bgPage p-md"
        >
          <input type="hidden" name="id" value={asset.id} />
          <FormField label="Failinimi" name="filename" required defaultValue={asset.filename} />
          <FormTextareaField
            label="Alt-tekst"
            name="alt"
            rows={3}
            hint="Kirjeldus ekraanilugejatele."
            defaultValue={asset.alt ?? ''}
          />
          <button type="submit" className={primaryButtonClass}>
            Salvesta
          </button>
        </form>
        <div className="space-y-sm rounded-card border border-border bg-bgPage p-md">
          <p className="text-label font-semibold text-ink">Fail</p>
          {isImage && asset.url ? (
            <img
              src={asset.url}
              alt={asset.alt ?? asset.filename}
              className="max-h-64 rounded-input object-contain"
            />
          ) : null}
          <dl className="space-y-xs text-bodySm">
            <div className="flex justify-between gap-sm">
              <dt className="text-ink-muted">Tüüp</dt>
              <dd className="text-right">{asset.mimeType ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-sm">
              <dt className="text-ink-muted">Suurus</dt>
              <dd>{formatFileSize(asset.filesize)}</dd>
            </div>
            <div className="flex justify-between gap-sm">
              <dt className="text-ink-muted">Lisatud</dt>
              <dd>{formatDateTime(asset.createdAt)}</dd>
            </div>
            <div className="flex justify-between gap-sm">
              <dt className="text-ink-muted">URL</dt>
              <dd className="text-right font-mono text-bodySm">{asset.url ?? '—'}</dd>
            </div>
          </dl>
          {asset.url ? (
            <a href={asset.url} target="_blank" rel="noopener noreferrer" className={secondaryButtonClass}>
              Ava fail
            </a>
          ) : null}
          <form action={deleteMediaAction}>
            <input type="hidden" name="id" value={asset.id} />
            <button
              type="submit"
              className="text-label font-semibold text-danger transition-colors duration-hover ease-hover hover:text-danger/80"
            >
              Kustuta
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
