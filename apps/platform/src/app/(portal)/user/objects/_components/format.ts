export const STATUS_LABELS: Record<string, string> = {
  draft: 'Mustand',
  scheduled: 'Plaanis',
  active: 'Aktiivne',
  ended: 'Lõppenud',
  'sealed-opening-pending': 'Avamine ootel',
  contract: 'Leping',
  completed: 'Lõpetatud',
  archived: 'Arhiveeritud',
  unsold: 'Müümata',
  appraised: 'Hinnatud',
}

export const TYPE_LABELS: Record<string, string> = {
  open: 'Avatud',
  sealed: 'Suletud',
}

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status
}

export function formatEur(amount: number): string {
  const rounded = Math.round(amount * 100) / 100
  const hasCents = Math.abs(rounded % 1) > 0.001
  const [whole, cents] = rounded.toFixed(hasCents ? 2 : 0).split('.')
  const grouped = (whole ?? '0').replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0')
  const centsPart = cents === undefined ? '' : `,${cents}`
  return `${grouped}${centsPart} €`
}

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
