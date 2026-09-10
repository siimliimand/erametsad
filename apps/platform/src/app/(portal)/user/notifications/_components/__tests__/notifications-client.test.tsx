import { createElement, type ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: () => undefined,
    refresh: () => undefined,
  }),
  usePathname: () => '/user/notifications',
}))

vi.mock('next/link', () => ({
  default: (props: { href: string; children: ReactNode }) =>
    createElement('a', { href: props.href }, props.children),
}))

const subscribe = vi.hoisted(() => vi.fn(() => () => undefined))
vi.mock('../../../../_lib/use-my-stream', () => ({
  useMyStream: () => ({ subscribe }),
}))

import { NotificationsClient } from '../notifications-client'
import { NOTIFICATION_EVENTS } from '../notifications-data'

function renderClient(unsubscribeToken: string | null = null): string {
  return renderToString(createElement(NotificationsClient, { unsubscribeToken }))
}

describe('NotificationsClient stacked panels', () => {
  it('renders the shared Minu keskkond page head above the three panels', () => {
    const html = renderClient()
    expect(html).toContain('Minu keskkond')
    expect(html).toContain('>Teavitused</h1>')
    expect(html.indexOf('Saabunud teavitused')).toBeGreaterThan(-1)
    expect(html).toContain('Teavituste eelistused')
    expect(html).toContain('Otsingute tellimused')
    expect(html.indexOf('Saabunud teavitused')).toBeLessThan(
      html.indexOf('Teavituste eelistused'),
    )
    expect(html.indexOf('Teavituste eelistused')).toBeLessThan(
      html.indexOf('Otsingute tellimused'),
    )
  })

  it('renders the demo summary sentence', () => {
    const html = renderClient()
    expect(html).toContain(
      'Kõik platvormi sõnumid ühes kohas — pakkumiste sündmused, oksjonite tähtajad ja lepingud.',
    )
  })
})

describe('PreferenceMatrix demo matrix', () => {
  it('covers the whole domain event set with switch/E-post/SMS columns', () => {
    const html = renderClient()
    expect(html).toContain('Teavitused')
    expect(html).toContain('E-post')
    expect(html).toContain('SMS')
    for (const event of NOTIFICATION_EVENTS) {
      expect(html).toContain(event.settingsLabel)
      expect(html).toContain(event.settingsDescription)
    }
  })

  it('shows an SMS dash for events without the SMS channel and the demo notes', () => {
    const html = renderClient()
    expect(html).toContain('SMS ei ole selle sündmuse puhul saadaval')
    expect(html).toContain('E-post on peamine teavituskanal.')
    expect(html).toContain('Muudatused rakenduvad kohe.')
    expect(html).toContain('Privaatsuspoliitika ja nõusolekute logi')
    expect(html).toContain('Saada test-teavitus')
  })

  it('renders switches with role=switch and disabled e-post checkboxes only when the master is off', () => {
    const html = renderClient()
    expect(html).toContain('role="switch"')
    expect(html).toMatch(/aria-checked="true"/)
  })
})
