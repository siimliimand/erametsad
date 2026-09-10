import { createElement, type ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/link', () => ({
  default: (props: { href: string; children: ReactNode }) =>
    createElement('a', { href: props.href }, props.children),
}))

import { InboxItemRow, NotificationInbox } from '../notification-inbox'
import type { NotificationItem } from '../notifications-data'

function makeItem(overrides: Partial<NotificationItem> = {}): NotificationItem {
  // Two hours back so the relative meta line is stable across run times.
  const twoHoursAgo = new Date(Date.now() - 2 * 3_600_000).toISOString()
  return {
    id: 'n1',
    category: 'outbid',
    channel: 'in_app',
    title: 'Sinu pakkumine on üle pakutud',
    body: 'Uus juhtiv pakkumine 7 750 €.',
    payload: { auctionId: 'a1' },
    readAt: null,
    sentAt: null,
    createdAt: twoHoursAgo,
    ...overrides,
  }
}

function renderRow(item: NotificationItem): string {
  return renderToString(
    createElement(InboxItemRow, { item, onMarkRead: () => undefined }),
  )
}

describe('InboxItemRow', () => {
  it('unread row shows the amber Lugemata state, category badge and Vaata oksjonit action', () => {
    const html = renderRow(makeItem())
    expect(html).toContain('Lugemata')
    expect(html).toContain('Pakkumine')
    expect(html).toContain('Sinu pakkumine on üle pakutud')
    expect(html).toContain('Vaata oksjonit')
    expect(html).toContain('href="/oksjon/a1"')
    expect(html).toContain('Lugemata teavitus.')
  })

  it('read row shows the Loetud state without the unread announcement', () => {
    const html = renderRow(makeItem({ readAt: '2026-09-10T11:00:00.000Z' }))
    expect(html).toContain('Loetud')
    expect(html).not.toContain('Lugemata teavitus.')
    expect(html).not.toContain('Lugemata<')
  })

  it('contract events badge as Leping with the Vaata lepingut action label', () => {
    const html = renderRow(
      makeItem({
        category: 'contract.ready',
        payload: { auctionId: 'a2' },
      }),
    )
    expect(html).toContain('Leping')
    expect(html).toContain('Vaata lepingut')
  })

  it('rows without a deep link render a mark-read button instead of a link', () => {
    const html = renderRow(makeItem({ payload: null }))
    expect(html).not.toContain('href=')
    expect(html).toContain('<button')
  })

  it('carries the relative time and absolute date title', () => {
    const html = renderRow(makeItem())
    expect(html).toContain('tundi tagasi')
    expect(html).toMatch(/title="[^"]+"/)
  })
})

describe('NotificationInbox panel', () => {
  it('renders the demo panel head, Märgi loetuks bulk action and filter chips', () => {
    const html = renderToString(createElement(NotificationInbox, { streamEpoch: 0 }))
    expect(html).toContain('Saabunud teavitused')
    expect(html).toContain('Märgi loetuks')
    expect(html).toContain('Klõps teavitusel märgib selle loetuks.')
    for (const chip of ['Kõik', 'Lugemata', 'Pakkumised', 'Oksjonid', 'Lepingud']) {
      expect(html).toContain(chip)
    }
  })

  it('bulk action starts disabled while nothing is loaded unread', () => {
    const html = renderToString(createElement(NotificationInbox, { streamEpoch: 0 }))
    expect(html).toMatch(/<button[^>]*disabled[^>]*>[^]*?Märgi loetuks/)
  })
})
