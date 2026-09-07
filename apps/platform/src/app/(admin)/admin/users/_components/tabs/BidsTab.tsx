import Link from 'next/link'

import { DataTable } from '../../../../_components/DataTable'
import { bidSourceLabels, bidStatusLabels, formatDateTime, formatEur } from '../../../../_lib/labels'

import type { BidSource, BidStatus } from '@/lib/data/schema'

export interface BidRow {
  id: string
  auctionId: string
  auctionTitle: string
  amount: number
  status: BidStatus
  source: BidSource
  createdAt: string
}

export function BidsTab({ rows }: { rows: BidRow[] }) {
  return (
    <div>
      <p className="mb-sm text-bodySm text-ink-muted">
        Kasutaja 100 viimast pakkumist. Summad ja olekud on nähtavad; teiste pakkujate identiteet
        ei kuvata.
      </p>
      <DataTable
        columns={[
          {
            key: 'auctionTitle',
            label: 'Oksjon',
            render: (row) => (
              <Link
                href={`/admin/auctions/${row.auctionId}`}
                className="text-label font-semibold text-primary transition-colors duration-hover ease-hover hover:text-primaryHover"
              >
                {row.auctionTitle}
              </Link>
            ),
          },
          { key: 'amount', label: 'Summa', render: (row) => formatEur(row.amount) },
          {
            key: 'status',
            label: 'Olek',
            render: (row) => bidStatusLabels[row.status],
          },
          {
            key: 'source',
            label: 'Allikas',
            render: (row) => bidSourceLabels[row.source],
          },
          { key: 'createdAt', label: 'Aeg', render: (row) => formatDateTime(row.createdAt) },
        ]}
        rows={rows}
        emptyLabel="Pakkumisi ei ole."
      />
    </div>
  )
}
