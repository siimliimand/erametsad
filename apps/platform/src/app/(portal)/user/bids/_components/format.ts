export function formatEur(value: number): string {
  return value.toLocaleString('et-EE', { style: 'currency', currency: 'EUR' })
}

export function formatEurInput(value: number): string {
  return value.toLocaleString('et-EE', { maximumFractionDigits: 2 })
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('et-EE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export function parseEurInput(raw: string): number | null {
  const normalized = raw.trim().replace(/\s/g, '').replace(',', '.')
  if (normalized === '') return null
  const value = Number(normalized)
  return Number.isFinite(value) ? value : null
}
