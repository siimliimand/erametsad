import { describe, expect, it } from 'vitest'

import {
  formatRelativeEstonian,
  mergeCategoryPages,
  notificationBadgeLabel,
  notificationFilter,
  notificationGroup,
  NOTIFICATION_FILTERS,
  type NotificationItem,
} from '../notifications-data'

function item(id: string, createdAt: string, category = 'outbid'): NotificationItem {
  return {
    id,
    category,
    channel: 'in_app',
    title: `Teavitus ${id}`,
    body: null,
    payload: null,
    readAt: null,
    sentAt: null,
    createdAt,
  }
}

describe('NOTIFICATION_FILTERS', () => {
  it('matches the demo chip set Kõik, Lugemata, Pakkumised, Oksjonid, Lepingud', () => {
    expect(NOTIFICATION_FILTERS.map((filter) => filter.label)).toEqual([
      'Kõik',
      'Lugemata',
      'Pakkumised',
      'Oksjonid',
      'Lepingud',
    ])
  })

  it('groups cover every domain event', () => {
    const grouped = NOTIFICATION_FILTERS.flatMap((filter) => filter.events ?? [])
    expect(grouped).toContain('auction.published')
    expect(grouped).toContain('contract.ready')
    expect(grouped).toContain('outbid')
  })

  it('falls back to the Kõik filter for unknown ids', () => {
    expect(notificationFilter('nope').id).toBe('all')
  })

  it('maps events to their group and badge label', () => {
    expect(notificationGroup('outbid')).toBe('bids')
    expect(notificationGroup('auction.ended')).toBe('auctions')
    expect(notificationGroup('contract.ready')).toBe('contracts')
    expect(notificationGroup('mystery')).toBeNull()
    expect(notificationBadgeLabel('outbid')).toBe('Pakkumine')
    expect(notificationBadgeLabel('auction.won')).toBe('Oksjon')
    expect(notificationBadgeLabel('contract.ready')).toBe('Leping')
    expect(notificationBadgeLabel('mystery')).toBe('Teavitus')
  })
})

describe('formatRelativeEstonian', () => {
  const now = new Date('2026-09-10T12:00:00.000Z')

  it('renders just now, minutes and hours like the demo meta line', () => {
    expect(formatRelativeEstonian('2026-09-10T11:59:40.000Z', now)).toBe('just nüüd')
    expect(formatRelativeEstonian('2026-09-10T11:45:00.000Z', now)).toBe('15 minutit tagasi')
    expect(formatRelativeEstonian('2026-09-10T10:00:00.000Z', now)).toBe('2 tundi tagasi')
  })

  it('renders days and falls back to a D.MM date after a week', () => {
    expect(formatRelativeEstonian('2026-09-09T12:00:00.000Z', now)).toBe('eile')
    expect(formatRelativeEstonian('2026-09-06T12:00:00.000Z', now)).toBe('4 päeva tagasi')
    expect(formatRelativeEstonian('2026-08-27T12:00:00.000Z', now)).toBe('27.08')
  })

  it('returns an empty string for invalid input', () => {
    expect(formatRelativeEstonian('not-a-date', now)).toBe('')
  })
})

describe('mergeCategoryPages', () => {
  it('merges per-event pages newest first and dedupes', () => {
    const merged = mergeCategoryPages(
      [
        [item('a', '2026-09-10T10:00:00.000Z'), item('b', '2026-09-10T09:00:00.000Z')],
        [item('c', '2026-09-10T09:30:00.000Z'), item('a', '2026-09-10T10:00:00.000Z')],
      ],
      25,
    )
    expect(merged.items.map((entry) => entry.id)).toEqual(['a', 'c', 'b'])
    expect(merged.nextCursor).toBeNull()
  })

  it('caps the page and returns a boundary cursor only when a page was full', () => {
    const pages = [
      Array.from({ length: 25 }, (_, index) =>
        item(`x${String(index)}`, `2026-09-10T10:${String(index % 60).padStart(2, '0')}:00.000Z`),
      ),
    ]
    const merged = mergeCategoryPages(pages, 25)
    expect(merged.items).toHaveLength(25)
    const last = merged.items[merged.items.length - 1]
    expect(merged.nextCursor).toBe(last?.createdAt)

    const short = mergeCategoryPages([pages[0]?.slice(0, 10) ?? []], 25)
    expect(short.items).toHaveLength(10)
    expect(short.nextCursor).toBeNull()
  })
})
