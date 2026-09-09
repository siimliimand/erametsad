'use client'

import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useState } from 'react'

import {
  confirmSealedCeremonyWinnerAction,
  type SealedCeremonyActionState,
  type SealedCeremonyContext,
  type RevealedBidView,
} from '../../../../../_actions/auctions'
import { FormField, primaryButtonClass } from '../../../../../_components/FormField'
import { useToast } from '../../../../../_components/ui/Toast'
import { formatEur, formatEurAmount } from '../../../../../_lib/labels'

type Decision = 'sold' | 'unsold' | 'house-backup'
type CompanyProfileChoice = '' | 'proceed' | 'hold'

const initialState: SealedCeremonyActionState = {
  ok: false,
  phase: 'revealed',
  error: null,
}

function decisionLabel(decision: string): string {
  if (decision === 'sold') return 'Müük'
  if (decision === 'unsold') return 'Müümata'
  return 'Varupakkumine'
}

/**
 * Winner decision after the reveal: sold (top valid bid), unsold with a
 * typed reason, or the superadmin-only kiiroksjon house-backup. The opener
 * confirms behind step-up re-auth (password, or session token for eID-only
 * accounts); the reserve comparison itself stays server-side. The dialog
 * shows the final price plus the fee estimate, and a company bidder with a
 * pending profile forces an explicit proceed-or-hold choice.
 */
export function WinnerConfirm({
  auctionId,
  bids,
  topMeetsReserve,
  feeEstimate,
  winnerProfileHold,
  isOpener,
  isSuperadmin,
  kiiroksjon,
}: {
  auctionId: string
  bids: SealedCeremonyContext['bids']
  topMeetsReserve: SealedCeremonyContext['topMeetsReserve']
  feeEstimate: SealedCeremonyContext['feeEstimate']
  winnerProfileHold: boolean
  isOpener: boolean
  isSuperadmin: boolean
  kiiroksjon: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const [confirmState, confirmFormAction, confirmPending] = useActionState(
    confirmSealedCeremonyWinnerAction,
    initialState,
  )
  const [dialogOpen, setDialogOpen] = useState(false)
  const [decision, setDecision] = useState<Decision>('sold')
  const [reason, setReason] = useState('')
  const [companyChoice, setCompanyChoice] = useState<CompanyProfileChoice>('')

  const topBid: RevealedBidView | null = bids.find((bid) => bid.valid) ?? null
  const soldPossible = topBid !== null && topMeetsReserve !== false
  const houseBackupPossible = isSuperadmin && kiiroksjon
  const effectiveDecision: Decision =
    decision === 'sold' && !soldPossible ? 'unsold' : decision
  const companyChoiceRequired = winnerProfileHold && effectiveDecision === 'sold'

  // Server-action error semantics stay intact: the state drives the toast,
  // and the success message follows the server-authoritative phase.
  useEffect(() => {
    if (confirmState.ok) {
      setDialogOpen(false)
      if (confirmState.phase === 'confirmed') {
        toast({ tone: 'success', title: 'Võitja kinnitatud. Lõpphind avaldatud.' })
      } else if (confirmState.phase === 'house-backup') {
        toast({
          tone: 'success',
          title: 'Varupakkumine kinnitatud. Otsus salvestatud auditilogisse.',
        })
      } else {
        toast({
          tone: 'success',
          title: 'Oksjon kuulutatud müümata. Otsus salvestatud auditilogisse.',
        })
      }
      router.refresh()
    } else if (confirmState.error !== null) {
      toast({
        tone: 'error',
        title: 'Kinnitamine ebaõnnestus',
        description: confirmState.error,
      })
    }
  }, [confirmState, toast, router])

  if (!isOpener) {
    return (
      <section className="rounded-card border border-border bg-bgPage p-md">
        <h2 className="mb-xs font-heading text-h4 font-bold text-ink">Võitja kinnitamine</h2>
        <p className="text-bodySm text-inkMuted">
          Võitja kinnitab avaja pärast uuesti autentimist. Oota, kuni avaja tulemuse kinnitab.
        </p>
      </section>
    )
  }

  return (
    <section className="rounded-card border border-border bg-bgPage p-md">
      <h2 className="mb-xs font-heading text-h4 font-bold text-ink">Võitja kinnitamine</h2>
      {!soldPossible ? (
        <p className="mb-sm text-bodySm text-inkMuted">
          {topBid === null
            ? 'Kehtivaid pakkumisi ei ole — märgi oksjon müümata.'
            : 'Kõrgeim kehtiv pakkumine ei täida piirhinna — võimalik on müümata või varupakkumine.'}
        </p>
      ) : null}
      {!houseBackupPossible && kiiroksjon ? (
        <p className="mb-sm text-bodySm text-inkMuted">
          Varupakkumise tee on ainult superadminile.
        </p>
      ) : null}
      {winnerProfileHold && topBid !== null ? (
        <p className="mb-sm rounded-input border border-statusEndingSoon bg-bgMist px-md py-sm text-bodySm text-ink">
          Võitja ettevõtte profiil on kinnitamata — kinnitamine vajab selget otsust.
        </p>
      ) : null}

      <button
        type="button"
        className={primaryButtonClass}
        disabled={confirmPending}
        onClick={() => {
          setDialogOpen(true)
        }}
      >
        Kinnita tulemus
      </button>

      {dialogOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-md"
          role="dialog"
          aria-modal="true"
          aria-label="Kinnita tulemus"
        >
          <form
            action={confirmFormAction}
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-card border border-border bg-bgPage p-md shadow-modal"
          >
            <input type="hidden" name="auctionId" value={auctionId} />
            <input type="hidden" name="bidId" value={topBid?.id ?? ''} />
            <input type="hidden" name="decision" value={effectiveDecision} />
            <input type="hidden" name="companyProfileDecision" value={companyChoice} />
            <h3 className="font-heading text-h4 font-bold text-ink">Kinnita tulemus</h3>
            <p className="mt-sm rounded-input border-l-4 border-danger bg-dangerLight px-md py-sm text-bodySm font-semibold text-danger">
              HOIATUS: otsus on lõplik. Müük avaldab lõpphinna ja koostab võitjale lepingu;
              müümata kuulutab oksjoni müüdud tagasi ei tule.
            </p>

            {effectiveDecision === 'sold' && topBid !== null ? (
              <div className="mt-sm rounded-input border border-border bg-bgMist px-md py-sm text-bodySm text-ink">
                <p>
                  Lõpphind:{' '}
                  <span className="font-semibold">{formatEurAmount(topBid.amount)}</span>
                </p>
                {feeEstimate !== null ? (
                  <p className="text-inkMuted">
                    Vahendustasu hinnang: {formatEur(feeEstimate.feeCents)} (
                    {String(feeEstimate.feePercent)}% + käibemaks {String(feeEstimate.vatPercent)}
                    %), makstakse lepingu sõlmimisel
                  </p>
                ) : null}
              </div>
            ) : null}

            <fieldset className="mt-md space-y-xs">
              <legend className="text-label font-semibold text-ink">Tulemus</legend>
              <label className="flex items-center gap-sm text-bodySm text-ink">
                <input
                  type="radio"
                  name="decision-radio"
                  value="sold"
                  checked={effectiveDecision === 'sold'}
                  disabled={!soldPossible}
                  onChange={() => {
                    setDecision('sold')
                  }}
                />
                Müük — kõrgeim kehtiv pakkumine võidab
              </label>
              <label className="flex items-center gap-sm text-bodySm text-ink">
                <input
                  type="radio"
                  name="decision-radio"
                  value="unsold"
                  checked={effectiveDecision === 'unsold'}
                  onChange={() => {
                    setDecision('unsold')
                  }}
                />
                Müümata — kuuluta müümata põhjusega
              </label>
              {houseBackupPossible ? (
                <label className="flex items-center gap-sm text-bodySm text-ink">
                  <input
                    type="radio"
                    name="decision-radio"
                    value="house-backup"
                    checked={effectiveDecision === 'house-backup'}
                    onChange={() => {
                      setDecision('house-backup')
                    }}
                  />
                  Varupakkumine — kiiroksjoni majapakkumise töövoog (superadmin)
                </label>
              ) : null}
            </fieldset>

            {companyChoiceRequired ? (
              <fieldset className="mt-md space-y-xs rounded-input border border-statusEndingSoon bg-bgMist px-md py-sm">
                <legend className="text-label font-semibold text-ink">
                  Ettevõtte profiil on ootel
                </legend>
                <p className="text-bodySm text-inkMuted">
                  Võitja ettevõtte profiil ei ole veel kinnitatud. Vali, kas kuulutad võitja ja
                  koostad lepingu, või hoia kinnitamine ootel.
                </p>
                <label className="flex items-center gap-sm text-bodySm text-ink">
                  <input
                    type="radio"
                    name="company-profile-choice"
                    value="proceed"
                    checked={companyChoice === 'proceed'}
                    onChange={() => {
                      setCompanyChoice('proceed')
                    }}
                  />
                  Jätka — kuuluta võitja ja koosta leping
                </label>
                <label className="flex items-center gap-sm text-bodySm text-ink">
                  <input
                    type="radio"
                    name="company-profile-choice"
                    value="hold"
                    checked={companyChoice === 'hold'}
                    onChange={() => {
                      setCompanyChoice('hold')
                    }}
                  />
                  Hoia ootel — ära kinnita veel
                </label>
              </fieldset>
            ) : null}

            {effectiveDecision === 'unsold' || effectiveDecision === 'house-backup' ? (
              <FormField
                label="Põhjus"
                name="reason"
                value={reason}
                onChange={(event) => {
                  setReason(event.target.value)
                }}
                required={effectiveDecision === 'unsold'}
                minLength={5}
                hint={
                  effectiveDecision === 'unsold'
                    ? 'Kohustuslik, vähemalt 5 tähemärki — läheb auditilogisse.'
                    : 'Valikuline — läheb auditilogisse.'
                }
              />
            ) : null}

            <FormField
              label="Kinnitus (kirjuta KINNITAN)"
              name="keyword"
              autoComplete="off"
              required
              minLength={8}
              maxLength={8}
            />
            <FormField
              label="Salasõna (avaja uus autentimine)"
              name="password"
              type="password"
              autoComplete="current-password"
              hint="Step-up: avaja kinnitab uuesti. eID-konto (ilma salasõnata) kinnitab kehtiva sessiooniga — jäta väli tühjaks."
            />

            <div className="mt-md flex justify-end gap-sm">
              <button
                type="button"
                onClick={() => {
                  setDialogOpen(false)
                }}
                className="inline-flex h-10 items-center rounded-button border border-border bg-bgPage px-4 text-label font-semibold text-ink transition-colors duration-hover ease-hover hover:border-primary hover:text-primary"
              >
                Katkesta
              </button>
              <button
                type="submit"
                disabled={
                  confirmPending ||
                  (effectiveDecision === 'unsold' && reason.trim().length < 5) ||
                  (companyChoiceRequired && companyChoice === '')
                }
                className="inline-flex h-10 items-center rounded-button bg-danger px-4 text-label font-semibold text-inkInverse transition-[filter] duration-hover ease-hover hover:brightness-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {confirmPending
                  ? 'Kinnitan…'
                  : `Kinnita lõplikult: ${decisionLabel(effectiveDecision)}`}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  )
}
