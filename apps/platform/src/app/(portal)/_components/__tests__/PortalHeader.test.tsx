import { createElement, type ComponentProps, type ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

let currentPathname = '/'

vi.mock('next/navigation', () => ({
  usePathname: () => currentPathname,
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

vi.mock('@/app/(portal)/_actions/logout', () => ({
  logoutAction: async () => undefined,
}))

import { PortalHeader } from '../PortalHeader'

function render(auth: Parameters<typeof PortalHeader>[0]['auth']): string {
  return renderToString(createElement(PortalHeader, { auth }))
}

describe('PortalHeader portal links', () => {
  it('renders Ajalugu and Registreeru links for guests and signed-in users', () => {
    for (const auth of [null, { userId: 'u1', role: 'user', profileId: 'p1', profileName: 'Mari' }]) {
      const html = render(auth)
      expect(html).toContain('Ajalugu')
      expect(html).toContain('Registreeru')
      expect(html).toContain('href="/ajalugu"')
      expect(html).toContain('href="/register"')
    }
  })

  it('marks Ajalugu active only on the Ajalugu page', () => {
    currentPathname = '/ajalugu'
    const html = render(null)
    // The header renders the nav twice (desktop and mobile), so the link is
    // marked active once per nav.
    expect(html.match(/aria-current="page"/g)).toHaveLength(2)
    expect(html).toMatch(/aria-current="page"[^>]*>Ajalugu</)
    expect(html).not.toMatch(/aria-current="page"[^>]*>Registreeru</)
    currentPathname = '/ajalugu/muud'
    expect(render(null)).toMatch(/href="\/ajalugu"[^>]*aria-current="page"[^>]*>Ajalugu</)
  })

  it('marks Registreeru active on the register page', () => {
    currentPathname = '/register'
    const html = render(null)
    expect(html.match(/aria-current="page"/g)).toHaveLength(2)
    expect(html).toMatch(/aria-current="page"[^>]*>Registreeru</)
    expect(html).not.toMatch(/aria-current="page"[^>]*>Ajalugu</)
  })

  it('leaves portal links inactive elsewhere', () => {
    currentPathname = '/oksjon/abc'
    expect(render(null)).not.toContain('aria-current="page"')
  })

  it('keeps the existing marketing link styling on portal links', () => {
    const html = render(null)
    expect(html).toContain(
      'whitespace-nowrap transition-colors duration-hover hover:text-primary',
    )
  })
})
