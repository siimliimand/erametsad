import { formatDateTime } from '../../../../_lib/labels'

export interface TemplateVersionEntry {
  id: string
  version: string
  createdAt: string
  updatedAt: string
  active: boolean
  /** First uploader (or draft saver) resolved from the audit trail. */
  uploaderName?: string | null
  /**
   * Free-text note per version. contract_templates has no note column yet,
   * so this stays null and renders an em dash until the schema adds one.
   */
  note?: string | null
  /** Active window derived from the activate/deactivate audit entries. */
  activeFrom?: string | null
  activeTo?: string | null
  /** Contracts generated from this exact version row. */
  generatedCount?: number
}

/**
 * Collapsible per-card version list (demo 08 "Ajalugu"): newest first,
 * the live version carries the "aktiivne" marker, plus the version
 * metadata row — uploader, generated-contracts count, note, active period.
 */
export function TemplateVersionHistory({
  versions,
}: {
  versions: TemplateVersionEntry[]
}) {
  return (
    <details className="border-t border-dashed border-border pt-sm">
      <summary className="cursor-pointer select-none text-label font-semibold text-primary">
        {`Ajalugu (${String(versions.length)})`}
      </summary>
      <ul className="mt-xs flex flex-col gap-1">
        {versions.map((entry) => (
          <li key={entry.id} className="flex flex-col gap-0.5">
            <span className="flex items-center justify-between gap-sm text-bodySm text-ink-muted">
              <span className="whitespace-nowrap font-mono">{`v${entry.version}`}</span>
              <span>
                {formatDateTime(entry.updatedAt)}
                {entry.active ? ' · aktiivne' : ''}
              </span>
            </span>
            <span className="flex flex-wrap items-center justify-between gap-x-sm text-label text-ink-muted">
              <span>
                {`Lisas: ${entry.uploaderName ?? '—'}`}
                {` · Lepinguid: ${String(entry.generatedCount ?? 0)}`}
                {` · Märkus: ${entry.note ?? '—'}`}
              </span>
              {entry.activeFrom || entry.activeTo ? (
                <span className="whitespace-nowrap">
                  {entry.activeTo === null
                    ? `Aktiivne alates ${formatDateTime(entry.activeFrom)}`
                    : `Aktiivne: ${formatDateTime(entry.activeFrom)} – ${formatDateTime(entry.activeTo)}`}
                </span>
              ) : entry.active ? (
                <span className="whitespace-nowrap">Aktiivne (ajalooline kirje puudub)</span>
              ) : (
                <span className="whitespace-nowrap">Pole aktiveeritud</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </details>
  )
}
