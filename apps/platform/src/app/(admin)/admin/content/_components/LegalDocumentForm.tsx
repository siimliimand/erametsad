
import { CheckboxField } from './CheckboxField'
import { RichTextFormValue } from './RichTextFormValue'
import { redirectPathsForSlugChange, utcIsoToTallinnInputValue } from './scheduled-publish'
import { saveLegalDocumentAction } from '../../../_actions/content'
import { AdminLink } from '../../../_components/AdminLink'
import {
  FormField,
  FormSelectField,
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
  const redirectPaths =
    document?.status === 'published'
      ? redirectPathsForSlugChange('legal-documents', document.slug, document.slug)
      : null

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
      <RichTextFormValue
        name="content"
        label="Sisu"
        defaultValue={document?.content ?? ''}
        hint="Vormindatud sisu; salvestub HTML-ina."
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
      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
        <FormSelectField
          label="Olek"
          name="status"
          options={statusOptions}
          hint="Tulevikus seatud avaldamise ajaga jääb dokument mustandiks kuni avaldamiseni."
          defaultValue={document?.status ?? 'draft'}
        />
        <FormField
          label="Avaldamise aeg"
          name="publishAt"
          type="datetime-local"
          step="60"
          hint="Kellaaeg Europe/Tallinn. Planeeritud avaldamine tehakse automaatselt."
          defaultValue={utcIsoToTallinnInputValue(document?.publishedAt)}
        />
      </div>
      {document?.status === 'published' && redirectPaths ? (
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
        <AdminLink href="/content/legal-documents" className={secondaryButtonClass}>
          Tühista
        </AdminLink>
        {document?.status === 'published' ? (
          <AdminLink href="/lepingud/dokumendid" target="_blank" className={secondaryButtonClass}>
            Vaata avaldatud loendit
          </AdminLink>
        ) : null}
      </div>
    </form>
  )
}
