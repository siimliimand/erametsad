import Link from 'next/link'

import type { RevealedBidView } from '../../../../../_actions/auctions'
import { formatDateTime, formatEurAmount } from '../../../../../_lib/labels'

/**
 * Ranked reveal record: amount desc, tie-by-earliest badge, invalid bids
 * greyed with the reason. Reserve stays server-side — only the boolean
 * verdict (`topMeetsReserve`) is rendered, never the reserve value.
 *
 * Pakkuja carries the bidder identity revealed by the one-shot ceremony
 * (name, code masked last-4 per D-16, company chip, user detail link for
 * users:read roles — the href arrives pre-gated from the server). The
 * identity is undefined outside the post-reveal read model, so both cells
 * degrade to an em dash. Marginaal is the gap to the next ranked bid.
 */
export function RevealRecord({
  bids,
  topMeetsReserve,
}: {
  bids: RevealedBidView[]
  topMeetsReserve: boolean | null
}) {
  return (
    <div>
      <div className="mb-sm overflow-x-auto rounded-input border border-border">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-border bg-bgMist">
              <th scope="col" className="h-10 px-3 text-label font-semibold text-inkMuted">Koht</th>
              <th scope="col" className="h-10 px-3 text-label font-semibold text-inkMuted">Summa</th>
              <th scope="col" className="h-10 px-3 text-label font-semibold text-inkMuted">Pakkuja</th>
              <th scope="col" className="h-10 px-3 text-label font-semibold text-inkMuted">Marginaal</th>
              <th scope="col" className="h-10 px-3 text-label font-semibold text-inkMuted">Esitatud</th>
              <th scope="col" className="h-10 px-3 text-label font-semibold text-inkMuted">Kehtivus</th>
            </tr>
          </thead>
          <tbody>
            {bids.map((bid) => {
              const bidder = bid.bidder ?? null
              return (
                <tr
                  key={bid.id}
                  className={`border-b border-border last:border-b-0 ${bid.valid ? '' : 'bg-bgMist text-inkMuted'}`}
                >
                  <td className="h-10 px-3 text-bodySm">
                    {bid.rank !== null ? String(bid.rank) : '—'}
                    {bid.tie ? (
                      <span className="ml-2 inline-flex items-center rounded-pill bg-statusEndingSoon/10 px-2 py-0.5 text-[11px] font-semibold text-statusEndingSoon">
                        Viik — varasem esitus
                      </span>
                    ) : null}
                  </td>
                  <td
                    className={`h-10 px-3 font-mono text-bodySm ${bid.valid ? 'font-semibold text-ink' : 'text-inkMuted line-through'}`}
                  >
                    {formatEurAmount(bid.amount)}
                  </td>
                  <td className="h-10 px-3 text-bodySm">
                    {bidder !== null ? (
                      <span>
                        <span className="flex items-center gap-2">
                          {bidder.userHref !== null ? (
                            <Link
                              href={bidder.userHref}
                              className="font-semibold text-ink underline-offset-2 transition-colors duration-hover ease-hover hover:text-primary hover:underline"
                            >
                              {bidder.name ?? bidder.email ?? 'Pakkuja'}
                            </Link>
                          ) : (
                            <span className="font-semibold text-ink">
                              {bidder.name ?? bidder.email ?? 'Pakkuja'}
                            </span>
                          )}
                          {bidder.isCompany ? (
                            <span className="inline-flex items-center rounded-pill bg-primaryLight px-2 py-0.5 text-[11px] font-semibold text-primary">
                              Ettevõte
                            </span>
                          ) : null}
                        </span>
                        {bidder.maskedCode !== null ? (
                          <span className="mt-0.5 block font-mono text-[11px] text-inkMuted">
                            {bidder.maskedCode}
                          </span>
                        ) : null}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="h-10 px-3 font-mono text-bodySm text-ink">
                    {bid.valid && bid.marginToNext != null
                      ? `+ ${formatEurAmount(bid.marginToNext)}`
                      : '—'}
                  </td>
                  <td className="h-10 px-3 text-bodySm">{formatDateTime(bid.createdAt)}</td>
                  <td className="h-10 px-3 text-bodySm">
                    {bid.valid ? (
                      <span className="text-primary">Kehtiv</span>
                    ) : (
                      <span className="text-inkMuted" title={bid.invalidReason ?? undefined}>
                        Kehtetu — {bid.invalidReason ?? 'põhjus teadmata'}
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {topMeetsReserve !== null ? (
        <p
          className={`text-bodySm font-semibold ${topMeetsReserve ? 'text-primary' : 'text-danger'}`}
        >
          {topMeetsReserve
            ? '✓ Kõrgeim kehtiv pakkumine täidab piirhinna'
            : '✗ Kõrgeim kehtiv pakkumine ei täida piirhinna'}
        </p>
      ) : null}
    </div>
  )
}
