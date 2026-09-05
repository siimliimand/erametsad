import Link from 'next/link'

import { CheckboxField } from './CheckboxField'
import { redirectPathsForSlugChange, utcIsoToTallinnInputValue } from './scheduled-publish'
import { savePageAction } from '../../../_actions/content'
import {
  FormField,
  FormSelectField,
  FormTextareaField,
  primaryButtonClass,
  secondaryButtonClass,
} from '../../../_components/FormField'
import { contentStatusLabels } from '../../../_lib/labels'

import type { PageDoc } from '@/lib/data/repositories'
import { contentStatuses } from '@/lib/data/schema'

const statusOptions = contentStatuses.map((status) => ({
  value: status,
  label: contentStatusLabels[status],
}))

export function PageForm({ page }: { page?: PageDoc }) {
  const layoutText =
    page?.layout === null || page?.layout === undefined
      ? ''
      : JSON.stringify(page.layout, null, 2)
  const redirectPaths =
    page?.status === 'published'
      ? redirectPathsForSlugChange('pages', page.slug, page.slug)
      : null

  return (
    <form
      action={savePageAction}
      className="max-w-container-sm space-y-sm rounded-card border border-border bg-bgPage p-md"
    >
      {page ? <input type="hidden" name="id" value={page.id} /> : null}
      <FormField label="Pealkiri" name="title" required defaultValue={page?.title ?? ''} />
      <FormField
        label="URL-nimi"
        name="slug"
        required
        hint="Näiteks: meist"
        defaultValue={page?.slug ?? ''}
      />
      <FormField label="SEO pealkiri" name="seoTitle" defaultValue={page?.seoTitle ?? ''} />
      <FormTextareaField
        label="SEO kirjeldus"
        name="seoDescription"
        rows={2}
        defaultValue={page?.seoDescription ?? ''}
      />
      <FormTextareaField
        label="Paigutus (JSON)"
        name="layout"
        rows={10}
        hint="Lehe blokkide JSON. Vorming peab olema korrektne JSON."
        defaultValue={layoutText}
      />
      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
        <FormSelectField
          label="Olek"
          name="status"
          options={statusOptions}
          hint="Tulevikus seatud avaldamise ajaga jääb leht mustandiks kuni avaldamiseni."
          defaultValue={page?.status ?? 'draft'}
        />
        <FormField
          label="Avaldamise aeg"
          name="publishAt"
          type="datetime-local"
          step="60"
          hint="Kellaaeg Europe/Tallinn. Planeeritud avaldamine tehakse automaatselt."
          defaultValue={utcIsoToTallinnInputValue(page?.publishedAt)}
        />
      </div>
      {page?.status === 'published' && redirectPaths ? (
        <CheckboxField
          label="Loo suunamine vana aadressilt"
          name="createRedirect"
          hint={`URL-i muutusel luuakse suunamine aadressilt ${redirectPaths.from} aadressile uue URL-i.`}
          defaultChecked
        />
      ) : null}
      <div className="flex items-center gap-sm pt-xs">
        <button type="submit" className={primaryButtonClass}>
          Salvesta
        </button>
        <Link href="/admin/content/pages" className={secondaryButtonClass}>
          Tühista
        </Link>
      </div>
    </form>
  )
}
