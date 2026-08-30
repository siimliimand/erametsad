import Link from 'next/link'

import { saveFaqCategoryAction } from '../../../_actions/content'
import {
  FormField,
  primaryButtonClass,
  secondaryButtonClass,
} from '../../../_components/FormField'

import type { FaqCategory } from '@/lib/data/schema'

export function FaqCategoryForm({ category }: { category?: FaqCategory }) {
  return (
    <form
      action={saveFaqCategoryAction}
      className="max-w-container-sm space-y-sm rounded-card border border-border bg-bgPage p-md"
    >
      {category ? <input type="hidden" name="id" value={category.id} /> : null}
      <FormField label="Pealkiri" name="title" required defaultValue={category?.title ?? ''} />
      <FormField
        label="URL-nimi"
        name="slug"
        required
        hint="Näiteks: oksjon"
        defaultValue={category?.slug ?? ''}
      />
      <FormField
        label="Järjekord"
        name="order"
        type="number"
        min="0"
        step="1"
        defaultValue={category?.order ?? 0}
      />
      <div className="flex items-center gap-sm pt-xs">
        <button type="submit" className={primaryButtonClass}>
          Salvesta
        </button>
        <Link href="/admin/content/faq/categories" className={secondaryButtonClass}>
          Tühista
        </Link>
      </div>
    </form>
  )
}
