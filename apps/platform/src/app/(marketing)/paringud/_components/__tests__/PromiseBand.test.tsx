import { createElement, type ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { PromiseBand } from '../PromiseBand'

function render(children: ReactNode): string {
  return renderToString(children).replace(/<!--.*?-->/g, '')
}

describe('PromiseBand', () => {
  it('renders the default seven-day promise message', () => {
    const html = render(createElement(PromiseBand))

    expect(html).toContain(
      'Pakkujad vastavad 7 päeva jooksul. Päringu esitamine on tasuta ega sidu sind.',
    )
  })

  it('renders a custom message', () => {
    const html = render(createElement(PromiseBand, { message: 'Oma sõnum' }))

    expect(html).toContain('Oma sõnum')
    expect(html).not.toContain('Pakkujad vastavad 7 päeva jooksul')
  })

  it('renders extra children as links next to the message', () => {
    const html = render(
      createElement(
        PromiseBand,
        null,
        createElement('a', { href: '/kkk/raie' }, 'Loe KKK-st'),
      ),
    )

    expect(html).toContain('Pakkujad vastavad 7 päeva jooksul')
    expect(html).toContain('href="/kkk/raie"')
    expect(html).toContain('Loe KKK-st')
  })
})
