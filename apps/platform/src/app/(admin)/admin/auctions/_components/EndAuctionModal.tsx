'use client'

/**
 * Manual-end confirmation dialog on the native <dialog> element: showModal()
 * gives the focus trap and Escape handling for free; the backdrop click and
 * the foot buttons funnel through dialog.close(), whose close event calls
 * onClose so the parent clears its endTarget row.
 *
 * The header previews the current leading bid (amount + relative time;
 * anonymity rules — amounts and times only, never a bidder identity). When
 * the end falls inside the final minute and anti-snipe is enabled, an info
 * line states that the server re-checks the anti-snipe extension before
 * the auction ends.
 */

import { useEffect, useRef, useState } from 'react'

import { CalendarClockIcon, TriangleAlertIcon, XIcon } from '../../../_components/icons'
import { formatEur, formatRelativeTime } from '../../../_lib/labels'

const FINAL_MINUTE_MS = 60_000
const ANTI_SNIPE_DEFAULT_MINUTES = 5

export interface EndAuctionModalAuction {
  id: string
  title: string
  context: string
  /** Leading bid amount in cents; null when no leading bid exists. */
  leadingBidCents?: number | null
  /** Leading bid submission time (ISO-8601). */
  leadingBidAt?: string | null
  /** Planned end time (ISO-8601); drives the final-minute notice. */
  endsAt?: string | null
  /** Whether anti-snipe is enabled for this auction. */
  antiSnipeEnabled?: boolean
  /** Anti-snipe window in minutes (1–30); defaults to 5. */
  antiSnipeMinutes?: number
}

interface EndAuctionModalProps {
  /** Row to end; null keeps the dialog closed. */
  auction: EndAuctionModalAuction | null
  action: (formData: FormData) => void | Promise<void>
  onClose: () => void
}

/** Mounted-only clock: null until the first effect, so SSR stays identical. */
function useNow(intervalMs = 1000): number | null {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(Date.now())
    const timer = setInterval(() => {
      setNow(Date.now())
    }, intervalMs)
    return () => {
      clearInterval(timer)
    }
  }, [intervalMs])
  return now
}

function clampAntiSnipeMinutesUi(value: number): number {
  if (!Number.isFinite(value)) return ANTI_SNIPE_DEFAULT_MINUTES
  return Math.min(30, Math.max(1, Math.round(value)))
}

export function EndAuctionModal({
  auction,
  action,
  onClose,
}: EndAuctionModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const openId = auction?.id ?? null
  const now = useNow()

  const leadingProvided = auction?.leadingBidCents !== undefined
  const hasLeadingBid =
    auction?.leadingBidCents !== null && auction?.leadingBidCents !== undefined
  const antiSnipeEnabled = auction?.antiSnipeEnabled === true
  const antiSnipeMinutes =
    auction?.antiSnipeMinutes !== undefined
      ? clampAntiSnipeMinutesUi(auction.antiSnipeMinutes)
      : ANTI_SNIPE_DEFAULT_MINUTES
  const endsAtMs =
    auction?.endsAt != null && auction.endsAt !== '' ? Date.parse(auction.endsAt) : Number.NaN
  const inFinalMinute =
    antiSnipeEnabled && now !== null && Number.isFinite(endsAtMs) && endsAtMs - now <= FINAL_MINUTE_MS

  // Open/close follows the target row identity, so a parent re-render with
  // a fresh auction object never resets the form mid-typing. Reset on open
  // per the demo (form.reset in openModal).
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (openId) {
      if (!dialog.open) dialog.showModal()
      formRef.current?.reset()
    } else if (dialog.open) {
      dialog.close()
    }
  }, [openId])

  // Demo body.modal-open: the page behind the open dialog must not scroll.
  useEffect(() => {
    if (!openId) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [openId])

  const requestClose = (): void => {
    dialogRef.current?.close()
  }

  const shortId = auction ? auction.id.slice(0, 8) : ''

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="end-auction-title"
      aria-describedby="end-auction-warn"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) requestClose()
      }}
      className="w-[min(480px,100%)] rounded-card border border-border bg-bgPage p-0 text-ink shadow-modal [&::backdrop]:bg-[rgba(24,26,46,0.45)]"
    >
      <div className="flex items-start gap-3 border-b border-border px-5 py-4">
        <span
          aria-hidden="true"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] bg-dangerLight text-danger"
        >
          <TriangleAlertIcon className="h-[18px] w-[18px]" />
        </span>
        <div className="flex-1">
          <h2
            id="end-auction-title"
            className="font-heading text-[16px] font-semibold text-ink"
          >
            Lõpeta käsitsi
          </h2>
          {auction && leadingProvided ? (
            <p className="mt-0.5 text-label text-inkMuted">
              {hasLeadingBid ? (
                <>
                  {'Juhtiv pakkumus: '}
                  <span className="font-semibold text-ink">
                    {formatEur(auction.leadingBidCents)}
                  </span>
                  {now !== null && auction.leadingBidAt != null
                    ? ` · ${formatRelativeTime(auction.leadingBidAt, now)}`
                    : ''}
                </>
              ) : (
                'Juhtiv pakkumus puudub.'
              )}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={requestClose}
          aria-label="Sulge"
          className="grid h-8 w-8 place-items-center rounded-[8px] text-inkMuted transition-colors duration-hover ease-hover hover:bg-bgMist hover:text-ink"
        >
          <XIcon aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
      <form ref={formRef} action={action} className="flex flex-col">
        {auction ? <input type="hidden" name="id" value={auction.id} /> : null}
        <div className="flex flex-col gap-3 px-5 py-4">
          <p
            id="end-auction-warn"
            className="flex gap-2.5 rounded-[8px] bg-dangerLight p-2.5 text-bodySm font-medium text-danger"
          >
            <TriangleAlertIcon
              aria-hidden="true"
              className="mt-px h-[15px] w-[15px] shrink-0"
            />
            Lõpetamine on pöördumatu. Oksjon suletakse kohe ja otsust ei saa
            tühistada.
          </p>
          {auction && inFinalMinute ? (
            <p className="flex gap-2.5 rounded-[8px] bg-bgMist p-2.5 text-bodySm text-inkMuted">
              <CalendarClockIcon
                aria-hidden="true"
                className="mt-px h-[15px] w-[15px] shrink-0"
              />
              <span>
                Viimane minut: enne lõpetamist kontrollib server antissnipe
                reeglit. Viimase {String(antiSnipeMinutes)} minuti jooksul
                tehtud pakkumine pikendab lõpuaega ja lõpetamine lükatakse
                tagasi.
              </span>
            </p>
          ) : null}
          {auction ? (
            <p className="text-bodySm leading-5 text-inkMuted">
              {`Oksjon #${shortId} · ${auction.title} — ${auction.context}.`}
            </p>
          ) : null}
          <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
            <legend className="sr-only">Tulemuse valik</legend>
            <label className="flex items-start gap-2.5 rounded-[8px] border border-border p-2.5 transition-colors duration-hover ease-hover hover:border-primary">
              <input
                type="radio"
                name="outcome"
                value="winner"
                required
                defaultChecked
                className="mt-0.5 h-[15px] w-[15px] accent-primary"
              />
              <span>
                <span className="block text-bodySm font-medium text-ink">
                  Kuuluta praegune pakkumine võitjaks
                </span>
                <span className="block text-label text-inkMuted">
                  Võitjale saadetakse kohe lepingu allkirjastamise kutse.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2.5 rounded-[8px] border border-border p-2.5 transition-colors duration-hover ease-hover hover:border-primary">
              <input
                type="radio"
                name="outcome"
                value="unsold"
                required
                className="mt-0.5 h-[15px] w-[15px] accent-primary"
              />
              <span>
                <span className="block text-bodySm font-medium text-ink">
                  Märgi müümata
                </span>
                <span className="block text-label text-inkMuted">
                  Oksjon lõpeb tulemuseta; piirhind jäi saavutamata.
                </span>
              </span>
            </label>
          </fieldset>
          <div>
            <label
              htmlFor="end-auction-reason"
              className="mb-1 block text-label font-medium text-inkMuted"
            >
              Lõpetamise põhjus (min 5 tähemärki)
            </label>
            <input
              id="end-auction-reason"
              name="reason"
              type="text"
              required
              minLength={5}
              placeholder="nt müüja taotlus 31.08"
              className="w-full rounded-[8px] border border-border bg-bgPage px-2.5 py-2 text-bodySm text-ink transition-colors duration-hover ease-hover focus:border-primary focus:outline-none"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3.5">
          <button
            type="button"
            onClick={requestClose}
            className="inline-flex items-center rounded-[8px] px-3.5 py-2 text-label font-semibold text-ink transition-colors duration-hover ease-hover hover:bg-bgMist"
          >
            Tühista
          </button>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-[8px] bg-danger px-3.5 py-2 text-label font-semibold text-inkInverse transition-[filter] duration-hover ease-hover hover:brightness-90"
          >
            <TriangleAlertIcon aria-hidden="true" className="h-4 w-4" />
            Kinnita lõpetamine
          </button>
        </div>
      </form>
    </dialog>
  )
}
