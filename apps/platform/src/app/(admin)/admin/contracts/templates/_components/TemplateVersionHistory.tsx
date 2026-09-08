import { formatDateTime } from '../../../../_lib/labels'

export interface TemplateVersionEntry {
  id: string
  version: string
  createdAt: string
  updatedAt: string
  active: boolean
}

/**
 * Collapsible per-card version list (demo 08 "Ajalugu"): newest first,
 * the live version carries the "aktiivne" marker.
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
      <ul className="mt-xs flex flex-col gap-0.5">
        {versions.map((entry) => (
          <li
            key={entry.id}
            className="flex items-center justify-between gap-sm text-bodySm text-ink-muted"
          >
            <span className="whitespace-nowrap font-mono">{`v${entry.version}`}</span>
            <span>
              {formatDateTime(entry.updatedAt)}
              {entry.active ? ' · aktiivne' : ''}
            </span>
          </li>
        ))}
      </ul>
    </details>
  )
}
