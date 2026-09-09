import { describe, expect, it } from 'vitest'

import { decodeEntities, sanitizeHtml, sanitizeUrl } from '../rich-text/rich-text-sanitize'

describe('sanitizeHtml allowlist', () => {
  it('keeps toolbar vocabulary intact', () => {
    const html =
      '<h2>Pealkiri</h2><p>Tekst <strong>rasvane</strong> ja <em>kursiiv</em>.</p>' +
      '<ul><li>üks</li><li>kaks</li></ul><ol><li>kolm</li></ol>'
    expect(sanitizeHtml(html)).toBe(html)
  })

  it('keeps simple tables with span attributes', () => {
    const html =
      '<table><thead><tr><th colspan="2">Nimi</th></tr></thead>' +
      '<tbody><tr><td rowspan="2">1</td><td>2</td></tr></tbody></table>'
    expect(sanitizeHtml(html)).toBe(html)
  })

  it('drops colspan values that are not bounded integers', () => {
    expect(sanitizeHtml('<td colspan="abc">x</td>')).toBe('<td>x</td>')
    expect(sanitizeHtml('<td colspan="99999">x</td>')).toBe('<td>x</td>')
  })
})

describe('sanitizeHtml dangerous content', () => {
  it('removes script, style, and iframe with their entire content', () => {
    const out = sanitizeHtml('<p>enne</p><script>alert(1)</script><style>p{}</style><iframe src="x">sisu</iframe><p> järel</p>')
    expect(out).toBe('<p>enne</p><p> järel</p>')
    expect(out).not.toContain('alert')
  })

  it('drops svg, math, template, and head content', () => {
    const out = sanitizeHtml('<svg><circle onclick="x()"/></svg><math><mi>y</mi></math><template><img src="x"></template><p>ok</p>')
    expect(out).toBe('<p>ok</p>')
  })

  it('strips event handler, style, class, and id attributes', () => {
    expect(sanitizeHtml('<p onclick="x()" style="color:red" class="a" id="b">t</p>')).toBe('<p>t</p>')
  })

  it('drops javascript: links but keeps the anchor text', () => {
    expect(sanitizeHtml('<a href="javascript:alert(1)">klikka</a>')).toBe('<a rel="noopener">klikka</a>')
  })

  it('defeats entity-encoded javascript URLs', () => {
    expect(sanitizeHtml('<a href="java&#115;cript:alert(1)">x</a>')).toBe('<a rel="noopener">x</a>')
    expect(sanitizeHtml('<a href="jav&Tab;ascript:alert(1)">x</a>')).toBe('<a rel="noopener">x</a>')
    expect(sanitizeHtml('<a href="java&colon;script">x</a>')).toBe('<a rel="noopener">x</a>')
    expect(sanitizeHtml('<a href="&#14; javascript:alert(1)">x</a>')).toBe('<a rel="noopener">x</a>')
  })

  it('forces rel="noopener" on every link', () => {
    const out = sanitizeHtml('<a href="https://näide.ee" rel="nofollow" target="_blank">x</a>')
    expect(out).toBe('<a href="https://näide.ee" rel="noopener">x</a>')
  })

  it('blocks data: and javascript: image sources', () => {
    expect(sanitizeHtml('<img src="data:image/png;base64,AAAA" alt="pilt">')).toBe('<img alt="pilt">')
    expect(sanitizeHtml('<img src="javascript:alert(1)" alt="p">')).toBe('<img alt="p">')
  })

  it('drops comments, doctype, and CDATA sections', () => {
    expect(sanitizeHtml('<!-- peidetud --><p>t</p>')).toBe('<p>t</p>')
    expect(sanitizeHtml('<!DOCTYPE html><p>t</p>')).toBe('<p>t</p>')
    const cdata = sanitizeHtml('<![CDATA[<script>alert(1)</script>]]><p>t</p>')
    expect(cdata).toContain('<p>t</p>')
    expect(cdata).not.toContain('<script>')
  })
})

describe('sanitizeHtml URL policy', () => {
  it('keeps safe href schemes and relative targets', () => {
    const kept = ['https://erametsad.ee/a', 'http://localhost:3000/b', 'mailto:info@erametsad.ee', 'tel:+37250000000', '/lepingud', 'pildid/mets.jpg', '#anker']
    for (const url of kept) {
      expect(sanitizeHtml(`<a href="${url}">x</a>`)).toBe(`<a href="${url}" rel="noopener">x</a>`)
    }
  })

  it('keeps only web and relative image sources', () => {
    expect(sanitizeHtml('<img src="https://cdn.erametsad.ee/pilt.webp" alt="mets">')).toBe(
      '<img src="https://cdn.erametsad.ee/pilt.webp" alt="mets">',
    )
    expect(sanitizeUrl('mailto:a@b.ee', false)).toBeNull()
  })

  it('rejects unknown schemes with colon tricks', () => {
    for (const url of ['vbscript:x', 'file:///etc/passwd', 'java\0script:x']) {
      expect(sanitizeUrl(url)).toBeNull()
    }
  })
})

describe('sanitizeHtml structural repair', () => {
  it('renames b and i to strong and em', () => {
    expect(sanitizeHtml('<b>rasvane</b> ja <i>kursiiv</i>')).toBe('<strong>rasvane</strong> ja <em>kursiiv</em>')
  })

  it('unwraps disallowed tags and keeps their text', () => {
    expect(sanitizeHtml('<span style="x">tekst</span><u>ala</u><blockquote>tsitaat</blockquote>')).toBe('tekstalatsitaat')
  })

  it('closes unclosed tags and ignores stray closing tags', () => {
    expect(sanitizeHtml('<p>katkestatud')).toBe('<p>katkestatud</p>')
    expect(sanitizeHtml('</p>üksildane')).toBe('üksildane')
  })

  it('applies implicit closes so pasted blocks do not nest', () => {
    expect(sanitizeHtml('<ul><li>üks<li>kaks</ul>')).toBe('<ul><li>üks</li><li>kaks</li></ul>')
    expect(sanitizeHtml('<p>üks<p>kaks')).toBe('<p>üks</p><p>kaks</p>')
  })

  it('lowercases tags and keeps the first duplicate attribute', () => {
    expect(sanitizeHtml('<P>T</P>')).toBe('<p>T</p>')
    expect(sanitizeHtml('<a href="/hea" href="javascript:alert(1)">x</a>')).toBe('<a href="/hea" rel="noopener">x</a>')
  })

  it('treats broken markup as text', () => {
    expect(sanitizeHtml('a < b')).toBe('a &lt; b')
  })

  it('strips NUL and control characters', () => {
    expect(sanitizeHtml('<p>a\u0000b</p>')).toBe('<p>ab</p>')
    expect(sanitizeHtml('<p>a\u0007b</p>')).toBe('<p>ab</p>')
  })
})

describe('decodeEntities', () => {
  it('decodes numeric and known named entities', () => {
    expect(decodeEntities('&#115;&#x3C;&amp;&nbsp;')).toBe('s<&\u00a0')
  })

  it('leaves unknown entities untouched', () => {
    expect(decodeEntities('&tundmatu;')).toBe('&tundmatu;')
  })
})
