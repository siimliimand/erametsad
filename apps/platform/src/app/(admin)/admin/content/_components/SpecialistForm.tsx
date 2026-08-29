import Link from 'next/link'

import { CheckboxField } from './CheckboxField'
import { saveSpecialistAction } from '../../../_actions/content'
import {
  FormField,
  FormTextareaField,
  primaryButtonClass,
  secondaryButtonClass,
} from '../../../_components/FormField'

import type { Specialist } from '@/lib/data/schema'

export function SpecialistForm({ specialist }: { specialist?: Specialist }) {
  return (
    <form
      action={saveSpecialistAction}
      className="max-w-container-sm space-y-sm rounded-card border border-border bg-bgPage p-md"
    >
      {specialist ? <input type="hidden" name="id" value={specialist.id} /> : null}
      <FormField label="Nimi" name="name" required defaultValue={specialist?.name ?? ''} />
      <FormField
        label="URL-nimi"
        name="slug"
        required
        hint="Näiteks: mari-maasikas"
        defaultValue={specialist?.slug ?? ''}
      />
      <FormField label="Amet" name="role" defaultValue={specialist?.role ?? ''} />
      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
        <FormField label="Telefon" name="phone" type="tel" defaultValue={specialist?.phone ?? ''} />
        <FormField
          label="E-post"
          name="email"
          type="email"
          defaultValue={specialist?.email ?? ''}
        />
      </div>
      <FormField
        label="Foto ID"
        name="photoId"
        hint="Meediafaili ID. Meediakogu haldus lisandub hiljem."
        defaultValue={specialist?.photoId ?? ''}
      />
      <FormTextareaField
        label="Biograafia"
        name="bio"
        rows={4}
        hint="HTML sisu."
        defaultValue={specialist?.bio ?? ''}
      />
      <FormField label="Piirkond" name="region" defaultValue={specialist?.region ?? ''} />
      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
        <CheckboxField
          label="Aktiivne"
          name="active"
          defaultChecked={specialist?.active ?? true}
        />
        <CheckboxField
          label="Esile tõstetud"
          name="featured"
          defaultChecked={specialist?.featured ?? false}
        />
      </div>
      <div className="flex items-center gap-sm pt-xs">
        <button type="submit" className={primaryButtonClass}>
          Salvesta
        </button>
        <Link href="/admin/content/specialists" className={secondaryButtonClass}>
          Tühista
        </Link>
      </div>
    </form>
  )
}
