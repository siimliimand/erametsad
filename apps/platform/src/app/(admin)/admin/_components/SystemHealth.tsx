import { WorkspaceCard } from './WorkspaceCard'
import { workspaceCardLabels } from '../_lib/workspace'
import type { WorkspaceQueues } from '../_lib/workspace'


interface HealthRow {
  label: string
  count: number
}

/**
 * "Süsteemi tervis" (01 demo). The demo plots operational telemetry (queue
 * lag, failed jobs, SSE connections) that this stack does not expose through
 * the workspace aggregation, so the card renders the pending backlog signals
 * that do exist, role-scoped, with ok/warn dots. The integration footer stays
 * as a legend: nothing here probes eID, the business registry or the SMS
 * gateway.
 */
export function SystemHealth({ queues }: { queues: WorkspaceQueues }) {
  const rows: HealthRow[] = []
  if (queues.sealedAwaitingCeremony !== null) {
    rows.push({
      label: 'Suletud tseremooniad ootel',
      count: queues.sealedAwaitingCeremony,
    })
  }
  if (queues.rightsRequests !== null) {
    rows.push({ label: 'Õigustaotlused ootel', count: queues.rightsRequests })
  }
  if (queues.newServiceRequests !== null) {
    rows.push({
      label: 'Uued teenusepäringud',
      count: queues.newServiceRequests,
    })
  }
  const allClear = rows.every((row) => row.count === 0)
  const headAside = (
    <span
      role="img"
      aria-label={allClear ? 'Kõik süsteemid töötavad' : 'Ootel ülesandeid'}
      className={`h-2 w-2 rounded-pill ${
        allClear ? 'bg-[var(--st-active-dot)]' : 'bg-cta'
      }`}
    />
  )
  return (
    <WorkspaceCard
      title={workspaceCardLabels.systemHealth}
      titleId="h-health"
      aside={headAside}
    >
      {rows.length === 0 ? (
        <p className="px-5 py-4 text-bodySm text-inkMuted">Andmeid pole</p>
      ) : (
        <div className="divide-y divide-border">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between gap-sm px-5 py-3"
            >
              <span className="text-bodySm leading-[18px] text-inkMuted">
                {row.label}
              </span>
              <span className="inline-flex items-center gap-2 text-bodySm font-medium leading-[18px] text-ink">
                <span className="font-mono tabular-nums">
                  {String(row.count)}
                </span>
                <span
                  aria-hidden="true"
                  className={`h-2 w-2 rounded-pill ${
                    row.count === 0 ? 'bg-[var(--st-active-dot)]' : 'bg-cta'
                  }`}
                />
                <span className="sr-only">
                  {row.count === 0 ? 'OK' : 'Ootel'}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="mt-auto border-t border-border px-5 py-3 text-[11px] leading-4 text-inkMuted">
        Jälgitakse: eID · Äriregister · SMS lüüs
      </div>
    </WorkspaceCard>
  )
}
