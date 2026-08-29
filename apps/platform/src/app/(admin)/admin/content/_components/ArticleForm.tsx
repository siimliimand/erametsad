import Link from 'next/link'

import { saveArticleAction } from '../../../_actions/content'
import {
  FormField,
  FormSelectField,
  FormTextareaField,
  primaryButtonClass,
  secondaryButtonClass,
} from '../../../_components/FormField'
import { contentStatusLabels } from '../../../_lib/labels'

import type { ArticleDoc } from '@/lib/data/repositories'
import { contentStatuses } from '@/lib/data/schema'

const statusOptions = contentStatuses.map((status) => ({
  value: status,
  label: contentStatusLabels[status],
}))

const mediaIdHint = 'Meediafaili ID. Meediakogu haldus lisandub hiljem.'

export function ArticleForm({ article }: { article?: ArticleDoc }) {
  return (
    <form
      action={saveArticleAction}
      className="max-w-container-sm space-y-sm rounded-card border border-border bg-bgPage p-md"
    >
      {article ? <input type="hidden" name="id" value={article.id} /> : null}
      <FormField label="Pealkiri" name="title" required defaultValue={article?.title ?? ''} />
      <FormField
        label="URL-nimi"
        name="slug"
        required
        hint="Näiteks: metsa-muugi-juhend"
        defaultValue={article?.slug ?? ''}
      />
      <FormTextareaField
        label="Lühikirjeldus"
        name="excerpt"
        rows={2}
        defaultValue={article?.excerpt ?? ''}
      />
      <FormTextareaField
        label="Sisu"
        name="content"
        rows={10}
        hint="HTML sisu."
        defaultValue={article?.content ?? ''}
      />
      <FormField label="Autor" name="author" defaultValue={article?.author ?? ''} />
      <FormField
        label="Sildid"
        name="tags"
        hint="Eralda komadega, näiteks: müük, oksjon"
        defaultValue={
          Array.isArray(article?.tags) ? article.tags.map(String).join(', ') : ''
        }
      />
      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
        <FormSelectField
          label="Olek"
          name="status"
          options={statusOptions}
          defaultValue={article?.status ?? 'draft'}
        />
        <FormField
          label="Peapildi ID"
          name="featuredImageId"
          hint={mediaIdHint}
          defaultValue={article?.featuredImageId ?? ''}
        />
      </div>
      <div className="flex items-center gap-sm pt-xs">
        <button type="submit" className={primaryButtonClass}>
          Salvesta
        </button>
        <Link href="/admin/content/articles" className={secondaryButtonClass}>
          Tühista
        </Link>
      </div>
    </form>
  )
}
