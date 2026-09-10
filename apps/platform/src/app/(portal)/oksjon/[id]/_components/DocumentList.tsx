import { Download, FileText } from 'lucide-react'

export interface DocumentItem {
  title: string
  href: string
  size?: string
  format?: string
}

// Demo document row (docs/design/demo/portal/02-lot-detail-open.html .doc-list):
// red PDF icon, name + size line and an outline "Laadi alla" action.
// `panel` wraps the rows in the demo bordered list; `plain` renders only the
// divided rows (inside an existing card).
export function DocumentList({
  items,
  variant = 'panel',
}: {
  items: DocumentItem[]
  variant?: 'panel' | 'plain'
}) {
  if (items.length === 0) return null
  return (
    <ul
      className={`m-0 flex list-none flex-col divide-y divide-border p-0 ${
        variant === 'panel'
          ? 'overflow-hidden rounded-card border border-border bg-bgPage'
          : ''
      }`}
    >
      {items.map((item) => (
        <li
          key={item.href}
          className={`flex items-center gap-3.5 bg-bgPage ${
            variant === 'panel' ? 'px-[18px] py-3.5' : 'py-3.5 first:pt-0'
          }`}
        >
          <FileText
            className="h-[22px] w-[22px] flex-none text-danger"
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <span className="block truncate text-bodySm font-semibold text-ink">
              {item.title}
            </span>
            {(item.format !== undefined || item.size !== undefined) && (
              <span className="block text-label text-inkMuted">
                {[item.format, item.size].filter(Boolean).join(' · ')}
              </span>
            )}
          </div>
          <a
            href={item.href}
            download
            className="inline-flex flex-none items-center gap-1.5 rounded-button border border-primary px-3.5 py-1.5 text-bodySm font-semibold text-primary transition-colors duration-hover hover:bg-primaryLight hover:text-primaryHover"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Laadi alla
          </a>
        </li>
      ))}
    </ul>
  )
}
