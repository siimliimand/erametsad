import Link from 'next/link'

import { DataTable } from '../../../../_components/DataTable'
import { ContractStatusPill, formatDateTime } from '../../../../_lib/labels'

export interface ContractRow {
  id: string
  auctionId: string
  auctionTitle: string
  status: React.ComponentProps<typeof ContractStatusPill>['status']
  createdAt: string
  signedAt: string | null
}

export function ContractsTab({ rows }: { rows: ContractRow[] }) {
  return (
    <div>
      <p className="mb-sm text-bodySm text-ink-muted">
        Lepingud, mille allkirjastaja on see kasutaja.
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
          {
            key: 'status',
            label: 'Olek',
            render: (row) => <ContractStatusPill status={row.status} />,
          },
          { key: 'createdAt', label: 'Loodud', render: (row) => formatDateTime(row.createdAt) },
          {
            key: 'signedAt',
            label: 'Allkirjastatud',
            render: (row) => formatDateTime(row.signedAt),
          },
        ]}
        rows={rows}
        emptyLabel="Lepinguid ei leitud."
      />
    </div>
  )
}
