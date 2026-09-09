'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'

import {
  listVoidConsequences,
  VOID_CONFIRM_KEYWORD,
  VOID_REASON_MIN_LENGTH,
  type VoidOutcome,
} from './void-consequences'
import { voidContractAction } from '../../../_actions/contracts'
import { TriangleAlertIcon } from '../../../_components/icons'
import { ConfirmDialog } from '../../../_components/ui/ConfirmDialog'
import { Modal } from '../../../_components/ui/Modal'

const inputClass =
  'w-full rounded-input border border-border bg-bgPage px-3 py-2 text-bodySm text-ink placeholder:text-inkMuted focus:border-primary focus:outline-none'
const selectClass =
  'h-10 w-full rounded-input border border-border bg-bgPage px-3 text-bodySm text-ink focus:border-primary focus:outline-none'

const fieldLabelClass = 'text-label font-semibold text-ink'

/**
 * Void flow for the contracts list (spec delta admin-commerce-ops): the
 * first dialog lists the consequences and collects the mandatory reason
 * plus the outcome; the second is the GDPR-style keyword confirm. A
 * framework (raamleping) row gains the prompt linking the signer's rights
 * matrix in the admin users rights view. The actual write stays the
 * `voidContractAction` server action — the dialog only shapes the request.
 */
export function VoidContractDialog({
  contractId,
  contractLabel,
  auctionTitle,
  isFramework,
  auctionRevertEligible,
  isSuperadmin,
  signerUserId,
}: {
  contractId: string
  contractLabel: string
  auctionTitle: string
  isFramework: boolean
  auctionRevertEligible: boolean
  isSuperadmin: boolean
  signerUserId: string | null
}) {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [outcome, setOutcome] = useState<VoidOutcome>('contract')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  const consequences = listVoidConsequences({
    isFramework,
    auctionRevertEligible,
    isSuperadmin,
    outcome,
    signerUserId,
  })
  const reasonReady = reason.trim().length >= VOID_REASON_MIN_LENGTH

  const close = () => {
    setDetailsOpen(false)
    setConfirmOpen(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setDetailsOpen(true)
        }}
        className="text-label font-semibold text-danger transition-[opacity] duration-hover ease-hover hover:opacity-80"
      >
        Tühista ⚠
      </button>

      <Modal
        open={detailsOpen}
        onClose={() => {
          setDetailsOpen(false)
        }}
        title="Tühista leping"
        tone="danger"
        icon={<TriangleAlertIcon className="h-[18px] w-[18px]" />}
        footer={
          <>
            <button
              type="button"
              onClick={close}
              className="inline-flex items-center rounded-button px-3.5 py-2 text-label font-semibold text-ink transition-colors duration-hover ease-hover hover:bg-bgMist"
            >
              Katkesta
            </button>
            <button
              type="button"
              disabled={!reasonReady}
              onClick={() => {
                setDetailsOpen(false)
                setConfirmOpen(true)
              }}
              className="inline-flex items-center rounded-button bg-danger px-3.5 py-2 text-label font-semibold text-inkInverse transition-[filter] duration-hover ease-hover hover:brightness-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Jätka
            </button>
          </>
        }
      >
        <p className="text-bodySm text-ink">
          {contractLabel} · {auctionTitle}
        </p>
        <ul className="flex flex-col gap-1.5">
          {consequences.lines.map((line) => (
            <li key={line} className="flex gap-2 text-bodySm text-ink">
              <span aria-hidden="true" className="text-danger">
                •
              </span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
        {consequences.frameworkRightsRevoked ? (
          <div className="rounded-input border border-border bg-bgPage px-3 py-2 text-bodySm text-ink">
            <p>Kontrolli pärast tühistamist kasutaja õiguste maatriksit:</p>
            {consequences.rightsMatrixPath ? (
              <Link
                href={consequences.rightsMatrixPath}
                className="font-semibold text-primary transition-colors duration-hover ease-hover hover:text-primaryHover"
              >
                Ava õiguste maatriks
              </Link>
            ) : null}
          </div>
        ) : null}
        <div className="flex flex-col gap-1">
          <label htmlFor={`void-outcome-${contractId}`} className={fieldLabelClass}>
            Tühistamise tulemus
          </label>
          <select
            id={`void-outcome-${contractId}`}
            value={outcome}
            onChange={(event) => {
              setOutcome(event.target.value as VoidOutcome)
            }}
            className={selectClass}
          >
            <option value="contract">Tühista ainult leping</option>
            {isSuperadmin ? (
              <option value="contract-and-result">Tühista leping ja oksjoni tulemus</option>
            ) : null}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`void-reason-${contractId}`} className={fieldLabelClass}>
            Tühistamise põhjus (kohustuslik)
          </label>
          <textarea
            id={`void-reason-${contractId}`}
            rows={3}
            value={reason}
            onChange={(event) => {
              setReason(event.target.value)
            }}
            placeholder="Tühistamise põhjus (kohustuslik)"
            className={inputClass}
          />
          {!reasonReady && reason.trim().length > 0 ? (
            <p className="text-label text-danger">
              Põhjus on kohustuslik (vähemalt {String(VOID_REASON_MIN_LENGTH)} tähemärki).
            </p>
          ) : null}
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => {
          setConfirmOpen(false)
        }}
        title="Kinnita tühistamine uuesti"
        description={
          <span>
            {`Leping ${contractLabel} läheb olekusse "tühistatud". `}
            {consequences.auctionReverts
              ? 'Oksjoni tulemus tühistatakse ja lot läheb tagasi olekusse "lõppenud". '
              : ''}
            {consequences.frameworkRightsRevoked && consequences.rightsMatrixPath ? (
              <Link
                href={consequences.rightsMatrixPath}
                className="font-semibold text-primary transition-colors duration-hover ease-hover hover:text-primaryHover"
              >
                Kasutaja õiguste maatriks
              </Link>
            ) : null}
          </span>
        }
        variant="keyword"
        keyword={VOID_CONFIRM_KEYWORD}
        keywordLabel={`Trüki kinnitussõna: ${VOID_CONFIRM_KEYWORD}`}
        confirmLabel="Kinnita tühistamine"
        cancelLabel="Katkesta"
        busy={submitting}
        onConfirm={() => {
          setSubmitting(true)
          formRef.current?.requestSubmit()
        }}
      />

      <form ref={formRef} action={voidContractAction} hidden>
        <input type="hidden" name="id" value={contractId} />
        <input type="hidden" name="reason" value={reason} />
        <input type="hidden" name="outcome" value={outcome} />
      </form>
    </>
  )
}
