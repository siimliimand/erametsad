
import { ContainerDownloadButton } from './_components/ContainerDownloadButton'
import { HtmlPreviewDrawer } from './_components/HtmlPreviewDrawer'
import { VoidContractDialog } from './_components/VoidContractDialog'
import {
  classifyContractSearch,
  CONTRACTS_FETCH_LIMIT,
  CONTRACTS_PAGE_SIZE,
  contractInDateRange,
  contractNumber,
  matchesContractSearch,
  paginateRows,
  parseContractListFilters,
  transactionRefLabel,
} from './_components/contract-search'
import {
  getContractContainerAction,
  getContractDocumentAction,
  resendContractAction,
} from '../../_actions/contracts'
import { AdminLink } from '../../_components/AdminLink'
import { DataTable } from '../../_components/DataTable'
import { ErrorNotice } from '../../_components/ErrorNotice'
import {
  FormField,
  FormSelectField,
  primaryButtonClass,
  secondaryButtonClass,
} from '../../_components/FormField'
import { PageHeader } from '../../_components/PageHeader'
import { StatusChip } from '../../_components/StatusChip'
import { requireAdminRepositories } from '../../_lib/admin'
import {
  contractStatusLabels,
  contractTemplateTypeLabels,
  formatDateTime,
} from '../../_lib/labels'
import { can } from '../../_lib/permissions'
import { chunkIds } from '../users/_components/user-search'

import { contractStatuses, contractTemplateTypes } from '@/lib/data/schema'
import type { ContractStatus, ContractTemplateType } from '@/lib/data/schema'

const STUCK_SENT_MS = 7 * 24 * 60 * 60 * 1000
const RESEND_THROTTLE_MS = 60 * 60 * 1000

interface ContractRow {
  id: string
  status: string
  createdAt: string
  signedAt: string | null
  type: ContractTemplateType
  templateLabel: string
  auctionTitle: string
  auctionStatus: string
  sellerName: string
  sellerId: string | null
  buyerName: string
  buyerId: string | null
  signerUserId: string | null
  transactionRef: string | null
  hasDocument: boolean
  stuck: boolean
  resendCount: number
  lastResendAt: string | null
}

const SEARCH_HINT = 'Otsi: osapool / oksjon / lepingu nr / tehingu viide'

type RawParams = Record<string, string | string[] | undefined>

function firstParam(params: RawParams, key: string): string {
  const value = params[key]
  const first = Array.isArray(value) ? value[0] : value
  return first ?? ''
}

export const metadata = { title: 'Lepingud' }

export default async function AdminContractsPage({
  searchParams,
}: {
  searchParams: Promise<RawParams>
}) {
  const params = await searchParams
  const viga = firstParam(params, 'viga')
  const teade = firstParam(params, 'teade')
  const q = firstParam(params, 'q').trim()
  const pageParam = firstParam(params, 'page')
  const filters = parseContractListFilters({
    type: firstParam(params, 'type'),
    status: firstParam(params, 'status'),
    from: firstParam(params, 'from'),
    to: firstParam(params, 'to'),
  })
  const query = classifyContractSearch(q)

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

  // Status translates into the repository where clause; the type filter
  // needs the template join anyway, and the date range plus freetext have
  // no repository operators yet, so all three run in JS over one bounded
  // fetch (users/auctions list pattern).
  const [{ docs: contracts }, { docs: templates }] = await Promise.all([
    repositories.find({
      collection: 'contracts',
      ...(filters.status
        ? { where: { status: { equals: filters.status } } }
        : {}),
      sort: '-createdAt',
      pagination: false,
      limit: CONTRACTS_FETCH_LIMIT,
    }),
    repositories.find({
      collection: 'contract-templates',
      sort: '-createdAt',
      pagination: false,
      limit: 500,
    }),
  ])
  const templateById = new Map(templates.map((template) => [template.id, template]))

  // Enrichment for filtering (titles, party names) runs on every fetched
  // contract; D1 caps bound parameters at 100, so id lists go in chunks.
  // Framework contracts have no lot; only auction contracts join to auctions.
  const lotIds = [
    ...new Set(
      contracts.flatMap((contract) => (contract.lotId === null ? [] : [contract.lotId])),
    ),
  ]
  const auctions = (
    await Promise.all(
      chunkIds(lotIds).map((chunk) =>
        repositories.find({
          collection: 'auctions',
          where: { id: { in: chunk } },
          pagination: false,
        }),
      ),
    )
  ).flatMap((result) => result.docs)
  const auctionById = new Map(auctions.map((auction) => [auction.id, auction]))

  const winningBidIds = [
    ...new Set(auctions.map((auction) => auction.winningBid).filter((id): id is string => !!id)),
  ]
  const winningBids = (
    await Promise.all(
      chunkIds(winningBidIds).map((chunk) =>
        repositories.find({
          collection: 'bids',
          where: { id: { in: chunk } },
          pagination: false,
        }),
      ),
    )
  ).flatMap((result) => result.docs)
  const bidById = new Map(winningBids.map((bid) => [bid.id, bid]))

  const partyIds = [
    ...new Set(
      [
        ...auctions.map((auction) => auction.sellerId),
        ...winningBids.map((bid) => bid.userId),
        ...contracts.map((contract) => contract.signedBy),
      ].filter((id): id is string => !!id),
    ),
  ]
  const parties = (
    await Promise.all(
      chunkIds(partyIds).map((chunk) =>
        repositories.find({
          collection: 'users',
          where: { id: { in: chunk } },
          pagination: false,
        }),
      ),
    )
  ).flatMap((result) => result.docs)
  const userLabel = new Map(parties.map((party) => [party.id, party.name ?? party.email]))

  const filteredContracts = contracts.filter((contract) => {
    const template = templateById.get(contract.templateId)
    if (filters.type && template?.type !== filters.type) return false
    if (!contractInDateRange(contract.createdAt, filters)) return false
    const auction =
      contract.lotId !== null ? auctionById.get(contract.lotId) : undefined
    const winningBid = auction?.winningBid ? bidById.get(auction.winningBid) : undefined
    return matchesContractSearch(
      {
        id: contract.id,
        contentHash: contract.contentHash,
        auctionTitle: auction?.title ?? contract.lotId ?? '',
        sellerName: auction?.sellerId
          ? (userLabel.get(auction.sellerId) ?? auction.sellerId)
          : '',
        buyerName: winningBid ? (userLabel.get(winningBid.userId) ?? winningBid.userId) : '',
      },
      query,
    )
  })

  const { pageRows, safePage, pageCount, totalCount } = paginateRows(
    filteredContracts,
    pageParam,
  )

  // Resend state stays a page-slice concern, like the other enrichment.
  const pageContractIds = pageRows.map((contract) => contract.id)
  const resendEntries =
    pageContractIds.length > 0
      ? (
          await repositories.find({
            collection: 'audit-entry',
            where: {
              and: [
                { action: { equals: 'contract.resend' } },
                { entityId: { in: pageContractIds } },
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

  const now = Date.now()
  const rows: ContractRow[] = pageRows.map((contract) => {
    const template = templateById.get(contract.templateId)
    const auction =
      contract.lotId !== null ? auctionById.get(contract.lotId) : undefined
    const winningBid = auction?.winningBid ? bidById.get(auction.winningBid) : undefined
    const resends = resendsByContract.get(contract.id)
    const lastResendAt = resends?.lastAt ?? null
    const sentForMs =
      contract.status === 'sent' ? now - Date.parse(contract.updatedAt) : Number.NaN
    return {
      id: contract.id,
      status: contract.status,
      createdAt: contract.createdAt,
      signedAt: contract.signedAt,
      type: template?.type ?? 'auction',
      templateLabel: template ? `${template.name} (v${template.version})` : contract.templateId,
      auctionTitle: auction?.title ?? contract.lotId ?? '—',
      auctionStatus: auction?.status ?? '',
      sellerName: auction?.sellerId ? (userLabel.get(auction.sellerId) ?? auction.sellerId) : '—',
      sellerId: auction?.sellerId ?? null,
      buyerName: winningBid ? (userLabel.get(winningBid.userId) ?? winningBid.userId) : '—',
      buyerId: winningBid?.userId ?? null,
      signerUserId: contract.signedBy ?? null,
      transactionRef: contract.contentHash,
      hasDocument: typeof contract.renderedHtml === 'string' && contract.renderedHtml !== '',
      stuck:
        contract.status === 'sent' &&
        Number.isFinite(sentForMs) &&
        sentForMs > STUCK_SENT_MS,
      resendCount: resends?.count ?? 0,
      lastResendAt,
    }
  })

  const fromParam = firstParam(params, 'from')
  const toParam = firstParam(params, 'to')
  const currentValues = {
    q: q || undefined,
    type: filters.type ?? undefined,
    status: filters.status ?? undefined,
    from: fromParam,
    to: toParam,
    page: safePage > 1 ? String(safePage) : undefined,
  }

  function buildUrl(overrides: Record<string, string | undefined>): string {
    const search = new URLSearchParams()
    for (const [key, value] of Object.entries({ ...currentValues, ...overrides })) {
      if (value) search.set(key, value)
    }
    const queryString = search.toString()
    return queryString === '' ? '/admin/contracts' : `/admin/contracts?${queryString}`
  }

  const hasActiveFilters =
    q !== '' ||
    filters.type !== null ||
    filters.status !== null ||
    fromParam !== '' ||
    toParam !== ''

  const voidDialog = (row: ContractRow): React.ReactElement => (
    <VoidContractDialog
      contractId={row.id}
      contractLabel={`Nr ${contractNumber(row.id)}`}
      auctionTitle={row.auctionTitle}
      isFramework={row.type === 'framework'}
      auctionRevertEligible={row.auctionStatus === 'contract'}
      isSuperadmin={isSuperadmin}
      signerUserId={row.signerUserId}
    />
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
          <AdminLink href="/contracts/templates" className={secondaryButtonClass}>
            Lepingu mallid
          </AdminLink>
        }
      />

      <form
        method="get"
        action="/admin/contracts"
        aria-label="Filtrid"
        className="mb-md flex max-w-container-sm flex-wrap items-end gap-sm rounded-card border border-border bg-bgPage p-md"
      >
        <div className="w-full max-w-80">
          <FormField
            label="Otsing"
            name="q"
            type="search"
            defaultValue={q}
            hint={SEARCH_HINT}
          />
        </div>
        <div className="w-40">
          <FormSelectField
            label="Tüüp"
            name="type"
            defaultValue={filters.type ?? ''}
            options={[
              { value: '', label: 'Kõik' },
              ...contractTemplateTypes.map((type) => ({
                value: type,
                label: contractTemplateTypeLabels[type],
              })),
            ]}
          />
        </div>
        <div className="w-36">
          <FormSelectField
            label="Olek"
            name="status"
            defaultValue={filters.status ?? ''}
            options={[
              { value: '', label: 'Kõik' },
              ...contractStatuses.map((status) => ({
                value: status,
                label: contractStatusLabels[status],
              })),
            ]}
          />
        </div>
        <div className="w-40">
          <FormField
            label="Loodud alates"
            name="from"
            type="date"
            defaultValue={fromParam}
          />
        </div>
        <div className="w-40">
          <FormField
            label="Loodud kuni"
            name="to"
            type="date"
            defaultValue={toParam}
          />
        </div>
        <button type="submit" className={primaryButtonClass}>
          Otsi
        </button>
        {hasActiveFilters ? (
          <AdminLink href="/contracts" className={secondaryButtonClass}>
            Tühjenda
          </AdminLink>
        ) : null}
      </form>

      <DataTable
        columns={[
          {
            key: 'nr',
            label: 'Nr',
            render: (row) => (
              <AdminLink
                href={`/contracts/${row.id}`}
                title={row.id}
                className="font-mono text-primary transition-colors duration-hover ease-hover hover:text-primaryHover"
              >
                {contractNumber(row.id)}
              </AdminLink>
            ),
          },
          {
            key: 'type',
            label: 'Tüüp',
            render: (row) => contractTemplateTypeLabels[row.type],
          },
          { key: 'auctionTitle', label: 'Oksjon' },
          {
            key: 'sellerName',
            label: 'Müüja',
            render: (row) =>
              row.sellerId ? (
                <AdminLink
                  href={`/users/${row.sellerId}`}
                  className="text-primary transition-colors duration-hover ease-hover hover:text-primaryHover"
                >
                  {row.sellerName}
                </AdminLink>
              ) : (
                row.sellerName
              ),
          },
          {
            key: 'buyerName',
            label: 'Ostja',
            render: (row) =>
              row.buyerId ? (
                <AdminLink
                  href={`/users/${row.buyerId}`}
                  className="text-primary transition-colors duration-hover ease-hover hover:text-primaryHover"
                >
                  {row.buyerName}
                </AdminLink>
              ) : (
                row.buyerName
              ),
          },
          { key: 'templateLabel', label: 'Mall' },
          {
            key: 'status',
            label: 'Olek',
            render: (row) => (
              <span className="inline-flex flex-col items-start gap-1">
                <StatusChip status={`contract:${row.status as ContractStatus}`} />
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
            key: 'signedAt',
            label: 'Allkirjastatud',
            render: (row) => formatDateTime(row.signedAt),
          },
          {
            key: 'transactionRef',
            label: 'Pakkuja tehingu viide',
            render: (row) =>
              row.transactionRef ? (
                <span
                  className="font-mono"
                  title={row.transactionRef}
                >
                  {transactionRefLabel(row.transactionRef)}
                </span>
              ) : (
                '—'
              ),
          },
          {
            key: 'actions',
            label: 'Tegevused',
            render: (row) => (
              <div className="flex flex-col items-start gap-xs">
                <AdminLink
                  href={`/contracts/${row.id}`}
                  className="text-label font-semibold text-primary transition-colors duration-hover ease-hover hover:text-primaryHover"
                >
                  Vaata
                </AdminLink>
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
                {row.status === 'prepared' || row.status === 'sent' ? voidDialog(row) : null}
              </div>
            ),
          },
        ]}
        rows={rows}
        emptyLabel={
          hasActiveFilters
            ? 'Lepingut ei leitud — kontrolli otsingusõna või filtreid.'
            : 'Lepinguid ei ole.'
        }
      />

      <div className="mt-sm flex items-center justify-between text-label text-ink-muted">
        <span>
          {totalCount === 0
            ? '0 lepingut'
            : `${String((safePage - 1) * CONTRACTS_PAGE_SIZE + 1)}–${String(Math.min(safePage * CONTRACTS_PAGE_SIZE, totalCount))} / ${String(totalCount)}`}
        </span>
        <span className="flex items-center gap-sm">
          {safePage > 1 ? (
            <AdminLink
              href={buildUrl({ page: String(safePage - 1) })}
              className="font-semibold text-primary transition-colors duration-hover ease-hover hover:text-primaryHover"
            >
              ‹ Eelmine
            </AdminLink>
          ) : null}
          <span>
            Leht {String(safePage)} / {String(pageCount)}
          </span>
          {safePage < pageCount ? (
            <AdminLink
              href={buildUrl({ page: String(safePage + 1) })}
              className="font-semibold text-primary transition-colors duration-hover ease-hover hover:text-primaryHover"
            >
              Järgmine ›
            </AdminLink>
          ) : null}
        </span>
      </div>
    </div>
  )
}
