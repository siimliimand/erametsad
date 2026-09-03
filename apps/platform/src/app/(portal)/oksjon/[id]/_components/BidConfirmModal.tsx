'use client'

import { Btn, Modal } from '@erametsad/ui'

export interface BidConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  /** Bid amount to confirm, in EUR. No API call happens until onConfirm. */
  amount: number
  /**
   * Smallest amount the next bid may carry after this one, in EUR;
   * `null` when the auction defines no bid step.
   */
  nextStepAmount: number | null
  /** True when the amount is below the start price and waits for seller approval (alapakkumine). */
  requiresSellerApproval?: boolean
  /** True while the confirm-triggered API call is in flight; blocks closing. */
  isSubmitting?: boolean
  /** Fired only when the user confirms; the parent owns the submission. */
  onConfirm: () => void
}

function eur(value: number): string {
  return value.toLocaleString('et-EE', { style: 'currency', currency: 'EUR' })
}

export function BidConfirmModal({
  isOpen,
  onClose,
  amount,
  nextStepAmount,
  requiresSellerApproval = false,
  isSubmitting = false,
  onConfirm,
}: BidConfirmModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={isSubmitting ? () => undefined : onClose}
      title="Kinnita pakkumine"
      size="sm"
    >
      <div className="flex flex-col gap-sm">
        <div className="flex items-baseline justify-between gap-sm rounded-input bg-bgMist px-sm py-xs">
          <span className="text-bodySm text-inkMuted">Pakkumise summa</span>
          <span className="font-heading text-h3 text-ink">{eur(amount)}</span>
        </div>
        {nextStepAmount !== null && (
          <p className="text-bodySm text-inkMuted">
            Järgmine lubatud pakkumine on vähemalt {eur(nextStepAmount)}.
          </p>
        )}
        {requiresSellerApproval && (
          <p className="text-bodySm text-statusEndingSoon">
            Summa on alghinnast madalam, pakkumine ootab müüja nõusolekut.
          </p>
        )}
        <p className="text-bodySm text-inkMuted">
          Pakkumine on siduv. Teenustasu rakendub vaid oksjoni võitmise korral
        </p>
        <div className="mt-2xs flex flex-col gap-xs sm:flex-row">
          <Btn variant="outline" onClick={onClose} disabled={isSubmitting}>
            Katkesta
          </Btn>
          <Btn onClick={onConfirm} isLoading={isSubmitting}>
            Esita pakkumine
          </Btn>
        </div>
      </div>
    </Modal>
  )
}
