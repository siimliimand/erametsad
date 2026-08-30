import Link from 'next/link'

import { CheckboxField } from './CheckboxField'
import { saveRedirectAction } from '../../../_actions/content'
import {
  FormField,
  FormSelectField,
  primaryButtonClass,
  secondaryButtonClass,
} from '../../../_components/FormField'
import { redirectTypeLabels } from '../../../_lib/labels'

import type { Redirect } from '@/lib/data/schema'
import { redirectTypes } from '@/lib/data/schema'

const typeOptions = redirectTypes.map((type) => ({
  value: type,
  label: redirectTypeLabels[type],
}))

export function RedirectForm({ redirect }: { redirect?: Redirect }) {
  return (
    <form
      action={saveRedirectAction}
      className="max-w-container-sm space-y-sm rounded-card border border-border bg-bgPage p-md"
    >
      {redirect ? <input type="hidden" name="id" value={redirect.id} /> : null}
      <FormField
        label="Kust"
        name="from"
        required
        hint="Näiteks: /vana-leht"
        defaultValue={redirect?.from ?? ''}
      />
      <FormField
        label="Kuhu"
        name="to"
        required
        hint="Näiteks: /uus-leht"
        defaultValue={redirect?.to ?? ''}
      />
      <FormSelectField
        label="Tüüp"
        name="type"
        options={typeOptions}
        defaultValue={redirect?.type ?? '301'}
      />
      <CheckboxField
        label="Aktiivne"
        name="active"
        defaultChecked={redirect?.active ?? true}
      />
      <div className="flex items-center gap-sm pt-xs">
        <button type="submit" className={primaryButtonClass}>
          Salvesta
        </button>
        <Link href="/admin/content/redirects" className={secondaryButtonClass}>
          Tühista
        </Link>
      </div>
    </form>
  )
}
