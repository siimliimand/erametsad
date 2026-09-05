import type { ContentStatus } from '@/lib/data/schema'

/**
 * Pure helpers for draft/publish/scheduled publishing (spec delta
 * admin-governance). Scheduled publishing is stored as a future
 * `publishedAt` on a draft row; the content actions sweep due rows to
 * `published` before every write (lazy evaluation; no runtime trigger yet).
 * Scheduling input is wall time in Europe/Tallinn per the spec.
 */

export const TALLINN_TIME_ZONE = 'Europe/Tallinn'

const WALL_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})$/

/** Offset of `timeZone` at the given instant (ms east of UTC). */
function zoneOffsetMs(instantMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(instantMs))
  const value = (type: string): number =>
    Number(parts.find((part) => part.type === type)?.value ?? '0')
  const wallAsUtc = Date.UTC(
    value('year'),
    value('month') - 1,
    value('day'),
    value('hour'),
    value('minute'),
    value('second'),
  )
  return wallAsUtc - instantMs
}

/**
 * Converts a datetime-local wall time (Europe/Tallinn) to a UTC ISO-8601
 * string. Two offset passes handle instants that fall into a DST shift.
 * Returns null for missing or impossible input.
 */
export function tallinnWallTimeToUtcIso(value: string): string | null {
  const match = WALL_TIME_PATTERN.exec(value.trim())
  if (!match) {
    return null
  }
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const hour = Number(match[4])
  const minute = Number(match[5])
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) {
    return null
  }
  const wallAsUtc = Date.UTC(year, month - 1, day, hour, minute)
  const firstPass = wallAsUtc - zoneOffsetMs(wallAsUtc, TALLINN_TIME_ZONE)
  const secondPass = wallAsUtc - zoneOffsetMs(firstPass, TALLINN_TIME_ZONE)
  const date = new Date(secondPass)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

/** Formats a stored UTC ISO string as a datetime-local value in Tallinn wall time. */
export function utcIsoToTallinnInputValue(iso: string | null | undefined): string {
  if (!iso) {
    return ''
  }
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TALLINN_TIME_ZONE,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(date)
  const value = (type: string): string =>
    parts.find((part) => part.type === type)?.value ?? '00'
  return `${value('year')}-${value('month')}-${value('day')}T${value('hour')}:${value('minute')}`
}

export interface PublishDecisionInput {
  requestedStatus: ContentStatus
  /** User-provided publish time (UTC ISO) or null when the field is empty. */
  publishAtIso: string | null
  currentPublishedAt: string | null
  currentStatus: ContentStatus | null
  nowIso: string
}

export interface PublishDecision {
  status: ContentStatus
  publishedAt: string | null
  /** True when the requested publish lands in the future (row stays draft). */
  scheduled: boolean
  /** True when an existing draft row turns published right now. */
  publishTransition: boolean
}

/**
 * Single source of truth for the status/publishedAt outcome of a save:
 * - a future publish time keeps the row a draft (scheduled publishing),
 * - publishing keeps the existing publishedAt (no re-dating on edits),
 * - a first publish stamps `now`.
 */
export function resolvePublishDecision(input: PublishDecisionInput): PublishDecision {
  if (input.requestedStatus === 'draft') {
    return {
      status: 'draft',
      publishedAt: input.publishAtIso,
      scheduled: false,
      publishTransition: false,
    }
  }
  const effective = input.publishAtIso ?? input.currentPublishedAt
  if (effective !== null && effective > input.nowIso) {
    return {
      status: 'draft',
      publishedAt: effective,
      scheduled: true,
      publishTransition: false,
    }
  }
  return {
    status: 'published',
    publishedAt: input.publishAtIso ?? input.currentPublishedAt ?? input.nowIso,
    scheduled: false,
    publishTransition: input.currentStatus !== 'published',
  }
}

export type PublishedSlugCollection = 'pages' | 'articles' | 'legal-documents'

/** Public URL conventions for slug-bearing published collections. */
export function contentPublicPath(collection: PublishedSlugCollection, slug: string): string {
  switch (collection) {
    case 'articles':
      return `/artiklid/${slug}`
    case 'legal-documents':
      return `/lepingud/dokumendid/${slug}`
    case 'pages':
      return `/${slug}`
  }
}

/** Old-slug -> new-slug redirect pair offered on published slug changes. */
export function redirectPathsForSlugChange(
  collection: PublishedSlugCollection,
  oldSlug: string,
  newSlug: string,
): { from: string; to: string } {
  return {
    from: contentPublicPath(collection, oldSlug),
    to: contentPublicPath(collection, newSlug),
  }
}
