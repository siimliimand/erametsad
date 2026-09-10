import type { ReactNode } from 'react'

import { AdminLink } from './AdminLink'
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon } from './icons'

export interface DataTableColumnSort {
  // undefined = column is sortable but not the active sort column
  dir?: 'asc' | 'desc' | undefined
  href: string
}

export interface DataTableColumn<T> {
  key: string
  label: string
  render?: (row: T) => ReactNode
  sort?: DataTableColumnSort | undefined
}

export interface DataTableProps<T> {
  columns: readonly DataTableColumn<T>[]
  rows: readonly T[]
  emptyLabel?: string
  // Extra <tr> classes, e.g. selection highlights; applied per row.
  rowClassName?: (row: T) => string
}

function rowKey(row: unknown, index: number): string {
  const id = (row as { id?: unknown }).id
  return typeof id === 'string' || typeof id === 'number' ? String(id) : `row-${String(index)}`
}

function ariaSortValue(dir?: 'asc' | 'desc'): 'ascending' | 'descending' | undefined {
  if (dir === 'asc') return 'ascending'
  if (dir === 'desc') return 'descending'
  return undefined
}

function SortGlyph({ dir, active }: { dir?: 'asc' | 'desc' | undefined; active: boolean }) {
  const className = `h-3 w-3 shrink-0 ${active ? 'opacity-100' : 'opacity-50'}`
  if (dir === 'asc') return <ArrowUpIcon className={className} />
  if (dir === 'desc') return <ArrowDownIcon className={className} />
  return <ArrowUpDownIcon className={className} />
}

export function DataTable<T>({
  columns,
  rows,
  emptyLabel = 'Andmeid pole',
  rowClassName,
}: DataTableProps<T>) {
  if (rows.length === 0) {
    return (
      <div className="rounded-card border border-border bg-bgPage px-md py-lg text-center text-bodySm text-inkMuted shadow-card">
        {emptyLabel}
      </div>
    )
  }
  return (
    <div className="overflow-x-auto rounded-card border border-border bg-bgPage shadow-card">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-border bg-bgMist">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                aria-sort={ariaSortValue(column.sort?.dir)}
                className="py-2.5 px-3 text-label font-medium text-inkMuted whitespace-nowrap first:pl-5 last:pr-5"
              >
                {column.sort ? (
                  <AdminLink
                    href={column.sort.href}
                    title={`Sorteeri ${column.label} järgi`}
                    className={`inline-flex items-center gap-1 whitespace-nowrap no-underline transition-colors duration-hover ease-hover hover:text-primary ${
                      column.sort.dir ? 'font-semibold text-primary' : 'text-inkMuted'
                    }`}
                  >
                    {column.label}
                    <SortGlyph dir={column.sort.dir} active={Boolean(column.sort.dir)} />
                  </AdminLink>
                ) : (
                  column.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={rowKey(row, index)}
              className={`border-b border-border last:border-b-0 hover:bg-bgMist transition-colors duration-hover ease-hover${rowClassName ? ` ${rowClassName(row)}` : ''}`}
            >
              {columns.map((column) => (
                <td key={column.key} className="py-3 px-3 text-[13px] leading-[18px] text-ink first:pl-5 last:pr-5">
                  <span className="inline-block max-w-[32rem] truncate whitespace-nowrap">
                    {column.render
                      ? column.render(row)
                      : ((row as Record<string, unknown>)[column.key] as ReactNode) ?? '—'}
                  </span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
