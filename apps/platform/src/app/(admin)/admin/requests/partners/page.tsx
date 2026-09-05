import { EE_COUNTIES } from '@erametsad/types'
import Link from 'next/link'

import {
  createPartnerAction,
  deletePartnerAction,
  setPartnerActiveAction,
  updatePartnerAction,
} from '../../../_actions/ops'
import { DataTable } from '../../../_components/DataTable'
import { ErrorNotice } from '../../../_components/ErrorNotice'
import {
  FormField,
  primaryButtonClass,
  secondaryButtonClass,
} from '../../../_components/FormField'
import { PageHeader } from '../../../_components/PageHeader'
import { requireAdminRepositories } from '../../../_lib/admin'
import { formatDateTime } from '../../../_lib/labels'
import { can } from '../../../_lib/permissions'

import type { AuditEntryDoc, PartnerDoc } from '@/lib/data/repositories'
import { getRepositories } from '@/lib/data/runtime'
import { serviceRequestTypes, type ServiceRequestType } from '@/lib/data/schema'

export const metadata = { title: 'Partnerid' }

const typeLabels: Record<ServiceRequestType, string> = {
  kava: 'Kava',
  hooldusraie: 'Hooldusraie',
  istutamine: 'Istutamine',
}

function countyChips(partner: PartnerDoc): string {
  const counties = Array.isArray(partner.counties)
    ? partner.counties.filter((county): county is string => typeof county === 'string')
    : []
  if (counties.length === 0) return 'Kogu Eesti'
  return counties
    .map((code) => EE_COUNTIES.find((county) => county.code === code)?.name ?? code)
    .join(', ')
}

interface PartnerFormDefaults {
  name: string
  contactEmail: string
  contactPhone: string
  serviceTypes: string[]
  counties: string[]
  capacity: string
  active: boolean
}

const EMPTY_FORM: PartnerFormDefaults = {
  name: '',
  contactEmail: '',
  contactPhone: '',
  serviceTypes: [],
  counties: [],
  capacity: '5',
  active: true,
}

function PartnerForm({
  action,
  defaults,
  partnerId,
  submitLabel,
}: {
  action: (formData: FormData) => Promise<void>
  defaults: PartnerFormDefaults
  partnerId?: string
  submitLabel: string
}) {
  return (
    <form action={action} className="space-y-sm rounded-card border border-border bg-bgPage p-md">
      {partnerId ? <input type="hidden" name="id" value={partnerId} /> : null}
      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
        <FormField label="Ettevõtte nimi" name="name" defaultValue={defaults.name} required />
        <FormField
          label="Suunamise e-post"
          name="contactEmail"
          type="email"
          defaultValue={defaults.contactEmail}
          required
        />
        <FormField label="Telefon" name="contactPhone" defaultValue={defaults.contactPhone} />
        <FormField
          label="Mahtude limiit (avatud päringud)"
          name="capacity"
          type="number"
          min={0}
          defaultValue={defaults.capacity}
          required
        />
      </div>

      <fieldset>
        <legend className="mb-xs text-label font-semibold text-ink">Teenused</legend>
        <div className="flex flex-wrap gap-sm">
          {serviceRequestTypes.map((type) => (
            <label key={type} className="flex items-center gap-xs text-bodySm text-ink">
              <input
                type="checkbox"
                name="serviceTypes"
                value={type}
                defaultChecked={defaults.serviceTypes.includes(type)}
              />
              {typeLabels[type]}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-xs text-label font-semibold text-ink">Maakonnad</legend>
        <div className="flex flex-wrap gap-sm">
          <label className="flex items-center gap-xs text-bodySm font-semibold text-ink">
            <input
              type="checkbox"
              name="counties"
              value="ALL"
              defaultChecked={defaults.counties.length === 0}
            />
            Kogu Eesti
          </label>
          {EE_COUNTIES.map((county) => (
            <label key={county.code} className="flex items-center gap-xs text-bodySm text-ink">
              <input
                type="checkbox"
                name="counties"
                value={county.code}
                defaultChecked={defaults.counties.includes(county.code)}
              />
              {county.name}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex items-center gap-xs text-bodySm text-ink">
        <input type="checkbox" name="active" defaultChecked={defaults.active} />
        Aktiivne (saab päringuid suunata)
      </label>

      <button type="submit" className={primaryButtonClass}>
        {submitLabel}
      </button>
    </form>
  )
}

export default async function PartnersPage({
  searchParams,
}: {
  searchParams: Promise<{ viga?: string; teade?: string; muuda?: string; lisa?: string }>
}) {
  const { viga, teade, muuda, lisa } = await searchParams
  const { session } = await requireAdminRepositories()
  if (!can(session.role, 'inquiries:read')) {
    return (
      <div>
        <PageHeader title="Partnerid" />
        <div className="rounded-input border border-danger bg-danger-light px-md py-sm text-bodySm text-danger">
          Ainult administraatorile ja spetsialistidele.
        </div>
      </div>
    )
  }

  const repositories = await getRepositories()
  const { docs: partners } = await repositories.find({
    collection: 'partners',
    sort: 'name',
    pagination: false,
  })
  const { docs: forwardAudits } = await repositories.find({
    collection: 'audit-entry',
    where: {
      and: [
        { action: { equals: 'request.forward' } },
        { entityType: { equals: 'service-request' } },
      ],
    },
    sort: '-createdAt',
    pagination: false,
  })

  const lastForwardedAt = new Map<string, string>()
  for (const entry of forwardAudits as (AuditEntryDoc & { entityId?: string | null })[]) {
    const after = entry.after
    const partnerId =
      typeof after === 'object' && after !== null
        ? (after as { partnerId?: unknown }).partnerId
        : undefined
    if (typeof partnerId === 'string' && !lastForwardedAt.has(partnerId)) {
      lastForwardedAt.set(partnerId, entry.createdAt)
    }
  }

  const rows = partners.map((partner) => ({
    id: partner.id,
    name: partner.name,
    contactEmail: partner.contactEmail,
    contactPhone: partner.contactPhone,
    services: (Array.isArray(partner.serviceTypes)
      ? partner.serviceTypes.filter((type): type is ServiceRequestType =>
          serviceRequestTypes.includes(type as ServiceRequestType),
        )
      : []
    ).map((type) => typeLabels[type]),
    counties: countyChips(partner),
    capacity: partner.capacity,
    active: partner.active,
    lastForwardedAt: lastForwardedAt.get(partner.id) ?? null,
  }))

  const editing = muuda ? (partners.find((partner) => partner.id === muuda) ?? null) : null
  const editingDefaults: PartnerFormDefaults | null = editing
    ? {
        name: editing.name,
        contactEmail: editing.contactEmail ?? '',
        contactPhone: editing.contactPhone ?? '',
        serviceTypes: Array.isArray(editing.serviceTypes)
          ? editing.serviceTypes.filter((type): type is string => typeof type === 'string')
          : [],
        counties: Array.isArray(editing.counties)
          ? editing.counties.filter((county): county is string => typeof county === 'string')
          : [],
        capacity: String(editing.capacity),
        active: editing.active,
      }
    : null

  return (
    <div>
      {viga ? <ErrorNotice message={viga} /> : null}
      {teade ? (
        <div className="mb-md rounded-input border border-primary bg-primary-light px-md py-sm text-bodySm text-primaryDark">
          {teade}
        </div>
      ) : null}
      <PageHeader
        title="Partnerite kataloog"
        description="Teenusepakkujad, maakonnakatted ja mahtude limiidid."
        backHref="/admin/requests"
      />

      <div className="mb-sm flex items-center gap-xs">
        <Link
          href={lisa ? '/admin/requests/partners' : '/admin/requests/partners?lisa=1'}
          className={lisa ? secondaryButtonClass : primaryButtonClass}
        >
          {lisa ? 'Sulge vorm' : 'Lisa partner'}
        </Link>
      </div>

      {lisa ? (
        <div className="mb-md">
          <PartnerForm
            action={createPartnerAction}
            defaults={EMPTY_FORM}
            submitLabel="Loo partner"
          />
        </div>
      ) : null}

      {editingDefaults && editing ? (
        <div className="mb-md">
          <h2 className="mb-xs font-heading text-h4 font-bold text-ink">
            Muuda: {editing.name}
          </h2>
          <PartnerForm
            action={updatePartnerAction}
            defaults={editingDefaults}
            partnerId={editing.id}
            submitLabel="Salvesta muudatused"
          />
        </div>
      ) : null}

      <DataTable
        columns={[
          { key: 'name', label: 'Ettevõte' },
          { key: 'contactEmail', label: 'E-post', render: (row) => row.contactEmail ?? '—' },
          { key: 'contactPhone', label: 'Telefon', render: (row) => row.contactPhone ?? '—' },
          {
            key: 'services',
            label: 'Teenused',
            render: (row) => (row.services.length > 0 ? row.services.join(', ') : '—'),
          },
          { key: 'counties', label: 'Maakonnad' },
          {
            key: 'capacity',
            label: 'Limiiit',
            render: (row) => `${String(row.capacity)} avatud päringut`,
          },
          { key: 'lastForwardedAt', label: 'Viimati edastatud', render: (row) => formatDateTime(row.lastForwardedAt) },
          {
            key: 'active',
            label: 'Aktiivne',
            render: (row) =>
              row.active ? (
                <span className="rounded-pill bg-primary-light px-2 py-0.5 text-label font-semibold text-primaryDark">
                  aktiivne
                </span>
              ) : (
                <span className="rounded-pill bg-bg-mist px-2 py-0.5 text-label font-semibold text-ink-muted">
                  mitteaktiivne
                </span>
              ),
          },
          {
            key: 'actions',
            label: 'Tegevused',
            render: (row) => (
              <div className="flex flex-wrap items-center gap-xs">
                <Link
                  href={`/admin/requests/partners?muuda=${row.id}`}
                  className="text-label font-semibold text-primary hover:text-primaryHover"
                >
                  Muuda
                </Link>
                <form action={setPartnerActiveAction}>
                  <input type="hidden" name="id" value={row.id} />
                  <input type="hidden" name="active" value={row.active ? 'off' : 'on'} />
                  <button type="submit" className="text-label font-semibold text-ink-muted hover:text-primary">
                    {row.active ? 'Deaktiveeri' : 'Aktiveeri'}
                  </button>
                </form>
                <form action={deletePartnerAction}>
                  <input type="hidden" name="id" value={row.id} />
                  <button type="submit" className="text-label font-semibold text-danger hover:text-danger">
                    Kustuta
                  </button>
                </form>
              </div>
            ),
          },
        ]}
        rows={rows}
        emptyLabel="Partnereid ei ole — lisa esimene partner."
      />
    </div>
  )
}
