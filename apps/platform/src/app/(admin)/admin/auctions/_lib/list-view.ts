export const SORT_KEYS = ['id', 'title', 'minBidCents', 'bidCount', 'endsAt', 'createdAt'] as const

export type SortKey = (typeof SORT_KEYS)[number]

export interface SortableAuctionRow {
  id: string
  title: string
  minBidCents: number
  bidCount: number
  endsAt: string | null
  createdAt: string
}

const DEFAULT_SORT = '-createdAt'

/**
 * User-facing strings stay in Estonian, matching the admin list UI.
 */
export function countdownText(endsAt: string, now: number): string {
  const ms = Date.parse(endsAt) - now
  if (ms <= 0) return 'lõppenud'
  const totalMinutes = Math.floor(ms / 60000)
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60
  if (days > 0) return `${String(days)} p ${String(hours)} h`
  if (hours > 0) return `${String(hours)} h ${String(minutes)} min`
  const seconds = Math.floor((ms % 60000) / 1000)
  return `${String(minutes)}:${String(seconds).padStart(2, '0')}`
}

export function initials(name: string | null | undefined): string {
  if (!name) return '—'
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

/**
 * Exactly one 'active' status in the filter sorts by imminent end;
 * every other filter combination falls back to newest first.
 */
export function defaultSortFor(statusFilter: readonly string[]): string {
  return statusFilter.length === 1 && statusFilter[0] === 'active' ? 'endsAt' : DEFAULT_SORT
}

export function sortAuctionRows<T extends SortableAuctionRow>(
  rows: T[],
  sort: string,
  fallback: string = DEFAULT_SORT,
): T[] {
  const active = parseSort(sort) ?? parseSort(fallback)
  if (!active) return [...rows]
  const { key, dir } = active
  return [...rows].sort((a, b) => compareRows(a, b, key, dir))
}

function parseSort(sort: string): { key: SortKey; dir: 1 | -1 } | null {
  if (sort === '') return null
  const dir: 1 | -1 = sort.startsWith('-') ? -1 : 1
  const raw = dir === -1 ? sort.slice(1) : sort
  if (!isSortKey(raw)) return null
  return { key: raw, dir }
}

function isSortKey(value: string): value is SortKey {
  return (SORT_KEYS as readonly string[]).includes(value)
}

function compareRows<T extends SortableAuctionRow>(a: T, b: T, key: SortKey, dir: 1 | -1): number {
  switch (key) {
    case 'id':
      return stringCompare(a.id, b.id) * dir
    case 'title':
      return a.title.localeCompare(b.title, 'et') * dir
    case 'minBidCents':
      return (a.minBidCents - b.minBidCents) * dir
    case 'bidCount':
      return (a.bidCount - b.bidCount) * dir
    case 'endsAt':
      return timestampCompare(a.endsAt, b.endsAt, dir)
    case 'createdAt':
      return timestampCompare(a.createdAt, b.createdAt, dir)
  }
}

function stringCompare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

// Null or empty timestamps sort last regardless of direction so rows without
// an end date stay grouped at the bottom in both ascending and descending views.
function timestampCompare(a: string | null, b: string | null, dir: 1 | -1): number {
  const av = a ?? ''
  const bv = b ?? ''
  if (av === '' && bv === '') return 0
  if (av === '') return 1
  if (bv === '') return -1
  return stringCompare(av, bv) * dir
}
