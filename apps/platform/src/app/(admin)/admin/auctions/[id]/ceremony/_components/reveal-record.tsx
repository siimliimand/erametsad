import type { RevealedBidView } from '../../../../../_actions/auctions'
import { formatDateTime, formatEurAmount } from '../../../../../_lib/labels'

/**
 * Ranked reveal record: amount desc, tie-by-earliest badge, invalid bids
 * greyed with the reason. Reserve stays server-side — only the boolean
 * verdict (`topMeetsReserve`) is rendered, never the reserve value.
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
              <th scope="col" className="h-10 px-3 text-label font-semibold text-ink-muted">Koht</th>
              <th scope="col" className="h-10 px-3 text-label font-semibold text-ink-muted">Summa</th>
              <th scope="col" className="h-10 px-3 text-label font-semibold text-ink-muted">Esitatud</th>
              <th scope="col" className="h-10 px-3 text-label font-semibold text-ink-muted">Kehtivus</th>
            </tr>
          </thead>
          <tbody>
            {bids.map((bid) => (
              <tr
                key={bid.id}
                className={`border-b border-border last:border-b-0 ${bid.valid ? '' : 'bg-bgMist text-ink-muted'}`}
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
                  className={`h-10 px-3 font-mono text-bodySm ${bid.valid ? 'font-semibold text-ink' : 'text-ink-muted line-through'}`}
                >
                  {formatEurAmount(bid.amount)}
                </td>
                <td className="h-10 px-3 text-bodySm">{formatDateTime(bid.createdAt)}</td>
                <td className="h-10 px-3 text-bodySm">
                  {bid.valid ? (
                    <span className="text-primary">Kehtiv</span>
                  ) : (
                    <span className="text-ink-muted" title={bid.invalidReason ?? undefined}>
                      Kehtetu — {bid.invalidReason ?? 'põhjus teadmata'}
                    </span>
                  )}
                </td>
              </tr>
            ))}
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
