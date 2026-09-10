// Contracts mirror the committed API routes under src/app/api/v1
// (my/notifications, auction-subscriptions). Filter param names mirror
// (portal)/_lib/filter-params.ts, which mirrors parseAuctionSearchParams.

export interface NotificationItem {
  id: string
  category: string
  channel: string | null
  title: string | null
  body: string | null
  payload: unknown
  readAt: string | null
  sentAt: string | null
  createdAt: string
}

export interface NotificationListResponse {
  items: NotificationItem[]
  nextCursor: string | null
  unreadCount: number
}

export interface AuctionSubscriptionItem {
  id: string
  filter: unknown
  channel: string
  frequency: string
  status: string
  createdAt: string
  updatedAt: string
}

export interface AuctionSubscriptionListResponse {
  items: AuctionSubscriptionItem[]
}

export interface UnsubscribeResponse {
  success: boolean
  message?: string
}

export const SUBSCRIPTION_CHANNELS = ['email', 'sms'] as const
export type SubscriptionChannel = (typeof SUBSCRIPTION_CHANNELS)[number]

export const SUBSCRIPTION_FREQUENCIES = ['immediate', 'daily', 'weekly'] as const
export type SubscriptionFrequency = (typeof SUBSCRIPTION_FREQUENCIES)[number]

export interface NotificationEventDef {
  value: string
  chipLabel: string
  settingsLabel: string
  settingsDescription: string
  emailAvailable: boolean
  smsAvailable: boolean
  effectiveEmail: boolean
  effectiveSms: boolean
}

// Mirrors DomainEventType and eventChannels in src/lib/notifications:
// 8 events; bid.approved/bid.rejected are in-app only; SMS only for
// auction.won and contract.ready. effective* are the defaults applied when
// the user has no stored preference for that event.
export const NOTIFICATION_EVENTS: readonly NotificationEventDef[] = [
  {
    value: 'auction.published',
    chipLabel: 'Oksjon avaldatud',
    settingsLabel: 'Uus oksjon on avaldatud',
    settingsDescription: 'Uus oksjon vastab sinu tellitud otsingutele',
    emailAvailable: true,
    smsAvailable: false,
    effectiveEmail: true,
    effectiveSms: false,
  },
  {
    value: 'bid.created',
    chipLabel: 'Pakkumus registreeritud',
    settingsLabel: 'Pakkumus registreeritud',
    settingsDescription: 'Kui keegi pakub sinu müügis oleva objekti eest',
    emailAvailable: true,
    smsAvailable: false,
    effectiveEmail: true,
    effectiveSms: false,
  },
  {
    value: 'outbid',
    chipLabel: 'Üle pakutud',
    settingsLabel: 'Pakkumus on üle pakutud',
    settingsDescription: 'Kui sinu pakkumine üle pakutakse',
    emailAvailable: true,
    smsAvailable: false,
    effectiveEmail: true,
    effectiveSms: false,
  },
  {
    value: 'bid.approved',
    chipLabel: 'Pakkumus kinnitatud',
    settingsLabel: 'Müüja kinnitas pakkumuse',
    settingsDescription: 'Müüja kinnitas pakkumuse',
    emailAvailable: false,
    smsAvailable: false,
    effectiveEmail: false,
    effectiveSms: false,
  },
  {
    value: 'bid.rejected',
    chipLabel: 'Pakkumus tagasi lükatud',
    settingsLabel: 'Müüja lükkas pakkumuse tagasi',
    settingsDescription: 'Müüja lükkas pakkumuse tagasi',
    emailAvailable: false,
    smsAvailable: false,
    effectiveEmail: false,
    effectiveSms: false,
  },
  {
    value: 'auction.ended',
    chipLabel: 'Oksjon lõppenud',
    settingsLabel: 'Oksjon on lõppenud',
    settingsDescription: 'Võit või kaotus ja lõpphind',
    emailAvailable: true,
    smsAvailable: false,
    effectiveEmail: true,
    effectiveSms: false,
  },
  {
    value: 'auction.won',
    chipLabel: 'Oksjon võidetud',
    settingsLabel: 'Te võitsite oksjoni',
    settingsDescription: 'Võit ja järgmised sammud lepinguni',
    emailAvailable: true,
    smsAvailable: true,
    effectiveEmail: true,
    effectiveSms: false,
  },
  {
    value: 'contract.ready',
    chipLabel: 'Leping valmis',
    settingsLabel: 'Leping on allkirjastamiseks valmis',
    settingsDescription: 'Oksjonileping on koostatud ja ootab allkirja',
    emailAvailable: true,
    smsAvailable: true,
    effectiveEmail: true,
    effectiveSms: false,
  },
]

export type NotificationGroupId = 'bids' | 'auctions' | 'contracts'

// Group chips map to the domain events behind them; the API filters one
// event per request, so groups merge per-event pages client-side
// (mergeCategoryPages).
const GROUP_FILTERS: readonly {
  id: NotificationGroupId
  label: string
  events: readonly string[]
}[] = [
  {
    id: 'bids',
    label: 'Pakkumised',
    events: ['bid.created', 'outbid', 'bid.approved', 'bid.rejected'],
  },
  { id: 'auctions', label: 'Oksjonid', events: ['auction.published', 'auction.ended', 'auction.won'] },
  { id: 'contracts', label: 'Lepingud', events: ['contract.ready'] },
]

export type NotificationFilterId = 'all' | 'unread' | NotificationGroupId

// Demo filter chips (11-user-notifications.html): Kõik, Lugemata,
// Pakkumised, Oksjonid, Lepingud.
export const NOTIFICATION_FILTERS: readonly {
  id: NotificationFilterId
  label: string
  events: readonly string[] | null
}[] = [
  { id: 'all', label: 'Kõik', events: null },
  { id: 'unread', label: 'Lugemata', events: null },
  ...GROUP_FILTERS,
]

const ALL_FILTER = { id: 'all', label: 'Kõik', events: null } as const

type NotificationFilterDef = (typeof NOTIFICATION_FILTERS)[number]

export function notificationFilter(id: string): NotificationFilterDef {
  return NOTIFICATION_FILTERS.find((filter) => filter.id === id) ?? ALL_FILTER
}

export function notificationGroup(event: string): NotificationGroupId | null {
  const group = GROUP_FILTERS.find((filter) => filter.events.includes(event))
  return group !== undefined ? group.id : null
}

const GROUP_BADGE_LABELS: Record<NotificationGroupId, string> = {
  bids: 'Pakkumine',
  auctions: 'Oksjon',
  contracts: 'Leping',
}

export function notificationBadgeLabel(event: string): string {
  const group = notificationGroup(event)
  return group !== null ? GROUP_BADGE_LABELS[group] : 'Teavitus'
}

// Same values as ListingFilters (which keeps them module-private).
export const SPECIES_OPTIONS = [
  { value: 'ma', label: 'Mänd (MA)' },
  { value: 'ku', label: 'Kuusk (KU)' },
  { value: 'ks', label: 'Kask (KS)' },
  { value: 'ha', label: 'Haab (HA)' },
  { value: 'sa', label: 'Sanglepp (SA)' },
  { value: 'ta', label: 'Tamm (TA)' },
] as const

export const LOGGING_TYPE_OPTIONS = [
  { value: 'u', label: 'Uuendusraie (U)' },
  { value: 'h', label: 'Hooldusraie (H)' },
  { value: 't', label: 'Taastusraie (T)' },
  { value: 'l', label: 'Langu- ja kahjustuspuude raie (L)' },
  { value: 'r', label: 'Sanitaarraie (R)' },
] as const

export function subscriptionChannelLabel(value: string): string {
  return value === 'email' ? 'E-post' : value === 'sms' ? 'SMS' : value
}

export function subscriptionFrequencyLabel(value: string): string {
  return value === 'immediate'
    ? 'Kohe'
    : value === 'daily'
      ? 'Kord päevas'
      : value === 'weekly'
        ? 'Kord nädalas'
        : value
}

export function notificationChannelLabel(value: string): string {
  return value === 'email' ? 'E-post' : value === 'sms' ? 'SMS' : value === 'in_app' ? 'Rakendus' : value
}

export async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? `Päring ebaõnnestus (${String(response.status)})`)
  }
  return (await response.json()) as T
}

export function apiJsonBody<T>(url: string, method: 'POST' | 'PATCH', data: unknown): Promise<T> {
  return apiJson<T>(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export function asFilterRecord(filter: unknown): Record<string, unknown> {
  if (typeof filter !== 'object' || filter === null || Array.isArray(filter)) return {}
  return filter as Record<string, unknown>
}

/** Normalizes string | string[] | number cell values into unique CSV tokens. */
export function csvTokens(value: unknown): string[] {
  const list = Array.isArray(value) ? value : [value]
  const tokens: string[] = []
  for (const entry of list) {
    if (typeof entry !== 'string') continue
    for (const part of entry.split(',')) {
      const token = part.trim()
      if (token !== '' && !tokens.includes(token)) tokens.push(token)
    }
  }
  return tokens
}

export function csvText(value: unknown): string {
  return csvTokens(value).join(', ')
}

export function parseCsvText(text: string): string[] {
  const tokens: string[] = []
  for (const part of text.split(',')) {
    const token = part.trim()
    if (token !== '' && !tokens.includes(token)) tokens.push(token)
  }
  return tokens
}

function optionLabel(
  options: readonly { value: string; label: string }[],
  value: string,
): string {
  return options.find((option) => option.value === value)?.label ?? value
}

/** Estonian chips for the filter keys shared with the listing filters. */
export function filterChips(filter: unknown): string[] {
  const data = asFilterRecord(filter)
  const chips: string[] = []

  const tokenChip = (key: string, label: string, options?: readonly { value: string; label: string }[]) => {
    const values = csvTokens(data[key])
    if (values.length === 0) return
    const rendered = options === undefined ? values : values.map((value) => optionLabel(options, value))
    chips.push(`${label}: ${rendered.join(', ')}`)
  }
  const rangeChip = (minKey: string, maxKey: string, label: string, unit: string) => {
    const min = typeof data[minKey] === 'number' ? (data[minKey]) : undefined
    const max = typeof data[maxKey] === 'number' ? (data[maxKey]) : undefined
    if (min === undefined && max === undefined) return
    if (min !== undefined && max !== undefined) {
      chips.push(`${label}: ${String(min)}–${String(max)} ${unit}`)
    } else if (min !== undefined) {
      chips.push(`${label}: alates ${String(min)} ${unit}`)
    } else {
      chips.push(`${label}: kuni ${String(max)} ${unit}`)
    }
  }

  tokenChip('county', 'Maakond')
  tokenChip('parish', 'Vald')
  tokenChip('species', 'Puuliik', SPECIES_OPTIONS)
  tokenChip('loggingType', 'Raieliik', LOGGING_TYPE_OPTIONS)
  rangeChip('areaMin', 'areaMax', 'Pindala', 'ha')
  rangeChip('volumeMin', 'volumeMax', 'Maht', 'm³')
  rangeChip('priceMin', 'priceMax', 'Hind', '€')
  return chips
}

/** Deep link from a notification payload; payloads carry auctionId. */
export function deepLinkFor(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null
  const auctionId = (payload as Record<string, unknown>).auctionId
  if (typeof auctionId !== 'string' || auctionId.trim() === '') return null
  return `/oksjon/${auctionId.trim()}`
}

export function formatEstonianDateTime(iso: string): string {
  return new Date(iso).toLocaleString('et-EE', { dateStyle: 'medium', timeStyle: 'short' })
}

// Demo meta line (11-user-notifications.html): "2 tundi tagasi", falling
// back to a D.MM date after a week.
export function formatRelativeEstonian(iso: string, now: Date = new Date()): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60_000)
  if (minutes < 1) return 'just nüüd'
  if (minutes < 60) return minutes === 1 ? '1 minut tagasi' : `${String(minutes)} minutit tagasi`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return hours === 1 ? '1 tund tagasi' : `${String(hours)} tundi tagasi`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'eile'
  if (days < 7) return `${String(days)} päeva tagasi`
  return new Intl.DateTimeFormat('et-EE', { day: 'numeric', month: '2-digit' }).format(date)
}

// Merges per-event pages (each already newest-first) into one demo page of
// up to pageSize items. A nextCursor exists only while at least one event
// returned a full page; the server cursor is inclusive (createdAt <= cursor),
// so the next fetch re-serves the boundary items and deduplication by id
// removes the overlap.
export function mergeCategoryPages(
  pages: readonly NotificationItem[][],
  pageSize = 25,
): { items: NotificationItem[]; nextCursor: string | null } {
  const seen = new Set<string>()
  const merged: NotificationItem[] = []
  for (const item of pages.flat().sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    merged.push(item)
  }
  const hasFullPage = pages.some((page) => page.length >= pageSize)
  if (!hasFullPage) return { items: merged, nextCursor: null }
  const items = merged.slice(0, pageSize)
  const cursorItem = items[items.length - 1]
  return { items, nextCursor: cursorItem?.createdAt ?? null }
}
