import type { AccessTokenPayload } from '@/lib/auth/jwt'
import type { AuctionDoc, CoreRepositories, WhereField } from '@/lib/data/repositories'
import { centsToEuros, eurosToCents } from '@/lib/data/repositories'
import type {
  AuctionObjectType,
  AuctionStatus,
  AuctionType,
  Bid,
  BidSource,
} from '@/lib/data/schema'
import { auctionObjectTypes, auctionStatuses } from '@/lib/data/schema'

// Shared read-side shaping for the public auction APIs. Server components
// (tasks 3.1, 4.1, 5.1) and the REST routes import the same helpers so role
// shaping happens once, at the data boundary (design D2/D5).

export const PUBLIC_AUCTION_STATUSES: readonly AuctionStatus[] = auctionStatuses.filter(
  (status) => status !== 'draft',
)

export const DEFAULT_AUCTION_LIST_LIMIT = 12
export const MAX_AUCTION_LIST_LIMIT = 100

export class AuctionQueryError extends Error {}

export interface AuctionViewer {
  userId: string
  activeProfileId?: string | undefined
}

export function viewerFromTokenPayload(
  payload: AccessTokenPayload | null,
): AuctionViewer | null {
  if (!payload) return null
  return {
    userId: payload.userId,
    ...(payload.activeProfileId !== undefined
      ? { activeProfileId: payload.activeProfileId }
      : {}),
  }
}

// ── Filters ─────────────────────────────────────────────────────────────

const SORT_FIELDS = ['startPrice', 'endPrice', 'endTime'] as const
export type AuctionSortField = (typeof SORT_FIELDS)[number]
export type AuctionSortDirection = 'asc' | 'desc'

export interface AuctionRangeFilter {
  min?: number | undefined
  max?: number | undefined
}

export interface AuctionFilters {
  objectTypes: AuctionObjectType[]
  statuses: AuctionStatus[]
  countyTokens: string[]
  parishTokens: string[]
  species: string[]
  loggingTypes: string[]
  area: AuctionRangeFilter
  volume: AuctionRangeFilter
  price: AuctionRangeFilter
  sortField: AuctionSortField
  sortDirection: AuctionSortDirection
  page: number
  limit: number
  map: boolean
}

function csvTokens(params: URLSearchParams, key: string): string[] {
  const tokens: string[] = []
  for (const value of params.getAll(key)) {
    for (const part of value.split(',')) {
      const token = part.trim().toLowerCase()
      if (token !== '') tokens.push(token)
    }
  }
  return tokens
}

function enumTokens<TValue extends string>(
  tokens: string[],
  allowed: readonly TValue[],
  error: string,
): TValue[] {
  if (tokens.length === 0) return []
  const set = new Set<string>(allowed)
  const matched: TValue[] = []
  for (const token of tokens) {
    if (!set.has(token)) {
      throw new AuctionQueryError(error)
    }
    matched.push(token as TValue)
  }
  return [...new Set(matched)]
}

function numberParam(
  params: URLSearchParams,
  key: string,
  error: string,
): number | undefined {
  const raw = params.get(key)
  if (raw === null || raw.trim() === '') return undefined
  const value = Number(raw)
  // The cap keeps price values inside the exact cents range of the
  // money helpers and rejects nonsense ranges for area/volume too.
  if (!Number.isFinite(value) || value < 0 || value > 1e9) {
    throw new AuctionQueryError(error)
  }
  return value
}

function rangeParams(
  params: URLSearchParams,
  minKey: string,
  maxKey: string,
  error: string,
): AuctionRangeFilter {
  const min = numberParam(params, minKey, error)
  const max = numberParam(params, maxKey, error)
  return {
    ...(min !== undefined ? { min } : {}),
    ...(max !== undefined ? { max } : {}),
  }
}

export function parseAuctionSearchParams(params: URLSearchParams): AuctionFilters {
  const rawSort = (params.get('sort') ?? '').trim()
  const sortDescending = rawSort.startsWith('-')
  const rawSortField = sortDescending ? rawSort.slice(1) : rawSort
  let sortField: AuctionSortField = 'endTime'
  if (rawSortField !== '') {
    // The portal serializes camelCase keys (serializeListingFilters writes
    // sort=endPrice), so matching stays case-insensitive over the constants.
    const matched = SORT_FIELDS.find(
      (field) => field.toLowerCase() === rawSortField.toLowerCase(),
    )
    if (matched === undefined) {
      throw new AuctionQueryError('Vale sortimisväli')
    }
    sortField = matched
  }
  const rawOrder = (params.get('order') ?? '').trim().toLowerCase()
  const sortDirection: AuctionSortDirection =
    rawOrder === 'desc' ? 'desc' : rawOrder === 'asc' ? 'asc' : sortDescending ? 'desc' : 'asc'

  const rawPage = Number(params.get('page') ?? '1')
  const rawLimit = Number(params.get('limit') ?? String(DEFAULT_AUCTION_LIST_LIMIT))

  return {
    objectTypes: enumTokens(
      csvTokens(params, 'objectType'),
      ['raieoigus', 'kinnistu', 'kiire', 'pakett'],
      'Vale objektitüübi filter',
    ),
    statuses: enumTokens(
      csvTokens(params, 'auctionStatus'),
      PUBLIC_AUCTION_STATUSES,
      'Vale oleku filter',
    ),
    countyTokens: csvTokens(params, 'county'),
    parishTokens: csvTokens(params, 'parish'),
    species: csvTokens(params, 'species'),
    loggingTypes: csvTokens(params, 'loggingType'),
    area: rangeParams(params, 'areaMin', 'areaMax', 'Vale pindala'),
    volume: rangeParams(params, 'volumeMin', 'volumeMax', 'Vale maht'),
    price: rangeParams(params, 'priceMin', 'priceMax', 'Vale hind'),
    sortField,
    sortDirection,
    page: Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1,
    limit: Number.isFinite(rawLimit)
      ? Math.min(Math.max(Math.floor(rawLimit), 1), MAX_AUCTION_LIST_LIMIT)
      : DEFAULT_AUCTION_LIST_LIMIT,
    map: params.get('map') === '1',
  }
}

// ── Value coercion helpers ──────────────────────────────────────────────

function isoOrNull(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string' && value !== '') return value
  return null
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => typeof entry === 'string')
}

// Seed and admin data store logging types as `{code}` objects; keep the
// code strings so the dossier does not drop them like stringList would.
function loggingTypeCodes(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => {
      if (typeof entry === 'string') return entry
      if (typeof entry === 'object' && entry !== null) {
        const code = (entry as Record<string, unknown>).code
        if (typeof code === 'string') return code
      }
      return null
    })
    .filter((code): code is string => code !== null)
}

function coordinatesOf(value: unknown): { lat: number; lng: number } | null {
  if (Array.isArray(value)) {
    const coords: unknown[] = value
    if (coords.length >= 2) {
      const lat = coords[0]
      const lng = coords[1]
      if (typeof lat === 'number' && typeof lng === 'number') return { lat, lng }
    }
    return null
  }
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>
    if (typeof record.lat === 'number' && typeof record.lng === 'number') {
      return { lat: record.lat, lng: record.lng }
    }
  }
  return null
}

function imageOf(value: unknown): string | null {
  if (!Array.isArray(value)) return null
  for (const entry of value) {
    if (typeof entry === 'object' && entry !== null) {
      const url = (entry as Record<string, unknown>).url
      if (typeof url === 'string' && url !== '') return url
    }
  }
  return null
}

const AREA_KEYS = ['area', 'ha', 'areaHa', 'area_ha'] as const
const VOLUME_KEYS = ['volume', 'volumeM3', 'volume_m3', 'm3'] as const

function firstNumber(record: Record<string, unknown>, keys: readonly string[]): number | null {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
      return Number(value)
    }
  }
  return null
}

export interface PackageTotals {
  area: number | null
  volume: number | null
}

/**
 * Best-effort area (ha) and volume (m³) totals from the free-form
 * packageRows JSON. Seed shapes use `area`/`volume`, `ha`, or `area_ha`
 * keys; rows without parseable values are skipped.
 */
export function packageTotals(packageRows: unknown): PackageTotals {
  if (!Array.isArray(packageRows)) return { area: null, volume: null }
  let area = 0
  let volume = 0
  let areaSeen = false
  let volumeSeen = false
  for (const row of packageRows) {
    if (typeof row !== 'object' || row === null) continue
    const record = row as Record<string, unknown>
    const areaValue = firstNumber(record, AREA_KEYS)
    if (areaValue !== null) {
      area += areaValue
      areaSeen = true
    }
    const volumeValue = firstNumber(record, VOLUME_KEYS)
    if (volumeValue !== null) {
      volume += volumeValue
      volumeSeen = true
    }
  }
  return { area: areaSeen ? area : null, volume: volumeSeen ? volume : null }
}

// ── Filter matching on the fetched docs ─────────────────────────────────

const SPECIES_CODE_NAMES: Readonly<Record<string, string>> = {
  ma: 'mänd',
  ku: 'kuusk',
  ks: 'kask',
  ha: 'haab',
  sa: 'sanglepp',
  ta: 'tamm',
}

function matchesSpecies(stored: unknown, tokens: string[]): boolean {
  if (tokens.length === 0) return true
  const names = new Set(stringList(stored).map((name) => name.toLowerCase()))
  if (names.size === 0) return false
  return tokens.some(
    (token) =>
      names.has(token) ||
      (SPECIES_CODE_NAMES[token] !== undefined && names.has(SPECIES_CODE_NAMES[token])),
  )
}

function storedLoggingCodes(stored: unknown): Set<string> {
  const codes = new Set<string>()
  if (!Array.isArray(stored)) return codes
  for (const entry of stored) {
    if (typeof entry === 'string') {
      codes.add(entry.toLowerCase())
      continue
    }
    if (typeof entry === 'object' && entry !== null) {
      const code = (entry as Record<string, unknown>).code
      if (typeof code === 'string') codes.add(code.toLowerCase())
    }
  }
  return codes
}

function matchesLoggingTypes(stored: unknown, tokens: string[]): boolean {
  if (tokens.length === 0) return true
  const codes = storedLoggingCodes(stored)
  if (codes.size === 0) return false
  return tokens.some((token) => codes.has(token))
}

function matchesRange(value: number | null, range: AuctionRangeFilter): boolean {
  if (range.min === undefined && range.max === undefined) return true
  if (value === null) return false
  if (range.min !== undefined && value < range.min) return false
  if (range.max !== undefined && value > range.max) return false
  return true
}

function matchesFilters(doc: AuctionDoc, filters: AuctionFilters): boolean {
  const totals = packageTotals(doc.packageRows)
  if (filters.price.min !== undefined && doc.minBidCents < eurosToCents(filters.price.min)) {
    return false
  }
  if (filters.price.max !== undefined && doc.minBidCents > eurosToCents(filters.price.max)) {
    return false
  }
  return (
    matchesRange(totals.area, filters.area) &&
    matchesRange(totals.volume, filters.volume) &&
    matchesSpecies(doc.species, filters.species) &&
    matchesLoggingTypes(doc.loggingTypes, filters.loggingTypes)
  )
}

// ── Sorting ─────────────────────────────────────────────────────────────

function sortValue(doc: AuctionDoc, field: AuctionSortField): number | null {
  if (field === 'startPrice') return doc.minBidCents
  if (field === 'endPrice') return doc.finalPriceCents
  const time = isoOrNull(doc.endsAt)
  if (time === null) return null
  const parsed = Date.parse(time)
  return Number.isNaN(parsed) ? null : parsed
}

function sortDocs(docs: AuctionDoc[], field: AuctionSortField, direction: AuctionSortDirection): AuctionDoc[] {
  const factor = direction === 'desc' ? -1 : 1
  return [...docs].sort((a, b) => {
    const aValue = sortValue(a, field)
    const bValue = sortValue(b, field)
    if (aValue === null && bValue === null) return a.id < b.id ? -1 : 1
    if (aValue === null) return 1
    if (bValue === null) return -1
    if (aValue !== bValue) return factor * (aValue - bValue)
    return a.id < b.id ? -1 : 1
  })
}

// ── Location lookups ────────────────────────────────────────────────────

interface LocationLookups {
  countyById: Map<string, { id: string; name: string; code: string }>
  parishById: Map<string, { id: string; name: string }>
}

async function locationLookups(repos: CoreRepositories): Promise<LocationLookups> {
  const [countiesResult, parishesResult] = await Promise.all([
    repos.find({ collection: 'counties', pagination: false }),
    repos.find({ collection: 'parishes', pagination: false }),
  ])
  const countyById = new Map(
    countiesResult.docs.map((county) => [county.id, { id: county.id, name: county.name, code: county.code }]),
  )
  const parishById = new Map(
    parishesResult.docs.map((parish) => [parish.id, { id: parish.id, name: parish.name }]),
  )
  return { countyById, parishById }
}

async function resolveCountyIds(
  repos: CoreRepositories,
  tokens: string[],
): Promise<string[] | null> {
  if (tokens.length === 0) return null
  const { docs } = await repos.find({ collection: 'counties', pagination: false })
  const matched = docs.filter(
    (county) =>
      tokens.includes(county.id.toLowerCase()) ||
      tokens.includes(county.code.toLowerCase()) ||
      tokens.includes(county.name.toLowerCase()),
  )
  return matched.map((county) => county.id)
}

async function resolveParishIds(
  repos: CoreRepositories,
  tokens: string[],
  countyIds: string[] | null,
): Promise<string[] | null> {
  if (tokens.length === 0) return null
  const { docs } = await repos.find({ collection: 'parishes', pagination: false })
  const scoped =
    countyIds !== null && countyIds.length > 0
      ? docs.filter((parish) => countyIds.includes(parish.countyId))
      : docs
  const matched = scoped.filter(
    (parish) =>
      tokens.includes(parish.id.toLowerCase()) || tokens.includes(parish.name.toLowerCase()),
  )
  return matched.map((parish) => parish.id)
}

// ── Summary shape ───────────────────────────────────────────────────────

export interface AuctionSummary {
  id: string
  slug: string
  title: string
  objectType: AuctionObjectType
  type: AuctionType
  isQuickAuction: boolean
  status: AuctionStatus
  endYear: number | null
  county: { id: string; name: string; code: string } | null
  parish: { id: string; name: string } | null
  address: string | null
  minBid: number
  finalPrice: number | null
  area: number | null
  volume: number | null
  species: string[]
  startsAt: string | null
  endsAt: string | null
  coordinates: { lat: number; lng: number } | null
  image: string | null
}

function auctionSummary(doc: AuctionDoc, lookups: LocationLookups): AuctionSummary {
  const totals = packageTotals(doc.packageRows)
  return {
    id: doc.id,
    slug: doc.slug,
    title: doc.title,
    objectType: doc.objectType,
    type: doc.type,
    isQuickAuction: doc.isQuickAuction,
    status: doc.status,
    endYear: doc.endYear,
    county:
      doc.countyId !== null ? (lookups.countyById.get(doc.countyId) ?? null) : null,
    parish:
      doc.parishId !== null ? (lookups.parishById.get(doc.parishId) ?? null) : null,
    address: doc.address,
    minBid: centsToEuros(doc.minBidCents),
    finalPrice:
      doc.finalPriceCents === null ? null : centsToEuros(doc.finalPriceCents),
    area: totals.area,
    volume: totals.volume,
    species: stringList(doc.species),
    startsAt: isoOrNull(doc.startsAt),
    endsAt: isoOrNull(doc.endsAt),
    coordinates: coordinatesOf(doc.coordinates),
    image: imageOf(doc.media),
  }
}

// ── List endpoint ───────────────────────────────────────────────────────

export interface AuctionListResult {
  auctions: AuctionSummary[]
  total: number
  page: number
  limit: number
  totalPages: number
}

async function collectAuctionDocs(
  repos: CoreRepositories,
  filters: AuctionFilters,
): Promise<AuctionDoc[]> {
  const statuses =
    filters.statuses.length > 0 ? filters.statuses : [...PUBLIC_AUCTION_STATUSES]
  const countyIds = await resolveCountyIds(repos, filters.countyTokens)
  const parishIds = await resolveParishIds(repos, filters.parishTokens, countyIds)

  const where: Record<string, WhereField> = { status: { in: statuses } }
  if (filters.objectTypes.length > 0) {
    where.objectType = { in: filters.objectTypes }
  }
  if (countyIds !== null && countyIds.length === 0) return []
  if (countyIds !== null) {
    where.county = { in: countyIds }
  }
  if (parishIds !== null && parishIds.length === 0) return []
  if (parishIds !== null) {
    where.parish = { in: parishIds }
  }

  const { docs } = await repos.find({
    collection: 'auctions',
    where,
    pagination: false,
    sort: 'id',
  })
  return docs.filter((doc) => matchesFilters(doc, filters))
}

export async function listAuctions(
  repos: CoreRepositories,
  searchParams: URLSearchParams,
): Promise<AuctionListResult> {
  const filters = parseAuctionSearchParams(searchParams)
  const docs = sortDocs(await collectAuctionDocs(repos, filters), filters.sortField, filters.sortDirection)
  const lookups = await locationLookups(repos)
  const summaries = docs.map((doc) => auctionSummary(doc, lookups))
  const total = summaries.length
  const totalPages = Math.max(Math.ceil(total / filters.limit), 1)
  const page = Math.min(filters.page, totalPages)
  const start = (page - 1) * filters.limit
  return {
    auctions: summaries.slice(start, start + filters.limit),
    total,
    page,
    limit: filters.limit,
    totalPages,
  }
}

export async function listAuctionMapPoints(
  repos: CoreRepositories,
  searchParams: URLSearchParams,
): Promise<AuctionSummary[]> {
  const filters = parseAuctionSearchParams(searchParams)
  const docs = sortDocs(await collectAuctionDocs(repos, filters), filters.sortField, filters.sortDirection)
  const lookups = await locationLookups(repos)
  return docs.map((doc) => auctionSummary(doc, lookups))
}

// ── Active statistics for the portal listing tabs ───────────────────────

export interface ActiveAuctionTypeStats {
  count: number
  areaHa: number
  volumeM3: number
  minBidEur: number
}

/**
 * Per-objectType aggregates over status='active' auctions only. Powers the
 * portal tab counters and the Estonian summary sentence; the euro value is
 * the sum of start prices because finalPrice is null while active.
 */
export async function activeStatsByObjectType(
  repos: CoreRepositories,
): Promise<Record<AuctionObjectType, ActiveAuctionTypeStats>> {
  const { docs } = await repos.find({
    collection: 'auctions',
    where: { status: { equals: 'active' } },
    pagination: false,
    sort: 'id',
  })
  const stats = Object.fromEntries(
    auctionObjectTypes.map((objectType) => [
      objectType,
      { count: 0, areaHa: 0, volumeM3: 0, minBidEur: 0 },
    ]),
  ) as Record<AuctionObjectType, ActiveAuctionTypeStats>
  for (const doc of docs) {
    const totals = packageTotals(doc.packageRows)
    const bucket = stats[doc.objectType]
    bucket.count += 1
    bucket.areaHa += totals.area ?? 0
    bucket.volumeM3 += totals.volume ?? 0
    bucket.minBidEur += centsToEuros(doc.minBidCents)
  }
  return stats
}

// ── Archive lists and statistics (portal /ajalugu) ──────────────────────

/** Every status after the end; the archive never shows draft/scheduled/active. */
export const ARCHIVED_AUCTION_STATUSES: readonly AuctionStatus[] = auctionStatuses.filter(
  (status) => status !== 'draft' && status !== 'scheduled' && status !== 'active',
)

export interface ArchivedAuctionTypeStats {
  count: number
  /** End years with archive data, newest first; feeds the filter chips. */
  endYears: number[]
}

export async function archivedStatsByObjectType(
  repos: CoreRepositories,
): Promise<Record<AuctionObjectType, ArchivedAuctionTypeStats>> {
  const { docs } = await repos.find({
    collection: 'auctions',
    where: { status: { in: [...ARCHIVED_AUCTION_STATUSES] } },
    pagination: false,
    sort: 'id',
  })
  const stats = Object.fromEntries(
    auctionObjectTypes.map((objectType) => [objectType, { count: 0, endYears: [] as number[] }]),
  ) as Record<AuctionObjectType, ArchivedAuctionTypeStats>
  for (const doc of docs) {
    const bucket = stats[doc.objectType]
    bucket.count += 1
    if (doc.endYear !== null && !bucket.endYears.includes(doc.endYear)) {
      bucket.endYears.push(doc.endYear)
    }
  }
  for (const bucket of Object.values(stats)) bucket.endYears.sort((a, b) => b - a)
  return stats
}

function archivedEndYearTokens(params: URLSearchParams): number[] {
  const years: number[] = []
  for (const token of csvTokens(params, 'endYear')) {
    const value = Number(token)
    if (Number.isInteger(value) && value >= 1970 && value <= 2100 && !years.includes(value)) {
      years.push(value)
    }
  }
  return years
}

/**
 * Archive variant of listAuctions: defaults to archived statuses and
 * lõpphind desc, supports the endYear chip filter, and applies the price
 * range to finalPriceCents — the live list's price range matches the
 * start price, which is meaningless for ended lots.
 */
export async function listArchivedAuctions(
  repos: CoreRepositories,
  searchParams: URLSearchParams,
): Promise<AuctionListResult> {
  const filters = parseAuctionSearchParams(searchParams)
  const hasSortParam = searchParams.get('sort') !== null || searchParams.get('order') !== null
  if (!hasSortParam) {
    filters.sortField = 'endPrice'
    filters.sortDirection = 'desc'
  }
  const statuses =
    filters.statuses.length > 0 ? filters.statuses : [...ARCHIVED_AUCTION_STATUSES]
  const price = filters.price
  filters.statuses = statuses
  filters.price = {}
  const endYears = archivedEndYearTokens(searchParams)
  const docs = (await collectAuctionDocs(repos, filters)).filter((doc) => {
    if (
      price.min !== undefined &&
      (doc.finalPriceCents === null || doc.finalPriceCents < eurosToCents(price.min))
    ) {
      return false
    }
    if (
      price.max !== undefined &&
      (doc.finalPriceCents === null || doc.finalPriceCents > eurosToCents(price.max))
    ) {
      return false
    }
    return endYears.length === 0 || (doc.endYear !== null && endYears.includes(doc.endYear))
  })
  const sorted = sortDocs(docs, filters.sortField, filters.sortDirection)
  const lookups = await locationLookups(repos)
  const summaries = sorted.map((doc) => auctionSummary(doc, lookups))
  const total = summaries.length
  const totalPages = Math.max(Math.ceil(total / filters.limit), 1)
  const page = Math.min(filters.page, totalPages)
  const start = (page - 1) * filters.limit
  return {
    auctions: summaries.slice(start, start + filters.limit),
    total,
    page,
    limit: filters.limit,
    totalPages,
  }
}

// ── Bid loading and shaping ─────────────────────────────────────────────

async function loadBids(repos: CoreRepositories, auctionId: string): Promise<Bid[]> {
  const { docs } = await repos.find({
    collection: 'bids',
    where: { auction: { equals: auctionId } },
    pagination: false,
    sort: 'createdAt',
  })
  return docs
}

/** Stable anonymized index (time order) across every bid on the auction. */
function bidLabels(bids: Bid[]): Map<string, number> {
  const ordered = [...bids].sort((a, b) => {
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1
    return a.id < b.id ? -1 : 1
  })
  return new Map(ordered.map((bid, index) => [bid.id, index + 1]))
}

function isPubliclyVisible(bid: Bid): boolean {
  return bid.status !== 'pending_approval' && bid.status !== 'rejected'
}

function latestIso(bids: Bid[]): string | null {
  let latest: string | null = null
  for (const bid of bids) {
    const iso = isoOrNull(bid.createdAt)
    if (iso !== null && (latest === null || iso > latest)) latest = iso
  }
  return latest
}

export interface BidListRow {
  id: string
  amount: number
  label: string
  createdAt: string
  source: BidSource
  isOwn: boolean
}

export type AuctionBidView =
  | { kind: 'sealed'; bidCount: number | null }
  | { kind: 'guest'; bidCount: number; latestBidAt: string | null }
  | {
      kind: 'authed'
      bidCount: number
      latestBidAt: string | null
      leadingBidAmount: number | null
      bids: BidListRow[]
    }

/**
 * Role-shaped bid list (design D5). Sealed auctions disclose only the bid
 * count, and only while the auction has not ended; after the end the
 * anonymity rule hides even the count. Open auctions show guests a count
 * and the latest bid time; authed users get anonymized amount rows with
 * their own pending alapakkumine entries included.
 */
export async function getAuctionBids(
  repos: CoreRepositories,
  auctionId: string,
  viewer: AuctionViewer | null,
): Promise<AuctionBidView | null> {
  const auction = await repos.findByID({ collection: 'auctions', id: auctionId })
  if (!auction || auction.status === 'draft') return null
  const bids = await loadBids(repos, auctionId)

  if (auction.type === 'sealed') {
    const disclosed = auction.status === 'scheduled' || auction.status === 'active'
    return { kind: 'sealed', bidCount: disclosed ? bids.length : null }
  }

  const publicBids = bids.filter(isPubliclyVisible)
  if (!viewer) {
    return {
      kind: 'guest',
      bidCount: publicBids.length,
      latestBidAt: latestIso(publicBids),
    }
  }

  const labels = bidLabels(bids)
  const ownPending = bids.filter(
    (bid) => bid.status === 'pending_approval' && bid.userId === viewer.userId,
  )
  const visible = [...publicBids, ...ownPending]
  const rows: BidListRow[] = visible
    .sort((a, b) => {
      if (a.amountCents !== b.amountCents) return b.amountCents - a.amountCents
      if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1
      return a.id < b.id ? -1 : 1
    })
    .map((bid) => ({
      id: bid.id,
      amount: centsToEuros(bid.amountCents),
      label: `Pakkuja #${String(labels.get(bid.id) ?? 0)}`,
      createdAt: isoOrNull(bid.createdAt) ?? bid.createdAt,
      source: bid.source,
      isOwn: bid.userId === viewer.userId,
    }))

  const leading = publicBids.find((bid) => bid.status === 'leading') ?? null
  return {
    kind: 'authed',
    bidCount: publicBids.length,
    latestBidAt: latestIso(publicBids),
    leadingBidAmount: leading === null ? null : centsToEuros(leading.amountCents),
    bids: rows,
  }
}

// ── Detail (dossier) endpoint ───────────────────────────────────────────

export interface AuctionContact {
  aliasEmail: string | null
  specialist: {
    id: string
    name: string
    phone: string | null
    email: string | null
  } | null
}

export interface AuctionViewerParticipation {
  hasBid: boolean
  hasAutobidder: boolean
  isLeading: boolean
}

function packageColumnLabels(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => {
      if (typeof entry === 'string') return entry
      if (typeof entry === 'object' && entry !== null) {
        const record = entry as Record<string, unknown>
        for (const key of ['column', 'label', 'name']) {
          const candidate = record[key]
          if (typeof candidate === 'string') return candidate
        }
      }
      return null
    })
    .filter((label): label is string => label !== null)
}

export interface AuctionDossier extends AuctionSummary {
  bidStep: number | null
  vatIncluded: boolean
  activatedAt: string | null
  katasterLink: string | null
  metsaregisterLink: string | null
  cadastres: string[]
  registryNumbers: string[]
  loggingTypes: string[]
  compartments: string[]
  forestNotifications: unknown[]
  deadlines: unknown
  packageHeader: string | null
  packageRows: unknown[]
  packageColumns: string[]
  descriptionPublic: string | null
  files: unknown[]
  media: unknown[]
  contact: AuctionContact
  /** Sealed auctions only, before the end; null otherwise. */
  bidCount: number | null
  /** Authed callers on open, active auctions only. */
  leadingBidAmount: number | null
  participation: AuctionViewerParticipation | null
}

async function auctionContact(
  repos: CoreRepositories,
  doc: AuctionDoc,
): Promise<AuctionContact> {
  if (doc.specialistId === null) return { aliasEmail: doc.aliasEmail, specialist: null }
  const specialist = await repos.findByID({
    collection: 'specialists',
    id: doc.specialistId,
  })
  if (!specialist) return { aliasEmail: doc.aliasEmail, specialist: null }
  return {
    aliasEmail: doc.aliasEmail,
    specialist: {
      id: specialist.id,
      name: specialist.name,
      phone: specialist.phone,
      email: specialist.email,
    },
  }
}

/**
 * Full public dossier. `reservePriceCents`, `descriptionInternal`,
 * `sellerId`, and `winningBid` never leave this function.
 */
export async function getAuctionDossier(
  repos: CoreRepositories,
  auctionId: string,
  viewer: AuctionViewer | null,
): Promise<AuctionDossier | null> {
  const doc = await repos.findByID({ collection: 'auctions', id: auctionId })
  if (!doc || doc.status === 'draft') return null

  const [lookups, contact] = await Promise.all([
    locationLookups(repos),
    auctionContact(repos, doc),
  ])
  const summary = auctionSummary(doc, lookups)

  let bidCount: number | null = null
  if (doc.type === 'sealed' && (doc.status === 'scheduled' || doc.status === 'active')) {
    const bids = await loadBids(repos, doc.id)
    bidCount = bids.length
  }

  let leadingBidAmount: number | null = null
  let participation: AuctionViewerParticipation | null = null
  if (doc.type === 'open' && doc.status === 'active' && viewer !== null) {
    const bids = await loadBids(repos, doc.id)
    const publicBids = bids.filter(isPubliclyVisible)
    const leading = publicBids.find((bid) => bid.status === 'leading') ?? null
    leadingBidAmount = leading === null ? null : centsToEuros(leading.amountCents)
    const hasAutobidderDocs = await repos.find({
      collection: 'autobidders',
      where: {
        and: [
          { auction: { equals: doc.id } },
          { user: { equals: viewer.userId } },
          { status: { equals: 'active' } },
        ],
      },
      limit: 1,
    })
    participation = {
      hasBid: bids.some((bid) => bid.userId === viewer.userId && bid.status !== 'rejected'),
      hasAutobidder: hasAutobidderDocs.docs.length > 0,
      isLeading: leading !== null && leading.userId === viewer.userId,
    }
  }

  return {
    ...summary,
    bidStep: doc.bidStepCents === null ? null : centsToEuros(doc.bidStepCents),
    vatIncluded: doc.vatIncluded,
    activatedAt: isoOrNull(doc.activatedAt),
    katasterLink: doc.katasterLink,
    metsaregisterLink: doc.metsaregisterLink,
    cadastres: stringList(doc.cadastres),
    registryNumbers: stringList(doc.registryNumbers),
    loggingTypes: loggingTypeCodes(doc.loggingTypes),
    compartments: stringList(doc.compartments),
    forestNotifications: Array.isArray(doc.notifications) ? doc.notifications : [],
    deadlines: doc.deadlines ?? null,
    packageHeader: doc.packageHeader,
    packageRows: Array.isArray(doc.packageRows) ? doc.packageRows : [],
    packageColumns: packageColumnLabels(doc.packageColumns),
    descriptionPublic: doc.descriptionPublic,
    files: Array.isArray(doc.files) ? doc.files : [],
    media: Array.isArray(doc.media) ? doc.media : [],
    contact,
    bidCount,
    leadingBidAmount,
    participation,
  }
}
