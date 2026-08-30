import Link from 'next/link'

import { saveFaqItemAction } from '../../../_actions/content'
import {
  FormField,
  FormSelectField,
  FormTextareaField,
  primaryButtonClass,
  secondaryButtonClass,
} from '../../../_components/FormField'

import type { FaqItem } from '@/lib/data/schema'

export function FaqItemForm({
  item,
  categories,
}: {
  item?: FaqItem
  categories: readonly { value: string; label: string }[]
}) {
  return (
    <form
      action={saveFaqItemAction}
      className="max-w-container-sm space-y-sm rounded-card border border-border bg-bgPage p-md"
    >
      {item ? <input type="hidden" name="id" value={item.id} /> : null}
      <FormField label="Küsimus" name="question" required defaultValue={item?.question ?? ''} />
      <FormTextareaField
        label="Vastus"
        name="answer"
        rows={6}
        hint="HTML sisu."
        required
        defaultValue={item?.answer ?? ''}
      />
      <FormSelectField
        label="Kategooria"
        name="categoryId"
        options={categories}
        defaultValue={item?.categoryId}
        {...(categories.length === 0 ? { hint: 'Esmalt loo vähemalt üks kategooria.' } : {})}
      />
      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
        <FormField
          label="Järjekord"
          name="order"
          type="number"
          min="0"
          step="1"
          defaultValue={item?.order ?? 0}
        />
        <FormField
          label="URL-nimi (valikuline)"
          name="slug"
          defaultValue={item?.slug ?? ''}
        />
      </div>
      <div className="flex items-center gap-sm pt-xs">
        <button type="submit" className={primaryButtonClass}>
          Salvesta
        </button>
        <Link href="/admin/content/faq/items" className={secondaryButtonClass}>
          Tühista
        </Link>
      </div>
    </form>
  )
}
