import { Info as InfoIcon } from 'lucide-react'
import type { ReactElement } from 'react'

import { PageHeader } from '../_components/PageHeader'
import { KpiCard } from '../_components/ui/KpiCard'
import { requireAdminRepositories } from '../_lib/admin'
import { formatEurAmount } from '../_lib/labels'
import { EndingToday } from './_components/EndingToday'
import { QuickActions } from './_components/QuickActions'
import { RecentLeads } from './_components/RecentLeads'
import { SystemHealth } from './_components/SystemHealth'
import {
  approvalSplitSubline,
  bidTrendSubline,
  getWorkspaceData,
  scheduledAuctionsSubline,
  workspaceKpiHrefs,
  workspaceKpiLabels,
  workspaceKpiSublabels,
} from './_lib/workspace'

export const metadata = { title: 'Töölaud' }

/** Demo critical threshold: countdown blinks inside the last 5 minutes. */
const CRITICAL_LOOKAHEAD_MS = 5 * 60 * 1000

/**
 * Demo sparkline: the aggregation exposes two real points (yesterday, today),
 * so the trend renders as one line between them instead of a fabricated
 * hourly series.
 */
function sparklinePoints(yesterday: number, today: number): string {
  const max = Math.max(yesterday, today, 1)
  const y = (value: number): number => 24 - (value / max) * 20
  return `0,${y(yesterday).toFixed(1)} 112,${y(today).toFixed(1)}`
}

function trendNode(changePercent: number | null): ReactElement | null {
  const text = bidTrendSubline(changePercent)
  if (text === null) return null
  if (changePercent !== null && changePercent > 0) {
    return (
      <span className="font-medium text-[color:var(--st-active-text)]">
        ▲ {text}
      </span>
    )
  }
  if (changePercent !== null && changePercent < 0) {
    return <span className="font-medium text-danger">▼ {text}</span>
  }
  return <span>{text}</span>
}

export default async function AdminDashboardPage() {
  const { session } = await requireAdminRepositories()
  const { kpis, endingToday, queues, quickActions, recentLeads } =
    await getWorkspaceData(session)
  const nowMs = Date.now()
  const criticalEnding = endingToday.filter(
    (row) => Date.parse(row.endsAt) - nowMs < CRITICAL_LOOKAHEAD_MS,
  ).length

  const cards: ReactElement[] = []
  if (kpis.activeAuctions) {
    const sub = scheduledAuctionsSubline(kpis.activeAuctions.scheduledCount)
    cards.push(
      <KpiCard
        key="active-auctions"
        label={workspaceKpiLabels.activeAuctions}
        value={String(kpis.activeAuctions.count)}
        {...(sub !== null ? { sub } : {})}
        href={workspaceKpiHrefs.activeAuctions}
      />,
    )
  }
  if (kpis.endingToday) {
    const alertProps = criticalEnding > 0 ? { alert: criticalEnding } : {}
    cards.push(
      <KpiCard
        key="ending-today"
        label={workspaceKpiLabels.endingToday}
        value={String(kpis.endingToday.count)}
        {...alertProps}
        sub={workspaceKpiSublabels.endingToday}
        href={workspaceKpiHrefs.endingToday}
      />,
    )
  }
  if (kpis.bidsToday) {
    const trend = trendNode(kpis.bidsToday.changePercent)
    cards.push(
      <KpiCard
        key="bids-today"
        label={workspaceKpiLabels.bidsToday}
        value={String(kpis.bidsToday.count)}
        href={workspaceKpiHrefs.bidsToday}
        {...(trend !== null
          ? {
              sub: (
                <>
                  <svg
                    viewBox="0 0 112 28"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                    className="h-6 w-full text-accent"
                  >
                    <polyline
                      points={sparklinePoints(
                        kpis.bidsToday.yesterdayCount,
                        kpis.bidsToday.count,
                      )}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      vectorEffect="non-scaling-stroke"
                    />
                  </svg>
                  {trend}
                </>
              ),
            }
          : {})}
      />,
    )
  }
  if (kpis.pendingApprovals) {
    const sub = approvalSplitSubline(
      kpis.pendingApprovals.companies,
      kpis.pendingApprovals.underbids,
    )
    cards.push(
      <KpiCard
        key="pending-approvals"
        label={workspaceKpiLabels.pendingApprovals}
        value={`${String(kpis.pendingApprovals.companies ?? 0)} + ${String(
          kpis.pendingApprovals.underbids ?? 0,
        )}`}
        danger
        {...(sub !== null ? { sub } : {})}
        href={workspaceKpiHrefs.pendingApprovals}
      />,
    )
  }
  if (kpis.newLeads) {
    cards.push(
      <KpiCard
        key="new-leads"
        label={workspaceKpiLabels.newLeads}
        value={String(kpis.newLeads.count)}
        sub={workspaceKpiSublabels.newLeads}
        href={workspaceKpiHrefs.newLeads}
      />,
    )
  }
  if (kpis.pendingSignature) {
    cards.push(
      <KpiCard
        key="pending-signature"
        label={workspaceKpiLabels.pendingSignature}
        value={String(kpis.pendingSignature.count)}
        sub={workspaceKpiSublabels.pendingSignature}
        href={workspaceKpiHrefs.pendingSignature}
      />,
    )
  }
  if (kpis.serviceFeeMonth) {
    cards.push(
      <KpiCard
        key="service-fee-month"
        label={workspaceKpiLabels.serviceFeeMonth}
        value={formatEurAmount(kpis.serviceFeeMonth.eur)}
        sub={
          <span className="inline-flex items-center gap-1">
            {workspaceKpiSublabels.serviceFeeMonth}
            <span
              title="Prognoos kuu lõpu seisuga"
              className="cursor-help text-inkMuted"
            >
              <InfoIcon aria-hidden="true" className="h-3 w-3" />
              <span className="sr-only">Prognoos kuu lõpu seisuga</span>
            </span>
          </span>
        }
        href={workspaceKpiHrefs.serviceFeeMonth}
      />,
    )
  }

  return (
    <div>
      <PageHeader
        title="Töölaud"
        breadcrumb={<span aria-current="page">Töölaud</span>}
      />
      <section
        aria-label="Päeva näitajad"
        className="mb-lg grid grid-cols-1 gap-sm min-[420px]:grid-cols-2 min-[768px]:grid-cols-4 min-[1280px]:grid-cols-7"
      >
        {cards}
      </section>
      <div className="grid grid-cols-1 items-stretch gap-lg min-[1024px]:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <EndingToday rows={endingToday} nowMs={nowMs} />
        <SystemHealth queues={queues} />
        <QuickActions rows={quickActions} />
        <RecentLeads rows={recentLeads} />
      </div>
    </div>
  )
}
