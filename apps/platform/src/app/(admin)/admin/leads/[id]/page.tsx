import Link from 'next/link'
import { notFound } from 'next/navigation'

import { updateLeadAction } from '../../../_actions/ops'
import { ErrorNotice } from '../../../_components/ErrorNotice'
import {
  FormSelectField,
  FormTextareaField,
  primaryButtonClass,
  secondaryButtonClass,
} from '../../../_components/FormField'
import { PageHeader } from '../../../_components/PageHeader'
import { requireAdminRepositories } from '../../../_lib/admin'
import { formatDateTime, leadStatusLabels } from '../../../_lib/labels'

import { leadStatuses } from '@/lib/data/schema'

export const metadata = { title: 'Juhtlõige' }

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-label font-semibold text-ink">{label}</span>
      <p className="rounded-input border border-border bg-bg-mist px-3 py-2 text-bodySm text-ink-muted">
        {children}
      </p>
    </div>
  )
}

export default async function LeadDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ viga?: string }>
}) {
  const { id } = await params
  const { viga } = await searchParams
  const { repositories } = await requireAdminRepositories()

  const lead = await repositories.findByID({ collection: 'leads', id })
  if (!lead) notFound()

  const { docs: specialists } = await repositories.find({
    collection: 'specialists',
    sort: 'name',
    pagination: false,
  })

  const localizedStatusOptions = leadStatuses.map((status) => ({
    value: status,
    label: leadStatusLabels[status],
  }))

  return (
    <div>
      {viga ? <ErrorNotice message={viga} /> : null}
      <PageHeader
        title={lead.contactName}
        description="Juhtlõike kontaktandmed ja töötlemine."
        backHref="/admin/leads"
      />

      <div className="mb-sm grid max-w-container-sm grid-cols-1 gap-sm rounded-card border border-border bg-bgPage p-md sm:grid-cols-2">
        <Field label="Vorm">{lead.formName}</Field>
        <Field label="Lehekülg">{lead.pageSlug ?? '—'}</Field>
        <Field label="Telefon">{lead.phone ?? '—'}</Field>
        <Field label="E-post">{lead.email ?? '—'}</Field>
        <Field label="Katastritunnus">{lead.cadastr ?? '—'}</Field>
        <Field label="Allikas">{lead.source ?? '—'}</Field>
        <Field label="Nõusolek">{formatDateTime(lead.consentAt)}</Field>
        <Field label="Loodud">{formatDateTime(lead.createdAt)}</Field>
      </div>

      <form
        action={updateLeadAction}
        className="max-w-container-sm space-y-sm rounded-card border border-border bg-bgPage p-md"
      >
        <input type="hidden" name="id" value={lead.id} />
        <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
          <FormSelectField
            label="Olek"
            name="status"
            options={localizedStatusOptions}
            defaultValue={lead.status}
          />
          <FormSelectField
            label="Määratud spetsialist"
            name="assignedSpecialist"
            options={[
              { value: '', label: 'Määramata' },
              ...specialists.map((specialist) => ({
                value: specialist.id,
                label: specialist.name,
              })),
            ]}
            defaultValue={lead.assignedSpecialistId ?? ''}
          />
        </div>
        <FormTextareaField
          label="Sisemine märkus"
          name="internalComment"
          defaultValue={lead.internalComment ?? ''}
        />
        <div className="flex items-center gap-sm pt-xs">
          <button type="submit" className={primaryButtonClass}>
            Salvesta
          </button>
          <Link href="/admin/leads" className={secondaryButtonClass}>
            Tühista
          </Link>
        </div>
      </form>
    </div>
  )
}
