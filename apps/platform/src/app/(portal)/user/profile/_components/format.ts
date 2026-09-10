export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('et-EE', { dateStyle: 'medium', timeStyle: 'short' })
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('et-EE', { dateStyle: 'medium' })
}

/**
 * Demo .mono mask for the personal code: first 7 characters plus a fixed
 * 5-star tail, matching the demo string "3870516*****".
 */
export function maskIsikukood(value: string): string {
  if (value.length <= 7) return '*'.repeat(5)
  return `${value.slice(0, 7)}*****`
}
