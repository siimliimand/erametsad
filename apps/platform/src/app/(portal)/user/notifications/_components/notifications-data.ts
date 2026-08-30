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
  emailAvailable: boolean
  smsAvailable: boolean
  effectiveEmail: boolean
  effectiveSms: boolean
}

// Mirrors DomainEventType and eventChannels in src/lib/notifications:
// 7 events; bid.approved/bid.rejected are in-app only; SMS only for
// auction.won and contract.ready. effective* are the service's hardcoded
// defaults — per-event preference storage does not exist yet.
export const NOTIFICATION_EVENTS: readonly NotificationEventDef[] = [
  {
    value: 'bid.created',
    chipLabel: 'Pakkumus registreeritud',
    settingsLabel: 'Pakkumus registreeritud',
    emailAvailable: true,
    smsAvailable: false,
    effectiveEmail: true,
    effectiveSms: false,
  },
  {
    value: 'outbid',
    chipLabel: 'Üle pakutud',
    settingsLabel: 'Pakkumus on üle pakutud',
    emailAvailable: true,
    smsAvailable: false,
    effectiveEmail: true,
    effectiveSms: false,
  },
  {
    value: 'bid.approved',
    chipLabel: 'Pakkumus kinnitatud',
    settingsLabel: 'Müüja kinnitas pakkumuse',
    emailAvailable: false,
    smsAvailable: false,
    effectiveEmail: false,
    effectiveSms: false,
  },
  {
    value: 'bid.rejected',
    chipLabel: 'Pakkumus tagasi lükatud',
    settingsLabel: 'Müüja lükkas pakkumuse tagasi',
    emailAvailable: false,
    smsAvailable: false,
    effectiveEmail: false,
    effectiveSms: false,
  },
  {
    value: 'auction.ended',
    chipLabel: 'Oksjon lõppenud',
    settingsLabel: 'Oksjon on lõppenud',
    emailAvailable: true,
    smsAvailable: false,
    effectiveEmail: true,
    effectiveSms: false,
  },
  {
    value: 'auction.won',
    chipLabel: 'Oksjon võidetud',
    settingsLabel: 'Te võitsite oksjoni',
    emailAvailable: true,
    smsAvailable: true,
    effectiveEmail: true,
    effectiveSms: false,
  },
  {
    value: 'contract.ready',
    chipLabel: 'Leping valmis',
    settingsLabel: 'Leping on allkirjastamiseks valmis',
    emailAvailable: true,
    smsAvailable: true,
    effectiveEmail: true,
    effectiveSms: false,
  },
]

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
