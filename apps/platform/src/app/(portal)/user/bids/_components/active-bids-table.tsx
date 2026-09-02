import { Countdown } from '@erametsad/ui'
import Link from 'next/link'

import { AutobidderInline } from './autobidder-inline'
import { BidStatusPill } from './bid-status-pill'
import { formatDateTime, formatEur } from './format'
import { MaskedAmount } from './masked-amount'
import { TypeBadge } from './type-badge'
import type { MyBidRow } from './types'

const SEALED_MASK =
  'Suletud oksjonil hoitakse pakkumisi peidetud kuni nende üheaegse avamiseni.'
const NO_LEADS = 'Pakkumisi veel ei ole.'

export interface ActiveBidsTableProps {
  rows: MyBidRow[]
  highlightedIds: ReadonlySet<string>
}

export function ActiveBidsTable({
  rows,
  highlightedIds,
}: ActiveBidsTableProps) {
  return (
    <div className="overflow-x-auto rounded-card border border-border bg-bgPage shadow-card">
      <table className="w-full min-w-max text-left">
        <thead>
          <tr className="border-b border-border bg-bgMist text-label text-inkMuted">
            <th scope="col" className="px-md py-3 font-semibold">
              Oksjon
            </th>
            <th scope="col" className="px-sm py-3 font-semibold">
              Minu pakkumine
            </th>
            <th scope="col" className="px-sm py-3 font-semibold">
              Juhtiv hind
            </th>
            <th scope="col" className="px-sm py-3 font-semibold">
              Staatus
            </th>
            <th scope="col" className="px-sm py-3 font-semibold">
              Automaatpakkuja
            </th>
            <th scope="col" className="px-md py-3 font-semibold">
              Aega jäänud
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const sealed = row.auction.auctionType === 'sealed'
            return (
              <tr
                key={row.auction.id}
                className={`border-b border-border transition-colors duration-hover last:border-b-0 ${
                  highlightedIds.has(row.auction.id) ? 'bg-dangerLight' : ''
                }`}
              >
                <td className="px-md py-sm">
                  <div className="flex flex-col gap-2xs">
                    <Link
                      href={`/oksjon/${row.auction.id}`}
                      className="font-label font-semibold text-ink transition-colors duration-hover hover:text-primary"
                    >
                      {row.auction.title}
                    </Link>
                    <div className="flex flex-wrap items-center gap-2xs">
                      <TypeBadge type={row.auction.auctionType} />
                      {row.auction.county !== null && (
                        <span className="text-bodySm text-inkMuted">
                          {row.auction.county.name}
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-sm py-sm">
                  {sealed ? (
                    <MaskedAmount explanation={SEALED_MASK} />
                  ) : row.myBid === null ? (
                    <span className="text-inkMuted">—</span>
                  ) : (
                    <div className="flex flex-col">
                      <span className="text-bodySm font-semibold text-ink">
                        {formatEur(row.myBid.amountEur)}
                      </span>
                      <span className="text-bodySm text-inkMuted">
                        {formatDateTime(row.myBid.createdAt)}
                      </span>
                    </div>
                  )}
                </td>
                <td className="px-sm py-sm">
                  {sealed ? (
                    <MaskedAmount explanation={SEALED_MASK} />
                  ) : row.leadingAmountEur !== null ? (
                    <span className="text-bodySm font-semibold text-ink">
                      {formatEur(row.leadingAmountEur)}
                    </span>
                  ) : (
                    <MaskedAmount explanation={NO_LEADS} />
                  )}
                </td>
                <td className="px-sm py-sm">
                  <BidStatusPill row={row} />
                </td>
                <td className="px-sm py-sm">
                  {sealed ? (
                    <MaskedAmount explanation="Automaatpakkuja töötab ainult avatud oksjonitel." />
                  ) : (
                    <AutobidderInline
                      auctionId={row.auction.id}
                      minBidEur={row.auction.minBidEur}
                      bidStepEur={row.auction.bidStepEur}
                      currentLeadingEur={row.leadingAmountEur}
                    />
                  )}
                </td>
                <td className="px-md py-sm">
                  {row.auction.endsAt !== null ? (
                    <Countdown
                      endsAt={row.auction.endsAt}
                      size="sm"
                      showLabel={false}
                    />
                  ) : (
                    <span className="text-inkMuted">—</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
