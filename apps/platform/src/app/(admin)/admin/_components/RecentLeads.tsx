import { WorkspaceCard } from './WorkspaceCard'
import { workspaceCardLabels } from '../_lib/workspace'
import type { RecentLeadRow } from '../_lib/workspace'


function leadTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleTimeString('et-EE', { hour: '2-digit', minute: '2-digit' })
}

/**
 * "Viimased juhtlõimed" (01 demo): time, contact chip, form line and source
 * chip. The demo's county column has no counterpart in the lead slices, so
 * the form name takes its place and the free-text source renders as the
 * right-hand chip.
 */
export function RecentLeads({ rows }: { rows: readonly RecentLeadRow[] }) {
  return (
    <WorkspaceCard
      title={workspaceCardLabels.recentLeads}
      titleId="h-leads"
    >
      {rows.length === 0 ? (
        <p className="px-5 py-4 text-bodySm text-inkMuted">
          Juhtlõimesid pole
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center gap-2.5 px-5 py-3">
              <time
                dateTime={row.createdAt}
                className="shrink-0 font-mono text-label leading-4 tabular-nums text-inkMuted"
              >
                {leadTime(row.createdAt)}
              </time>
              <span className="shrink-0 whitespace-nowrap rounded-pill border border-border bg-bgMist px-2.5 py-0.5 text-label leading-4 text-ink">
                {row.contactName}
              </span>
              <span className="min-w-0 flex-1 truncate text-label leading-4 text-inkMuted">
                {row.formName}
              </span>
              {row.source !== null ? (
                <span className="shrink-0 whitespace-nowrap rounded-pill bg-bgMist px-2.5 py-0.5 text-[11px] font-semibold leading-4 text-inkMuted">
                  {row.source}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </WorkspaceCard>
  )
}
