import type { ReactNode } from 'react'

export interface EmptyRowProps {
  colSpan: number
  children: ReactNode
}

// Table empty state row (10/14 demo .empty-row/.empty-cell).
export function EmptyRow({ colSpan, children }: EmptyRowProps) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-6 text-center text-bodySm text-inkMuted">
        {children}
      </td>
    </tr>
  )
}
