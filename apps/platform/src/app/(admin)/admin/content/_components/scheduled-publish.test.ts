import { describe, expect, it } from 'vitest'

import {
  contentPublicPath,
  redirectPathsForSlugChange,
  resolvePublishDecision,
  tallinnWallTimeToUtcIso,
  utcIsoToTallinnInputValue,
} from './scheduled-publish'

describe('tallinnWallTimeToUtcIso', () => {
  it('converts summer wall time (EEST, UTC+3)', () => {
    expect(tallinnWallTimeToUtcIso('2026-07-01T12:00')).toBe('2026-07-01T09:00:00.000Z')
  })

  it('converts winter wall time (EET, UTC+2)', () => {
    expect(tallinnWallTimeToUtcIso('2026-01-15T12:00')).toBe('2026-01-15T10:00:00.000Z')
  })

  it('accepts a space separator and trailing whitespace', () => {
    expect(tallinnWallTimeToUtcIso(' 2026-07-01 12:00 ')).toBe('2026-07-01T09:00:00.000Z')
  })

  it('rejects invalid input', () => {
    expect(tallinnWallTimeToUtcIso('')).toBeNull()
    expect(tallinnWallTimeToUtcIso('2026-07-01')).toBeNull()
    expect(tallinnWallTimeToUtcIso('2026-07-01T25:00')).toBeNull()
    expect(tallinnWallTimeToUtcIso('2026-13-01T12:00')).toBeNull()
    expect(tallinnWallTimeToUtcIso('nope')).toBeNull()
  })
})

describe('utcIsoToTallinnInputValue', () => {
  it('formats UTC instants as Tallinn wall time', () => {
    expect(utcIsoToTallinnInputValue('2026-07-01T09:00:00.000Z')).toBe('2026-07-01T12:00')
    expect(utcIsoToTallinnInputValue('2026-01-15T10:00:00.000Z')).toBe('2026-01-15T12:00')
  })

  it('returns an empty string for missing or invalid values', () => {
    expect(utcIsoToTallinnInputValue(null)).toBe('')
    expect(utcIsoToTallinnInputValue(undefined)).toBe('')
    expect(utcIsoToTallinnInputValue('nope')).toBe('')
  })

  it('round-trips through the wall-time converter', () => {
    const iso = '2026-07-01T09:00:00.000Z'
    const roundTripped = tallinnWallTimeToUtcIso(utcIsoToTallinnInputValue(iso))
    expect(roundTripped).toBe(iso)
  })
})

describe('resolvePublishDecision', () => {
  const now = '2026-09-05T09:00:00.000Z'

  it('draft clears the publish time when the field is empty', () => {
    expect(
      resolvePublishDecision({
        requestedStatus: 'draft',
        publishAtIso: null,
        currentPublishedAt: '2026-01-01T00:00:00.000Z',
        currentStatus: 'published',
        nowIso: now,
      }),
    ).toEqual({ status: 'draft', publishedAt: null, scheduled: false, publishTransition: false })
  })

  it('a future publish time schedules the row as a draft', () => {
    const future = '2026-12-01T10:00:00.000Z'
    expect(
      resolvePublishDecision({
        requestedStatus: 'published',
        publishAtIso: future,
        currentPublishedAt: null,
        currentStatus: null,
        nowIso: now,
      }),
    ).toEqual({ status: 'draft', publishedAt: future, scheduled: true, publishTransition: false })
  })

  it('an existing future publish time keeps the row scheduled', () => {
    const future = '2026-12-01T10:00:00.000Z'
    expect(
      resolvePublishDecision({
        requestedStatus: 'published',
        publishAtIso: null,
        currentPublishedAt: future,
        currentStatus: 'draft',
        nowIso: now,
      }),
    ).toEqual({ status: 'draft', publishedAt: future, scheduled: true, publishTransition: false })
  })

  it('a first publish stamps now', () => {
    expect(
      resolvePublishDecision({
        requestedStatus: 'published',
        publishAtIso: null,
        currentPublishedAt: null,
        currentStatus: null,
        nowIso: now,
      }),
    ).toEqual({ status: 'published', publishedAt: now, scheduled: false, publishTransition: true })
  })

  it('republishing a draft keeps the previous publishedAt', () => {
    const past = '2026-01-01T00:00:00.000Z'
    expect(
      resolvePublishDecision({
        requestedStatus: 'published',
        publishAtIso: null,
        currentPublishedAt: past,
        currentStatus: 'draft',
        nowIso: now,
      }),
    ).toEqual({ status: 'published', publishedAt: past, scheduled: false, publishTransition: true })
  })

  it('re-saving a published row does not re-date or re-publish', () => {
    const past = '2026-01-01T00:00:00.000Z'
    expect(
      resolvePublishDecision({
        requestedStatus: 'published',
        publishAtIso: null,
        currentPublishedAt: past,
        currentStatus: 'published',
        nowIso: now,
      }),
    ).toEqual({ status: 'published', publishedAt: past, scheduled: false, publishTransition: false })
  })

  it('an explicit past publish time wins over the stored value', () => {
    const past = '2026-02-02T08:00:00.000Z'
    expect(
      resolvePublishDecision({
        requestedStatus: 'published',
        publishAtIso: past,
        currentPublishedAt: null,
        currentStatus: 'draft',
        nowIso: now,
      }),
    ).toEqual({ status: 'published', publishedAt: past, scheduled: false, publishTransition: true })
  })
})

describe('public path conventions', () => {
  it('builds collection specific public paths', () => {
    expect(contentPublicPath('articles', 'uuendus')).toBe('/artiklid/uuendus')
    expect(contentPublicPath('pages', 'meist')).toBe('/meist')
    expect(contentPublicPath('legal-documents', 'kasutustingimused')).toBe(
      '/lepingud/dokumendid/kasutustingimused',
    )
  })

  it('builds redirect pairs for slug changes', () => {
    expect(redirectPathsForSlugChange('articles', 'vana', 'uus')).toEqual({
      from: '/artiklid/vana',
      to: '/artiklid/uus',
    })
  })
})
