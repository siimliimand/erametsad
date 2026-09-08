'use client'

import type { BuilderBlock } from './builder-types'
import { TriangleAlertIcon } from '../../../../_components/icons'
import { Modal } from '../../../../_components/ui/Modal'

import { getBlockTypeLabel } from '@/lib/content/blocks'

/**
 * Delete confirmation for a block. Temporary stand-in for the shared
 * ConfirmDialog (parallel task): plain confirm/cancel on the Modal primitive,
 * danger tone.
 */
export interface DeleteBlockModalProps {
  /** Block pending deletion; null keeps the modal closed. */
  block: BuilderBlock | null
  onDelete: () => void
  onClose: () => void
}

export function DeleteBlockModal({ block, onDelete, onClose }: DeleteBlockModalProps) {
  return (
    <Modal
      open={block !== null}
      onClose={onClose}
      title="Kustuta blokk"
      tone="danger"
      icon={<TriangleAlertIcon className="h-[18px] w-[18px]" />}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center gap-xs rounded-button border border-border bg-bgPage px-4 text-label font-semibold text-ink transition-colors duration-hover ease-hover hover:border-primary hover:text-primary"
          >
            Tühista
          </button>
          <button
            type="button"
            onClick={() => {
              onDelete()
              onClose()
            }}
            className="inline-flex h-10 items-center gap-xs rounded-button bg-danger px-4 text-label font-semibold text-inkInverse transition-[filter] duration-hover ease-hover hover:brightness-90"
          >
            <TriangleAlertIcon className="h-4 w-4" />
            Kustuta blokk
          </button>
        </>
      }
    >
      {block ? (
        <p className="text-bodySm leading-5 text-ink">
          {`Kas kustutada blokk „${getBlockTypeLabel(block.type)}“? Seda toimingut ei saa tagasi võtta.`}
        </p>
      ) : null}
    </Modal>
  )
}
