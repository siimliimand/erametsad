'use client'

import { Modal } from '@erametsad/ui'
import Link from 'next/link'

export interface GuestGateModalProps {
  isOpen: boolean
  onClose: () => void
  auctionId: string
}

// Demo guest gate (docs/design/demo/portal/02-lot-detail-open.html
// #loginModal): a validated guest submit opens this modal instead of an API
// call; the actions route to login/register with a `next` back to the lot.
export function GuestGateModal({ isOpen, onClose, auctionId }: GuestGateModalProps) {
  const next = `?next=${encodeURIComponent(`/oksjon/${auctionId}`)}`

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Pakkumise tegemiseks logi sisse"
      size="sm"
    >
      <div className="flex flex-col gap-sm">
        <p className="text-body text-inkMuted">
          Pakkuda saavad registreeritud kasutajad, kellel on allkirjastatud
          raamleping. Logi sisse või loo konto — see võtab vaid mõne minuti.
        </p>
        <div className="mt-2xs flex flex-col gap-xs">
          <Link
            href={`/login${next}`}
            className="inline-flex h-12 w-full items-center justify-center rounded-button bg-cta px-6 font-label font-semibold text-ink transition-colors duration-hover hover:bg-ctaHover"
          >
            Logi sisse
          </Link>
          <Link
            href={`/register${next}`}
            className="inline-flex h-12 w-full items-center justify-center rounded-button border border-primary px-6 font-label font-semibold text-primary transition-colors duration-hover hover:bg-primaryLight hover:text-primaryHover"
          >
            Registreeru
          </Link>
        </div>
        <p className="text-bodySm text-inkMuted">
          Pakkumine on siduv. Tingimused leiad{' '}
          <Link
            href="/tingimused"
            className="font-semibold text-primary hover:text-primaryHover"
          >
            tingimustest
          </Link>
          .
        </p>
      </div>
    </Modal>
  )
}
