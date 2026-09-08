'use client'

import { useParams } from 'next/navigation'

import {
  sealedAuditActionLabel,
  type SealedAuditFeedState,
} from './sealed-audit-view'
import { useSealedAuditFeed } from './use-sealed-audit-feed'

const stateDotClass: Record<SealedAuditFeedState, string> = {
  connecting: 'bg-info',
  live: 'bg-primary animate-pulse motion-reduce:animate-none',
  offline: 'bg-danger',
}

function formatClock(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleTimeString('et-EE')
}

/**
 * Live audit strip (demo 05-sealed-opening "Reaalajas auditlogi"): the
 * auction's sealed-opening audit lines, newest first, refetched on
 * sealed-relevant SSE events. Renders nothing without `audit:read` —
 * scoping is enforced again on every refetch inside the server action.
 */
export function LiveAuditStrip() {
  const { id } = useParams<{ id: string }>()
  const { lines, state, permitted } = useSealedAuditFeed(id)

  if (!permitted) return null

  return (
    <section
      aria-label="Reaalajas auditlogi"
      className="rounded-card border border-border bg-bgPage p-md"
    >
      <h2 className="flex items-center gap-xs text-label font-semibold text-ink-muted">
        <span
          aria-hidden="true"
          className={`inline-block h-2 w-2 rounded-full ${stateDotClass[state]}`}
        />
        Reaalajas auditlogi
        <span className="sr-only">
          {state === 'live' ? ' (otseülekanne)' : state === 'offline' ? ' (taasühendab)' : ''}
        </span>
      </h2>
      {lines.length === 0 ? (
        <p className="mt-sm text-bodySm text-ink-muted">
          Pitseeritud avamise auditikirjeid veel ei ole.
        </p>
      ) : (
        <ol role="log" aria-live="polite" className="mt-sm max-h-48 overflow-y-auto">
          {lines.map((line) => (
            <li
              key={line.id}
              className="flex items-baseline gap-sm border-b border-dashed border-border py-1.5 text-bodySm text-ink last:border-b-0"
            >
              <time
                dateTime={line.createdAt}
                className="flex-none font-mono text-label text-ink-muted"
              >
                {formatClock(line.createdAt)}
              </time>
              <span className="min-w-0">
                {sealedAuditActionLabel(line.action)}
                {line.actorLabel !== null ? ` — ${line.actorLabel}` : ''}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
