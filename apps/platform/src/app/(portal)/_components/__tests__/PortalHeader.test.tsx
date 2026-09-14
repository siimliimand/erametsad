import { createElement, type ComponentProps, type ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

let currentPathname = '/'
let currentSearch = ''

vi.mock('next/navigation', () => ({
  usePathname: () => currentPathname,
  useSearchParams: () => new URLSearchParams(currentSearch),
  useRouter: () => ({ refresh: () => undefined }),
}))

vi.mock('next/link', () => ({
  default: (props: ComponentProps<'a'> & { children: ReactNode }) =>
    createElement(
      'a',
      {
        href: props.href,
        className: props.className,
        'aria-current': props['aria-current'],
      },
      props.children,
    ),
}))

vi.mock('@/app/(marketing)/_lib/base-url', () => ({
  marketingUrl: (path: string) => `https://erametsad.ww0.dev${path}`,
}))

vi.mock('@/app/(portal)/_actions/logout', () => ({
  logoutAction: () => Promise.resolve(),
}))

import { PortalHeader } from '../PortalHeader'

function render(auth: Parameters<typeof PortalHeader>[0]['auth']): string {
  return renderToString(createElement(PortalHeader, { auth }))
}

// Labels carrying aria-current per rendered nav (desktop nav + mobile drawer).
function currentLabels(html: string): string[] {
  return [...html.matchAll(/aria-current="page">([^<]+)</g)].map(
    (match) => match[1] ?? '',
  )
}

const authedAuth = {
  userId: 'u1',
  role: 'user',
  profileId: 'p1',
  profileName: 'Tõnis K.',
  impersonatedBy: null,
}

describe('PortalHeader nav', () => {
  it('renders the six demo nav items for guests and signed-in users', () => {
    for (const auth of [null, authedAuth]) {
      const html = render(auth)
      for (const label of [
        'Kõik oksjonid',
        'Raieõigused',
        'Metskinnistud',
        'Ajalugu',
        'KKK',
        'Kontakt',
      ]) {
        expect(html).toContain(label)
      }
    }
  })

  it('links KKK, Kontakt, and Paku oma metsa to the marketing host', () => {
    const html = render(null)
    expect(html).toContain('href="https://erametsad.ww0.dev/kkk"')
    expect(html).toContain('href="https://erametsad.ww0.dev/kontakt"')
    expect(html).toContain(
      'href="https://erametsad.ww0.dev/teenused/raieoiguse-muuk"',
    )
  })

  it('marks Kõik oksjonid active on / for guests', () => {
    const html = render(null)
    expect(currentLabels(html)).toEqual(['Kõik oksjonid', 'Kõik oksjonid'])
  })

  it('marks Raieõigused and Metskinnistud active from the tab param', () => {
    currentSearch = 'tab=raieoigused'
    expect(currentLabels(render(null))).toEqual(['Raieõigused', 'Raieõigused'])
    currentSearch = 'tab=metskinnistud'
    expect(currentLabels(render(null))).toEqual([
      'Metskinnistud',
      'Metskinnistud',
    ])
    currentSearch = ''
  })

  it('marks Ajalugu active on /ajalugu and its child paths only', () => {
    currentPathname = '/ajalugu'
    expect(currentLabels(render(null))).toEqual(['Ajalugu', 'Ajalugu'])
    currentPathname = '/ajalugu/muud'
    expect(currentLabels(render(null))).toEqual(['Ajalugu', 'Ajalugu'])
    currentPathname = '/oksjon/abc'
    expect(render(null)).not.toContain('aria-current="page"')
    currentPathname = '/'
  })

  it('keeps tab links inactive when the param is missing or unknown', () => {
    currentSearch = 'tab=puid'
    expect(currentLabels(render(null))).toEqual([
      'Kõik oksjonid',
      'Kõik oksjonid',
    ])
    currentSearch = ''
  })
})

describe('PortalHeader guest actions', () => {
  it('shows the Logi sisse / Paku oma metsa button pair', () => {
    const html = render(null)
    expect(html).toContain('Logi sisse')
    expect(html).toContain('Paku oma metsa')
    expect(html).toContain('href="/login?next=%2F"')
    expect(html).not.toContain('Logi välja')
  })

  it('preserves the current path in the login link', () => {
    currentPathname = '/oksjon/abc'
    expect(render(null)).toContain('href="/login?next=%2Foksjon%2Fabc"')
    currentPathname = '/'
  })

  it('hides the header Paku oma metsa CTA on small mobile viewports', () => {
    const html = render(null)
    expect(html).toMatch(/href="https:\/\/erametsad\.ww0\.dev\/teenused\/raieoiguse-muuk"[^>]*class="[^"]*\bhidden\b[^"]*\bsm:inline-flex\b/)
  })
})

describe('PortalHeader authed state', () => {
  it('shows the avatar initials and the display name', () => {
    const html = render(authedAuth)
    expect(html).toContain('>TK<')
    expect(html).toContain('Tõnis K.')
    expect(html).not.toContain('Logi sisse')
  })

  it('falls back to a single initial without a profile name', () => {
    const html = render({ ...authedAuth, profileName: null })
    expect(html).toContain('>K<')
    expect(html).toContain('Minu konto')
  })

  it('renders the user-area links and logout in the mobile drawer', () => {
    const html = render(authedAuth)
    for (const label of [
      'Minu pakkumised',
      'Minu objektid',
      'Teavitused',
      'Minu profiil',
      'Lepingud',
      'Logi välja',
    ]) {
      expect(html).toContain(label)
    }
  })
})
