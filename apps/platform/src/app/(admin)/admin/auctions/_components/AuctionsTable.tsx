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
import { useEffect, useRef, useState } from 'react'
import type { ComponentType } from 'react'

import { Countdown } from './Countdown'
import { EndAuctionModal } from './EndAuctionModal'
import { useAdminBase } from '../../../_components/AdminBase'
import { AdminLink } from '../../../_components/AdminLink'
import {
  DataTable,
  type DataTableColumn,
  type DataTableColumnSort,
} from '../../../_components/DataTable'
import { inputClass, primaryButtonClass, secondaryButtonClass } from '../../../_components/FormField'
import { StatusChip } from '../../../_components/StatusChip'
import {
  CalendarClockIcon,
  CopyIcon,
  EllipsisIcon,
  ExternalLinkIcon,
  MapPinHouseIcon,
  PackageIcon,
  PencilIcon,
  TreePineIcon,
  WheatIcon,
  XIcon,
  ZapIcon,
} from '../../../_components/icons'
import { Modal } from '../../../_components/ui/Modal'
import {
  trapTabKey,
  useDialogFocus,
  useEscapeKey,
} from '../../../_components/ui/useOverlay'
import {
  auctionObjectTypeLabels,
  auctionStatusLabels,
  auctionTypeLabels,
  formatDateTime,
} from '../../../_lib/labels'
import { tallinnWallTimeToUtcIso } from '../../content/_components/scheduled-publish'
import type { SortKey } from '../_lib/list-view'

import type { AuctionObjectType, AuctionStatus } from '@/lib/data/schema'
import { joinAdminBase } from '@/lib/routing/admin-base'

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
  /**
   * Combined lot-size cell ("12,4 ha / 980 m³") from the real area/volume
   * columns; null when the lot carries neither measure.
   */
  areaVolumeLabel: string | null
  endsAt: string | null
  /**
   * Initial cell text for the Lõpp column, precomputed server-side:
   * countdown text for active rows, formatted datetime otherwise, null
   * when endsAt is null. Precomputing keeps SSR and hydration identical.
   */
  endsLabel: string | null
  /** Initial cell text for the Uuendatud column, formatted server-side. */
  updatedAtLabel: string
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
  pollumaa: 'bg-[var(--st-draft-bg)] text-[color:var(--st-draft-text)]',
}

const typeChipIcons: Record<
  AuctionObjectType,
  ComponentType<{ className?: string }>
> = {
  raieoigus: TreePineIcon,
  kinnistu: MapPinHouseIcon,
  pakett: PackageIcon,
  kiire: ZapIcon,
  pollumaa: WheatIcon,
}

const raBtnClass =
  'inline-flex items-center gap-1 rounded-md border border-border bg-bgPage px-2 py-1 text-[11px] font-medium text-inkMuted transition-colors duration-hover ease-hover'
const raBtnActionClass = `${raBtnClass} hover:border-primary hover:bg-bgMist hover:text-primary`
const raBtnDangerClass = `${raBtnClass} hover:border-danger hover:bg-dangerLight hover:text-danger`

const bulkBarBtnClass =
  'inline-flex items-center gap-1.5 rounded-[8px] border border-white/25 px-3 py-1.5 text-label font-semibold transition-colors duration-hover ease-hover hover:bg-white/10'
const bulkCancelBtnClass =
  'inline-flex items-center gap-1 rounded-[8px] px-2 py-1.5 text-label text-white/75 transition-colors duration-hover ease-hover hover:text-white'

// Veerud column chooser: optional columns persist per browser in
// localStorage; fixed columns (selection, id, title, status, areaVolume,
// actions) always render.
const COLUMNS_STORAGE_KEY = 'erametsad.admin.auctions.columns'

// The export route keeps the `auctions:export` gate and scope enforcement
// server-side; it accepts `?ids=` for a selection export plus the list's
// shareable filter params for a filtered export.
const AUCTIONS_EXPORT_HREF = '/api/v1/admin/auctions/export'

const OPTIONAL_COLUMN_KEYS = [
  'objectType',
  'countyName',
  'minBidCents',
  'bidCount',
  'endsAt',
  'updatedAt',
  'specialistName',
] as const

type OptionalColumnKey = (typeof OPTIONAL_COLUMN_KEYS)[number]

const OPTIONAL_COLUMN_LABELS: Record<OptionalColumnKey, string> = {
  objectType: 'Tüüp',
  countyName: 'Maakond',
  minBidCents: 'Alghind',
  bidCount: 'Pakkumisi',
  endsAt: 'Lõpp',
  updatedAt: 'Uuendatud',
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

// Row selection survives the list's server-side page navigation (each page
// remounts this component) in sessionStorage; the selection therefore
// accumulates across pages until the operator clears it.
const SELECTION_STORAGE_KEY = 'erametsad.admin.auctions.selection'

function readStoredSelection(): ReadonlySet<string> {
  try {
    const raw = window.sessionStorage.getItem(SELECTION_STORAGE_KEY)
    if (raw === null) return new Set<string>()
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Set<string>()
    return new Set(parsed.filter((value): value is string => typeof value === 'string'))
  } catch {
    return new Set<string>()
  }
}

function writeStoredSelection(ids: ReadonlySet<string>): void {
  try {
    window.sessionStorage.setItem(SELECTION_STORAGE_KEY, JSON.stringify([...ids]))
  } catch {
    // Storage can throw in private mode: the selection then only lives for
    // this page session.
  }
}

/**
 * End-time preview base for the Ajasta avaldamine modal (task 5.3): the
 * row's own stored end when it has one, otherwise the modal's shared end.
 * Null when neither exists — the row then schedules without an end.
 */
export function bulkEndBaseIso(endsAtIso: string | null, sharedEndWall: string): string | null {
  if (endsAtIso !== null && endsAtIso !== '' && !Number.isNaN(Date.parse(endsAtIso))) {
    return endsAtIso
  }
  if (sharedEndWall.trim() === '') return null
  return tallinnWallTimeToUtcIso(sharedEndWall)
}

/** The offset math itself: base plus N hours, as UTC ISO; null base stays null. */
export function bulkShiftedEndIso(
  endsAtIso: string | null,
  sharedEndWall: string,
  shiftHours: number,
): string | null {
  const base = bulkEndBaseIso(endsAtIso, sharedEndWall)
  if (base === null) return null
  return new Date(Date.parse(base) + shiftHours * 60 * 60 * 1000).toISOString()
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
  const base = useAdminBase()
  const [selected, setSelected] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  )
  const [endTarget, setEndTarget] = useState<AuctionTableRow | null>(null)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [shiftHours, setShiftHours] = useState(0)
  const [sharedEndWall, setSharedEndWall] = useState('')
  const [visibleColumns, setVisibleColumns] = useState<ReadonlySet<string>>(
    () => new Set<string>(OPTIONAL_COLUMN_KEYS),
  )
  const [columnsOpen, setColumnsOpen] = useState(false)
  const columnsPanelRef = useRef<HTMLDivElement>(null)
  const columnsTriggerRef = useRef<HTMLButtonElement>(null)
  const columnsHydratedRef = useRef(false)
  const selectionHydratedRef = useRef(false)

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

  // Same mount-then-persist pattern for the row selection, so a selection
  // made on one list page re-appears after navigating to another.
  useEffect(() => {
    setSelected(readStoredSelection())
    selectionHydratedRef.current = true
  }, [])

  useEffect(() => {
    if (!selectionHydratedRef.current) return
    writeStoredSelection(selected)
  }, [selected])

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
      window.location.href = joinAdminBase(base, '/auctions/new')
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [base, roleCanWrite])

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

  // Select-all on the rendered page: adds (or removes) every row of the
  // current page while rows picked on other pages keep their state.
  const allRenderedSelected =
    rows.length > 0 && rows.every((row) => selected.has(row.id))

  const toggleAllRendered = (): void => {
    setSelected((previous) => {
      const next = new Set(previous)
      for (const row of rows) {
        if (allRenderedSelected) {
          next.delete(row.id)
        } else {
          next.add(row.id)
        }
      }
      return next
    })
  }

  const clearSelection = (): void => {
    setSelected(new Set<string>())
    setScheduleOpen(false)
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

  // The bulk-bar selection export must carry exactly the picked rows, so the
  // href is rebuilt from the selection instead of reusing the filter href.
  const selectionExportHref = `${AUCTIONS_EXPORT_HREF}?${new URLSearchParams({
    ids: [...selected].join(','),
  }).toString()}`

  const handleBulkSchedule = async (formData: FormData): Promise<void> => {
    await bulkScheduleAction(formData)
    clearSelection()
  }

  const openScheduleModal = (): void => {
    setShiftHours(0)
    setSharedEndWall('')
    setScheduleOpen(true)
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
        <AdminLink
          href={`/auctions/${row.id}`}
          className="font-mono text-bodySm text-primary transition-colors duration-hover ease-hover hover:text-primary/80"
          title={row.id}
        >
          #{row.id.slice(0, 8)}
        </AdminLink>
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
          <AdminLink
            href={`/auctions/${row.id}`}
            className="font-semibold text-primary transition-colors duration-hover ease-hover hover:text-primary/80"
          >
            {row.title}
          </AdminLink>
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
      key: 'areaVolume',
      label: 'ha / m³',
      render: (row) => (
        <span className="tabular-nums">{row.areaVolumeLabel ?? '—'}</span>
      ),
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
      key: 'updatedAt',
      label: OPTIONAL_COLUMN_LABELS.updatedAt,
      render: (row) => (
        <span className="whitespace-nowrap">{row.updatedAtLabel}</span>
      ),
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
            <AdminLink
              href={row.editHref}
              title="Muuda oksjonit"
              className={raBtnActionClass}
            >
              <PencilIcon aria-hidden="true" className="h-3 w-3" />
              Muuda
            </AdminLink>
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
      <div className="relative mb-2 flex items-center justify-end gap-3">
        {roleCanWrite ? (
          <label className="mr-auto inline-flex h-8 cursor-pointer items-center gap-2 text-label text-inkMuted">
            <input
              type="checkbox"
              checked={allRenderedSelected}
              onChange={toggleAllRendered}
              aria-label="Vali kõik loendi read"
              className="h-4 w-4 accent-primary"
            />
            Vali kõik
          </label>
        ) : null}
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
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-[120] flex max-w-[calc(100vw-32px)] -translate-x-1/2 flex-wrap items-center gap-2.5 rounded-card bg-ink px-3 py-2.5 pl-5 text-inkInverse shadow-modal"
        >
          <span className="text-label font-semibold">
            Valitud <span className="font-mono">{String(selected.size)}</span>{' '}
            oksjonit
          </span>
          <button
            type="button"
            onClick={openScheduleModal}
            className={bulkBarBtnClass}
          >
            <CalendarClockIcon
              aria-hidden="true"
              className="h-4 w-4 shrink-0"
            />
            Ajasta avaldamine
          </button>
          {roleCanExport ? (
            <>
              <a
                href={selectionExportHref}
                title="Ekspordib valitud oksjonid"
                className={bulkBarBtnClass}
              >
                <DownloadIcon
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0"
                />
                Ekspordi valitud
              </a>
              <a
                href={csvHref}
                title="Ekspordib praeguse filtri"
                className={bulkBarBtnClass}
              >
                <DownloadIcon
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0"
                />
                Ekspordi filtreeritud
              </a>
            </>
          ) : null}
          <button
            type="button"
            onClick={clearSelection}
            className={bulkCancelBtnClass}
          >
            <XIcon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
            Tühista
          </button>
        </div>
      ) : null}
      <Modal
        open={roleCanWrite && scheduleOpen}
        onClose={() => {
          setScheduleOpen(false)
        }}
        title="Ajasta avaldamine"
        tone="info"
        icon={<CalendarClockIcon className="h-[18px] w-[18px]" />}
      >
        <form
          action={handleBulkSchedule}
          className="flex flex-col gap-3"
          aria-label="Ajasta avaldamine"
        >
          {[...selected].map((id) => (
            <input key={id} type="hidden" name="ids" value={id} />
          ))}
          <p className="text-bodySm text-inkMuted">
            Kõik valitud mustanded saavad ühise algusaja. Iga rida säilitab oma
            lõpuaja; nihkega liiguvad kõik lõpuajad võrdse tunniarvu võrra.
          </p>
          <div className="flex flex-wrap gap-3">
            <label className="flex flex-1 flex-col gap-1 text-label font-medium text-inkMuted">
              Algus (Europe/Tallinn)
              <input
                type="datetime-local"
                name="startsAt"
                required
                title="Kellaaeg Europe/Tallinn"
                className={inputClass}
              />
            </label>
            <label className="flex flex-1 flex-col gap-1 text-label font-medium text-inkMuted">
              Lõpp alus (valikuline)
              <input
                type="datetime-local"
                name="endsAt"
                value={sharedEndWall}
                onChange={(event) => {
                  setSharedEndWall(event.target.value)
                }}
                title="Kellaaeg Europe/Tallinn — kasutatakse ridadele, millel oma lõppu pole"
                className={inputClass}
              />
            </label>
            <label className="flex w-36 flex-col gap-1 text-label font-medium text-inkMuted">
              Nihuta kõiki lõppe (h)
              <input
                type="number"
                name="shiftEndHours"
                value={String(shiftHours)}
                min={-8760}
                max={8760}
                step={1}
                onChange={(event) => {
                  const parsed = Number.parseInt(event.target.value, 10)
                  setShiftHours(Number.isNaN(parsed) ? 0 : parsed)
                }}
                className={inputClass}
              />
            </label>
          </div>
          <fieldset className="m-0 flex flex-col gap-1 border-0 p-0">
            <legend className="mb-1 text-label font-semibold text-ink">
              Lõppude eelvaade
            </legend>
            <ul className="m-0 flex max-h-56 list-none flex-col gap-1 overflow-y-auto p-0">
              {[...selected].map((id) => {
                const row = rows.find((entry) => entry.id === id)
                const previewIso = row
                  ? bulkShiftedEndIso(row.endsAt, sharedEndWall, shiftHours)
                  : null
                const shiftNote =
                  shiftHours !== 0
                    ? ` (${shiftHours > 0 ? '+' : '−'}${String(Math.abs(shiftHours))} h)`
                    : ''
                return (
                  <li
                    key={id}
                    data-preview-ends-at={previewIso ?? ''}
                    className="flex items-baseline justify-between gap-3 rounded-[8px] bg-bgMist px-2.5 py-1.5"
                  >
                    <span className="min-w-0 truncate text-bodySm text-ink">
                      {row ? row.title : `#${id.slice(0, 8)}`}
                    </span>
                    <span className="whitespace-nowrap text-bodySm tabular-nums text-inkMuted">
                      {row === undefined
                        ? '—'
                        : previewIso === null
                          ? 'lõpp puudub'
                          : formatDateTime(previewIso)}
                      {row !== undefined && previewIso !== null ? shiftNote : ''}
                    </span>
                  </li>
                )
              })}
            </ul>
          </fieldset>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setScheduleOpen(false)
              }}
              className={secondaryButtonClass}
            >
              Tühista
            </button>
            <button type="submit" className={primaryButtonClass}>
              <CalendarClockIcon
                aria-hidden="true"
                className="h-4 w-4 shrink-0"
              />
              Ajasta
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
