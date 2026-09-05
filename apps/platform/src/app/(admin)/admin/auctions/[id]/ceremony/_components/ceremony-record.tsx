import { RevealRecord } from './reveal-record'
import type { SealedCeremonyContext } from '../../../../../_actions/auctions'
import { formatDateTime } from '../../../../../_lib/labels'

/**
 * Permanent read-only ceremony record: signatures, one-shot reveal ranking,
 * and the decisions taken. Rendered from the state action's read model —
 * the full `sealed.*` audit chain lives in the audit log module.
 */
export function CeremonyRecord({ context }: { context: SealedCeremonyContext }) {
  return (
    <section className="space-y-md">
      <div className="rounded-card border border-l-4 border-info bg-info-light p-md">
        <h2 className="mb-xs font-heading text-h4 font-bold text-info">
          Tseremoonia protokoll (kirjutuskaitstud)
        </h2>
        <p className="text-bodySm text-info">
          Pärast paljastust on avamine ainult loetav. Kogu tegevus on auditilogis (`sealed.*`).
        </p>
      </div>

      <section className="rounded-card border border-border bg-bgPage p-md">
        <h3 className="mb-sm font-heading text-h4 font-bold text-ink">Allkirjad</h3>
        <dl className="grid grid-cols-1 gap-xs sm:grid-cols-2">
          <div className="rounded-input border border-border bg-bgMist px-md py-sm">
            <dt className="text-label font-semibold text-ink-muted">Avaja</dt>
            <dd className="mt-1 text-bodySm text-ink">
              {context.opener !== null ? (
                <>
                  <span className="font-semibold">{context.opener.userId}</span> ·{' '}
                  {formatDateTime(context.opener.signedAt)}
                </>
              ) : (
                '—'
              )}
            </dd>
          </div>
          <div className="rounded-input border border-border bg-bgMist px-md py-sm">
            <dt className="text-label font-semibold text-ink-muted">Kinnitaja</dt>
            <dd className="mt-1 text-bodySm text-ink">
              {context.approver !== null ? (
                <>
                  <span className="font-semibold">{context.approver.userId}</span> ·{' '}
                  {formatDateTime(context.approver.signedAt)}
                </>
              ) : (
                '—'
              )}
            </dd>
          </div>
        </dl>
        {context.signaturesExpired ? (
          <p className="mt-sm text-bodySm text-ink-muted">Allkirjade kehtivusaeg on lõppenud.</p>
        ) : null}
      </section>

      <section className="rounded-card border border-border bg-bgPage p-md">
        <h3 className="mb-sm font-heading text-h4 font-bold text-ink">Paljastus</h3>
        {context.revealed ? (
          <>
            <p className="mb-sm text-bodySm text-ink-muted">
              Paljastatud: {formatDateTime(context.revealedAt)}
            </p>
            <RevealRecord bids={context.bids} topMeetsReserve={context.topMeetsReserve} />
          </>
        ) : (
          <p className="text-bodySm text-ink-muted">Pakkumisi ei paljastatud.</p>
        )}
      </section>

      <section className="rounded-card border border-border bg-bgPage p-md">
        <h3 className="mb-sm font-heading text-h4 font-bold text-ink">Otsused</h3>
        <ul className="space-y-xs text-bodySm text-ink">
          <li>
            Võitja kinnitatud:{' '}
            {context.winnerConfirmed ? (
              <span className="font-semibold text-primary">jah</span>
            ) : (
              <span className="text-ink-muted">ei</span>
            )}
          </li>
          <li>
            Tühistatud:{' '}
            {context.voided ? (
              <span className="font-semibold text-danger">jah — kuulutatud müümata</span>
            ) : (
              <span className="text-ink-muted">ei</span>
            )}
          </li>
        </ul>
      </section>
    </section>
  )
}
