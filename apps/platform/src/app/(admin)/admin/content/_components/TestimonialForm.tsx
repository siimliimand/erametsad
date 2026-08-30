import Link from 'next/link'

import { CheckboxField } from './CheckboxField'
import { saveTestimonialAction } from '../../../_actions/content'
import {
  FormField,
  FormTextareaField,
  primaryButtonClass,
  secondaryButtonClass,
} from '../../../_components/FormField'

import type { Testimonial } from '@/lib/data/schema'

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
      <div className="flex items-center gap-sm pt-xs">
        <button type="submit" className={primaryButtonClass}>
          Salvesta
        </button>
        <Link href="/admin/content/testimonials" className={secondaryButtonClass}>
          Tühista
        </Link>
      </div>
    </form>
  )
}
