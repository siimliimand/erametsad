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
  FormTextareaField,
  primaryButtonClass,
  secondaryButtonClass,
} from '../../../_components/FormField'
import { PageHeader } from '../../../_components/PageHeader'
import { requireAdminRepositories } from '../../../_lib/admin'
import { formatDateTime } from '../../../_lib/labels'
import { can } from '../../../_lib/permissions'
import { resolveRegistrySnapshot } from '../../leads/_components/registry-snapshot'

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

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}

/**
 * Registrikood, kontaktisik and märkus have no partners-table columns; they
 * persist in the audited create/update record (task 8.6). The latest entry
 * per partner wins.
 */
interface PartnerRecordExtras {
  regCode: string | null
  contactPerson: string | null
  note: string | null
}

function resolvePartnerExtras(
  audits: readonly (AuditEntryDoc & { entityId?: string | null })[],
): Map<string, PartnerRecordExtras> {
  const byPartner = new Map<string, PartnerRecordExtras>()
  for (const entry of audits) {
    if (entry.action !== 'partner.create' && entry.action !== 'partner.update') continue
    if (!entry.entityId) continue
    const after = asRecord(entry.after)
    byPartner.set(entry.entityId, {
      regCode: typeof after.regCode === 'string' ? after.regCode : null,
      contactPerson: typeof after.contactPerson === 'string' ? after.contactPerson : null,
      note: typeof after.note === 'string' ? after.note : null,
    })
  }
  return byPartner
}

interface PartnerFormDefaults {
  name: string
  regCode: string
  contactEmail: string
  contactPhone: string
  contactPerson: string
  note: string
  serviceTypes: string[]
  counties: string[]
  capacity: string
  active: boolean
}

const EMPTY_FORM: PartnerFormDefaults = {
  name: '',
  regCode: '',
  contactEmail: '',
  contactPhone: '',
  contactPerson: '',
  note: '',
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
          label="Registrikood"
          name="regCode"
          defaultValue={defaults.regCode}
          inputMode="numeric"
          hint="8 numbrit; täitke Äriregistri eeltäidiseks ja sisestage käsitsi."
        />
        <FormField
          label="Suunamise e-post"
          name="contactEmail"
          type="email"
          defaultValue={defaults.contactEmail}
          required
        />
        <FormField label="Telefon" name="contactPhone" defaultValue={defaults.contactPhone} />
        <FormField label="Kontaktisik" name="contactPerson" defaultValue={defaults.contactPerson} />
        <FormField
          label="Mahtude limiit (avatud päringud)"
          name="capacity"
          type="number"
          min={0}
          defaultValue={defaults.capacity}
          required
        />
      </div>
      <FormTextareaField label="Märkus" name="note" rows={2} defaultValue={defaults.note} />

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
  searchParams: Promise<{ viga?: string; teade?: string; muuda?: string; lisa?: string; reg?: string }>
}) {
  const { viga, teade, muuda, lisa, reg } = await searchParams
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
  const { docs: partnerAudits } = await repositories.find({
    collection: 'audit-entry',
    where: { entityType: { equals: 'partner' } },
    sort: '-createdAt',
    pagination: false,
  })
  const extrasByPartner = resolvePartnerExtras(partnerAudits)
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

  // Äriregister prefill (task 8.6): no live fetch action exists yet, so the
  // fixture-backed registry snapshot resolves the structure read-only from
  // the ?reg= query and prefills the create form when the code is known.
  const registryLookup = reg
    ? resolveRegistrySnapshot(reg.trim(), null, null)
    : null

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

  const rows = partners.map((partner) => {
    const extras = extrasByPartner.get(partner.id)
    return {
      id: partner.id,
      name: partner.name,
      regCode: extras?.regCode ?? null,
      contactEmail: partner.contactEmail,
      contactPhone: partner.contactPhone,
      contactPerson: extras?.contactPerson ?? null,
      note: extras?.note ?? null,
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
    }
  })

  const editing = muuda ? (partners.find((partner) => partner.id === muuda) ?? null) : null
  const editingDefaults: PartnerFormDefaults | null = editing
    ? {
        name: editing.name,
        regCode: extrasByPartner.get(editing.id)?.regCode ?? '',
        contactEmail: editing.contactEmail ?? '',
        contactPhone: editing.contactPhone ?? '',
        contactPerson: extrasByPartner.get(editing.id)?.contactPerson ?? '',
        note: extrasByPartner.get(editing.id)?.note ?? '',
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
  const createDefaults: PartnerFormDefaults = {
    ...EMPTY_FORM,
    // Äriregister prefill: only a verified legal name fills the form; the
    // typed registrikood stays in its field for the round-trip.
    ...(registryLookup?.status === 'REGISTREERITUD' && registryLookup.legalName
      ? { name: registryLookup.legalName }
      : {}),
    ...(reg && /^\d{8}$/.test(reg.trim()) ? { regCode: reg.trim() } : {}),
  }

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
        backHref="/admin/inquiries"
      />

      <div className="mb-sm flex items-center gap-xs">
        <Link
          href={lisa ? '/admin/inquiries/partners' : '/admin/inquiries/partners?lisa=1'}
          className={lisa ? secondaryButtonClass : primaryButtonClass}
        >
          {lisa ? 'Sulge vorm' : 'Lisa partner'}
        </Link>
      </div>

      {lisa ? (
        <div className="mb-md space-y-sm">
          <form
            method="get"
            action="/admin/inquiries/partners"
            className="flex flex-wrap items-end gap-xs rounded-card border border-border bg-bg-mist p-sm"
          >
            <input type="hidden" name="lisa" value="1" />
            <FormField label="Registrikood (Äriregister)" name="reg" defaultValue={reg ?? ''} />
            <button
              type="submit"
              className="inline-flex h-10 items-center rounded-button border border-border bg-bgPage px-4 text-label font-semibold text-ink hover:border-primary hover:text-primary"
            >
              Laadi andmed
            </button>
            {registryLookup ? (
              <span
                className={`rounded-pill px-2 py-0.5 text-label font-semibold ${
                  registryLookup.status === 'REGISTREERITUD'
                    ? 'bg-primary-light text-primaryDark'
                    : 'bg-bg-mist text-ink-muted'
                }`}
              >
                {registryLookup.status === 'REGISTREERITUD'
                  ? `Äriregister: ${registryLookup.legalName ?? ''}`
                  : 'Äriregister: kinnitamata — sisestage andmed käsitsi'}
              </span>
            ) : null}
          </form>
          <PartnerForm
            action={createPartnerAction}
            defaults={createDefaults}
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
          { key: 'regCode', label: 'Registrikood', render: (row) => row.regCode ?? '—' },
          { key: 'contactEmail', label: 'E-post', render: (row) => row.contactEmail ?? '—' },
          { key: 'contactPhone', label: 'Telefon', render: (row) => row.contactPhone ?? '—' },
          { key: 'contactPerson', label: 'Kontaktisik', render: (row) => row.contactPerson ?? '—' },
          {
            key: 'note',
            label: 'Märkus',
            render: (row) => (row.note ? <span title={row.note}>{row.note}</span> : '—'),
          },
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
                  href={`/admin/inquiries/partners?muuda=${row.id}`}
                  className="text-label font-semibold text-primary hover:text-primaryHover"
                >
                  Muuda
                </Link>
                {row.active ? (
                  <form action={setPartnerActiveAction} className="flex items-center gap-xs">
                    <input type="hidden" name="id" value={row.id} />
                    <input type="hidden" name="active" value="off" />
                    <input
                      type="text"
                      name="reason"
                      aria-label="Deaktiveerimise põhjus"
                      placeholder="Põhjus"
                      required
                      className="h-8 w-32 rounded-input border border-border bg-bgPage px-2 text-bodySm text-ink outline-none focus:border-primary"
                    />
                    <button type="submit" className="text-label font-semibold text-ink-muted hover:text-danger">
                      Deaktiveeri
                    </button>
                  </form>
                ) : (
                  <form action={setPartnerActiveAction}>
                    <input type="hidden" name="id" value={row.id} />
                    <input type="hidden" name="active" value="on" />
                    <button type="submit" className="text-label font-semibold text-ink-muted hover:text-primary">
                      Aktiveeri
                    </button>
                  </form>
                )}
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
