'use client'

import Link from 'next/link'
import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'

import { AuditDiff } from './AuditDiff'
import { auditEntryDenies, entityTypeLabel, groupLabel, userAgentFamily } from './action-registry'
import { Drawer } from '../../../_components/ui/Drawer'
import { formatAuditDateTime, userRoleLabels } from '../../../_lib/labels'

import type { UserRole } from '@/lib/data/schema'

export interface AuditDrawerRelatedEntry {
  id: string
  createdAt: string
  action: string
  entityType: string | null
  entityId: string | null
  actorName: string
  /** True when the entry is already loaded and can open in this drawer. */
  inList: boolean
}

export interface AuditDrawerEntry {
  id: string
  createdAt: string
  action: string
  actionGroup: string
  entityType: string | null
  entityId: string | null
  actorId: string | null
  actorName: string
  actorRole: UserRole | null
  /** Era column or the JSON fallback resolved by auditEntryReason. */
  reason: string | null
  sessionId: string | null
  ipHash: string | null
  userAgent: string | null
  before: unknown
  after: unknown
  prevHash: string | null
  hash: string | null
  related: AuditDrawerRelatedEntry[]
}

const SECRET_NOTE = 'Salajased väljad (näiteks tagatishind, võtmed, isikukood) on maskeeritud.'

const sectTitleClass = 'font-mono text-[11px] font-semibold uppercase tracking-wide text-inkMuted'

/**
 * Audit result chip (demo 14-audit-log "Tulemus" chip: ✓ OK / ✕ Keeldutud).
 * Not the shared StatusChip primitive: its variant union and label map are
 * closed and carry no OK/Keeldutud pair, so this local chip mirrors the
 * primitive's pill classes and the demo's active/danger triads instead.
 */
function ResultChip({ denies }: { denies: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-pill px-2 py-0.5 text-label font-medium ${
        denies
          ? 'bg-danger-light text-danger'
          : 'bg-[var(--st-active-bg)] text-[color:var(--st-active-text)]'
      }`}
    >
      <span aria-hidden="true">{denies ? '✕' : '✓'}</span>
      {denies ? 'Keeldutud' : 'OK'}
    </span>
  )
}

function RelatedRow({ related }: { related: AuditDrawerRelatedEntry }) {
  const openControl = related.inList ? (
    <OpenAuditEntryButton entryId={related.id} />
  ) : (
    <Link
      href={`/admin/audit?entry=${encodeURIComponent(related.id)}`}
      className="text-label font-semibold text-primary transition-colors duration-hover ease-hover hover:text-primaryHover"
    >
      Vaata
    </Link>
  )
  return (
    <li className="flex items-center gap-3 border-b border-border py-2 last:border-b-0">
      <time dateTime={related.createdAt} className="shrink-0 font-mono text-[11px] text-inkMuted">
        {formatAuditDateTime(related.createdAt)}
      </time>
      <span className="shrink-0 font-mono text-bodySm text-ink">{related.action}</span>
      <span className="min-w-0 flex-1 truncate text-bodySm text-inkMuted">{related.actorName}</span>
      {openControl}
    </li>
  )
}

function DetailField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-inkMuted">{label}</dt>
      <dd className="min-w-0 break-all">{children}</dd>
    </>
  )
}

function AuditEntryDetail({ entry }: { entry: AuditDrawerEntry }) {
  const payloadJson = JSON.stringify(
    {
      id: entry.id,
      createdAt: entry.createdAt,
      action: entry.action,
      actorId: entry.actorId,
      entityType: entry.entityType,
      entityId: entry.entityId,
      before: entry.before,
      after: entry.after,
      prevHash: entry.prevHash,
      hash: entry.hash,
    },
    null,
    2,
  )
  return (
    <div className="space-y-md">
      <section aria-label="Üldandmed">
        <h3 className={sectTitleClass}>Üldandmed</h3>
        <dl className="mt-2 grid grid-cols-[10rem_1fr] gap-x-sm gap-y-2xs text-bodySm text-ink">
          <dt className="text-inkMuted">Tegija</dt>
          <dd>
            {entry.actorName}
            {entry.actorRole ? ` (${userRoleLabels[entry.actorRole]})` : ''}
          </dd>
          <dt className="text-inkMuted">Aeg</dt>
          <dd>
            <time dateTime={entry.createdAt}>{formatAuditDateTime(entry.createdAt)}</time>
          </dd>
          <dt className="text-inkMuted">Olem</dt>
          <dd>
            {entityTypeLabel(entry.entityType)}
            {entry.entityId ? (
              <span className="ml-1 font-mono text-inkMuted" title={entry.entityId}>
                #{entry.entityId.slice(0, 8)}
              </span>
            ) : null}
          </dd>
          <dt className="text-inkMuted">Rühm</dt>
          <dd>{groupLabel(entry.actionGroup)}</dd>
        </dl>
      </section>

      <section aria-label="Kontekst">
        <h3 className={sectTitleClass}>Kontekst</h3>
        <dl className="mt-2 grid grid-cols-[10rem_1fr] gap-x-sm gap-y-2xs text-bodySm text-ink">
          <DetailField label="Põhjus">
            {entry.reason ?? <span className="text-inkMuted">—</span>}
          </DetailField>
          <DetailField label="Seanss">
            {entry.sessionId ? (
              <span className="font-mono" title={entry.sessionId}>
                {entry.sessionId.slice(0, 8)}
              </span>
            ) : (
              <span className="text-inkMuted">—</span>
            )}
          </DetailField>
          <DetailField label="IP-räsi">
            {entry.ipHash ? (
              <span className="font-mono" title={entry.ipHash}>
                {entry.ipHash.slice(0, 12)}…
              </span>
            ) : (
              <span className="text-inkMuted">—</span>
            )}
          </DetailField>
          <DetailField label="Brauser">
            {entry.userAgent
              ? `${userAgentFamily(entry.userAgent)} (${entry.userAgent.slice(0, 60)})`
              : '—'}
          </DetailField>
        </dl>
      </section>

      <section aria-label="Sündmuse andmed">
        <h3 className={sectTitleClass}>Sündmuse andmed (payload)</h3>
        <pre
          tabIndex={0}
          className="mt-2 max-h-[280px] overflow-auto whitespace-pre rounded-card border border-border bg-bgMist p-3 font-mono text-[12px] leading-[18px] text-ink"
        >
          {payloadJson}
        </pre>
      </section>

      <section aria-label="Enne ja järel">
        <h3 className={sectTitleClass}>Enne / Järel</h3>
        <div className="mt-2">
          <AuditDiff before={entry.before} after={entry.after} />
        </div>
        <p className="mt-xs text-label text-inkMuted">{SECRET_NOTE}</p>
      </section>

      <section aria-label="Seotud kirjed">
        <h3 className={sectTitleClass}>Seotud kirjed</h3>
        {entry.related.length === 0 ? (
          <p className="mt-2 text-bodySm text-inkMuted">Seotud kirjeid ei ole.</p>
        ) : (
          <ul className="mt-2">
            {entry.related.map((related) => (
              <RelatedRow key={related.id} related={related} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

const OpenAuditDrawerContext = createContext<((entryId: string) => void) | null>(null)

/**
 * 680px audit detail drawer (demo 14-audit-log adrawer; size "lg"). All
 * entry data is computed server-side and passed in; deep links (?entry=)
 * pre-open the drawer via initialEntryId.
 */
export function AuditDrawerProvider({
  entries,
  initialEntryId,
  children,
}: {
  entries: AuditDrawerEntry[]
  initialEntryId: string | null
  children: ReactNode
}) {
  const [selectedId, setSelectedId] = useState<string | null>(initialEntryId)
  const selected = selectedId
    ? (entries.find((entry) => entry.id === selectedId) ?? null)
    : null
  return (
    <OpenAuditDrawerContext.Provider value={setSelectedId}>
      {children}
      <Drawer
        open={selected !== null}
        onClose={() => {
          setSelectedId(null)
        }}
        size="lg"
        title={selected ? `Kirje #${selected.id.slice(0, 8)}` : ''}
        subtitle={selected ? `${selected.action} · ${formatAuditDateTime(selected.createdAt)}` : undefined}
        footer={
          selected ? (
            <div className="flex w-full flex-wrap items-center justify-between gap-2">
              <span className="break-all font-mono text-[11px] text-inkMuted">
                Ahela räsi: {selected.hash ?? '—'}
              </span>
              <span className="flex items-center gap-2">
                <span className="text-label text-inkMuted">
                  Kirjeid ei saa uuendada ega kustutada
                </span>
                <ResultChip denies={auditEntryDenies(selected.action)} />
              </span>
            </div>
          ) : null
        }
      >
        {selected ? <AuditEntryDetail entry={selected} /> : null}
      </Drawer>
    </OpenAuditDrawerContext.Provider>
  )
}

export function OpenAuditEntryButton({ entryId }: { entryId: string }) {
  const openEntry = useContext(OpenAuditDrawerContext)
  return (
    <button
      type="button"
      onClick={() => {
        openEntry?.(entryId)
      }}
      title="Ava kirje detailvaade"
      className="text-label font-semibold text-primary transition-colors duration-hover ease-hover hover:text-primaryHover"
    >
      Ava
    </button>
  )
}
