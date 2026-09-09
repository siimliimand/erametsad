'use client'

import { History } from 'lucide-react'
import { useEffect, useMemo, useState, useTransition } from 'react'

import {
  buildBlockDiff,
  configJsonText,
  type DrawerBlock,
  type PageVersionOption,
  type VersionDiffStatus,
} from './version-blocks'
import { restorePageVersionAction } from '../../../../_actions/content'
import { secondaryButtonClass } from '../../../../_components/FormField'
import { ConfirmDialog } from '../../../../_components/ui/ConfirmDialog'
import { Drawer } from '../../../../_components/ui/Drawer'
import { formatDateTime } from '../../../../_lib/labels'

import { getBlockTypeLabel } from '@/lib/content/blocks'

export { buildBlockDiff, parseVersionBlocks } from './version-blocks'
export type { DrawerBlock, PageVersionOption, VersionDiffRow, VersionDiffStatus } from './version-blocks'

/**
 * Versions drawer for the page editor: publish snapshots from
 * `page_versions`, a hand-rolled two-column diff (selected version vs the
 * page's current blocks) and a reason-confirmed restore through
 * `restorePageVersionAction`.
 *
 * The parent server component owns the data: it reads `page_versions` and the
 * current `page_blocks` rows, parses each `snapshotJson` with
 * `parseVersionBlocks` and passes the results as props.
 */

const diffStatusLabels: Record<Exclude<VersionDiffStatus, 'same'>, string> = {
  changed: 'Muudetud',
  added: 'Lisatud',
  removed: 'Eemaldatud',
}

const diffRowTone: Record<VersionDiffStatus, string> = {
  same: 'border-border',
  changed: 'border-info',
  added: 'border-primary',
  removed: 'border-danger',
}

const diffCellTone: Record<VersionDiffStatus, string> = {
  same: 'bg-bgPage',
  changed: 'bg-infoLight',
  added: 'bg-primaryLight',
  removed: 'bg-dangerLight',
}

const jsonPreClass =
  'max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-[8px] border border-border bg-bgPage p-2 font-mono text-[11px] leading-4 text-inkMuted'

const dangerButtonClass =
  'inline-flex h-10 items-center gap-xs rounded-button bg-danger px-4 text-label font-semibold text-inkInverse transition-[filter] duration-hover ease-hover hover:brightness-90 disabled:cursor-not-allowed disabled:opacity-50'

export interface VersionsDrawerProps {
  pageId: string
  open: boolean
  onClose: () => void
  /** `page_versions` rows in any order; the list sorts by version descending. */
  versions: readonly PageVersionOption[]
  /** The page's current `page_blocks` as validated block entries. */
  currentBlocks: readonly DrawerBlock[]
}

export function VersionsDrawer({
  pageId,
  open,
  onClose,
  versions,
  currentBlocks,
}: VersionsDrawerProps) {
  const sorted = useMemo(
    () => [...versions].sort((a, b) => b.version - a.version),
    [versions],
  )
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  // Keep the selection valid when the versions prop changes between opens.
  useEffect(() => {
    if (!open) return
    setSelectedId((current) =>
      current !== null && sorted.some((version) => version.id === current)
        ? current
        : (sorted[0]?.id ?? null),
    )
  }, [open, sorted])

  const selected = sorted.find((version) => version.id === selectedId) ?? null
  const diff = useMemo(
    () => (selected ? buildBlockDiff(selected.blocks, currentBlocks) : []),
    [selected, currentBlocks],
  )
  const changedCount = diff.filter((row) => row.status === 'changed').length
  const addedCount = diff.filter((row) => row.status === 'added').length
  const removedCount = diff.filter((row) => row.status === 'removed').length

  const handleRestore = (reason: string) => {
    if (!selected) return
    setConfirmOpen(false)
    const formData = new FormData()
    formData.set('pageId', pageId)
    formData.set('versionId', selected.id)
    formData.set('reason', reason)
    startTransition(async () => {
      await restorePageVersionAction(formData)
    })
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Versioonid"
      subtitle={
        sorted.length > 0 ? `${String(sorted.length)} versiooni` : 'Ajalugu puudub'
      }
      size="lg"
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButtonClass}>
            Sulge
          </button>
          <button
            type="button"
            onClick={() => {
              setConfirmOpen(true)
            }}
            disabled={!selected || pending}
            className={dangerButtonClass}
          >
            <History className="h-4 w-4" />
            Taasta see versioon
          </button>
        </>
      }
    >
      {sorted.length === 0 ? (
        <p className="rounded-[8px] border border-dashed border-border px-3 py-6 text-center text-bodySm text-inkMuted">
          Versioone pole veel. Lehe avaldamine loob automaatselt esimese versiooni.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <ul className="flex max-h-48 list-none flex-col gap-1 overflow-y-auto rounded-card border border-border p-1">
            {sorted.map((version) => {
              const isSelected = version.id === selectedId
              return (
                <li key={version.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(version.id)
                    }}
                    aria-pressed={isSelected}
                    className={`flex w-full items-center gap-2 rounded-[8px] px-2.5 py-2 text-left transition-colors duration-hover ease-hover ${
                      isSelected
                        ? 'bg-bgMist text-primary'
                        : 'text-ink hover:bg-bgMist'
                    }`}
                  >
                    <span className="font-mono text-label font-semibold">
                      {`Versioon ${String(version.version)}`}
                    </span>
                    {version.label ? (
                      <span className="min-w-0 flex-1 truncate text-label">{version.label}</span>
                    ) : (
                      <span className="min-w-0 flex-1" />
                    )}
                    <span className="shrink-0 text-[11px] text-inkMuted">
                      {formatDateTime(version.createdAt)}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>

          {selected ? (
            <section aria-label="Versioonide võrdlus" className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-label font-semibold text-ink">Erinevused:</span>
                {changedCount > 0 ? (
                  <span className="rounded-pill bg-infoLight px-2 py-0.5 text-[11px] font-medium text-info">
                    {`${String(changedCount)} ${diffStatusLabels.changed.toLowerCase()}`}
                  </span>
                ) : null}
                {addedCount > 0 ? (
                  <span className="rounded-pill bg-primaryLight px-2 py-0.5 text-[11px] font-medium text-primary">
                    {`${String(addedCount)} ${diffStatusLabels.added.toLowerCase()}`}
                  </span>
                ) : null}
                {removedCount > 0 ? (
                  <span className="rounded-pill bg-dangerLight px-2 py-0.5 text-[11px] font-medium text-danger">
                    {`${String(removedCount)} ${diffStatusLabels.removed.toLowerCase()}`}
                  </span>
                ) : null}
                {diff.length > 0 && changedCount + addedCount + removedCount === 0 ? (
                  <span className="text-label text-inkMuted">
                    Valitud versioon ja praegune olek on identsed.
                  </span>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <span className="font-mono text-[11px] font-semibold uppercase tracking-wide text-inkMuted">
                  {`Versioon ${String(selected.version)}`}
                </span>
                <span className="font-mono text-[11px] font-semibold uppercase tracking-wide text-inkMuted">
                  Praegune
                </span>
              </div>

              {diff.map((row) => (
                <div
                  key={String(row.ordinal)}
                  className={`grid grid-cols-2 gap-2 rounded-[8px] border-l-4 ${diffRowTone[row.status]}`}
                >
                  <DiffCell ordinal={row.ordinal} status={row.status} block={row.versionBlock} />
                  <DiffCell ordinal={row.ordinal} status={row.status} block={row.currentBlock} />
                </div>
              ))}
              {diff.length === 0 ? (
                <p className="rounded-[8px] border border-dashed border-border px-3 py-4 text-center text-bodySm text-inkMuted">
                  Mõlemas olekus pole ühtegi blokki.
                </p>
              ) : null}
            </section>
          ) : null}
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => {
          setConfirmOpen(false)
        }}
        variant="reason"
        title={selected ? `Taasta versioon ${String(selected.version)}` : 'Taasta versioon'}
        description="Taastamine asendab lehe praegused blokid valitud versiooni blokkidega. Praeguseid salvestamata muudatusi ei saa tagasi võtta."
        reasonLabel="Põhjendus (kohustuslik)"
        reasonPlaceholder="Miks seda versiooni taastatakse?"
        confirmLabel="Taasta"
        busy={pending}
        onConfirm={handleRestore}
        note="Toiming kirjutatakse auditilogi."
      />
    </Drawer>
  )
}

function DiffCell({
  ordinal,
  status,
  block,
}: {
  ordinal: number
  status: VersionDiffStatus
  block: DrawerBlock | null
}) {
  if (!block) {
    return (
      <div
        className={`flex min-h-16 items-center justify-center rounded-[8px] border border-dashed border-border text-[11px] text-inkMuted ${diffCellTone[status]}`}
      >
        Puudub
      </div>
    )
  }
  return (
    <div className={`flex min-w-0 flex-col gap-1 rounded-[8px] p-2 ${diffCellTone[status]}`}>
      <span className="flex items-center gap-1.5 text-label font-semibold text-ink">
        <span className="font-mono text-[11px] text-inkMuted">{`${String(ordinal)}.`}</span>
        {getBlockTypeLabel(block.type)}
        {status !== 'same' ? (
          <span className="ml-auto font-mono text-[10px] font-medium text-inkMuted">
            {diffStatusLabels[status]}
          </span>
        ) : null}
      </span>
      <pre className={jsonPreClass}>{configJsonText(block.config)}</pre>
    </div>
  )
}
