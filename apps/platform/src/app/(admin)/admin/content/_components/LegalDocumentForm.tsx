import Link from 'next/link'

import { saveLegalDocumentAction } from '../../../_actions/content'
import {
  FormField,
  FormSelectField,
  FormTextareaField,
  primaryButtonClass,
  secondaryButtonClass,
} from '../../../_components/FormField'
import { contentStatusLabels, legalDocumentTypeLabels } from '../../../_lib/labels'

import type { LegalDocument } from '@/lib/data/schema'
import { contentStatuses, legalDocumentTypes } from '@/lib/data/schema'

const statusOptions = contentStatuses.map((status) => ({
  value: status,
  label: contentStatusLabels[status],
}))

const typeOptions = [
  { value: '', label: 'Määramata' },
  ...legalDocumentTypes.map((type) => ({ value: type, label: legalDocumentTypeLabels[type] })),
]

export function LegalDocumentForm({ document }: { document?: LegalDocument }) {
  return (
    <form
      action={saveLegalDocumentAction}
      className="max-w-container-sm space-y-sm rounded-card border border-border bg-bgPage p-md"
    >
      {document ? <input type="hidden" name="id" value={document.id} /> : null}
      <FormField label="Pealkiri" name="title" required defaultValue={document?.title ?? ''} />
      <FormField
        label="URL-nimi"
        name="slug"
        required
        hint="Näiteks: kasutustingimused"
        defaultValue={document?.slug ?? ''}
      />
      <FormSelectField
        label="Tüüp"
        name="type"
        options={typeOptions}
        defaultValue={document?.type ?? ''}
      />
      <FormTextareaField
        label="Sisu"
        name="content"
        rows={10}
        required
        hint="HTML sisu."
        defaultValue={document?.content ?? ''}
      />
      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
        <FormField label="Versioon" name="version" defaultValue={document?.version ?? ''} />
        <FormField
          label="Jõustumiskuupäev"
          name="effectiveDate"
          type="date"
          defaultValue={document?.effectiveDate ? document.effectiveDate.slice(0, 10) : ''}
        />
      </div>
      <FormSelectField
        label="Olek"
        name="status"
        options={statusOptions}
        defaultValue={document?.status ?? 'draft'}
      />
      <div className="flex items-center gap-sm pt-xs">
        <button type="submit" className={primaryButtonClass}>
          Salvesta
        </button>
        <Link href="/admin/content/legal-documents" className={secondaryButtonClass}>
          Tühista
        </Link>
      </div>
    </form>
  )
}
