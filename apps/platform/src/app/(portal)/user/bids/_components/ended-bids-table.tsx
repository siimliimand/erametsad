import Link from 'next/link'

import { BidStatusPill } from './bid-status-pill'
import { formatDateTime, formatEur } from './format'
import { MaskedAmount } from './masked-amount'
import { TypeBadge } from './type-badge'
import type { MyBidRow } from './types'

const SEALED_MASK =
  'Suletud oksjonil hoitakse pakkumisi peidetud kuni nende üheaegse avamiseni.'

function finalPriceOf(row: MyBidRow): number | null {
  return row.finalPriceEur ?? null
}

export function EndedBidsTable({ rows }: { rows: MyBidRow[] }) {
  return (
    <div className="overflow-x-auto rounded-card border border-border bg-bgPage shadow-card">
      <table className="w-full min-w-max text-left">
        <thead>
          <tr className="border-b border-border bg-bgMist text-label text-inkMuted">
            <th scope="col" className="px-md py-3 font-semibold">
              Oksjon
            </th>
            <th scope="col" className="px-sm py-3 font-semibold">
              Tulemus
            </th>
            <th scope="col" className="px-sm py-3 font-semibold">
              Lõpphind
            </th>
            <th scope="col" className="px-sm py-3 font-semibold">
              Minu pakkumine
            </th>
            <th scope="col" className="px-md py-3 font-semibold">
              Tegevus
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const sealed = row.auction.auctionType === 'sealed'
            const won = row.outcome === 'won'
            const finalPrice = finalPriceOf(row)
            return (
              <tr
                key={row.auction.id}
                className="border-b border-border last:border-b-0"
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
                      {row.auction.endsAt !== null && (
                        <span className="text-bodySm text-inkMuted">
                          Lõppes {formatDateTime(row.auction.endsAt)}
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-sm py-sm">
                  <BidStatusPill row={row} ended />
                </td>
                <td className="px-sm py-sm">
                  <span className="text-bodySm font-semibold text-ink">
                    {finalPrice !== null ? formatEur(finalPrice) : '—'}
                  </span>
                </td>
                <td className="px-sm py-sm">
                  {sealed || row.myBid === null ? (
                    sealed ? (
                      <MaskedAmount explanation={SEALED_MASK} />
                    ) : (
                      <span className="text-inkMuted">—</span>
                    )
                  ) : (
                    <span className="text-bodySm text-ink">
                      {formatEur(row.myBid.amountEur)}
                    </span>
                  )}
                </td>
                <td className="px-md py-sm">
                  <div className="flex flex-col items-start gap-2xs">
                    {won && (
                      <Link
                        href={`/lepingud/oksjonileping/${row.auction.id}`}
                        className="inline-flex h-8 items-center justify-center rounded-button border border-primary px-3 text-label font-semibold text-primary transition-colors duration-hover hover:bg-primaryLight"
                      >
                        Allkirjasta leping
                      </Link>
                    )}
                    <Link
                      href={`/oksjon/${row.auction.id}`}
                      className="text-label font-semibold text-inkMuted transition-colors duration-hover hover:text-primary"
                    >
                      Vaata oksjonit
                    </Link>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
