import Link from 'next/link'
import type { ReactNode } from 'react'

import { CheckboxField } from './CheckboxField'
import { FeeChangeBanner } from './FeeChangeBanner'
import { readAuctionDefaults, sealedApproverRoles } from './settings-audit'
import { updateSettingsAction } from '../../../_actions/content'
import {
  FormField,
  FormSelectField,
  FormTextareaField,
  primaryButtonClass,
  secondaryButtonClass,
} from '../../../_components/FormField'

import type { SettingsDoc } from '@/lib/data/repositories'

const approverRoleOptions = sealedApproverRoles.map((role) => ({
  value: role,
  label: role === 'superadmin' ? 'Peakasutaja' : 'Administraator',
}))

function SectionForm({
  section,
  title,
  children,
}: {
  section: string
  title: string
  children: ReactNode
}) {
  return (
    <form
      action={updateSettingsAction}
      className="max-w-container-sm space-y-sm rounded-card border border-border bg-bgPage p-md"
    >
      <input type="hidden" name="section" value={section} />
      <h2 className="text-h3 text-ink">{title}</h2>
      {children}
      <FormTextareaField
        label="Põhjendus (kohustuslik)"
        name="reason"
        rows={2}
        required
        hint="Vähemalt 5 tähemärki. Salvestus koos põhjendusega logitakse auditisse."
      />
      <div className="flex items-center gap-sm pt-xs">
        <button type="submit" className={primaryButtonClass}>
          Salvesta
        </button>
      </div>
    </form>
  )
}

export function SettingsForm({ settings }: { settings?: SettingsDoc | undefined }) {
  const featureFlagsText =
    settings?.featureFlags === null || settings?.featureFlags === undefined
      ? ''
      : JSON.stringify(settings.featureFlags, null, 2)
  const auctionDefaults = readAuctionDefaults(settings)

  return (
    <div className="space-y-lg">
      <FeeChangeBanner />

      <SectionForm section="uldine" title="Üldine">
        <FormField
          label="Organisatsiooni nimi"
          name="orgName"
          defaultValue={settings?.orgName ?? ''}
        />
        <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
          <FormField
            label="Registrikood"
            name="orgRegCode"
            defaultValue={settings?.orgRegCode ?? ''}
          />
          <FormField
            label="Aadress"
            name="orgAddress"
            defaultValue={settings?.orgAddress ?? ''}
          />
        </div>
      </SectionForm>

      <SectionForm section="tasud" title="Tasud">
        <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
          <FormField
            label="Vahendustasu (%)"
            name="feePercent"
            type="number"
            min="0"
            max="100"
            step="1"
            required
            hint="Kehtib ainult uutele oksjonidele."
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
      </SectionForm>

      <SectionForm section="oksjonid" title="Oksjonid">
        <FormField
          label="Anti-snipe vaikeaeg (min)"
          name="antiSnipeDurationMinutes"
          type="number"
          min="1"
          max="30"
          step="1"
          required
          hint="Vahemikus 1–30 minutit. Vaikeväärtus uutele lottidele; olemasolevad lotid säilitavad oma väärtuse."
          defaultValue={settings?.antiSnipeDurationMinutes ?? 5}
        />
        <CheckboxField
          label="Alapakkumine lubatud"
          name="alapakkumineEnabled"
          hint="Vaikeolek uutele lottidele. Lepingu sõlmimise tingimus: nõuab raamlepingut."
          defaultChecked={settings?.alapakkumineEnabled ?? true}
        />
        <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
          <FormField
            label="Alapakkumise otsuse tähtaeg (päevades)"
            name="alapakkumineDecisionDeadlineDays"
            type="number"
            min="1"
            max="14"
            step="1"
            required
            hint="Müüja kinnitamise tähtaeg päevades (1–14)."
            defaultValue={auctionDefaults.alapakkumineDecisionDeadlineDays}
          />
          <FormField
            label="Kiiroksjoni kestus (tunnid)"
            name="kiiroksjonDurationHours"
            type="number"
            min="24"
            max="72"
            step="1"
            required
            hint="Lubatud vahemik 24–72 tundi."
            defaultValue={auctionDefaults.kiiroksjonDurationHours}
          />
        </div>
        <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
          <FormField
            label="Pitserdatud pakkumiste paranduste limiit"
            name="sealedRevisionCap"
            type="number"
            min="0"
            max="5"
            step="1"
            required
            hint="Lubatud vahemik 0–5."
            defaultValue={settings?.sealedRevisionCap ?? 3}
          />
          <FormSelectField
            label="Suletud avamise kinnitaja roll"
            name="sealedApproverRole"
            options={approverRoleOptions}
            hint="Kahe-osalise avamise kinnitaja roll."
            defaultValue={auctionDefaults.sealedApproverRole}
          />
        </div>
      </SectionForm>

      <SectionForm section="lipud" title="Lipud">
        <FormTextareaField
          label="Lippude JSON"
          name="featureFlags"
          rows={4}
          hint='Näiteks {"requireFrameworkContract": true}. Oksjonite vaikesätted (auctionDefaults) hallatakse Oksjonid sektsioonis.'
          defaultValue={featureFlagsText}
        />
      </SectionForm>

      <div className="max-w-container-sm">
        <Link href="/admin/content" className={secondaryButtonClass}>
          Tagasi sisu avalehele
        </Link>
      </div>
    </div>
  )
}
