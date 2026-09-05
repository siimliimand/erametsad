import Link from 'next/link'

import { ContainerDownloadButton } from './_components/ContainerDownloadButton'
import { HtmlPreviewDrawer } from './_components/HtmlPreviewDrawer'
import {
  getContractContainerAction,
  getContractDocumentAction,
  resendContractAction,
  voidContractAction,
} from '../../_actions/contracts'
import { DataTable } from '../../_components/DataTable'
import { ErrorNotice } from '../../_components/ErrorNotice'
import { secondaryButtonClass } from '../../_components/FormField'
import { PageHeader } from '../../_components/PageHeader'
import { requireAdminRepositories } from '../../_lib/admin'
import { ContractStatusPill, formatDateTime } from '../../_lib/labels'
import { can } from '../../_lib/permissions'

import type { UserDoc } from '@/lib/data/repositories'
import type { ContractStatus } from '@/lib/data/schema'

const STUCK_SENT_MS = 7 * 24 * 60 * 60 * 1000
const RESEND_THROTTLE_MS = 60 * 60 * 1000

interface ContractRow {
  id: string
  status: string
  createdAt: string
  auctionTitle: string
  sellerName: string
  sellerId: string | null
  buyerName: string
  buyerId: string | null
  hasDocument: boolean
  stuck: boolean
  resendCount: number
  lastResendAt: string | null
}

const reasonInputClass =
  'w-full rounded-input border border-border bg-bgPage px-3 py-2 text-bodySm text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none'

export const metadata = { title: 'Lepingud' }

export default async function AdminContractsPage({
  searchParams,
}: {
  searchParams: Promise<{ viga?: string; teade?: string }>
}) {
  const { viga, teade } = await searchParams
  const { session, repositories } = await requireAdminRepositories()
  if (!can(session.role, 'contracts:read')) {
    return (
      <div>
        <PageHeader title="Lepingud" />
        <div className="rounded-input border border-danger bg-danger-light px-md py-sm text-bodySm text-danger">
          Lepinguid saab vaata ainult administraator.
        </div>
      </div>
    )
  }
  const isSuperadmin = session.role === 'superadmin'

  const { docs: contracts } = await repositories.find({
    collection: 'contracts',
    sort: '-createdAt',
    limit: 50,
  })

  const contractIds = contracts.map((contract) => contract.id)
  const resendEntries =
    contractIds.length > 0
      ? (
          await repositories.find({
            collection: 'audit-entry',
            where: {
              and: [
                { action: { equals: 'contract.resend' } },
                { entityId: { in: contractIds } },
              ],
            },
            sort: '-createdAt',
            pagination: false,
            limit: 500,
          })
        ).docs
      : []
  const resendsByContract = new Map<string, { count: number; lastAt: string | null }>()
  for (const entry of resendEntries) {
    const contractId = entry.entityId
    if (!contractId) continue
    const current = resendsByContract.get(contractId) ?? { count: 0, lastAt: null }
    current.count += 1
    current.lastAt ??= entry.createdAt
    resendsByContract.set(contractId, current)
  }

  const lotIds = [...new Set(contracts.map((contract) => contract.lotId))]
  const auctions =
    lotIds.length > 0
      ? (
          await repositories.find({
            collection: 'auctions',
            where: { id: { in: lotIds } },
            pagination: false,
          })
        ).docs
      : []
  const auctionById = new Map(auctions.map((auction) => [auction.id, auction]))

  const winningBidIds = [
    ...new Set(auctions.map((auction) => auction.winningBid).filter((id): id is string => !!id)),
  ]
  const winningBids =
    winningBidIds.length > 0
      ? (
          await repositories.find({
            collection: 'bids',
            where: { id: { in: winningBidIds } },
            pagination: false,
          })
        ).docs
      : []
  const bidById = new Map(winningBids.map((bid) => [bid.id, bid]))

  const partyIds = [
    ...new Set(
      [
        ...auctions.map((auction) => auction.sellerId),
        ...winningBids.map((bid) => bid.userId),
      ].filter((id): id is string => !!id),
    ),
  ]
  const parties: UserDoc[] =
    partyIds.length > 0
      ? (
          await repositories.find({
            collection: 'users',
            where: { id: { in: partyIds } },
            pagination: false,
          })
        ).docs
      : []
  const userLabel = new Map(parties.map((party) => [party.id, party.name ?? party.email]))

  const now = Date.now()
  const rows: ContractRow[] = contracts.map((contract) => {
    const auction = auctionById.get(contract.lotId)
    const winningBid = auction?.winningBid ? bidById.get(auction.winningBid) : undefined
    const resends = resendsByContract.get(contract.id)
    const lastResendAt = resends?.lastAt ?? null
    const sentForMs =
      contract.status === 'sent' ? now - Date.parse(contract.updatedAt) : Number.NaN
    return {
      id: contract.id,
      status: contract.status,
      createdAt: contract.createdAt,
      auctionTitle: auction?.title ?? contract.lotId,
      sellerName: auction?.sellerId ? (userLabel.get(auction.sellerId) ?? auction.sellerId) : '—',
      sellerId: auction?.sellerId ?? null,
      buyerName: winningBid ? (userLabel.get(winningBid.userId) ?? winningBid.userId) : '—',
      buyerId: winningBid?.userId ?? null,
      hasDocument: typeof contract.renderedHtml === 'string' && contract.renderedHtml !== '',
      stuck:
        contract.status === 'sent' &&
        Number.isFinite(sentForMs) &&
        sentForMs > STUCK_SENT_MS,
      resendCount: resends?.count ?? 0,
      lastResendAt,
    }
  })

  const voidForm = (row: ContractRow): React.ReactElement => (
    <details className="mt-xs">
      <summary className="cursor-pointer text-label font-semibold text-danger">
        Tühista ⚠
      </summary>
      <form action={voidContractAction} className="mt-xs flex w-64 flex-col gap-xs">
        <input type="hidden" name="id" value={row.id} />
        <textarea
          name="reason"
          required
          minLength={5}
          rows={2}
          placeholder="Tühistamise põhjus (kohustuslik)"
          className={reasonInputClass}
        />
        <select
          name="outcome"
          defaultValue="contract"
          className="rounded-input border border-border bg-bgPage px-3 py-2 text-bodySm text-ink"
        >
          <option value="contract">Tühista ainult leping</option>
          {isSuperadmin ? (
            <option value="contract-and-result">Tühista leping ja oksjoni tulemus</option>
          ) : null}
        </select>
        <button
          type="submit"
          className="inline-flex h-8 items-center justify-center rounded-button border border-danger bg-bgPage px-3 text-label font-semibold text-danger transition-colors duration-hover ease-hover hover:bg-danger-light"
        >
          Kinnita tühistamine
        </button>
      </form>
    </details>
  )

  return (
    <div>
      {viga ? <ErrorNotice message={viga} /> : null}
      {teade ? (
        <div className="mb-sm rounded-input border border-primaryLight bg-primaryLight px-md py-sm text-bodySm text-primaryDark">
          {teade}
        </div>
      ) : null}
      <PageHeader
        title="Lepingud"
        description="Sõlmitavad ja sõlmitud müügilepingud koos pooltega."
        actions={
          <Link href="/admin/contracts/templates" className={secondaryButtonClass}>
            Lepingu mallid
          </Link>
        }
      />
      <DataTable
        columns={[
          { key: 'auctionTitle', label: 'Oksjon' },
          {
            key: 'sellerName',
            label: 'Müüja',
            render: (row) =>
              row.sellerId ? (
                <Link
                  href={`/admin/users/${row.sellerId}`}
                  className="text-primary transition-colors duration-hover ease-hover hover:text-primaryHover"
                >
                  {row.sellerName}
                </Link>
              ) : (
                row.sellerName
              ),
          },
          {
            key: 'buyerName',
            label: 'Ostja',
            render: (row) =>
              row.buyerId ? (
                <Link
                  href={`/admin/users/${row.buyerId}`}
                  className="text-primary transition-colors duration-hover ease-hover hover:text-primaryHover"
                >
                  {row.buyerName}
                </Link>
              ) : (
                row.buyerName
              ),
          },
          {
            key: 'status',
            label: 'Olek',
            render: (row) => (
              <span className="inline-flex flex-col items-start gap-1">
                <ContractStatusPill status={row.status as ContractStatus} />
                {row.stuck ? (
                  <span className="inline-flex items-center rounded-pill bg-amber-100 px-2 py-0.5 text-label font-semibold text-amber-800">
                    ⏳ peatunud &gt;7 pd — saada uuesti
                  </span>
                ) : null}
              </span>
            ),
          },
          {
            key: 'createdAt',
            label: 'Loodud',
            render: (row) => formatDateTime(row.createdAt),
          },
          {
            key: 'actions',
            label: 'Tegevused',
            render: (row) => (
              <div className="flex flex-col items-start gap-xs">
                <Link
                  href={`/admin/contracts/${row.id}`}
                  className="text-label font-semibold text-primary transition-colors duration-hover ease-hover hover:text-primaryHover"
                >
                  Vaata
                </Link>
                {row.hasDocument ? (
                  <>
                    <HtmlPreviewDrawer
                      label="Vaata dokumenti"
                      drawerTitle="Lepingu dokument"
                      documentId={row.id}
                      fetchDocument={getContractDocumentAction}
                    />
                    <ContainerDownloadButton
                      label="Laadi allkirjakonteiner ↓"
                      contractId={row.id}
                      fetchContainer={getContractContainerAction}
                    />
                  </>
                ) : null}
                {row.status === 'sent' ? (
                  row.lastResendAt &&
                  now - Date.parse(row.lastResendAt) < RESEND_THROTTLE_MS ? (
                    <span
                      className="text-label text-ink-muted"
                      title={`Saada uuesti saab ainult üks kord tunnis (viimati ${formatDateTime(row.lastResendAt)}).`}
                    >
                      Saada uuesti (ootel)
                    </span>
                  ) : (
                    <form action={resendContractAction}>
                      <input type="hidden" name="id" value={row.id} />
                      <button
                        type="submit"
                        className="text-label font-semibold text-primary transition-colors duration-hover ease-hover hover:text-primaryHover"
                      >
                        Saada uuesti{row.resendCount > 0 ? ` (${String(row.resendCount)})` : ''}
                      </button>
                    </form>
                  )
                ) : null}
                {row.status === 'prepared' || row.status === 'sent' ? voidForm(row) : null}
              </div>
            ),
          },
        ]}
        rows={rows}
        emptyLabel="Lepinguid ei ole."
      />
    </div>
  )
}
