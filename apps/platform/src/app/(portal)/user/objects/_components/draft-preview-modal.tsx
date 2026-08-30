'use client'

import { Modal } from '@eametsad/ui'

import { formatDateTime, formatEur, statusLabel, TYPE_LABELS } from './format'
import type { SellerAuctionRow } from './seller-data'

interface DraftPreviewModalProps {
  row: SellerAuctionRow | null
  onClose: () => void
}

export function DraftPreviewModal({ row, onClose }: DraftPreviewModalProps) {
  if (!row) return null
  const entries: [string, string][] = [
    ['Nimi', row.title],
    ['Tüüp', TYPE_LABELS[row.type] ?? row.type],
    ['Olek', statusLabel(row.status)],
    ['Algushind', formatEur(row.startPrice)],
    ['Algab', formatDateTime(row.startsAt)],
    ['Lõpeb', formatDateTime(row.endsAt)],
    ['Lisatud', formatDateTime(row.createdAt)],
  ]
  return (
    <Modal isOpen onClose={onClose} title="Mustandi eelvaade" size="md">
      <dl className="flex flex-col gap-2xs text-bodySm">
        {entries.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-md">
            <dt className="shrink-0 text-inkMuted">{label}</dt>
            <dd className="text-right font-semibold text-ink">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-md text-bodySm text-inkMuted">
        Mustand ei ole veel avalik. Pärast spetsialisti ülevaatust ja planeerimist
        ilmub oksjon sirvijatele.
      </p>
    </Modal>
  )
}
