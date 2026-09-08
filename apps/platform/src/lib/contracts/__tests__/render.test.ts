import { describe, expect, it } from 'vitest'

import { renderTemplate, type ContractTemplate } from '../render'

import type { ContractTemplateSourceFormat } from '@/lib/data/schema'

function template(overrides: Partial<ContractTemplate> = {}): ContractTemplate {
  return {
    name: 'Raamleping 2026',
    type: 'framework',
    version: '3.1',
    placeholders: [{ key: 'bidder.name' }],
    active: true,
    ...overrides,
  }
}

describe('renderTemplate stored HTML source', () => {
  it('passes the stored source through verbatim and ignores the DOCX-derived htmlContent', () => {
    const view = template({
      htmlContent: '<p>DOCX-i tuletatud sisu {{bidder.name}}</p>',
      sourceContent: '<p>Müügileping <strong>{{bidder.name}}</strong> &amp; selts</p>',
      sourceFormat: 'html',
    })

    const { html } = renderTemplate(view, { 'bidder.name': 'Test Testov' })

    expect(html).toBe('<p>Müügileping <strong>Test Testov</strong> &amp; selts</p>')
  })

  it('replaces tokens after the passthrough', () => {
    const view = template({
      sourceContent: 'Ostja: {{bidder.name}}, tasu: {{fee.total}}',
      sourceFormat: 'html',
    })

    const { html } = renderTemplate(view, { 'bidder.name': 'Test Testov', 'fee.total': '1000 €' })

    expect(html).toBe('Ostja: Test Testov, tasu: 1000 €')
  })
})

describe('renderTemplate stored TXT source', () => {
  it('escapes the source fully and wraps it in the fallback shell', () => {
    const view = template({
      sourceContent: '<b>Metsa</b> & "loomad" \'müük\'',
      sourceFormat: 'txt',
    })

    const { html } = renderTemplate(view, {})

    expect(html.startsWith('<!DOCTYPE html>')).toBe(true)
    expect(html).toContain('<h1>Raamleping 2026</h1>')
    expect(html).toContain('<p>Version: 3.1</p>')
    expect(html).toContain('white-space: pre-wrap')
    expect(html).toContain('<pre>&lt;b&gt;Metsa&lt;/b&gt; &amp; &quot;loomad&quot; &#39;müük&#39;</pre>')
    expect(html.endsWith('</body></html>')).toBe(true)
  })

  it('never lets raw source markup reach the output', () => {
    const view = template({
      sourceContent: '<script>alert("paisumine")</script>',
      sourceFormat: 'txt',
    })

    const { html } = renderTemplate(view, {})

    expect(html).toContain(
      '<pre>&lt;script&gt;alert(&quot;paisumine&quot;)&lt;/script&gt;</pre>',
    )
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<b>')
  })

  it('replaces tokens inside the escaped TXT body', () => {
    const view = template({
      sourceContent: 'Ostja: {{bidder.name}}',
      sourceFormat: 'txt',
    })

    const { html } = renderTemplate(view, { 'bidder.name': 'Test Testov' })

    expect(html).toContain('<pre>Ostja: Test Testov</pre>')
  })
})

describe('renderTemplate fallback paths', () => {
  it('uses htmlContent when the stored source is missing, empty or blank', () => {
    const sources: (string | null | undefined)[] = [undefined, null, '', '   ']
    for (const sourceContent of sources) {
      const { html } = renderTemplate(
        template({ htmlContent: '<p>DOCX-i sisu</p>', sourceContent, sourceFormat: 'html' }),
        {},
      )
      expect(html).toBe('<p>DOCX-i sisu</p>')
    }
  })

  it('falls back to htmlContent for an unknown source format', () => {
    const view = template({
      htmlContent: '<p>DOCX-i sisu</p>',
      sourceContent: '<p>Orvukas lähtetekst</p>',
      sourceFormat: 'pdf' as ContractTemplateSourceFormat,
    })

    const { html } = renderTemplate(view, {})

    expect(html).toBe('<p>DOCX-i sisu</p>')
  })

  it('generates the fallback document when neither source nor htmlContent exists', () => {
    const { html } = renderTemplate(template(), { 'bidder.name': 'Test Testov' })

    expect(html.startsWith('<!DOCTYPE html>')).toBe(true)
    expect(html).toContain('<h1>Raamleping 2026</h1>')
    expect(html).toContain('<p>Version: 3.1</p>')
    expect(html).toContain('bidder.name:</span> Test Testov')
    expect(html.endsWith('</body></html>')).toBe(true)
  })
})
