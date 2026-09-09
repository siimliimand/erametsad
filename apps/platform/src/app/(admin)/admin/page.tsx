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
  BIDS_SPARKLINE_DAYS,
  approvalSplitSubline,
  bidTrendSubline,
  getWorkspaceData,
  isAdminRole,
  scheduledAuctionsSubline,
  workspaceKpiHrefs,
  workspaceKpiLabels,
  workspaceKpiSublabels,
} from './_lib/workspace'

export const metadata = { title: 'Töölaud' }

/** Sparkline viewport, shared with the statistics Charts.tsx conventions. */
const SPARKLINE_WIDTH = 112
const SPARKLINE_HEIGHT = 28

/**
 * Seven-day bid sparkline (spec: bids-today shows a 7-day trend): one point
 * per Tallinn calendar day, oldest first, with the today point last.
 */
function sparklinePoints(dailyCounts: readonly number[]): string {
  const max = Math.max(...dailyCounts, 1)
  const step =
    dailyCounts.length > 1
      ? SPARKLINE_WIDTH / (dailyCounts.length - 1)
      : SPARKLINE_WIDTH / 2
  return dailyCounts
    .map((count, index) => {
      const x = index * step
      const y = SPARKLINE_HEIGHT - 4 - (count / max) * (SPARKLINE_HEIGHT - 8)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
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
    // Demo rule: the KPI carries its amber attention badge whenever at least
    // one auction ends today (Europe/Tallinn calendar day).
    const alertProps =
      kpis.endingToday.count > 0 ? { alert: kpis.endingToday.count } : {}
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
                    viewBox={`0 0 ${String(SPARKLINE_WIDTH)} ${String(SPARKLINE_HEIGHT)}`}
                    preserveAspectRatio="none"
                    role="img"
                    aria-label={`Pakkumised viimased ${String(BIDS_SPARKLINE_DAYS)} päeva`}
                    className="h-6 w-full text-accent"
                  >
                    <title>{`Pakkumisi päevas, viimased ${String(BIDS_SPARKLINE_DAYS)} päeva`}</title>
                    <polyline
                      points={sparklinePoints(kpis.bidsToday.dailyCounts)}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
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
    // Red only when something is actually pending (spec dashboard parity).
    const pendingTotal =
      (kpis.pendingApprovals.companies ?? 0) +
      (kpis.pendingApprovals.underbids ?? 0)
    cards.push(
      <KpiCard
        key="pending-approvals"
        label={workspaceKpiLabels.pendingApprovals}
        value={`${String(kpis.pendingApprovals.companies ?? 0)} + ${String(
          kpis.pendingApprovals.underbids ?? 0,
        )}`}
        {...(pendingTotal > 0 ? { danger: true } : {})}
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
        {isAdminRole(session.role) ? <SystemHealth queues={queues} /> : null}
        <QuickActions rows={quickActions} />
        <RecentLeads rows={recentLeads} />
      </div>
    </div>
  )
}
