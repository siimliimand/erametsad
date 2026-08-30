import Link from 'next/link'

import { CheckboxField } from './CheckboxField'
import { savePartnerServiceAction } from '../../../_actions/content'
import {
  FormField,
  FormTextareaField,
  primaryButtonClass,
  secondaryButtonClass,
} from '../../../_components/FormField'

import type { PartnerService } from '@/lib/data/schema'

export function PartnerServiceForm({ service }: { service?: PartnerService }) {
  return (
    <form
      action={savePartnerServiceAction}
      className="max-w-container-sm space-y-sm rounded-card border border-border bg-bgPage p-md"
    >
      {service ? <input type="hidden" name="id" value={service.id} /> : null}
      <FormField label="Nimi" name="name" required defaultValue={service?.name ?? ''} />
      <FormField
        label="URL-nimi"
        name="slug"
        required
        hint="Näiteks: metsa-hindamine"
        defaultValue={service?.slug ?? ''}
      />
      <FormTextareaField
        label="Kirjeldus"
        name="description"
        rows={4}
        defaultValue={service?.description ?? ''}
      />
      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
        <FormField label="Ikoon" name="icon" defaultValue={service?.icon ?? ''} />
        <FormField label="Link" name="link" defaultValue={service?.link ?? ''} />
      </div>
      <FormField
        label="Järjekord"
        name="order"
        type="number"
        min="0"
        step="1"
        defaultValue={service?.order ?? 0}
      />
      <CheckboxField
        label="Aktiivne"
        name="active"
        defaultChecked={service?.active ?? true}
      />
      <div className="flex items-center gap-sm pt-xs">
        <button type="submit" className={primaryButtonClass}>
          Salvesta
        </button>
        <Link href="/admin/content/partner-services" className={secondaryButtonClass}>
          Tühista
        </Link>
      </div>
    </form>
  )
}
