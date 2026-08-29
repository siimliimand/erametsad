'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useActionState, useEffect } from 'react'

import {
  approveSealedCeremonyAction,
  confirmSealedWinnerAction,
  startSealedCeremonyAction,
  voidSealedCeremonyAction,
  type CeremonyState,
} from '../../../../_actions/auctions'
import { primaryButtonClass, secondaryButtonClass } from '../../../../_components/FormField'
import { formatEurAmount, formatRelativeTime } from '../../../../_lib/labels'

const initialState: CeremonyState = {
  phase: 'start',
  sessionId: null,
  approvalToken: null,
  bids: [],
  error: null,
}

export function CeremonyFlow({
  auctionId,
  sealedBidCount,
  reservePriceCents,
}: {
  auctionId: string
  sealedBidCount: number
  reservePriceCents: number | null
}) {
  const router = useRouter()
  const [startState, startAction, startPending] = useActionState(
    startSealedCeremonyAction,
    initialState,
  )
  const [approveState, approveAction, approvePending] = useActionState(
    approveSealedCeremonyAction,
    initialState,
  )
  const [confirmState, confirmAction, confirmPending] = useActionState(
    confirmSealedWinnerAction,
    initialState,
  )

  const confirmed = confirmState.phase === 'confirmed'
  useEffect(() => {
    if (confirmed) router.refresh()
  }, [confirmed, router])

  const detailPath = `/admin/auctions/${auctionId}`

  return (
    <div className="space-y-md">
      <section className="rounded-card border border-border bg-bgPage p-md">
        <h2 className="mb-xs font-heading text-h4 font-bold text-ink">Lukustatud pakkumised</h2>
        <p className="text-bodySm text-ink-muted">
          Krüptitud pakkumusi: <span className="font-semibold text-ink">{String(sealedBidCount)}</span>
          {reservePriceCents !== null ? (
            <>
              {' '}
              Reservhind:{' '}
              <span className="font-semibold text-ink">{formatEurAmount(reservePriceCents / 100)}</span>
            </>
          ) : null}
        </p>
      </section>

      {confirmed ? (
        <section className="rounded-card border border-l-4 border-info bg-info-light p-md">
          <h2 className="mb-xs font-heading text-h4 font-bold text-info">Võitja kinnitatud</h2>
          <p className="mb-sm text-bodySm text-info">
            Oksjon on nüüd hinnatud ja võitjale koostatakse leping. Jätka detailvaatest.
          </p>
          <Link href={detailPath} className={secondaryButtonClass}>
            Tagasi detailvaatesse
          </Link>
        </section>
      ) : startState.phase === 'awaiting-approval' || approveState.phase === 'revealed' ? (
        <section className="rounded-card border border-border bg-bgPage p-md">
          {approveState.phase === 'revealed' ? (
            <>
              <h2 className="mb-xs font-heading text-h4 font-bold text-ink">Avatud pakkumused</h2>
              <p className="mb-sm text-bodySm text-ink-muted">
                Järjestus krüpti lahtiharutamise järgi. Näidatakse ainult summasid ja aegu.
              </p>
              <div className="mb-sm overflow-x-auto rounded-input border border-border">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-border bg-bg-mist">
                      <th scope="col" className="h-10 px-3 text-label font-semibold text-ink-muted">Koht</th>
                      <th scope="col" className="h-10 px-3 text-label font-semibold text-ink-muted">Summa</th>
                      <th scope="col" className="h-10 px-3 text-label font-semibold text-ink-muted">Aeg</th>
                      <th scope="col" className="h-10 px-3 text-label font-semibold text-ink-muted">Kehtivus</th>
                    </tr>
                  </thead>
                  <tbody>
                    {approveState.bids.map((bid, index) => (
                      <tr key={bid.id} className="border-b border-border last:border-b-0">
                        <td className="h-10 px-3 text-bodySm text-ink">{String(index + 1)}</td>
                        <td className="h-10 px-3 text-bodySm font-semibold text-ink">
                          {formatEurAmount(bid.amount)}
                        </td>
                        <td className="h-10 px-3 text-bodySm text-ink">{formatRelativeTime(bid.createdAt)}</td>
                        <td className="h-10 px-3 text-bodySm">
                          {bid.valid ? (
                            <span className="text-primary">Kehtiv</span>
                          ) : (
                            <span className="text-danger">Vigane (krüptimine ebaõnnestus)</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {confirmState.error ? (
                <p className="mb-sm rounded-input border border-danger bg-danger-light px-md py-sm text-bodySm text-danger">
                  {confirmState.error}
                </p>
              ) : null}
              {approveState.bids.some((bid) => bid.valid) ? (
                <form action={confirmAction} className="flex flex-wrap items-center gap-sm">
                  <input type="hidden" name="auctionId" value={auctionId} />
                  <input
                    type="hidden"
                    name="bidId"
                    value={approveState.bids.find((bid) => bid.valid)?.id ?? ''}
                  />
                  <input type="hidden" name="sessionId" value={approveState.sessionId ?? ''} />
                  <input type="hidden" name="approvalToken" value={approveState.approvalToken ?? ''} />
                  <button type="submit" className={primaryButtonClass} disabled={confirmPending}>
                    {confirmPending ? 'Kinnitan…' : 'Kinnita kõrgeim võitjaks'}
                  </button>
                  <span className="text-bodySm text-ink-muted">
                    {reservePriceCents !== null
                      ? 'Reservhinda täitmata jätmisel kuulutatakse oksjon müümata.'
                      : 'Kinnitamine määrab võitjaks kõrgeima kehtiva pakkumise.'}
                  </span>
                </form>
              ) : (
                <p className="text-bodySm text-ink-muted">
                  Kehtivaid pakkumusi ei ole; oksjon jääb avamata. Kasuta allpool tühistamist.
                </p>
              )}
            </>
          ) : (
            <>
              <h2 className="mb-xs font-heading text-h4 font-bold text-ink">Samm 2: teine kinnitaja</h2>
              <p className="mb-sm text-bodySm text-ink-muted">
                Esimene administraator avas sessiooni. Teine (erinev) administraator peab sisse
                andma sessiooni id ja kinnituseloabi ning kinnitama avamise. Sessioon aegub 30 minutit.
              </p>
              <dl className="mb-sm grid grid-cols-1 gap-xs sm:grid-cols-2">
                <div className="rounded-input border border-border bg-bg-mist px-md py-sm">
                  <dt className="text-label font-semibold text-ink-muted">Sessiooni id</dt>
                  <dd className="break-all font-mono text-bodySm text-ink">{startState.sessionId}</dd>
                </div>
                <div className="rounded-input border border-border bg-bg-mist px-md py-sm">
                  <dt className="text-label font-semibold text-ink-muted">Kinnituseluba</dt>
                  <dd className="break-all font-mono text-bodySm text-ink">{startState.approvalToken}</dd>
                </div>
              </dl>
              {approveState.error ? (
                <p className="mb-sm rounded-input border border-danger bg-danger-light px-md py-sm text-bodySm text-danger">
                  {approveState.error}
                </p>
              ) : null}
              <form action={approveAction} className="flex flex-wrap items-center gap-sm">
                <input type="hidden" name="sessionId" value={startState.sessionId ?? ''} />
                <input type="hidden" name="approvalToken" value={startState.approvalToken ?? ''} />
                <button type="submit" className={primaryButtonClass} disabled={approvePending}>
                  {approvePending ? 'Kinnitan…' : 'Kinnita avamine'}
                </button>
                <span className="text-bodySm text-ink-muted">
                  Sisesta teise administraatorina.
                </span>
              </form>
            </>
          )}
        </section>
      ) : (
        <section className="rounded-card border border-border bg-bgPage p-md">
          <h2 className="mb-xs font-heading text-h4 font-bold text-ink">Samm 1: ava pitseered</h2>
          <p className="mb-sm text-bodySm text-ink-muted">
            Alustamine krüptib lahti alles pärast teise administraatori kinnitust. Uue sessiooni
            alustamiseks laadi leht uuesti.
          </p>
          {startState.error ? (
            <p className="mb-sm rounded-input border border-danger bg-danger-light px-md py-sm text-bodySm text-danger">
              {startState.error}
            </p>
          ) : null}
          <form action={startAction}>
            <input type="hidden" name="auctionId" value={auctionId} />
            <button type="submit" className={primaryButtonClass} disabled={startPending}>
              {startPending ? 'Avan…' : 'Ava pitseered'}
            </button>
          </form>
        </section>
      )}

      <section className="rounded-card border border-border bg-bgPage p-md">
        <h2 className="mb-xs font-heading text-h4 font-bold text-ink">Tühista avamine</h2>
        <p className="mb-sm text-bodySm text-ink-muted">
          Kuulutab oksjoni müümata ilma pakkumusi avamata. Tegevust ei saa tagasi võtta.
        </p>
        <form action={voidSealedCeremonyAction}>
          <input type="hidden" name="auctionId" value={auctionId} />
          <button
            type="submit"
            className="inline-flex h-10 items-center rounded-button border border-danger bg-bgPage px-4 text-label font-semibold text-danger transition-colors duration-hover ease-hover hover:border-danger/60"
          >
            Kuuluta müümata
          </button>
        </form>
      </section>
    </div>
  )
}
