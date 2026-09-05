import Link from 'next/link'

import { LeadsKanban, type KanbanCardView } from './_components/LeadsKanban'
import { findDuplicateLead, leadSlaBadge } from './_components/lead-flow'
import { createLeadAction } from '../../_actions/ops'
import { DataTable } from '../../_components/DataTable'
import { ErrorNotice } from '../../_components/ErrorNotice'
import {
  FormField,
  FormTextareaField,
  primaryButtonClass,
  secondaryButtonClass,
} from '../../_components/FormField'
import { PageHeader } from '../../_components/PageHeader'
import { requireAdminRepositories } from '../../_lib/admin'
import { formatDateTime, LeadStatusPill } from '../../_lib/labels'
import { can, leadInScope, leadScope } from '../../_lib/permissions'

import type { AuditEntryDoc } from '@/lib/data/repositories'
import { getRepositories } from '@/lib/data/runtime'

export const metadata = { title: 'Juhtlõimed' }

interface NextActionView {
  dueAt: string
  overdue: boolean
}

export default async function AdminLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{
    viga?: string
    teade?: string
    vaade?: string
    allikas?: string
    spetsialist?: string
    sla?: string
  }>
}) {
  const { viga, teade, vaade, allikas, spetsialist, sla } = await searchParams
  const { session } = await requireAdminRepositories()
  if (!can(session.role, 'leads:read')) {
    return (
      <div>
        <PageHeader title="Juhtlõimed" />
        <div className="rounded-input border border-danger bg-danger-light px-md py-sm text-bodySm text-danger">
          Ainult administraatorile ja spetsialistidele.
        </div>
      </div>
    )
  }

  const repositories = await getRepositories()
  const scope = leadScope(session.role, session.userId)
  if (scope.kind === 'none') {
    return (
      <div>
        <PageHeader title="Juhtlõimed" />
        <div className="rounded-input border border-border bg-bg-mist px-md py-sm text-bodySm text-ink-muted">
          Müüjal puudub ligipääs juhtlõimedele.
        </div>
      </div>
    )
  }

  const { docs: leads } = await repositories.find({
    collection: 'leads',
    sort: '-createdAt',
    limit: 200,
  })
  const scopedLeads = leads.filter((lead) =>
    leadInScope(scope, { assignedSpecialistId: lead.assignedSpecialistId }),
  )

  const { docs: specialists } = await repositories.find({
    collection: 'specialists',
    sort: 'name',
    pagination: false,
  })
  const specialistNames = new Map(
    specialists.map((specialist) => [specialist.id, specialist.name]),
  )

  const { docs: leadAudits } = await repositories.find({
    collection: 'audit-entry',
    where: { entityType: { equals: 'lead' } },
    sort: '-createdAt',
    pagination: false,
  })
  const nextActionByLead = new Map<string, NextActionView>()
  const noteCounts = new Map<string, number>()
  for (const entry of leadAudits as (AuditEntryDoc & { entityId?: string | null })[]) {
    if (!entry.entityId) continue
    if (entry.action === 'lead.next_action') {
      const after = entry.after as { dueAt?: unknown } | null
      if (!nextActionByLead.has(entry.entityId) && typeof after?.dueAt === 'string') {
        nextActionByLead.set(entry.entityId, {
          dueAt: after.dueAt,
          overdue: Date.parse(after.dueAt) < Date.now(),
        })
      }
    }
    if (entry.action === 'lead.note') {
      noteCounts.set(entry.entityId, (noteCounts.get(entry.entityId) ?? 0) + 1)
    }
  }

  const filteredLeads = scopedLeads.filter((lead) => {
    if (allikas && lead.formName !== allikas) return false
    if (spetsialist === 'määramata' && lead.assignedSpecialistId) return false
    if (spetsialist && spetsialist !== 'määramata' && lead.assignedSpecialistId !== spetsialist) {
      return false
    }
    if (sla === '1' && !leadSlaBadge(lead.createdAt, lead.status)) return false
    return true
  })

  const nowMs = Date.now()
  const kanbanCards: KanbanCardView[] = filteredLeads.map((lead) => {
    const sla = leadSlaBadge(lead.createdAt, lead.status, nowMs)
    const nextAction = nextActionByLead.get(lead.id)
    const duplicate = findDuplicateLead(scopedLeads, lead, lead.id, nowMs)
    return {
      id: lead.id,
      contactName: lead.contactName,
      formName: lead.formName,
      cadastr: lead.cadastr ?? null,
      status: lead.status,
      assignedSpecialistId: lead.assignedSpecialistId,
      assignedSpecialistName: lead.assignedSpecialistId
        ? (specialistNames.get(lead.assignedSpecialistId) ?? null)
        : null,
      sla,
      nextActionAt: nextAction ? formatDateTime(nextAction.dueAt) : null,
      duplicateOfId: duplicate?.id ?? null,
      mine: lead.assignedSpecialistId === session.userId,
    }
  })

  const sourceOptions = [
    ...new Set(scopedLeads.map((lead) => lead.formName)),
  ].map((formName) => ({ value: formName, label: formName }))

  const filterLink = (label: string, params: Record<string, string | undefined>) => {
    const search = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (value) search.set(key, value)
    }
    const query = search.toString()
    return (
      <Link
        key={label}
        href={query ? `/admin/leads?${query}` : '/admin/leads'}
        className={`rounded-pill px-3 py-1 text-label font-semibold transition-colors duration-hover ease-hover ${
          label.startsWith('•')
            ? 'bg-primaryLight text-primaryDark'
            : 'border border-border bg-bgPage text-ink-muted hover:text-primary'
        }`}
      >
        {label.replace('• ', '')}
      </Link>
    )
  }

  const tableRows = filteredLeads.map((lead) => {
    const nextAction = nextActionByLead.get(lead.id)
    const duplicate = findDuplicateLead(scopedLeads, lead, lead.id, nowMs)
    return {
      id: lead.id,
      createdAt: lead.createdAt,
      contactName: lead.contactName,
      phone: lead.phone,
      email: lead.email,
      source: `${lead.formName}${lead.pageSlug ? ` · ${lead.pageSlug}` : ''}`,
      cadastr: lead.cadastr,
      status: lead.status,
      specialistName: lead.assignedSpecialistId
        ? (specialistNames.get(lead.assignedSpecialistId) ?? '—')
        : 'määramata',
      sla: leadSlaBadge(lead.createdAt, lead.status, nowMs),
      nextActionAt: nextAction?.dueAt ?? null,
      nextOverdue: nextAction?.overdue ?? false,
      noteCount: noteCounts.get(lead.id) ?? 0,
      duplicateOfId: duplicate?.id ?? null,
    }
  })

  const view = vaade === 'tabel' ? 'tabel' : 'kanban'
  const activeFilters: Record<string, string | undefined> = {
    allikas,
    spetsialist,
    ...(sla === '1' ? { sla: '1' } : {}),
    ...(view === 'tabel' ? { vaade: 'tabel' } : {}),
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
        title="Juhtlõimed"
        description={
          scope.kind === 'assigned-specialist'
            ? 'Näitate ainult endale määratud juhtlõimesid.'
            : 'Sissetulekud vormidelt koos kontaktide, SLA ja olekuga.'
        }
      />

      <div className="mb-sm flex flex-wrap items-center gap-xs">
        {filterLink(view === 'kanban' ? '• Kanban' : 'Kanban', { ...activeFilters, vaade: undefined })}
        {filterLink(view === 'tabel' ? '• Tabel' : 'Tabel', { ...activeFilters, vaade: 'tabel' })}
        {filterLink(activeFilters.allikas ? `• ${allikas ?? ''}` : 'Kõik allikad', {
          ...activeFilters,
          allikas: undefined,
        })}
        {sourceOptions.map((option) =>
          option.value === allikas ? null : filterLink(option.label, { ...activeFilters, allikas: option.value }),
        )}
        {filterLink(sla === '1' ? '• Ainult SLA ületanud' : 'Ainult SLA ületanud', {
          ...activeFilters,
          sla: sla === '1' ? undefined : '1',
        })}
      </div>

      <details className="mb-sm rounded-card border border-border bg-bgPage p-md">
        <summary className={`${secondaryButtonClass} cursor-pointer list-none`}>
          + Uus juhtlõige (käsitsi)
        </summary>
        <form action={createLeadAction} className="mt-sm max-w-container-sm space-y-sm">
          <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
            <FormField label="Nimi" name="contactName" required />
            <FormField label="Telefon" name="phone" type="tel" />
            <FormField label="E-post" name="email" type="email" />
            <FormField label="Katastritunnus" name="cadastr" />
            <FormField label="Allikas" name="source" placeholder="nt telefonikõne" />
          </div>
          <FormTextareaField label="Sisemine märkus" name="internalComment" rows={2} />
          <label className="flex items-center gap-xs text-bodySm text-ink">
            <input type="checkbox" name="consent" required />
            Klient nõustus andmete töötlemisega (nõusolek salvestatakse)
          </label>
          <button type="submit" className={primaryButtonClass}>
            Loo juhtlõige
          </button>
        </form>
      </details>

      {view === 'kanban' ? (
        <LeadsKanban cards={kanbanCards} />
      ) : (
        <DataTable
          columns={[
            { key: 'createdAt', label: 'Kuupäev', render: (row) => formatDateTime(row.createdAt) },
            {
              key: 'contactName',
              label: 'Nimi',
              render: (row) => (
                <Link
                  href={`/admin/leads/${row.id}`}
                  className="font-semibold text-primary hover:text-primaryHover"
                >
                  {row.contactName}
                </Link>
              ),
            },
            { key: 'phone', label: 'Telefon', render: (row) => row.phone ?? '—' },
            { key: 'email', label: 'E-post', render: (row) => row.email ?? '—' },
            { key: 'source', label: 'Allikas' },
            { key: 'cadastr', label: 'Katastrid', render: (row) => row.cadastr ?? '—' },
            {
              key: 'status',
              label: 'Olek',
              render: (row) => (
                <LeadStatusPill status={row.status} />
              ),
            },
            { key: 'specialistName', label: 'Spetsialist' },
            {
              key: 'sla',
              label: 'SLA',
              render: (row) =>
                row.sla ? (
                  <span
                    className={`rounded-pill px-2 py-0.5 text-label font-semibold ${
                      row.sla.level === 'red'
                        ? 'bg-danger-light text-danger'
                        : 'bg-info-light text-info'
                    }`}
                  >
                    {row.sla.label}
                  </span>
                ) : (
                  '—'
                ),
            },
            {
              key: 'nextActionAt',
              label: 'Järgmine tegevus',
              render: (row) =>
                row.nextActionAt ? (
                  <span className={row.nextOverdue ? 'font-semibold text-danger' : ''}>
                    {formatDateTime(row.nextActionAt)}
                  </span>
                ) : (
                  '—'
                ),
            },
            { key: 'noteCount', label: 'Märkmeid' },
            {
              key: 'duplicate',
              label: 'Duplikaat',
              render: (row) =>
                row.duplicateOfId ? (
                  <Link
                    href={`/admin/leads/${row.duplicateOfId}`}
                    className="text-info underline"
                  >
                    võimalik duplikaat
                  </Link>
                ) : (
                  '—'
                ),
            },
          ]}
          rows={tableRows}
          emptyLabel="Juhtlõimed puuduvad — vormide esitamised ilmuvad siia automaatselt."
        />
      )}
    </div>
  )
}
