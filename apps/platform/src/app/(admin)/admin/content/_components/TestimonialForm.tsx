
import { CheckboxField } from './CheckboxField'
import { saveTestimonialAction } from '../../../_actions/content'
import { AdminLink } from '../../../_components/AdminLink'
import {
  FormField,
  FormSelectField,
  FormTextareaField,
  primaryButtonClass,
  secondaryButtonClass,
} from '../../../_components/FormField'
import { contentStatusLabels } from '../../../_lib/labels'

import type { Testimonial } from '@/lib/data/schema'
import { contentStatuses } from '@/lib/data/schema'

const statusOptions = contentStatuses.map((status) => ({
  value: status,
  label: contentStatusLabels[status],
}))

export function TestimonialForm({ testimonial }: { testimonial?: Testimonial }) {
  return (
    <form
      action={saveTestimonialAction}
      className="max-w-container-sm space-y-sm rounded-card border border-border bg-bgPage p-md"
    >
      {testimonial ? <input type="hidden" name="id" value={testimonial.id} /> : null}
      <FormField label="Nimi" name="name" required defaultValue={testimonial?.name ?? ''} />
      <FormField label="Amet" name="role" defaultValue={testimonial?.role ?? ''} />
      <FormTextareaField
        label="Tsitaat"
        name="content"
        rows={4}
        required
        defaultValue={testimonial?.content ?? ''}
      />
      <FormField
        label="Foto ID"
        name="avatarId"
        hint="Meediafaili ID. Meediakogu haldus lisandub hiljem."
        defaultValue={testimonial?.avatarId ?? ''}
      />
      <CheckboxField
        label="Esile tõstetud"
        name="featured"
        defaultChecked={testimonial?.featured ?? false}
      />
      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
        <FormSelectField
          label="Olek"
          name="status"
          options={statusOptions}
          hint="Avaldatud tsitaat kuvatakse avalikel lehtedel."
          defaultValue={testimonial?.status ?? 'draft'}
        />
        <FormField
          label="Hinne (valikuline)"
          name="rating"
          type="number"
          min="1"
          max="5"
          step="1"
          hint="Tähehinnang 1-5."
          defaultValue={testimonial?.rating ?? ''}
        />
      </div>
      <div className="flex items-center gap-sm pt-xs">
        <button type="submit" className={primaryButtonClass}>
          Salvesta
        </button>
        <AdminLink href="/content/testimonials" className={secondaryButtonClass}>
          Tühista
        </AdminLink>
      </div>
    </form>
  )
}
