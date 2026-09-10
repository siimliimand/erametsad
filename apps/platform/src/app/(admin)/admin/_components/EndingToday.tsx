import { Play as PlayIcon } from 'lucide-react'
import type { ComponentType } from 'react'

import { WorkspaceCard } from './WorkspaceCard'
import { AdminLink } from '../../_components/AdminLink'
import { MapPinHouseIcon, PackageIcon, TreePineIcon, ZapIcon } from '../../_components/icons'
import { EmptyRow } from '../../_components/ui/EmptyRow'
import { auctionObjectTypeLabels, auctionTypeLabels, formatEur } from '../../_lib/labels'
import { workspaceCardLabels } from '../_lib/workspace'
import type { EndingTodayRow } from '../_lib/workspace'
import { Countdown } from '../auctions/_components/Countdown'
import { countdownText } from '../auctions/_lib/list-view'

import type { AuctionObjectType } from '@/lib/data/schema'

// Demo 01 type chips; mirrored in AuctionsTable until the column work in 4.1.
const typeChipMeta: Record<
  AuctionObjectType,
  { className: string; Icon: ComponentType<{ className?: string }> }
> = {
  raieoigus: {
    className: 'bg-[var(--st-active-bg)] text-[color:var(--st-active-text)]',
    Icon: TreePineIcon,
  },
  kinnistu: {
    className: 'bg-[var(--st-scheduled-bg)] text-[color:var(--st-scheduled-text)]',
    Icon: MapPinHouseIcon,
  },
  pakett: {
    className: 'bg-[var(--st-draft-bg)] text-[color:var(--st-draft-text)]',
    Icon: PackageIcon,
  },
  kiire: {
    className: 'bg-[var(--st-draft-bg)] text-[color:var(--st-draft-text)]',
    Icon: ZapIcon,
  },
}

const actionBtnClass =
  'inline-flex items-center gap-1.5 rounded-[8px] border border-accent px-3 py-1 text-label font-semibold text-primary whitespace-nowrap transition-colors duration-hover ease-hover hover:bg-[var(--st-active-bg)]'

function TypeChip({ objectType, type }: { objectType: string; type: string }) {
  const meta =
    objectType in typeChipMeta
      ? typeChipMeta[objectType as AuctionObjectType]
      : typeChipMeta.pakett
  const label =
    objectType in typeChipMeta
      ? auctionObjectTypeLabels[objectType as AuctionObjectType]
      : objectType
  return (
    <span
      title={`${label} — ${type === 'sealed' ? auctionTypeLabels.sealed : auctionTypeLabels.open}`}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-pill px-2 py-0.5 text-label ${meta.className}`}
    >
      <meta.Icon aria-hidden="true" className="h-3 w-3" />
      {label}
    </span>
  )
}

/**
 * "Lõpevad täna" live table (01 demo): ticking countdowns, critical blink via
 * the shared Countdown, object-type chips, and Monitor/Ava links. The row
 * slices carry no lot area, so the demo's Pindala column is dropped.
 */
export function EndingToday({
  rows,
  nowMs,
}: {
  rows: readonly EndingTodayRow[]
  nowMs: number
}) {
  const liveAside = (
    <span className="inline-flex items-center gap-1.5 text-label font-semibold text-[color:var(--st-active-text)]">
      <span
        aria-hidden="true"
        className="h-2 w-2 rounded-pill bg-[var(--st-active-dot)] [animation:live-pulse_2s_ease-out_infinite] motion-reduce:[animation:none]"
      />
      {workspaceCardLabels.live}
    </span>
  )
  return (
    <WorkspaceCard
      title={workspaceCardLabels.endingToday}
      titleId="h-ending"
      aside={liveAside}
      footHref="/admin/auctions"
      footLabel={workspaceCardLabels.viewAll}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] border-collapse text-left">
          <thead>
            <tr className="border-b border-border bg-bgMist">
              <th scope="col" className="py-2.5 pl-5 pr-3 text-label font-medium text-inkMuted">
                Lot
              </th>
              <th scope="col" className="px-3 py-2.5 text-label font-medium text-inkMuted">
                Tüüp
              </th>
              <th scope="col" className="px-3 py-2.5 text-label font-medium text-inkMuted">
                Lõpeb
              </th>
              <th
                scope="col"
                className="px-3 py-2.5 text-right text-label font-medium text-inkMuted"
              >
                Hetke pakkumine
              </th>
              <th scope="col" className="py-2.5 pl-3 pr-5 text-right">
                <span className="sr-only">Tegevus</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <EmptyRow colSpan={5}>Täna ei lõpe ühtegi oksjonit</EmptyRow>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-border transition-colors duration-hover ease-hover last:border-b-0 hover:bg-bgMist"
                >
                  <td className="py-3 pl-5 pr-3 text-bodySm leading-[18px] text-ink">
                    <span className="font-mono text-label text-inkMuted">
                      #{row.id.slice(0, 8)}
                    </span>{' '}
                    <AdminLink
                      href={`/auctions/${row.id}`}
                      className="font-medium text-primary transition-colors duration-hover ease-hover hover:text-primaryHover hover:underline"
                    >
                      {row.title}
                    </AdminLink>
                  </td>
                  <td className="px-3 py-3">
                    <TypeChip objectType={row.objectType} type={row.type} />
                  </td>
                  <td className="px-3 py-3">
                    <Countdown endsAt={row.endsAt}>
                      {countdownText(row.endsAt, nowMs)}
                    </Countdown>
                  </td>
                  <td className="px-3 py-3 text-right text-bodySm leading-[18px] tabular-nums">
                    {row.type === 'sealed' ? (
                      <span>
                        <span className="font-medium">
                          {String(row.sealedBidCount ?? 0)}
                        </span>{' '}
                        <span className="text-inkMuted">suletud</span>
                      </span>
                    ) : row.currentBidCents === null ? (
                      '—'
                    ) : (
                      formatEur(row.currentBidCents)
                    )}
                  </td>
                  <td className="py-3 pl-3 pr-5 text-right">
                    {row.type === 'sealed' ? (
                      <AdminLink
                        href={`/auctions/${row.id}/ceremony`}
                        className={actionBtnClass}
                      >
                        <PlayIcon aria-hidden="true" className="h-3 w-3" />
                        Ava
                      </AdminLink>
                    ) : (
                      <AdminLink
                        href={`/auctions/${row.id}/monitor`}
                        className={actionBtnClass}
                      >
                        <PlayIcon aria-hidden="true" className="h-3 w-3" />
                        Monitor
                      </AdminLink>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </WorkspaceCard>
  )
}
