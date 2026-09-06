import type { ReactNode } from 'react'

export interface DataTableColumn<T> {
  key: string
  label: string
  render?: (row: T) => ReactNode
}

export interface DataTableProps<T> {
  columns: readonly DataTableColumn<T>[]
  rows: readonly T[]
  emptyLabel?: string
}

function rowKey(row: unknown, index: number): string {
  const id = (row as { id?: unknown }).id
  return typeof id === 'string' || typeof id === 'number' ? String(id) : `row-${String(index)}`
}

export function DataTable<T>({ columns, rows, emptyLabel = 'Andmeid pole' }: DataTableProps<T>) {
  if (rows.length === 0) {
    return (
      <div className="rounded-card border border-border bg-bgPage px-md py-lg text-center text-bodySm text-inkMuted">
        {emptyLabel}
      </div>
    )
  }
  return (
    <div className="overflow-x-auto rounded-card border border-border bg-bgPage">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-border bg-bgMist">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className="py-2.5 px-3 text-label font-medium text-inkMuted whitespace-nowrap first:pl-4 last:pr-4"
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={rowKey(row, index)}
              className="border-b border-border last:border-b-0 hover:bg-bgMist transition-colors duration-hover ease-hover"
            >
              {columns.map((column) => (
                <td key={column.key} className="py-3 px-3 text-[13px] leading-[18px] text-ink first:pl-4 last:pr-4">
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
