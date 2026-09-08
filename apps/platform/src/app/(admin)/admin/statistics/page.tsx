import { Download as DownloadIcon } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'

import {
  ChartSeriesLegend,
  MonthlyBarsChart,
  TypeDonutChart,
  TrendChart,
} from './_components/Charts'
import {
  getStatisticsData,
  OBJECT_TYPE_LABELS,
  periodSubline,
  soldSubline,
  statisticsKpiLabels,
  STATISTICS_PERIODS,
  type CountyStatRow,
  type StatisticsPeriod,
  type TopAuctionRow,
} from './_lib/statistics'
import { DataTable, type DataTableColumn } from '../../_components/DataTable'
import { ErrorNotice } from '../../_components/ErrorNotice'
import { secondaryButtonClass } from '../../_components/FormField'
import { PageHeader } from '../../_components/PageHeader'
import { KpiCard } from '../../_components/ui/KpiCard'
import { requireAdminRepositories } from '../../_lib/admin'
import { formatEur, formatEurAmount } from '../../_lib/labels'
import { can } from '../../_lib/permissions'

// DB-backed admin page: the build has no D1, so the window must be per-request.
export const dynamic = 'force-dynamic'

export const metadata = { title: 'Statistika' }

/** Period switcher pill labels (demo .select-input options). */
const PERIOD_LABELS: Record<StatisticsPeriod, string> = {
  30: 'Viimased 30 päeva',
  90: 'Viimased 90 päeva',
  365: 'Aasta',
}

type RawParams = Record<string, string | string[] | undefined>

function parsePeriod(value: string | string[] | undefined): StatisticsPeriod {
  const first = Array.isArray(value) ? value[0] : value
  const parsed = Number.parseInt(first ?? '', 10)
  return (STATISTICS_PERIODS as readonly number[]).includes(parsed)
    ? (parsed as StatisticsPeriod)
    : STATISTICS_PERIODS[0]
}

function periodHref(period: StatisticsPeriod): string {
  return period === STATISTICS_PERIODS[0]
    ? '/admin/statistics'
    : `/admin/statistics?period=${String(period)}`
}

function percentValue(percent: number | null): string {
  return percent === null ? '—' : `${String(percent)}%`
}

/* Demo 12 card chrome (.card/.card-head/.card-title/.chart-body). */
const cardClass =
  'flex min-w-0 flex-col overflow-hidden rounded-card border border-border bg-bgPage shadow-card'
const cardHeadClass =
  'flex flex-wrap items-center justify-between gap-sm border-b border-border px-5 py-3.5'
const cardTitleClass = 'font-heading text-[16px] font-semibold leading-[22px] text-ink'
const cardSubClass = 'text-label text-inkMuted'
const chartBodyClass = 'px-5 pb-2 pt-4'
const chartNoteClass = 'px-5 pb-3.5 pt-2.5 text-[11px] leading-4 text-inkMuted'

/** Demo .num cells: right-aligned mono tabular figures. */
function NumberCell({ children }: { children: ReactNode }) {
  return (
    <span className="block text-right font-mono tabular-nums">{children}</span>
  )
}

function UpliftCell({ percent }: { percent: number }) {
  return (
    <span className="block text-right font-mono font-medium tabular-nums text-[color:var(--st-active-text)]">
      ▲ +{String(percent)}%
    </span>
  )
}

const topColumns: DataTableColumn<TopAuctionRow>[] = [
  {
    key: 'title',
    label: 'Objekt',
    render: (row) => <span className="font-medium">{row.title}</span>,
  },
  {
    key: 'objectType',
    label: 'Tüüp',
    render: (row) => OBJECT_TYPE_LABELS[row.objectType] ?? row.objectType,
  },
  {
    key: 'minBidCents',
    label: 'Alghind',
    render: (row) => <NumberCell>{formatEur(row.minBidCents)}</NumberCell>,
  },
  {
    key: 'finalPriceCents',
    label: 'Lõpphind',
    render: (row) => <NumberCell>{formatEur(row.finalPriceCents)}</NumberCell>,
  },
  {
    key: 'upliftPercent',
    label: 'Ülepakkumine',
    render: (row) => <UpliftCell percent={row.upliftPercent} />,
  },
]

const countyColumns: DataTableColumn<CountyStatRow>[] = [
  {
    key: 'name',
    label: 'Maakond',
    render: (row) => <span className="font-medium">{row.name}</span>,
  },
  {
    key: 'total',
    label: 'Oksjonid',
    render: (row) => <NumberCell>{String(row.total)}</NumberCell>,
  },
  {
    key: 'sold',
    label: 'Müüdud',
    render: (row) => <NumberCell>{String(row.sold)}</NumberCell>,
  },
  {
    key: 'avgFinalEur',
    label: 'Keskmine hind',
    render: (row) => <NumberCell>{formatEurAmount(row.avgFinalEur)}</NumberCell>,
  },
]

export default async function AdminStatisticsPage({
  searchParams,
}: {
  searchParams: Promise<RawParams>
}) {
  const params = await searchParams
  const { session } = await requireAdminRepositories()
  if (!can(session.role, 'statistics:read')) {
    return (
      <div>
        <PageHeader title="Statistika" />
        <ErrorNotice message="Ligipääs statistikale puudub." />
      </div>
    )
  }

  const data = await getStatisticsData(parsePeriod(params.period))

  return (
    <div>
      <PageHeader
        title="Statistika"
        description="Müügi ja tegevuse näitajad valitud perioodil."
        breadcrumb={
          <>
            <Link
              href="/admin"
              className="transition-colors duration-hover ease-hover hover:text-primary"
            >
              Töölaud
            </Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">Statistika</span>
          </>
        }
        actions={
          <>
            <nav aria-label="Ajavahemik" className="flex flex-wrap gap-2">
              {STATISTICS_PERIODS.map((option) => {
                const active = option === data.period
                return (
                  <Link
                    key={option}
                    href={periodHref(option)}
                    aria-current={active ? 'page' : undefined}
                    className={`rounded-pill border px-3.5 py-1.5 text-label whitespace-nowrap transition-colors duration-hover ease-hover ${
                      active
                        ? 'border-primary bg-primary font-semibold text-inkInverse'
                        : 'border-border bg-bgPage font-medium text-ink hover:border-primary hover:text-primary'
                    }`}
                  >
                    {PERIOD_LABELS[option]}
                  </Link>
                )
              })}
            </nav>
            <a
              href={`/admin/statistics/export?period=${String(data.period)}`}
              className={secondaryButtonClass}
            >
              <DownloadIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
              Ekspordi CSV
            </a>
          </>
        }
      />

      {/* KPI strip (demo .kpi-6) */}
      <section
        aria-label="Statistika näitajad"
        className="mb-lg grid grid-cols-2 gap-sm min-[768px]:grid-cols-3 min-[1280px]:grid-cols-6"
      >
        <KpiCard
          label={statisticsKpiLabels.totalAuctions}
          value={String(data.kpis.totalAuctions)}
          sub={periodSubline(data.period)}
        />
        <KpiCard
          label={statisticsKpiLabels.sold}
          value={percentValue(data.kpis.sold.percent)}
          sub={soldSubline(data.kpis.sold.count)}
        />
        <KpiCard
          label={statisticsKpiLabels.avgUplift}
          value={percentValue(data.kpis.avgUplift.percent)}
          sub="Lõpphind alghinnast"
        />
        <KpiCard
          label={statisticsKpiLabels.serviceFee}
          value={formatEurAmount(data.kpis.serviceFee.eur)}
          sub={periodSubline(data.period)}
        />
        <KpiCard
          label={statisticsKpiLabels.bidCount}
          value={String(data.kpis.bidCount)}
          sub={periodSubline(data.period)}
        />
        <KpiCard
          label={statisticsKpiLabels.avgFinalPrice}
          value={formatEurAmount(data.kpis.avgFinalPrice.eur)}
          sub={soldSubline(data.kpis.sold.count)}
        />
      </section>

      <div className="flex flex-col gap-lg">
        {/* Charts row: monthly bars (2/3) + type donut (1/3) */}
        <div className="grid items-stretch gap-lg min-[1024px]:grid-cols-3">
          <section
            aria-labelledby="stats-monthly-title"
            className={`${cardClass} min-[1024px]:col-span-2`}
          >
            <div className={cardHeadClass}>
              <h2 id="stats-monthly-title" className={cardTitleClass}>
                Oksjonite tulemused kuupõhiselt
              </h2>
              <ChartSeriesLegend series={data.monthly.series} />
            </div>
            <div className={chartBodyClass}>
              <MonthlyBarsChart data={data.monthly} />
            </div>
            <p className={chartNoteClass}>
              Kuude lõikes · summad tuhandetes eurotes (t€)
            </p>
          </section>

          <section aria-labelledby="stats-donut-title" className={cardClass}>
            <div className={cardHeadClass}>
              <h2 id="stats-donut-title" className={cardTitleClass}>
                Oksjonite tüüpjaotus
              </h2>
            </div>
            <TypeDonutChart data={{ segments: data.donut }} />
          </section>
        </div>

        {/* Bid trend: always the last 30 days, independent of the period */}
        <section aria-labelledby="stats-trend-title" className={cardClass}>
          <div className={cardHeadClass}>
            <h2 id="stats-trend-title" className={cardTitleClass}>
              Pakkumiste arv
            </h2>
            <span className={cardSubClass}>päevane arv · viimased 30 päeva</span>
          </div>
          <div className={chartBodyClass}>
            <TrendChart data={data.trend} />
          </div>
        </section>

        {/* Tables row: Top-5 (2/3) + county overview (1/3). Aggregated
            results only — no winner identities anywhere. */}
        <div className="grid items-start gap-lg min-[1024px]:grid-cols-3">
          <section aria-labelledby="stats-top-title" className="min-w-0 min-[1024px]:col-span-2">
            <div className="mb-sm flex flex-wrap items-baseline justify-between gap-sm">
              <h2 id="stats-top-title" className={cardTitleClass}>
                Top 5 edukat oksjonit
              </h2>
              <span className={cardSubClass}>ülepakkumise % järgi</span>
            </div>
            <DataTable
              columns={topColumns}
              rows={data.topAuctions}
              emptyLabel="Perioodil pole müüdud oksjoneid."
            />
          </section>

          <section aria-labelledby="stats-county-title" className="min-w-0">
            <div className="mb-sm">
              <h2 id="stats-county-title" className={cardTitleClass}>
                Maakondade ülevaade
              </h2>
            </div>
            <DataTable
              columns={countyColumns}
              rows={data.counties}
              emptyLabel="Perioodil pole oksjoneid."
            />
          </section>
        </div>
      </div>
    </div>
  )
}
