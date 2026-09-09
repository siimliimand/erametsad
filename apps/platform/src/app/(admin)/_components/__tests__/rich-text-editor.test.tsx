import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { RichTextEditor } from '../rich-text/RichTextEditor'

function render(props: Parameters<typeof RichTextEditor>[0]): string {
  return renderToString(createElement(RichTextEditor, props))
}

describe('RichTextEditor', () => {
  it('renders the limited Estonian toolbar and the editable region', () => {
    const html = render({ value: '<p>sisu</p>', onChange: () => undefined })
    expect(html).toContain('role="toolbar"')
    expect(html).toContain('Vormindus')
    for (const label of ['Pealkiri 2', 'Pealkiri 3', 'Tavaline', 'Loend', '1. Loend', 'Link', 'Tabel']) {
      expect(html).toContain(label)
    }
    expect(html).toContain('role="textbox"')
    expect(html).toContain('aria-multiline="true"')
    expect(html).toContain('Rikastatud tekstiredaktor')
  })

  it('shows the image button only with a media hook wired', () => {
    expect(render({ value: '', onChange: () => undefined })).not.toContain('Lisa pilt')
    const withHook = render({
      value: '',
      onChange: () => undefined,
      onRequestImage: () => null,
    })
    expect(withHook).toContain('Lisa pilt')
  })

  it('hides the link URL row until the Link button opens it', () => {
    const html = render({ value: '', onChange: () => undefined })
    expect(html).not.toContain('Lingi URL')
    expect(html).not.toContain('Lisa link')
  })

  it('renders the disabled state without an editable region', () => {
    const html = render({ value: '', onChange: () => undefined, disabled: true })
    expect(html).toContain('aria-disabled="true"')
  })
})
