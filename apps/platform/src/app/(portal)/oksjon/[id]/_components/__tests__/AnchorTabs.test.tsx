import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { AnchorTabs } from '../AnchorTabs'

describe('AnchorTabs', () => {
  const items = [
    { id: 'ulevaade', label: 'Ülevaade' },
    { id: 'asukoht', label: 'Asukoht' },
    { id: 'dokumendid', label: 'Dokumendid' },
    { id: 'pakkumised', label: 'Pakkumised' },
  ]

  it('renders all tab items and sets aria-current on the first by default', () => {
    const html = renderToString(createElement(AnchorTabs, { items }))
    expect(html).toContain('Ülevaade')
    expect(html).toContain('Asukoht')
    expect(html).toContain('Dokumendid')
    expect(html).toContain('Pakkumised')
    expect(html).toContain('aria-current="true"')
  })

  it('hides scrollbars and does not render scrollbar-width:thin', () => {
    const html = renderToString(createElement(AnchorTabs, { items }))
    expect(html).not.toContain('scrollbar-width:thin')
    expect(html).toContain('[scrollbar-width:none]')
  })

  it('renders fade indicator elements for horizontal scroll affordance', () => {
    const html = renderToString(createElement(AnchorTabs, { items }))
    expect(html).toContain('bg-gradient-to-r')
    expect(html).toContain('bg-gradient-to-l')
  })
})

