import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { ControlCodeScreen } from '../_components/ControlCodeScreen'

function plain(value: string): string {
  return value.replace(/<!--.*?-->/g, '')
}

function renderScreen(props: {
  method: 'smartid' | 'mobileid' | 'idcard'
  controlCode: string | null
  state: 'pending' | 'success' | 'failed'
}): string {
  return plain(
    renderToString(
      createElement(ControlCodeScreen, {
        ...props,
        onCancel: vi.fn(),
        onRestart: vi.fn(),
      }),
    ),
  )
}

describe('ControlCodeScreen', () => {
  it('shows the per-method waiting copy and the big control code', () => {
    const html = renderScreen({
      method: 'smartid',
      controlCode: '4832',
      state: 'pending',
    })

    expect(html).toContain('Kontrolli telefoni või arvutit')
    expect(html).toContain('Kontrolli, et telefonis kuvatakse sama numbrit')
    expect(html).toContain('Kontrollkood')
    expect(html).toContain('4832')
    expect(html).toContain('aria-live="polite"')
    expect(html).toContain('Ootame sinu kinnitust…')
    expect(html).toContain('Tühista')
  })

  it('shows the Mobile-ID SMS copy while pending', () => {
    const html = renderScreen({
      method: 'mobileid',
      controlCode: '4832',
      state: 'pending',
    })

    expect(html).toContain('Kontrolli oma telefoni')
    expect(html).toContain('Kinnituskood saadeti SMS-iga')
  })

  it('explains a missing control code (ID-kaart)', () => {
    const html = renderScreen({
      method: 'idcard',
      controlCode: null,
      state: 'pending',
    })

    expect(html).toContain('Kontrolli oma arvutit')
    expect(html).toContain('Kontrollkoodi ei kuvatud')
  })

  it('offers restart and cancel in the failed state', () => {
    const html = renderScreen({
      method: 'smartid',
      controlCode: '4832',
      state: 'failed',
    })

    expect(html).toContain('Autentimine ei õnnestunud')
    expect(html).toContain('Proovi uuesti')
    expect(html).toContain('Tühista')
    expect(html).not.toContain('4832')
  })

  it('shows the success state', () => {
    const html = renderScreen({
      method: 'smartid',
      controlCode: '4832',
      state: 'success',
    })

    expect(html).toContain('Sisselogimine õnnestus')
    expect(html).not.toContain('4832')
  })
})
