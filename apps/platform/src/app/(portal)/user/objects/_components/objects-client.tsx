'use client'

import { Btn } from '@erametsad/ui'
import { FilterX, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, type ReactNode } from 'react'


import { ApiError, requestJson } from './api'
import { DraftPreviewModal } from './draft-preview-modal'
import { LotDrawer } from './lot-drawer'
import { ObjectCard } from './object-card'
import type { PendingBannerGroup, SellerAuctionRow, StatusTab } from './seller-data'

// Demo chips (10-user-objects.html): Kõik / Käimasolevad / Lõppenud /
// Mustandid. 'ongoing' is the composite pre-end filter (design D9).
const OBJECT_CHIPS: readonly { id: Exclude<StatusTab, 'scheduled' | 'active'>; label: string }[] = [
  { id: 'all', label: 'Kõik' },
  { id: 'ongoing', label: 'Käimasolevad' },
  { id: 'ended', label: 'Lõppenud' },
  { id: 'draft', label: 'Mustandid' },
]

function chipIdForStatus(status: StatusTab): Exclude<StatusTab, 'scheduled' | 'active'> {
  return status === 'scheduled' || status === 'active' ? 'ongoing' : status
}

const SELL_HREF = '/user/objects/paku'

const chipClass = (active: boolean) =>
  `inline-flex flex-none items-center rounded-pill border px-3 py-1 text-[13px] font-semibold transition-colors duration-hover ease-hover motion-reduce:transition-none ${
    active
      ? 'border-primary bg-primary text-inkInverse'
      : 'border-border bg-bgPage text-ink hover:border-primary hover:text-primary'
  }`

interface Feedback {
  message: string
  kind: 'success' | 'error'
}

interface ObjectsClientProps {
  status: StatusTab
  rows: SellerAuctionRow[]
  pendingGroups: PendingBannerGroup[]
}

export function ObjectsClient({ status, rows, pendingGroups }: ObjectsClientProps) {
  const router = useRouter()
  const activeChip = chipIdForStatus(status)
  const [drawerAuctionId, setDrawerAuctionId] = useState<string | null>(null)
  const [previewAuctionId, setPreviewAuctionId] = useState<string | null>(null)
  const [reviewDone, setReviewDone] = useState<ReadonlySet<string>>(() => new Set())
  const [relistDone, setRelistDone] = useState<ReadonlySet<string>>(() => new Set())
  const [rowBusy, setRowBusy] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<Record<string, Feedback>>({})

  function changeChip(chip: Exclude<StatusTab, 'scheduled' | 'active'>) {
    router.push(`/user/objects?status=${chip}`, { scroll: false })
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
        className={`text-label ${entry.kind === 'error' ? 'text-danger' : 'text-statusActive'}`}
      >
        {entry.message}
      </span>
    )
  }

  const drawerRow = rows.find((row) => row.id === drawerAuctionId) ?? null
  const previewRow = rows.find((row) => row.id === previewAuctionId) ?? null

  return (
    <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-5 py-8 md:py-10">
      <div className="flex justify-end">
        <a
          href={SELL_HREF}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-button bg-cta px-4 text-label font-semibold text-ink transition-colors duration-hover ease-hover hover:bg-ctaHover motion-reduce:transition-none"
        >
          <Plus size={16} aria-hidden="true" />
          Paku oma objekti
        </a>
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

      <div
        role="group"
        aria-label="Filtreeri objekte"
        className="flex flex-wrap items-center gap-2.5"
      >
        <span className="text-label font-semibold text-ink">Filtreeri:</span>
        {OBJECT_CHIPS.map((chip) => (
          <button
            key={chip.id}
            type="button"
            aria-pressed={activeChip === chip.id}
            onClick={() => {
              changeChip(chip.id)
            }}
            className={chipClass(activeChip === chip.id)}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2.5 rounded-card bg-primaryLight px-7 py-12 text-center">
          <FilterX size={32} className="text-primary" aria-hidden="true" />
          <h2 className="m-0 font-heading text-[22px] font-bold text-ink">
            Filtritele ei vasta ükski objekt
          </h2>
          <p className="m-0 max-w-[34em] text-bodySm text-inkMuted">
            Muuda filter laiemaks või tühjenda see — kõik sinu objektid on siin loetletud.
          </p>
          <button
            type="button"
            onClick={() => {
              router.push('/user/objects')
            }}
            className="inline-flex h-10 items-center justify-center rounded-button border border-primary bg-transparent px-4 text-label font-semibold text-primary transition-colors duration-hover ease-hover hover:bg-primaryLight motion-reduce:transition-none"
          >
            Tühjenda filtrid
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {rows.map((row) => (
            <ObjectCard
              key={row.id}
              row={row}
              busy={rowBusy === row.id}
              reviewSent={reviewDone.has(row.id)}
              relistSent={relistDone.has(row.id)}
              feedback={renderFeedback(row.id)}
              onOpenBids={setDrawerAuctionId}
              onPreview={setPreviewAuctionId}
              onReview={(target) => {
                void sendRequestReview(target)
              }}
              onRelist={(target) => {
                void sendRelistRequest(target)
              }}
            />
          ))}
        </div>
      )}

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
    </div>
  )
}
