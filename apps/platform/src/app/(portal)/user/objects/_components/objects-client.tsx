'use client'

import { ChipNav, DataTable, Btn, type Column } from '@erametsad/ui'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type ReactNode } from 'react'

import { ApiError, requestJson } from './api'
import { DraftPreviewModal } from './draft-preview-modal'
import { formatEur, statusLabel, TYPE_LABELS } from './format'
import { LeadModal } from './lead-modal'
import { LotDrawer } from './lot-drawer'
import type {
  PendingBannerGroup,
  SellerAuctionRow,
  StatusTab,
  StatusTabCounts,
} from './seller-data'

const PAGE_SIZE = 10

const TAB_ITEMS: readonly { id: StatusTab; label: string }[] = [
  { id: 'all', label: 'Kõik' },
  { id: 'draft', label: 'Mustand' },
  { id: 'scheduled', label: 'Plaanis' },
  { id: 'active', label: 'Aktiivsed' },
  { id: 'ended', label: 'Lõppenud' },
]

interface Feedback {
  message: string
  kind: 'success' | 'error'
}

function TextButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="h-8 px-2 text-label font-semibold text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-40 disabled:no-underline"
    >
      {children}
    </button>
  )
}

interface ObjectsClientProps {
  status: StatusTab
  rows: SellerAuctionRow[]
  counts: StatusTabCounts
  pendingGroups: PendingBannerGroup[]
  profileName: string | null
}

export function ObjectsClient({
  status,
  rows,
  counts,
  pendingGroups,
  profileName,
}: ObjectsClientProps) {
  const router = useRouter()
  const [page, setPage] = useState(1)
  const [drawerAuctionId, setDrawerAuctionId] = useState<string | null>(null)
  const [previewAuctionId, setPreviewAuctionId] = useState<string | null>(null)
  const [leadOpen, setLeadOpen] = useState(false)
  const [reviewDone, setReviewDone] = useState<ReadonlySet<string>>(() => new Set())
  const [relistDone, setRelistDone] = useState<ReadonlySet<string>>(() => new Set())
  const [rowBusy, setRowBusy] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<Record<string, Feedback>>({})

  function changeTab(tab: string) {
    setPage(1)
    router.push(`/user/objects?status=${tab}`, { scroll: false })
  }

  function markDone(
    setter: React.Dispatch<React.SetStateAction<ReadonlySet<string>>>,
    id: string,
  ) {
    setter((previous) => new Set(previous).add(id))
  }

  function setFeedbackFor(id: string, message: string, kind: Feedback['kind']) {
    setFeedback((previous) => ({ ...previous, [id]: { message, kind } }))
  }

  async function sendRequestReview(row: SellerAuctionRow) {
    if (rowBusy !== null) return
    setRowBusy(row.id)
    try {
      await requestJson(`/api/v1/my-auctions/${row.id}/request-review`, {
        method: 'POST',
        body: JSON.stringify({}),
      })
      markDone(setReviewDone, row.id)
      setFeedbackFor(row.id, 'Mustand on saadetud spetsialistile.', 'success')
      router.refresh()
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && err.message.includes('menetluses')) {
        markDone(setReviewDone, row.id)
        setFeedbackFor(row.id, 'Taotlus on juba menetluses.', 'success')
      } else {
        setFeedbackFor(
          row.id,
          err instanceof ApiError ? err.message : 'Taotluse saatmine ebaõnnestus.',
          'error',
        )
      }
    } finally {
      setRowBusy(null)
    }
  }

  async function sendRelistRequest(row: SellerAuctionRow) {
    if (rowBusy !== null) return
    setRowBusy(row.id)
    try {
      await requestJson(`/api/v1/my-auctions/${row.id}/relist-request`, {
        method: 'POST',
        body: JSON.stringify({}),
      })
      markDone(setRelistDone, row.id)
      setFeedbackFor(row.id, 'Taotlus uueks oksjoniks on esitatud.', 'success')
      router.refresh()
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && err.message.includes('menetluses')) {
        markDone(setRelistDone, row.id)
        setFeedbackFor(row.id, 'Taotlus on juba menetluses.', 'success')
      } else {
        setFeedbackFor(
          row.id,
          err instanceof ApiError ? err.message : 'Taotluse saatmine ebaõnnestus.',
          'error',
        )
      }
    } finally {
      setRowBusy(null)
    }
  }

  function renderFeedback(id: string): ReactNode {
    const entry = feedback[id]
    if (entry === undefined) return undefined
    return (
      <span
        className={`text-label ${
          entry.kind === 'error' ? 'text-danger' : 'text-statusActive'
        }`}
      >
        {entry.message}
      </span>
    )
  }

  function renderActions(row: SellerAuctionRow): ReactNode {
    if (row.status === 'draft') {
      const sent = reviewDone.has(row.id)
      return (
        <div className="flex flex-col gap-0.5">
          <div className="flex">
            <TextButton
              onClick={() => {
                setPreviewAuctionId(row.id)
              }}
            >
              Eelvaade
            </TextButton>
            <TextButton
              disabled={sent || rowBusy === row.id}
              onClick={() => {
                void sendRequestReview(row)
              }}
            >
              Saada spetsialistile
            </TextButton>
          </div>
          {renderFeedback(row.id)}
        </div>
      )
    }
    if (row.status === 'unsold') {
      const sent = relistDone.has(row.id)
      return (
        <div className="flex flex-col gap-0.5">
          <div className="flex">
            <TextButton
              disabled={sent || rowBusy === row.id}
              onClick={() => {
                void sendRelistRequest(row)
              }}
            >
              Taotle uut oksjonit
            </TextButton>
          </div>
          {renderFeedback(row.id)}
        </div>
      )
    }
    return <span className="text-inkMuted">—</span>
  }

  function renderLeadingPrice(row: SellerAuctionRow): ReactNode {
    if (row.leadingPrice !== null) return formatEur(row.leadingPrice)
    if (row.type === 'sealed' && (row.status === 'scheduled' || row.status === 'active')) {
      return `${formatEur(row.startPrice)} (algushind)`
    }
    if (row.finalPrice !== null) return formatEur(row.finalPrice)
    return '—'
  }

  const columns: Column<SellerAuctionRow>[] = [
    {
      key: 'title',
      label: 'Objekt',
      sortable: false,
      width: '28%',
      render: (row) =>
        row.status === 'draft' ? (
          <span className="font-semibold text-ink">{row.title}</span>
        ) : (
          <Link
            href={`/oksjon/${row.id}`}
            className="font-semibold text-primary hover:underline"
          >
            {row.title}
          </Link>
        ),
    },
    {
      key: 'type',
      label: 'Tüüp',
      sortable: false,
      render: (row) => (
        <span className="text-label font-semibold text-inkMuted">
          {TYPE_LABELS[row.type] ?? row.type}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Olek',
      sortable: false,
      render: (row) => statusLabel(row.status),
    },
    {
      key: 'startPrice',
      label: 'Algushind',
      sortable: false,
      render: (row) => formatEur(row.startPrice),
    },
    {
      key: 'leadingPrice',
      label: 'Juhtiv hind',
      sortable: false,
      render: renderLeadingPrice,
    },
    {
      key: 'bidCount',
      label: 'Pakkumisi',
      sortable: false,
      render: (row) => (
        <button
          type="button"
          onClick={() => {
            setDrawerAuctionId(row.id)
          }}
          title="Vaata pakkumisi"
          className="inline-flex items-center gap-1.5 rounded-button px-2 py-1 text-label font-semibold text-primary hover:bg-primaryLight"
        >
          {String(row.bidCount)}
          {row.pendingApprovalCount > 0 && (
            <span className="rounded-pill bg-cta px-1.5 py-0.5 text-label font-bold text-ink">
              {row.pendingApprovalCount} ootel
            </span>
          )}
        </button>
      ),
    },
    {
      key: 'views',
      label: 'Vaatamisi',
      sortable: false,
      render: () => '—',
    },
    {
      key: 'actions',
      label: 'Tegevused',
      sortable: false,
      render: renderActions,
    },
  ]

  const totalPages = Math.max(Math.ceil(rows.length / PAGE_SIZE), 1)
  const currentPage = Math.min(page, totalPages)
  const pagedRows = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const drawerRow = rows.find((row) => row.id === drawerAuctionId) ?? null
  const previewRow = rows.find((row) => row.id === previewAuctionId) ?? null

  return (
    <div className="flex flex-col gap-md">
      <div className="flex flex-wrap items-center justify-between gap-sm">
        <h1 className="text-h3 font-bold text-ink">Minu müügid</h1>
        <Btn
          variant="cta"
          onClick={() => {
            setLeadOpen(true)
          }}
        >
          + Müüa metsa
        </Btn>
      </div>

      {pendingGroups.length > 0 && (
        <div
          role="status"
          className="rounded-card border border-cta bg-cta/10 px-md py-sm"
        >
          {pendingGroups.map((group) => (
            <div
              key={group.auctionId}
              className="flex flex-wrap items-center justify-between gap-xs py-2xs"
            >
              <p className="text-bodySm text-ink">
                Oksjonil „{group.title}” on{' '}
                <strong>
                  {group.count} {group.count === 1 ? 'alapakkumine' : 'alapakkumist'}
                </strong>{' '}
                kinnitamise ootel.
              </p>
              <Btn
                size="sm"
                variant="outline"
                onClick={() => {
                  setDrawerAuctionId(group.auctionId)
                }}
              >
                Vaata pakkumisi
              </Btn>
            </div>
          ))}
        </div>
      )}

      <ChipNav
        items={TAB_ITEMS.map((tab) => ({ ...tab, count: counts[tab.id] }))}
        activeId={status}
        onChange={changeTab}
      />

      <div className="rounded-card border border-border bg-bgPage p-sm">
        <DataTable
          columns={columns}
          data={pagedRows}
          sortable={false}
          page={currentPage}
          totalPages={totalPages}
          onPageChange={setPage}
          emptyState="Müügid puuduvad."
        />
      </div>

      {drawerRow !== null && (
        <LotDrawer
          key={drawerRow.id}
          row={drawerRow}
          onClose={() => {
            setDrawerAuctionId(null)
          }}
        />
      )}
      <DraftPreviewModal
        row={previewRow}
        onClose={() => {
          setPreviewAuctionId(null)
        }}
      />
      <LeadModal
        isOpen={leadOpen}
        onClose={() => {
          setLeadOpen(false)
        }}
        profileName={profileName}
      />
    </div>
  )
}
