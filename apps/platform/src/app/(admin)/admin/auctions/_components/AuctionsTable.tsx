'use client'

/**
 * Client wrapper for the auctions table (design D1): the server page sends
 * serialized rows plus server action references and this component owns row
 * selection, the fixed bulk bar, the ⌘N shortcut and the Veerud column
 * chooser. Cell strings are precomputed server-side so the client bundle
 * stays lean.
 */

import {
  Download as DownloadIcon,
  Settings2 as Settings2Icon,
} from 'lucide-react'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import type { ComponentType } from 'react'

import { Countdown } from './Countdown'
import { EndAuctionModal } from './EndAuctionModal'
import {
  DataTable,
  type DataTableColumn,
  type DataTableColumnSort,
} from '../../../_components/DataTable'
import { StatusChip } from '../../../_components/StatusChip'
import {
  trapTabKey,
  useDialogFocus,
  useEscapeKey,
} from '../../../_components/ui/useOverlay'
import {
  CalendarClockIcon,
  CopyIcon,
  EllipsisIcon,
  ExternalLinkIcon,
  MapPinHouseIcon,
  PackageIcon,
  PencilIcon,
  TreePineIcon,
  XIcon,
  ZapIcon,
} from '../../../_components/icons'
import {
  auctionObjectTypeLabels,
  auctionStatusLabels,
  auctionTypeLabels,
} from '../../../_lib/labels'
import type { SortKey } from '../_lib/list-view'

import type { AuctionObjectType, AuctionStatus } from '@/lib/data/schema'

export interface AuctionTableRow {
  id: string
  title: string
  objectType: AuctionObjectType
  type: 'open' | 'sealed'
  isQuickAuction: boolean
  status: AuctionStatus
  countyName: string | null
  minBidCents: number
  minBidLabel: string
  endsAt: string | null
  /**
   * Initial cell text for the Lõpp column, precomputed server-side:
   * countdown text for active rows, formatted datetime otherwise, null
   * when endsAt is null. Precomputing keeps SSR and hydration identical.
   */
  endsLabel: string | null
  bidCount: number
  pendingCount: number
  specialistName: string | null
  specialistInitials: string
  portalHref: string
  editHref: string
  canEnd: boolean
  canArchive: boolean
  canRelist: boolean
}

type ServerAction = (formData: FormData) => Promise<void>

export interface AuctionsTableProps {
  rows: readonly AuctionTableRow[]
  sorts: Partial<Record<SortKey, DataTableColumnSort>>
  csvHref: string
  roleCanWrite: boolean
  roleCanExport: boolean
  bulkScheduleAction: ServerAction
  duplicateAction: ServerAction
  endManuallyAction: ServerAction
  archiveAction: ServerAction
  relistAction: ServerAction
}

const typeChipClass: Record<AuctionObjectType, string> = {
  raieoigus: 'bg-[var(--st-active-bg)] text-[color:var(--st-active-text)]',
  kinnistu: 'bg-[var(--st-scheduled-bg)] text-[color:var(--st-scheduled-text)]',
  pakett: 'bg-[var(--st-draft-bg)] text-[color:var(--st-draft-text)]',
  kiire: 'bg-[var(--st-draft-bg)] text-[color:var(--st-draft-text)]',
}

const typeChipIcons: Record<
  AuctionObjectType,
  ComponentType<{ className?: string }>
> = {
  raieoigus: TreePineIcon,
  kinnistu: MapPinHouseIcon,
  pakett: PackageIcon,
  kiire: ZapIcon,
}

const raBtnClass =
  'inline-flex items-center gap-1 rounded-md border border-border bg-bgPage px-2 py-1 text-[11px] font-medium text-inkMuted transition-colors duration-hover ease-hover'
const raBtnActionClass = `${raBtnClass} hover:border-primary hover:bg-bgMist hover:text-primary`
const raBtnDangerClass = `${raBtnClass} hover:border-danger hover:bg-dangerLight hover:text-danger`

const bulkInputClass =
  'h-8 rounded-[8px] border border-white/25 bg-transparent px-2 text-label text-inkInverse [color-scheme:dark]'
const bulkBarBtnClass =
  'inline-flex items-center gap-1.5 rounded-[8px] border border-white/25 px-3 py-1.5 text-label font-semibold transition-colors duration-hover ease-hover hover:bg-white/10'
const bulkCancelBtnClass =
  'inline-flex items-center gap-1 rounded-[8px] px-2 py-1.5 text-label text-white/75 transition-colors duration-hover ease-hover hover:text-white'

// Veerud column chooser: optional columns persist per browser in
// localStorage; fixed columns (selection, id, title, status, actions) always
// render.
const COLUMNS_STORAGE_KEY = 'erametsad.admin.auctions.columns'

const OPTIONAL_COLUMN_KEYS = [
  'objectType',
  'countyName',
  'minBidCents',
  'bidCount',
  'endsAt',
  'specialistName',
] as const

type OptionalColumnKey = (typeof OPTIONAL_COLUMN_KEYS)[number]

const OPTIONAL_COLUMN_LABELS: Record<OptionalColumnKey, string> = {
  objectType: 'Tüüp',
  countyName: 'Maakond',
  minBidCents: 'Alghind',
  bidCount: 'Pakkumisi',
  endsAt: 'Lõpp',
  specialistName: 'Spetsialist',
}

// localStorage is touched only from effects/handlers, so SSR and the first
// client render always see the full default set and hydration stays
// identical.
function readStoredColumns(): ReadonlySet<string> {
  try {
    const raw = window.localStorage.getItem(COLUMNS_STORAGE_KEY)
    if (raw === null) return new Set(OPTIONAL_COLUMN_KEYS)
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Set(OPTIONAL_COLUMN_KEYS)
    return new Set(
      parsed.filter(
        (value): value is OptionalColumnKey =>
          typeof value === 'string' &&
          (OPTIONAL_COLUMN_KEYS as readonly string[]).includes(value),
      ),
    )
  } catch {
    return new Set(OPTIONAL_COLUMN_KEYS)
  }
}

function writeStoredColumns(visible: ReadonlySet<string>): void {
  try {
    const ordered = OPTIONAL_COLUMN_KEYS.filter((key) => visible.has(key))
    window.localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(ordered))
  } catch {
    // Storage can throw in private mode or on quota errors: the column
    // choice then only lives for this page session.
  }
}

/**
 * Info line for the end-manual modal, from row data only: the demo line
 * includes the leading bid, which the serialized row does not carry.
 */
function endContextLabel(row: AuctionTableRow): string {
  if (row.type === 'sealed') {
    return `suletud oksjon — ${String(row.bidCount)} pakkumist, avamine pärast lõppu`
  }
  if (row.status === 'active') {
    return `aktiivne oksjon — ${String(row.bidCount)} pakkumist`
  }
  return `staatus: ${auctionStatusLabels[row.status]}`
}

export function AuctionsTable({
  rows,
  sorts,
  csvHref,
  roleCanWrite,
  roleCanExport,
  bulkScheduleAction,
  duplicateAction,
  endManuallyAction,
  archiveAction,
  relistAction,
}: AuctionsTableProps) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  )
  const [endTarget, setEndTarget] = useState<AuctionTableRow | null>(null)
  const [visibleColumns, setVisibleColumns] = useState<ReadonlySet<string>>(
    () => new Set<string>(OPTIONAL_COLUMN_KEYS),
  )
  const [columnsOpen, setColumnsOpen] = useState(false)
  const columnsPanelRef = useRef<HTMLDivElement>(null)
  const columnsTriggerRef = useRef<HTMLButtonElement>(null)
  const columnsHydratedRef = useRef(false)

  useEscapeKey(columnsOpen, () => {
    setColumnsOpen(false)
  })
  useDialogFocus(columnsOpen, columnsPanelRef)

  // Load the persisted column choice after mount; persisting waits for that
  // load so a stored selection is never clobbered by the default set.
  useEffect(() => {
    setVisibleColumns(readStoredColumns())
    columnsHydratedRef.current = true
  }, [])

  useEffect(() => {
    if (!columnsHydratedRef.current) return
    writeStoredColumns(visibleColumns)
  }, [visibleColumns])

  // Outside pointer press closes the chooser; presses on the trigger are
  // left to the button's own click toggle so one gesture never re-opens it.
  useEffect(() => {
    if (!columnsOpen) return
    const onPointerDown = (event: MouseEvent): void => {
      const target = event.target
      if (
        target instanceof Node &&
        (columnsPanelRef.current?.contains(target) ||
          columnsTriggerRef.current?.contains(target))
      ) {
        return
      }
      setColumnsOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
    }
  }, [columnsOpen])

  // Global ⌘N / Ctrl+N opens the new-auction form, mirroring the header
  // button's kbd hint; write-gated roles never register the listener. Typing
  // in form fields keeps the shortcut inert so draft filter input is never
  // lost to a surprise navigation.
  useEffect(() => {
    if (!roleCanWrite) return
    const isEditableTarget = (event: KeyboardEvent): boolean => {
      const target = event.target
      return (
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      )
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (
        !(event.metaKey || event.ctrlKey) ||
        event.key.toLowerCase() !== 'n' ||
        isEditableTarget(event)
      ) {
        return
      }
      event.preventDefault()
      window.location.href = '/admin/auctions/new'
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [roleCanWrite])

  const toggleRow = (id: string): void => {
    setSelected((previous) => {
      const next = new Set(previous)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const clearSelection = (): void => {
    setSelected(new Set<string>())
  }

  const toggleColumn = (key: OptionalColumnKey): void => {
    setVisibleColumns((previous) => {
      const next = new Set(previous)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const handleBulkSchedule = async (formData: FormData): Promise<void> => {
    await bulkScheduleAction(formData)
    clearSelection()
  }

  const columns: DataTableColumn<AuctionTableRow>[] = [
    ...(roleCanWrite
      ? [
          {
            key: 'select',
            label: 'Vali',
            render: (row: AuctionTableRow) => (
              <input
                type="checkbox"
                checked={selected.has(row.id)}
                onChange={() => {
                  toggleRow(row.id)
                }}
                aria-label={`Vali oksjon ${row.title}`}
                className="h-4 w-4 accent-primary"
              />
            ),
          },
        ]
      : []),
    {
      key: 'id',
      label: 'ID',
      sort: sorts.id,
      render: (row) => (
        <Link
          href={`/admin/auctions/${row.id}`}
          className="font-mono text-bodySm text-primary transition-colors duration-hover ease-hover hover:text-primary/80"
          title={row.id}
        >
          #{row.id.slice(0, 8)}
        </Link>
      ),
    },
    {
      key: 'title',
      label: 'Nimi',
      sort: sorts.title,
      render: (row) => (
        <span className="flex items-center gap-1.5">
          {row.isQuickAuction || row.objectType === 'kiire' ? (
            <>
              <ZapIcon
                aria-hidden="true"
                className="h-3.5 w-3.5 shrink-0 text-cta"
              />
              <span className="sr-only">Kiiroksjon</span>
            </>
          ) : null}
          <Link
            href={`/admin/auctions/${row.id}`}
            className="font-semibold text-primary transition-colors duration-hover ease-hover hover:text-primary/80"
          >
            {row.title}
          </Link>
        </span>
      ),
    },
    {
      key: 'objectType',
      label: OPTIONAL_COLUMN_LABELS.objectType,
      render: (row) => {
        const TypeIcon = typeChipIcons[row.objectType]
        return (
          <span
            title={`${auctionObjectTypeLabels[row.objectType]} — ${auctionTypeLabels[row.type]}`}
            className={`inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-label ${typeChipClass[row.objectType]}`}
          >
            <TypeIcon aria-hidden="true" className="h-3 w-3" />
            <span className="sr-only">
              {auctionObjectTypeLabels[row.objectType]}
            </span>
            <span
              title={auctionTypeLabels[row.type]}
              className="rounded border border-border bg-bgPage px-1 font-mono text-[10px] text-inkMuted"
            >
              {row.type === 'open' ? 'A' : 'S'}
            </span>
          </span>
        )
      },
    },
    {
      key: 'status',
      label: 'Olek',
      render: (row) => <StatusChip status={row.status} />,
    },
    {
      key: 'countyName',
      label: OPTIONAL_COLUMN_LABELS.countyName,
      render: (row) => row.countyName ?? '—',
    },
    {
      key: 'minBidCents',
      label: OPTIONAL_COLUMN_LABELS.minBidCents,
      sort: sorts.minBidCents,
      render: (row) => (
        <span className="text-right tabular-nums">{row.minBidLabel}</span>
      ),
    },
    {
      key: 'bidCount',
      label: OPTIONAL_COLUMN_LABELS.bidCount,
      sort: sorts.bidCount,
      render: (row) => (
        <span className="tabular-nums">
          {String(row.bidCount)}
          {row.pendingCount > 0 ? (
            <span
              className="ml-1 font-medium text-amber-600"
              title="Alapakkumisi ootel"
            >
              ({String(row.pendingCount)}p)
            </span>
          ) : null}
        </span>
      ),
    },
    {
      key: 'endsAt',
      label: OPTIONAL_COLUMN_LABELS.endsAt,
      sort: sorts.endsAt,
      render: (row) => {
        if (!row.endsAt) return '—'
        if (row.status === 'active') {
          return (
            <Countdown endsAt={row.endsAt}>{row.endsLabel ?? ''}</Countdown>
          )
        }
        return row.endsLabel ?? '—'
      },
    },
    {
      key: 'specialistName',
      label: OPTIONAL_COLUMN_LABELS.specialistName,
      render: (row) =>
        row.specialistName ? (
          <>
            <span
              aria-hidden="true"
              title={row.specialistName}
              className="flex h-[26px] w-[26px] items-center justify-center rounded-pill bg-primaryLight font-heading text-[10px] font-semibold text-primary"
            >
              {row.specialistInitials}
            </span>
            <span className="sr-only">{row.specialistName}</span>
          </>
        ) : (
          '—'
        ),
    },
    {
      key: 'actions',
      label: 'Tegevused',
      render: (row) => (
        <span className="row-actions">
          <a
            href={row.portalHref}
            target="_blank"
            rel="noopener"
            title="Vaata portaalis"
            className={raBtnActionClass}
          >
            <ExternalLinkIcon aria-hidden="true" className="h-3 w-3" />
            Vaata
          </a>
          {roleCanWrite ? (
            <Link
              href={row.editHref}
              title="Muuda oksjonit"
              className={raBtnActionClass}
            >
              <PencilIcon aria-hidden="true" className="h-3 w-3" />
              Muuda
            </Link>
          ) : null}
          {roleCanWrite ? (
            <form action={duplicateAction}>
              <input type="hidden" name="id" value={row.id} />
              <button
                type="submit"
                title="Duplikaat uueks mustandiks"
                className={raBtnActionClass}
              >
                <CopyIcon aria-hidden="true" className="h-3 w-3" />
                Dupl.
              </button>
            </form>
          ) : null}
          {row.canEnd ? (
            <button
              type="button"
              title="Lõpeta käsitsi"
              className={raBtnDangerClass}
              onClick={() => {
                setEndTarget(row)
              }}
            >
              <EllipsisIcon aria-hidden="true" className="h-3 w-3" />
              Lõpeta
            </button>
          ) : null}
          {row.canArchive ? (
            <details className="relative">
              <summary
                title="Arhiivi"
                className={`${raBtnActionClass} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}
              >
                <EllipsisIcon aria-hidden="true" className="h-3 w-3" />
                Arhiivi
              </summary>
              <form
                action={archiveAction}
                className="mt-xs flex w-72 flex-col gap-xs rounded-card border border-border bg-bgPage p-3 shadow-modal"
              >
                <input type="hidden" name="id" value={row.id} />
                <label className="flex flex-col gap-xs text-label text-inkMuted">
                  Arhiiveerimise põhjus (kohustuslik)
                  <textarea
                    name="reason"
                    required
                    minLength={5}
                    rows={2}
                    className="rounded-input border border-border bg-bgPage px-2 py-1 text-bodySm text-ink"
                    placeholder="Kirjuta põhjus (min 5 tähemärki)"
                  />
                </label>
                <button
                  type="submit"
                  className="rounded-button border border-border px-3 py-1 text-label font-semibold text-ink transition-colors duration-hover ease-hover hover:border-primary hover:text-primary"
                >
                  Arhiivi
                </button>
              </form>
            </details>
          ) : null}
          {row.canRelist ? (
            <form action={relistAction}>
              <input type="hidden" name="id" value={row.id} />
              <button
                type="submit"
                title="Avalda uuesti"
                className={raBtnActionClass}
              >
                Avalda uuesti
              </button>
            </form>
          ) : null}
        </span>
      ),
    },
  ]

  // Hidden optional columns render neither header nor cell: filtering the
  // array before DataTable sees it covers both.
  const visibleTableColumns = columns.filter(
    (column) =>
      !(OPTIONAL_COLUMN_KEYS as readonly string[]).includes(column.key) ||
      visibleColumns.has(column.key),
  )

  return (
    <div>
      <div className="relative mb-2 flex justify-end">
        <button
          type="button"
          ref={columnsTriggerRef}
          onClick={() => {
            setColumnsOpen((open) => !open)
          }}
          aria-haspopup="dialog"
          aria-expanded={columnsOpen}
          className="inline-flex h-8 items-center gap-1.5 rounded-button border border-border bg-bgPage px-2.5 text-label font-semibold text-ink transition-colors duration-hover ease-hover hover:border-primary hover:bg-bgMist hover:text-primary"
        >
          <Settings2Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
          Veerud
        </button>
        {columnsOpen ? (
          <div
            ref={columnsPanelRef}
            role="dialog"
            aria-modal="false"
            aria-label="Vali veerud"
            tabIndex={-1}
            onKeyDown={(event) => {
              if (columnsPanelRef.current) {
                trapTabKey(event, columnsPanelRef.current)
              }
            }}
            className="absolute right-0 top-full z-20 mt-1 w-56 rounded-card border border-border bg-bgPage p-1.5 shadow-modal"
          >
            <p className="px-2 pb-1 pt-1.5 text-label font-semibold text-inkMuted">
              Vali veerud
            </p>
            {OPTIONAL_COLUMN_KEYS.map((key) => (
              <label
                key={key}
                className="flex cursor-pointer items-center gap-2 rounded-[8px] px-2 py-1.5 text-bodySm text-ink transition-colors duration-hover ease-hover hover:bg-bgMist"
              >
                <input
                  type="checkbox"
                  checked={visibleColumns.has(key)}
                  onChange={() => {
                    toggleColumn(key)
                  }}
                  className="h-4 w-4 accent-primary"
                />
                {OPTIONAL_COLUMN_LABELS[key]}
              </label>
            ))}
          </div>
        ) : null}
      </div>
      <DataTable
        columns={visibleTableColumns}
        rows={rows}
        emptyLabel="Filtritele vastavaid oksjoneid ei leitud"
        rowClassName={(row) =>
          selected.has(row.id) ? '[&>td]:bg-primaryLight' : ''
        }
      />
      <EndAuctionModal
        auction={
          endTarget
            ? {
                id: endTarget.id,
                title: endTarget.title,
                context: endContextLabel(endTarget),
              }
            : null
        }
        action={endManuallyAction}
        onClose={() => {
          setEndTarget(null)
        }}
      />
      {roleCanWrite && selected.size > 0 ? (
        <form
          action={handleBulkSchedule}
          role="status"
          className="fixed bottom-6 left-1/2 z-[120] flex max-w-[calc(100vw-32px)] -translate-x-1/2 flex-wrap items-center gap-2.5 rounded-card bg-ink px-3 py-2.5 pl-5 text-inkInverse shadow-modal"
        >
          <span className="text-label font-semibold">
            Valitud <span className="font-mono">{String(selected.size)}</span>{' '}
            oksjonit
          </span>
          {[...selected].map((id) => (
            <input key={id} type="hidden" name="ids" value={id} />
          ))}
          <label className="flex items-center gap-1.5 text-label text-white/75">
            Algus
            <input
              type="datetime-local"
              name="startsAt"
              required
              title="Kellaaeg Europe/Tallinn"
              className={bulkInputClass}
            />
          </label>
          <label className="flex items-center gap-1.5 text-label text-white/75">
            Lõpp
            <input
              type="datetime-local"
              name="endsAt"
              title="Kellaaeg Europe/Tallinn"
              className={bulkInputClass}
            />
          </label>
          <button type="submit" className={bulkBarBtnClass}>
            <CalendarClockIcon
              aria-hidden="true"
              className="h-4 w-4 shrink-0"
            />
            Ajasta avaldimine
          </button>
          {roleCanExport ? (
            <a
              href={csvHref}
              title="Ekspordib praeguse filtri"
              className={bulkBarBtnClass}
            >
              <DownloadIcon aria-hidden="true" className="h-4 w-4 shrink-0" />
              Ekspordi valitud
            </a>
          ) : null}
          <button
            type="button"
            onClick={clearSelection}
            className={bulkCancelBtnClass}
          >
            <XIcon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
            Tühista
          </button>
        </form>
      ) : null}
    </div>
  )
}
