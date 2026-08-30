import Link from 'next/link'

import { CheckboxField } from './CheckboxField'
import { updateSettingsAction } from '../../../_actions/content'
import {
  FormField,
  FormTextareaField,
  primaryButtonClass,
  secondaryButtonClass,
} from '../../../_components/FormField'

import type { SettingsDoc } from '@/lib/data/repositories'

export function SettingsForm({ settings }: { settings?: SettingsDoc | undefined }) {
  const featureFlagsText =
    settings?.featureFlags === null || settings?.featureFlags === undefined
      ? ''
      : JSON.stringify(settings.featureFlags, null, 2)

  return (
    <form
      action={updateSettingsAction}
      className="max-w-container-sm space-y-sm rounded-card border border-border bg-bgPage p-md"
    >
      <FormField label="Organisatsiooni nimi" name="orgName" defaultValue={settings?.orgName ?? ''} />
      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
        <FormField
          label="Registrikood"
          name="orgRegCode"
          defaultValue={settings?.orgRegCode ?? ''}
        />
        <FormField label="Aadress" name="orgAddress" defaultValue={settings?.orgAddress ?? ''} />
      </div>
      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
        <FormField
          label="Vahendustasu (%)"
          name="feePercent"
          type="number"
          min="0"
          max="100"
          step="1"
          required
          defaultValue={settings?.feePercent ?? 3}
        />
        <FormField
          label="Käibemaks (%)"
          name="vatPercent"
          type="number"
          min="0"
          max="100"
          step="1"
          required
          defaultValue={settings?.vatPercent ?? 22}
        />
      </div>
      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
        <FormField
          label="Oksjoni aja pikendamine (min)"
          name="antiSnipeDurationMinutes"
          type="number"
          min="0"
          step="1"
          required
          hint="Viimastel minutitel tehtud pakkumine pikendab oksjoni lõppaega selle võrra."
          defaultValue={settings?.antiSnipeDurationMinutes ?? 5}
        />
        <FormField
          label="Pitserdatud pakkumise paranduste limiit"
          name="sealedRevisionCap"
          type="number"
          min="0"
          step="1"
          required
          defaultValue={settings?.sealedRevisionCap ?? 3}
        />
      </div>
      <CheckboxField
        label="Alapakkumine lubatud"
        name="alapakkumineEnabled"
        hint="Lepingu sõlmimise tingimus: nõuab raamlepingut."
        defaultChecked={settings?.alapakkumineEnabled ?? true}
      />
      <FormTextareaField
        label="Lippude JSON"
        name="featureFlags"
        rows={4}
        hint='Näiteks {"requireFrameworkContract": true}'
        defaultValue={featureFlagsText}
      />
      <div className="flex items-center gap-sm pt-xs">
        <button type="submit" className={primaryButtonClass}>
          Salvesta
        </button>
        <Link href="/admin/content" className={secondaryButtonClass}>
          Tagasi sisu avalehele
        </Link>
      </div>
    </form>
  )
}
