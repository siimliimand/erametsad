import { EE_COUNTIES, HOOLDUSRAIE_SERVICE_OPTIONS, ISTUTAMINE_SERVICE_OPTIONS } from '@erametsad/types'
import Link from 'next/link'
import type { ReactNode } from 'react'

import { rankRoutingCandidates, type RoutingPartnerInput } from './_components/routing'
import { forwardServiceRequestAction, markRequestRespondedAction, retryRequestForwardAction } from '../../_actions/ops'
import { DataTable } from '../../_components/DataTable'
import { ErrorNotice } from '../../_components/ErrorNotice'
import { primaryButtonClass, secondaryButtonClass } from '../../_components/FormField'
import { PageHeader } from '../../_components/PageHeader'
import { requireAdminRepositories } from '../../_lib/admin'
import { formatDateTime } from '../../_lib/labels'
import { can } from '../../_lib/permissions'

import type { AuditEntryDoc, PartnerDoc } from '@/lib/data/repositories'
import { getRepositories } from '@/lib/data/runtime'
import { serviceRequestTypes, type ServiceRequestType } from '@/lib/data/schema'

export const metadata = { title: 'Päringud' }

const typeLabels: Record<ServiceRequestType, string> = {
  kava: 'Metsamajanduskava',
  hooldusraie: 'Hooldusraie',
  istutamine: 'Metsa istutamine',
}

const serviceLabels: Record<string, string> = {
  ...Object.fromEntries(HOOLDUSRAIE_SERVICE_OPTIONS.map((option) => [option.value, option.label])),
  ...Object.fromEntries(ISTUTAMINE_SERVICE_OPTIONS.map((option) => [option.value, option.label])),
}

function countyName(code: unknown): string {
  if (typeof code !== 'string') return '—'
  return EE_COUNTIES.find((county) => county.code === code)?.name ?? code
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function asText(value: unknown): ReactNode {
  if (typeof value === 'string' && value !== '') return value
  if (typeof value === 'number' || typeof value === 'boolean') return value
  return '—'
}

interface ForwardLogRow {
  entryId: string
  action: string
  createdAt: string
  partnerId: string | null
  partnerName: string
  recipient: string | null
  delivered: boolean
  retry: boolean
}

function payloadDefinitionList(payload: Record<string, unknown>): ReactNode {
  const rows: { label: string; value: ReactNode }[] = [
    { label: 'Nimi', value: asText(asRecord(payload.contact).name) },
    { label: 'Telefon', value: asText(asRecord(payload.contact).phone) },
    { label: 'E-post', value: asText(asRecord(payload.contact).email) },
  ]
  if (payload.county) {
    rows.push({ label: 'Maakond', value: countyName(payload.county) })
  }
  rows.push({
    label: 'Katastritunnused',
    value: asStringArray(payload.cadastres).join(', ') || '—',
  })
  if (payload.paper_copy !== undefined) {
    rows.push({ label: 'Kava paberkandjal', value: payload.paper_copy === true ? 'jah' : 'ei' })
  }
  if (payload.provisions !== undefined) {
    rows.push({
      label: 'Ülesanded ja tingimused',
      value: typeof payload.provisions === 'string' ? payload.provisions : '—',
    })
  }
  if (Array.isArray(payload.services)) {
    rows.push({
      label: 'Teenused',
      value: asStringArray(payload.services)
        .map((service) => serviceLabels[service] ?? service)
        .join(', '),
    })
  }
  if (payload.comment !== undefined) {
    rows.push({
      label: 'Kommentaar',
      value: typeof payload.comment === 'string' ? payload.comment : '—',
    })
  }
  return (
    <dl className="space-y-1">
      {rows.map((row) => (
        <div key={row.label} className="flex justify-between gap-sm text-bodySm">
          <dt className="text-ink-muted">{row.label}</dt>
          <dd className="text-right text-ink">{row.value}</dd>
        </div>
      ))}
    </dl>
  )
}

export default async function ServiceRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{
    viga?: string
    teade?: string
    detail?: string
    tuup?: string
    olek?: string
  }>
}) {
  const { viga, teade, detail, tuup, olek } = await searchParams
  const { session } = await requireAdminRepositories()
  if (!can(session.role, 'inquiries:read')) {
    return (
      <div>
        <PageHeader title="Päringud" />
        <div className="rounded-input border border-danger bg-danger-light px-md py-sm text-bodySm text-danger">
          Ainult administraatorile ja spetsialistidele.
        </div>
      </div>
    )
  }

  const repositories = await getRepositories()
  const typeFilter = serviceRequestTypes.includes(tuup as ServiceRequestType)
    ? (tuup as ServiceRequestType)
    : null

  const { docs: requests } = await repositories.find({
    collection: 'service-requests',
    ...(typeFilter ? { where: { type: { equals: typeFilter } } } : {}),
    sort: '-createdAt',
    limit: 200,
  })

  const { docs: partners } = await repositories.find({
    collection: 'partners',
    sort: 'name',
    pagination: false,
  })

  const { docs: requestAudits } = await repositories.find({
    collection: 'audit-entry',
    where: { entityType: { equals: 'service-request' } },
    sort: '-createdAt',
    pagination: false,
  })

  const auditsByRequest = new Map<string, (AuditEntryDoc & { entityId?: string | null })[]>()
  for (const entry of requestAudits as (AuditEntryDoc & { entityId?: string | null })[]) {
    if (!entry.entityId) continue
    const list = auditsByRequest.get(entry.entityId) ?? []
    list.push(entry)
    auditsByRequest.set(entry.entityId, list)
  }

  const respondedByPartner = new Map<string, Map<string, string>>()
  for (const [requestId, entries] of auditsByRequest) {
    for (const entry of entries) {
      if (entry.action !== 'request.mark_responded') continue
      const after = asRecord(entry.after)
      if (typeof after.partnerId !== 'string') continue
      const perRequest = respondedByPartner.get(requestId) ?? new Map<string, string>()
      if (!perRequest.has(after.partnerId)) {
        perRequest.set(after.partnerId, entry.createdAt)
      }
      respondedByPartner.set(requestId, perRequest)
    }
  }

  const sentButOpenCounts: Record<string, number> = {}
  for (const request of requests) {
    const responded = respondedByPartner.get(request.id)
    for (const partnerId of asStringArray(request.routedTo)) {
      if (responded?.has(partnerId)) continue
      sentButOpenCounts[partnerId] = (sentButOpenCounts[partnerId] ?? 0) + 1
    }
  }

  const filteredRequests = requests.filter((request) => {
    if (olek === 'uus' && request.status !== 'new') return false
    if (olek === 'routed' && request.status !== 'routed') return false
    return true
  })

  const rows = filteredRequests.map((request) => {
    const payload = asRecord(request.payload)
    const contact = asRecord(payload.contact)
    const responded = respondedByPartner.get(request.id)
    const sentCount = asStringArray(request.routedTo).length
    const respondedCount = responded ? responded.size : 0
    return {
      id: request.id,
      type: request.type,
      client: typeof contact.name === 'string' ? contact.name : '—',
      county: payload.county ? countyName(payload.county) : '—',
      cadastres: asStringArray(payload.cadastres).length,
      createdAt: request.createdAt,
      routedAt: request.status === 'routed' ? request.updatedAt : null,
      sentCount,
      respondedCount,
      status: request.status,
    }
  })

  const detailRequest = detail ? (requests.find((request) => request.id === detail) ?? null) : null

  const routingCandidates = detailRequest
    ? rankRoutingCandidates(
        partners.map((partner: PartnerDoc) => ({
          id: partner.id,
          name: partner.name,
          capacity: partner.capacity,
          contactEmail: partner.contactEmail,
          serviceTypes: partner.serviceTypes,
          counties: partner.counties,
          active: partner.active,
        }) satisfies RoutingPartnerInput),
        {
          type: detailRequest.type,
          county: typeof asRecord(detailRequest.payload).county === 'string'
            ? (asRecord(detailRequest.payload).county as string)
            : null,
          openCounts: sentButOpenCounts,
          sentPartnerIds: new Set(asStringArray(detailRequest.routedTo)),
          preselectCount: 3,
        },
      )
    : []

  const forwardLog: ForwardLogRow[] = detailRequest
    ? (auditsByRequest.get(detailRequest.id) ?? [])
        .filter((entry) => entry.action === 'request.forward' || entry.action === 'request.mark_responded')
        .map((entry) => {
          const after = asRecord(entry.after)
          return {
            entryId: entry.id,
            action: entry.action,
            createdAt: entry.createdAt,
            partnerId: typeof after.partnerId === 'string' ? after.partnerId : null,
            partnerName:
              typeof after.partnerName === 'string'
                ? after.partnerName
                : (partners.find((partner) => partner.id === after.partnerId)?.name ?? '—'),
            recipient: typeof after.recipient === 'string' ? after.recipient : null,
            delivered:
              entry.action === 'request.mark_responded' ||
              asRecord(after.emailResult).success === true,
            retry: after.retry === true,
          }
        })
    : []

  const detailPath = (requestId: string) => `/admin/requests?detail=${requestId}`

  return (
    <div>
      {viga ? <ErrorNotice message={viga} /> : null}
      {teade ? (
        <div className="mb-md rounded-input border border-primary bg-primary-light px-md py-sm text-bodySm text-primaryDark">
          {teade}
        </div>
      ) : null}
      <PageHeader
        title="Päringute suunamine"
        description="Turbe päringud partneritele — partnerile edastatakse vaid teenuse osutamiseks vajalikud andmed."
        actions={
          <Link href="/admin/requests/partners" className={secondaryButtonClass}>
            Partnerid
          </Link>
        }
      />

      <div className="mb-sm flex flex-wrap items-center gap-xs">
        {[
          { label: 'Kõik', href: '/admin/requests' },
          ...serviceRequestTypes.map((type) => ({
            label: typeLabels[type],
            href: `/admin/requests?tuup=${type}`,
          })),
        ].map((tab) => (
          <Link
            key={tab.label}
            href={tab.href}
            className={`rounded-pill px-3 py-1 text-label font-semibold transition-colors duration-hover ease-hover ${
              (tab.label === 'Kõik' && !typeFilter) || (typeFilter && tab.label === typeLabels[typeFilter])
                ? 'bg-primaryLight text-primaryDark'
                : 'border border-border bg-bgPage text-ink-muted hover:text-primary'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <DataTable
        columns={[
          {
            key: 'client',
            label: 'Klient',
            render: (row) => (
              <Link href={detailPath(row.id)} className="font-semibold text-primary hover:text-primaryHover">
                {row.client}
              </Link>
            ),
          },
          { key: 'type', label: 'Tüüp', render: (row) => typeLabels[row.type] },
          { key: 'county', label: 'Maakond' },
          { key: 'cadastres', label: 'Katastrid', render: (row) => (row.cadastres > 0 ? String(row.cadastres) : '—') },
          { key: 'createdAt', label: 'Loodud', render: (row) => formatDateTime(row.createdAt) },
          {
            key: 'routedAt',
            label: 'Saadetud',
            render: (row) => (row.routedAt ? `${formatDateTime(row.routedAt)} (${String(row.sentCount)})` : '—'),
          },
          {
            key: 'status',
            label: 'Olek',
            render: (row) =>
              row.respondedCount > 0 ? (
                <span className="rounded-pill bg-info-light px-2 py-0.5 text-label font-semibold text-info">
                  vastatud ({String(row.respondedCount)})
                </span>
              ) : row.status === 'routed' ? (
                <span className="rounded-pill bg-primary-light px-2 py-0.5 text-label font-semibold text-primaryDark">
                  saadetud
                </span>
              ) : (
                <span className="rounded-pill bg-bg-mist px-2 py-0.5 text-label font-semibold text-ink-muted">
                  uus
                </span>
              ),
          },
          {
            key: 'actions',
            label: 'Tegevused',
            render: (row) => (
              <Link href={detailPath(row.id)} className="text-label font-semibold text-primary hover:text-primaryHover">
                Ava
              </Link>
            ),
          },
        ]}
        rows={rows}
        emptyLabel="Uusi päringuid ei ole — vormide esitamised ilmuvad siia."
      />

      {detailRequest ? (
        (() => {
          const payload = asRecord(detailRequest.payload)
          const attachments = asStringArray(detailRequest.attachments)
          const responded = respondedByPartner.get(detailRequest.id) ?? new Map<string, string>()
          return (
            <section className="mt-md space-y-sm rounded-card border border-border bg-bgPage p-md">
              <header className="flex flex-wrap items-center justify-between gap-sm">
                <h2 className="font-heading text-h4 font-bold text-ink">
                  Päring #{detailRequest.id.slice(0, 8)} · {typeLabels[detailRequest.type]}
                </h2>
                <Link href="/admin/requests" className={secondaryButtonClass}>
                  Sulge detail
                </Link>
              </header>

              <div className="grid grid-cols-1 gap-sm lg:grid-cols-2">
                <div className="rounded-input border border-border bg-bg-mist p-sm">
                  <h3 className="mb-xs text-label font-semibold text-ink">Päringu sisu</h3>
                  {payloadDefinitionList(payload)}
                  <div className="mt-sm border-t border-border pt-xs text-bodySm text-ink-muted">
                    <p className="font-semibold text-ink">Ei edastata partnerile</p>
                    <p>Nõusolek: {formatDateTime(detailRequest.consentAt)}</p>
                    <p>Allikaleht: {detailRequest.pageSlug ?? '—'}</p>
                  </div>
                </div>

                <div className="rounded-input border border-border bg-bg-mist p-sm">
                  <h3 className="mb-xs text-label font-semibold text-ink">Manused</h3>
                  {attachments.length === 0 ? (
                    <p className="text-bodySm text-ink-muted">Manuseid ei ole.</p>
                  ) : (
                    <ul className="text-bodySm text-ink">
                      {attachments.map((attachment) => (
                        <li key={attachment}>{attachment}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <form
                action={forwardServiceRequestAction}
                className="rounded-input border border-border bg-bg-mist p-sm"
              >
                <input type="hidden" name="id" value={detailRequest.id} />
                <h3 className="mb-xs text-label font-semibold text-ink">
                  Suunamine → partnerid ({typeLabels[detailRequest.type]})
                </h3>
                <p className="mb-xs text-bodySm text-ink-muted">
                  Partnerile edastatakse vaid nimi, telefon, e-post ja kinnistuandmed — mitte
                  isikukood, IP, allikas ega nõusolekuandmed. Manused kui lingid, kehtivad 14 päeva.
                </p>
                <ul className="mb-xs space-y-1">
                  {routingCandidates.length === 0 ? (
                    <li className="text-bodySm text-ink-muted">
                      Ühtegi aktiivset partnerit ei kata seda teenust/maakonda —{' '}
                      <Link href="/admin/requests/partners" className="text-primary underline">
                        lisa partner
                      </Link>
                    </li>
                  ) : null}
                  {routingCandidates.map((candidate) => {
                    const respondedAt = responded.get(candidate.partner.id)
                    return (
                      <li key={candidate.partner.id} className="text-bodySm text-ink">
                        <label className="flex flex-wrap items-center gap-xs">
                          <input
                            type="checkbox"
                            name="partnerIds"
                            value={candidate.partner.id}
                            defaultChecked={candidate.preselected}
                            disabled={candidate.alreadySent}
                          />
                          <span className="font-semibold">{candidate.partner.name}</span>
                          <span className="text-ink-muted">
                            avatud {String(candidate.openCount)}/{String(candidate.partner.capacity)}
                            {candidate.countyMatch ? ' · maakond kattub' : ' · Kogu Eesti'}
                          </span>
                          {candidate.alreadySent ? (
                            <span className="text-ink-muted">saadetud</span>
                          ) : null}
                          {candidate.atCapacity && !candidate.alreadySent ? (
                            <span className="font-semibold text-danger">Maht täidetud</span>
                          ) : null}
                          {respondedAt ? (
                            <span className="rounded-pill bg-info-light px-2 py-0.5 text-label font-semibold text-info">
                              vastanud {formatDateTime(respondedAt)}
                            </span>
                          ) : null}
                        </label>
                      </li>
                    )
                  })}
                </ul>
                <button type="submit" className={primaryButtonClass}>
                  Saada valitud partneritele
                </button>
              </form>

              <div className="rounded-input border border-border bg-bg-mist p-sm">
                <h3 className="mb-xs text-label font-semibold text-ink">Edastamise log</h3>
                {forwardLog.length === 0 ? (
                  <p className="text-bodySm text-ink-muted">Päringut pole veel edastatud.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left">
                      <thead>
                        <tr className="border-b border-border">
                          <th scope="col" className="h-8 px-2 text-label font-semibold text-ink-muted">Aeg</th>
                          <th scope="col" className="h-8 px-2 text-label font-semibold text-ink-muted">Partner</th>
                          <th scope="col" className="h-8 px-2 text-label font-semibold text-ink-muted">Kande olek</th>
                          <th scope="col" className="h-8 px-2 text-label font-semibold text-ink-muted">Vastanud</th>
                          <th scope="col" className="h-8 px-2 text-label font-semibold text-ink-muted">Tegevused</th>
                        </tr>
                      </thead>
                      <tbody>
                        {forwardLog.map((row) => (
                          <tr key={row.entryId} className="border-b border-border last:border-b-0">
                            <td className="h-8 px-2 text-bodySm text-ink">{formatDateTime(row.createdAt)}</td>
                            <td className="h-8 px-2 text-bodySm text-ink">
                              {row.partnerName}
                              {row.retry ? ' (kordussaade)' : ''}
                              {row.recipient ? <span className="block text-ink-muted">{row.recipient}</span> : null}
                            </td>
                            <td className="h-8 px-2 text-bodySm">
                              {row.action === 'request.mark_responded' ? (
                                <span className="text-info">märgitud vastanuks</span>
                              ) : row.delivered ? (
                                <span className="text-primary">saadetud</span>
                              ) : (
                                <span className="text-danger">nurjus</span>
                              )}
                            </td>
                            <td className="h-8 px-2 text-bodySm text-ink">—</td>
                            <td className="h-8 px-2">
                              {row.action === 'request.forward' && row.partnerId ? (
                                <div className="flex items-center gap-xs">
                                  <form action={markRequestRespondedAction}>
                                    <input type="hidden" name="id" value={detailRequest.id} />
                                    <input type="hidden" name="partnerId" value={row.partnerId} />
                                    <button
                                      type="submit"
                                      className="text-label font-semibold text-primary hover:text-primaryHover"
                                    >
                                      Märgi vastatuks
                                    </button>
                                  </form>
                                  <form action={retryRequestForwardAction}>
                                    <input type="hidden" name="id" value={detailRequest.id} />
                                    <input type="hidden" name="partnerId" value={row.partnerId} />
                                    <button
                                      type="submit"
                                      className="text-label font-semibold text-ink-muted hover:text-primary"
                                    >
                                      Saada uuesti
                                    </button>
                                  </form>
                                </div>
                              ) : (
                                '—'
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          )
        })()
      ) : null}
    </div>
  )
}
