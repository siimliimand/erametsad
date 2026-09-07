import type { ReactNode } from 'react'

import { IntegrationKeys } from './IntegrationKeys'
import { RoleMatrix } from './RoleMatrix'
import { updateSettingsAction } from '../../../_actions/content'
import {
  FormField,
  FormSelectField,
  FormTextareaField,
  primaryButtonClass,
} from '../../../_components/FormField'
import { TriangleAlertIcon } from '../../../_components/icons'
import { CheckboxField } from '../../content/_components/CheckboxField'
import { FeeChangeBanner } from '../../content/_components/FeeChangeBanner'
import {
  readAuctionDefaults,
  sealedApproverRoles,
} from '../../content/_components/settings-audit'

import type { SettingsDoc } from '@/lib/data/repositories'

const approverRoleOptions = sealedApproverRoles.map((role) => ({
  value: role,
  label: role === 'superadmin' ? 'Peakasutaja' : 'Administraator',
}))

// The six demo rubriigid (docs/design/demo/admin/13-settings.html); ids and
// order match the prototype anchors.
const sectionNav = [
  { id: 'sec-platvorm', label: 'Platvorm' },
  { id: 'sec-reeglid', label: 'Oksjonite reeglid' },
  { id: 'sec-tasud', label: 'Teenustasud' },
  { id: 'sec-paringud', label: 'Teenuse päringud' },
  { id: 'sec-integratsioon', label: 'Integratsioonid' },
  { id: 'sec-rollid', label: 'Rollid ja õigused' },
] as const

function SettingsSection({
  id,
  title,
  children,
}: {
  id: string
  title: string
  children: ReactNode
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className="scroll-mt-[calc(var(--topbar-h)+var(--space-md))] overflow-hidden rounded-card border border-border bg-bgPage shadow-card"
    >
      <div className="border-b border-border px-md py-xs">
        <h2
          id={`${id}-heading`}
          className="font-heading text-[16px] font-semibold leading-[22px] text-ink"
        >
          {title}
        </h2>
      </div>
      {children}
    </section>
  )
}

function SectionForm({
  section,
  children,
}: {
  section: string
  children: ReactNode
}) {
  return (
    <form
      action={updateSettingsAction}
      className="border-b border-border last:border-b-0"
    >
      <input type="hidden" name="section" value={section} />
      <div className="space-y-sm px-md py-sm">
        {children}
        <FormTextareaField
          id={`reason-${section}`}
          label="Põhjendus (kohustuslik)"
          name="reason"
          rows={2}
          required
          hint="Vähemalt 5 tähemärki. Salvestus koos põhjendusega logitakse auditisse."
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-sm border-t border-border px-md py-sm">
        <p className="text-label text-inkMuted">
          Muudatused logitakse auditilogisse
        </p>
        <button type="submit" className={primaryButtonClass}>
          Salvesta
        </button>
      </div>
    </form>
  )
}

export function SettingsForm({
  settings,
}: {
  settings?: SettingsDoc | undefined
}) {
  const featureFlagsText =
    settings?.featureFlags === null || settings?.featureFlags === undefined
      ? ''
      : JSON.stringify(settings.featureFlags, null, 2)
  const auctionDefaults = readAuctionDefaults(settings)

  return (
    <div>
      <p className="mb-md flex items-center gap-xs rounded-card bg-infoLight px-sm py-xs text-label font-medium text-info">
        <TriangleAlertIcon className="h-4 w-4 shrink-0" />
        Kõik muudatused jõustuvad kohe ja logitakse auditilogisse.
      </p>

      <div className="grid items-start gap-lg lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav
          aria-label="Seadete rubriigid"
          className="flex flex-row flex-wrap gap-xs lg:sticky lg:top-[calc(var(--topbar-h)+var(--space-lg))] lg:flex-col lg:gap-0.5"
        >
          {sectionNav.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className="rounded-card border-l-[3px] border-l-transparent px-3 py-2 text-label font-medium text-inkMuted transition-colors duration-hover ease-hover hover:bg-bgMist hover:text-primary"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex min-w-0 flex-col gap-lg">
          <SettingsSection id="sec-platvorm" title="Platvorm">
            <SectionForm section="uldine">
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
            <SectionForm section="lipud">
              <h3 className="text-label font-semibold text-ink">
                Funktsioonide lipud
              </h3>
              <FormTextareaField
                label="Lipude JSON"
                name="featureFlags"
                rows={4}
                hint='Näiteks {"requireFrameworkContract": true}. Oksjonite vaikesätted (auctionDefaults) hallatakse Oksjonite reeglite rubriigis.'
                defaultValue={featureFlagsText}
              />
            </SectionForm>
          </SettingsSection>

          <SettingsSection id="sec-reeglid" title="Oksjonite reeglid">
            <SectionForm section="oksjonid">
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
                  defaultValue={
                    auctionDefaults.alapakkumineDecisionDeadlineDays
                  }
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
          </SettingsSection>

          <SettingsSection id="sec-tasud" title="Teenustasud">
            <SectionForm section="tasud">
              <FeeChangeBanner />
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
          </SettingsSection>

          <SettingsSection id="sec-paringud" title="Teenuse päringud">
            <p className="px-md py-sm text-bodySm text-inkMuted">
              Selle rubriigi sätted pole veel saadaval.
            </p>
          </SettingsSection>

          <SettingsSection id="sec-integratsioon" title="Integratsioonid">
            <IntegrationKeys />
          </SettingsSection>

          <SettingsSection id="sec-rollid" title="Rollid ja õigused">
            <RoleMatrix />
          </SettingsSection>
        </div>
      </div>
    </div>
  )
}
