'use client'

import Link from 'next/link'

import { CeremonyUnsoldShortcut } from './_components/ceremony-checklist'
import { CeremonyRecord } from './_components/ceremony-record'
import { RevealPanel } from './_components/reveal-panel'
import { SigningPanel } from './_components/signing-panel'
import { VoidPanel } from './_components/void-panel'
import { WinnerConfirm } from './_components/winner-confirm'
import type { SealedCeremonyContext } from '../../../../_actions/auctions'
import { secondaryButtonClass } from '../../../../_components/FormField'
import type { StaffRole } from '../../../../_lib/permissions'

/**
 * Sealed-opening ceremony state machine:
 * checklist → signing (AVAN/KINNITAN, distinct sessions, 30 min) →
 * reveal-armed (60 s post-end unlock, one-shot) → revealed (read-only
 * record) → decided/voided. All mutations go through the new
 * `signSealed*`/`revealSealedBids`/`confirmSealedCeremonyWinner`/`voidSealedBids`
 * actions;
 * the read model arrives via `sealedCeremonyStateAction` (server page).
 * While the opening is in progress, admins outside the ceremony get a
 * read-only "Avamine on pooleli" view; an empty lot offers the direct
 * müümata shortcut from the checklist stage.
 */
export function CeremonyFlow({
  auctionId,
  initialContext,
  session,
  kiiroksjon,
  sealedBidCount,
}: {
  auctionId: string
  initialContext: SealedCeremonyContext
  session: { userId: string; role: StaffRole }
  kiiroksjon: boolean
  sealedBidCount: number
}) {
  const context = initialContext
  const detailPath = `/admin/auctions/${auctionId}`
  // Superadmin void stays available until the winner decision locks the lot
  // (post-confirm voids run through the contract module instead).
  const canVoid = session.role === 'superadmin' && context.status === 'ended'
  const openingPooleli = context.openingInProgress && !context.viewerIsParticipant
  const unsoldShortcutPossible =
    context.status === 'ended' &&
    !context.revealed &&
    !context.winnerConfirmed &&
    !context.voided &&
    sealedBidCount === 0

  if (context.error !== null) {
    return (
      <section className="rounded-card border border-l-4 border-danger bg-dangerLight p-md">
        <h2 className="mb-xs font-heading text-h4 font-bold text-danger">
          Tseremoonia olek ei ole saadaval
        </h2>
        <p className="text-bodySm text-danger">{context.error}</p>
      </section>
    )
  }

  const bothSigned = context.opener !== null && context.approver !== null

  return (
    <div className="space-y-md">
      <section className="rounded-card border border-border bg-bgPage p-md">
        <h2 className="mb-xs font-heading text-h4 font-bold text-ink">Lukustatud pakkumised</h2>
        <p className="text-bodySm text-inkMuted">
          Krüptitud pakkumusi:{' '}
          <span className="font-semibold text-ink">{String(sealedBidCount)}</span>. Summasid
          näidatakse ainult pärast paljastust; piirhind jääb serverisse.
        </p>
      </section>

      {openingPooleli ? (
        <>
          <div className="rounded-card border border-l-4 border-info bg-infoLight p-md">
            <h2 className="mb-xs font-heading text-h4 font-bold text-info">
              Avamine on pooleli
            </h2>
            <p className="text-bodySm text-info">
              Teine administaator viib avamist parasjagu läbi. Kuni tseremoonia on lõpetatud, on
              see vaate ainult loetav.
            </p>
          </div>
          {context.revealed ? <CeremonyRecord context={context} /> : null}
          <Link href={detailPath} className={secondaryButtonClass}>
            Tagasi detailvaatesse
          </Link>
        </>
      ) : context.voided ? (
        <>
          <div className="rounded-card border border-l-4 border-danger bg-dangerLight p-md">
            <h2 className="mb-xs font-heading text-h4 font-bold text-danger">Tühistatud</h2>
            <p className="text-bodySm text-danger">
              Avamine tühistati; oksjon on kuulutatud müümata. Tseremoonia kirje on ainult
              loetav.
            </p>
          </div>
          <CeremonyRecord context={context} />
          <Link href={detailPath} className={secondaryButtonClass}>
            Tagasi detailvaatesse
          </Link>
        </>
      ) : context.winnerConfirmed ? (
        <>
          <CeremonyRecord context={context} />
          <Link href={detailPath} className={secondaryButtonClass}>
            Tagasi detailvaatesse
          </Link>
        </>
      ) : context.revealed ? (
        <>
          <CeremonyRecord context={context} />
          {context.status === 'ended' ? (
            <WinnerConfirm
              auctionId={auctionId}
              bids={context.bids}
              topMeetsReserve={context.topMeetsReserve}
              feeEstimate={context.feeEstimate}
              winnerProfileHold={context.winnerProfileHold}
              isOpener={session.userId === context.opener?.userId}
              isSuperadmin={session.role === 'superadmin'}
              kiiroksjon={kiiroksjon}
            />
          ) : null}
          {canVoid ? <VoidPanel auctionId={auctionId} /> : null}
        </>
      ) : (
        <>
          <SigningPanel
            auctionId={auctionId}
            checklist={context.checklist}
            opener={context.opener}
            approver={context.approver}
            signaturesExpired={context.signaturesExpired}
            currentUserId={session.userId}
          />
          {unsoldShortcutPossible ? <CeremonyUnsoldShortcut auctionId={auctionId} /> : null}
          {bothSigned ? (
            <RevealPanel
              auctionId={auctionId}
              revealAllowedAt={context.revealAllowedAt}
              signaturesExpired={context.signaturesExpired}
            />
          ) : null}
          {canVoid ? <VoidPanel auctionId={auctionId} /> : null}
        </>
      )}
    </div>
  )
}
