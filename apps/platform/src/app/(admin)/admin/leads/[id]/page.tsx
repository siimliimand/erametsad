import Link from 'next/link'
import { notFound } from 'next/navigation'

import {
  addLeadNoteAction,
  assignLeadSpecialistAction,
  moveLeadStatusFormAction,
  setLeadNextActionAction,
} from '../../../_actions/ops'
import { ErrorNotice } from '../../../_components/ErrorNotice'
import {
  FormField,
  FormSelectField,
  FormTextareaField,
  primaryButtonClass,
} from '../../../_components/FormField'
import { PageHeader } from '../../../_components/PageHeader'
import { requireAdminRepositories } from '../../../_lib/admin'
import { formatDateTime, leadStatusLabels, LeadStatusPill } from '../../../_lib/labels'
import { can, leadInScope, leadScope } from '../../../_lib/permissions'
import { roundRobinSuggestion } from '../_components/lead-flow'

import { getRepositories } from '@/lib/data/runtime'
import type { Specialist } from '@/lib/data/schema'
import { leadStatuses } from '@/lib/data/schema'

const OPEN_STATUSES_FOR_SUGGESTION: ReadonlySet<string> = new Set(['new', 'contacted'])

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

interface TimelineEntry {
  id: string
  action: string
  actorName: string
  createdAt: string
  text: string | null
  fromStatus: string | null
  toStatus: string | null
}

export default async function LeadDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ viga?: string; teade?: string }>
}) {
  const { id } = await params
  const { viga, teade } = await searchParams
  const { session } = await requireAdminRepositories()
  if (!can(session.role, 'leads:read')) notFound()

  const repositories = await getRepositories()
  const lead = await repositories.findByID({ collection: 'leads', id })
  if (!lead) notFound()
  const scope = leadScope(session.role, session.userId)
  if (
    !leadInScope(scope, {
      assignedSpecialistId: lead.assignedSpecialistId,
    })
  ) {
    notFound()
  }

  const { docs: specialists } = await repositories.find({
    collection: 'specialists',
    sort: 'name',
    pagination: false,
  })

  // Consent record: the latest cookie-consent decision tied to the lead's
  // stored IP hash; a marketing rejection marks contact as forbidden.
  let consentWithdrawn: string | null = null
  if (lead.ipHash) {
    const { docs: consentEntries } = await repositories.find({
      collection: 'consent-log',
      where: { ipHash: { equals: lead.ipHash } },
      sort: '-createdAt',
      limit: 1,
    })
    const latest = consentEntries[0]
    const categories = latest?.categories as { marketing?: unknown } | null
    if (latest && categories?.marketing === false) {
      consentWithdrawn = latest.createdAt
    }
  }

  const { docs: leadAudits } = await repositories.find({
    collection: 'audit-entry',
    where: {
      and: [
        { entityType: { equals: 'lead' } },
        { entityId: { equals: lead.id } },
      ],
    },
    sort: '-createdAt',
    pagination: false,
  })

  const actorIds = [
    ...new Set(
      leadAudits
        .map((entry) => entry.actorId)
        .filter((actorId): actorId is string => Boolean(actorId)),
    ),
  ]

  const { docs: actors } =
    actorIds.length > 0
      ? await repositories.find({
          collection: 'users',
          where: { id: { in: actorIds } },
          pagination: false,
        })
      : { docs: [] }
  const actorNames = new Map(
    actors.map((actor) => [actor.id, actor.name ?? actor.email]),
  )

  const timeline: TimelineEntry[] = leadAudits.map((entry) => {
    const after = entry.after as Record<string, unknown> | null
    const before = entry.before as Record<string, unknown> | null
    return {
      id: entry.id,
      action: entry.action,
      actorName: entry.actorId ? (actorNames.get(entry.actorId) ?? entry.actorId) : 'süsteem',
      createdAt: entry.createdAt,
      text: typeof after?.text === 'string' ? after.text : null,
      fromStatus: typeof before?.status === 'string' ? before.status : null,
      toStatus: typeof after?.status === 'string' ? after.status : null,
    }
  })

  let nextAction: { dueAt: string; note: string | null } | null = null
  for (const entry of leadAudits) {
    if (entry.action !== 'lead.next_action') continue
    const after = entry.after as { dueAt?: unknown; note?: unknown } | null
    if (typeof after?.dueAt === 'string') {
      nextAction = {
        dueAt: after.dueAt,
        note: typeof after.note === 'string' ? after.note : null,
      }
      break
    }
  }

  // Round-robin suggestion: active specialists, fewest open-pipeline leads first.
  const openCounts = new Map<string, number>()
  for (const specialist of specialists) {
    openCounts.set(specialist.id, 0)
  }
  const { docs: allLeads } = await repositories.find({
    collection: 'leads',
    where: { assignedSpecialist: { exists: true } },
    pagination: false,
  })
  for (const row of allLeads) {
    if (!row.assignedSpecialistId || !OPEN_STATUSES_FOR_SUGGESTION.has(row.status)) continue
    openCounts.set(
      row.assignedSpecialistId,
      (openCounts.get(row.assignedSpecialistId) ?? 0) + 1,
    )
  }
  const suggestion = roundRobinSuggestion(
    specialists.map((specialist: Specialist) => ({
      id: specialist.id,
      name: specialist.name,
      active: specialist.active,
      openLeadCount: openCounts.get(specialist.id) ?? 0,
    })),
  )

  const statusOptions = leadStatuses.map((status) => ({
    value: status,
    label: leadStatusLabels[status],
  }))
  const cadastralLink = lead.cadastr
    ? `https://xgis.maaamet.ee/xGIS/ruumikaljud?query=${encodeURIComponent(lead.cadastr)}`
    : null
  const nextOverdue = nextAction ? Date.parse(nextAction.dueAt) < Date.now() : false

  return (
    <div>
      {viga ? <ErrorNotice message={viga} /> : null}
      {teade ? (
        <div className="mb-md rounded-input border border-primary bg-primary-light px-md py-sm text-bodySm text-primaryDark">
          {teade}
        </div>
      ) : null}
      <PageHeader
        title={`${lead.contactName} · #${lead.id.slice(0, 8)}`}
        description="Juhtlõime detail: allikas, kontaktid, nõusolek, märkmed ja järgmine tegevus."
        backHref="/admin/leads"
        actions={<LeadStatusPill status={lead.status} />}
      />

      {consentWithdrawn ? (
        <div className="mb-md rounded-input border border-danger bg-danger-light px-md py-sm text-bodySm text-danger">
          Nõusolek tagasi võetud {formatDateTime(consentWithdrawn)} — kontakt keelatud.
        </div>
      ) : null}

      <div className="mb-sm grid max-w-container-sm grid-cols-1 gap-sm rounded-card border border-border bg-bgPage p-md sm:grid-cols-2">
        <Field label="Allikavorm">{lead.formName}</Field>
        <Field label="Lehekülg">{lead.pageSlug ?? '—'}</Field>
        <Field label="Telefon">
          {lead.phone ? (
            <a className="text-primary underline" href={`tel:${lead.phone}`}>
              {lead.phone}
            </a>
          ) : (
            '—'
          )}
        </Field>
        <Field label="E-post">
          {lead.email ? (
            <a className="text-primary underline" href={`mailto:${lead.email}`}>
              {lead.email}
            </a>
          ) : (
            '—'
          )}
        </Field>
        <Field label="Katastritunnus">
          {lead.cadastr && cadastralLink ? (
            <a className="text-primary underline" href={cadastralLink} target="_blank" rel="noreferrer">
              {lead.cadastr} (Maa-amet)
            </a>
          ) : (
            (lead.cadastr ?? '—')
          )}
        </Field>
        <Field label="Allikas">{lead.source ?? '—'}</Field>
        <Field label="Nõusolek turunduseks">
          {consentWithdrawn
            ? `tagasi võetud ${formatDateTime(consentWithdrawn)}`
            : `${formatDateTime(lead.consentAt)} ✓`}
        </Field>
        <Field label="Loodud">{formatDateTime(lead.createdAt)}</Field>
        <Field label="Varem sisestatud märkus">{lead.internalComment ?? '—'}</Field>
        <Field label="Järgmine tegevus">
          {nextAction ? (
            <span className={nextOverdue ? 'font-semibold text-danger' : ''}>
              {formatDateTime(nextAction.dueAt)}
              {nextAction.note ? ` — ${nextAction.note}` : ''}
              {nextOverdue ? ' (ületatud)' : ''}
            </span>
          ) : (
            '—'
          )}
        </Field>
      </div>

      {can(session.role, 'leads:write') ? (
        <div className="mb-sm grid max-w-container-sm grid-cols-1 gap-sm">
          <form
            action={moveLeadStatusFormAction}
            className="space-y-sm rounded-card border border-border bg-bgPage p-md"
          >
            <input type="hidden" name="id" value={lead.id} />
            <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
              <FormSelectField label="Oleku muutus" name="status" options={statusOptions} defaultValue={lead.status} />
            </div>
            <FormTextareaField
              label="Märkus / põhjus"
              name="note"
              rows={2}
              hint="Kohustuslik kvalifitseerimisel ja mittekvalifitseerimisel (vähemalt 5 tähemärki)."
            />
            <button type="submit" className={primaryButtonClass}>
              Muuda olekut
            </button>
          </form>

          <form
            action={assignLeadSpecialistAction}
            className="space-y-sm rounded-card border border-border bg-bgPage p-md"
          >
            <input type="hidden" name="id" value={lead.id} />
            {suggestion ? (
              <p className="text-bodySm text-info">
                Soovitus: {suggestion.name} (järjekorras järgmine, {String(suggestion.openLeadCount)} avatud juhtlõimet)
              </p>
            ) : null}
            <FormSelectField
              label="Määratud spetsialist"
              name="assignedSpecialist"
              options={[
                { value: '', label: 'Määramata' },
                ...specialists.map((specialist) => ({
                  value: specialist.id,
                  label: `${specialist.name}${suggestion?.id === specialist.id ? ' — soovitus' : ''}`,
                })),
              ]}
              defaultValue={lead.assignedSpecialistId ?? ''}
            />
            <button type="submit" className={primaryButtonClass}>
              Määra
            </button>
          </form>

          <form
            action={setLeadNextActionAction}
            className="space-y-sm rounded-card border border-border bg-bgPage p-md"
          >
            <input type="hidden" name="id" value={lead.id} />
            <FormField label="Järgmise tegevuse kuupäev" name="dueAt" type="datetime-local" required />
            <FormField label="Meeldetuletuse märkus" name="note" />
            <button type="submit" className={primaryButtonClass}>
              Sea meeldetuletus
            </button>
          </form>

          <form
            action={addLeadNoteAction}
            className="space-y-sm rounded-card border border-border bg-bgPage p-md"
          >
            <input type="hidden" name="id" value={lead.id} />
            <FormTextareaField label="Lisa märkus" name="text" rows={3} required />
            <button type="submit" className={primaryButtonClass}>
              Salvesta märkus
            </button>
          </form>
        </div>
      ) : null}

      <section className="max-w-container-sm rounded-card border border-border bg-bgPage p-md">
        <h2 className="mb-sm font-heading text-h4 font-bold text-ink">Märkmete ajajoon</h2>
        {timeline.length === 0 ? (
          <p className="text-bodySm text-ink-muted">Märkmeid ei ole.</p>
        ) : (
          <ol className="space-y-xs">
            {timeline.map((entry) => (
              <li
                key={entry.id}
                className="rounded-input border border-border bg-bg-mist px-sm py-xs text-bodySm"
              >
                <span className="font-semibold text-ink">
                  {entry.action === 'lead.note'
                    ? 'Märkus'
                    : entry.action === 'lead.status'
                      ? 'Oleku muutus'
                      : entry.action === 'lead.assign'
                        ? 'Määramine'
                        : entry.action === 'lead.next_action'
                          ? 'Järgmine tegevus'
                          : entry.action === 'lead.create_manual'
                            ? 'Käsitsi loodud'
                            : entry.action}
                </span>
                {entry.fromStatus && entry.toStatus ? (
                  <span className="text-ink-muted">
                    {' '}
                    {leadStatusLabels[entry.fromStatus as (typeof leadStatuses)[number]]} →{' '}
                    {leadStatusLabels[entry.toStatus as (typeof leadStatuses)[number]]}
                  </span>
                ) : null}
                {entry.text ? <span className="text-ink"> — {entry.text}</span> : null}
                <span className="block text-ink-muted">
                  {entry.actorName} · {formatDateTime(entry.createdAt)}
                </span>
              </li>
            ))}
          </ol>
        )}
        <p className="mt-xs text-bodySm text-ink-muted">
          Ajajoon on lõppematu — kirjeid ei saa muuta ega kustutada.{' '}
          <Link href="/admin/leads" className="text-primary underline">
            Tagasi loendisse
          </Link>
        </p>
      </section>
    </div>
  )
}
