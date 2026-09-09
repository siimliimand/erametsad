// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'

import {
  applyBlockTag,
  applyLink,
  getEditorHtml,
  insertImage,
  insertSanitizedHtml,
  insertTable,
  isEmptyEditorHtml,
  setEditorContent,
  toggleBold,
  toggleList,
} from '../rich-text/rich-text-commands'

let doc: Document
let host: HTMLElement

beforeEach(() => {
  doc = document
  document.body.innerHTML = ''
  host = doc.createElement('div')
  doc.body.appendChild(host)
})

function makeRoot(html = ''): HTMLElement {
  const root = doc.createElement('div')
  if (html) root.innerHTML = html
  host.appendChild(root)
  return root
}

function selectRange(start: Node, startOffset: number, end: Node, endOffset: number): void {
  const range = doc.createRange()
  range.setStart(start, startOffset)
  range.setEnd(end, endOffset)
  const selection = doc.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
}

function selectWhole(root: HTMLElement): void {
  selectRange(root, 0, root, root.childNodes.length)
}

function firstText(root: HTMLElement): Text {
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const node = walker.nextNode()
  if (!node) throw new Error('no text node')
  return node as Text
}

describe('toggleBold', () => {
  it('wraps the selected text in strong', () => {
    const root = makeRoot('<p>terve maailm</p>')
    const text = firstText(root)
    selectRange(text, 6, text, 12)
    toggleBold(doc, root)
    expect(root.innerHTML).toBe('<p>terve <strong>maailm</strong></p>')
  })

  it('unwraps strong when the whole run is already bold', () => {
    const root = makeRoot('<p><strong>esiletoodud</strong></p>')
    selectWhole(root)
    toggleBold(doc, root)
    expect(root.innerHTML).toBe('<p>esiletoodud</p>')
  })

  it('ignores a collapsed caret', () => {
    const root = makeRoot('<p>puutumata</p>')
    const text = firstText(root)
    selectRange(text, 4, text, 4)
    toggleBold(doc, root)
    expect(root.innerHTML).toBe('<p>puutumata</p>')
  })
})

describe('applyBlockTag', () => {
  it('renames the selected paragraph to h2 and back', () => {
    const root = makeRoot('<p>Pealkiri</p>')
    selectWhole(root)
    applyBlockTag(doc, root, 'h2')
    expect(root.innerHTML).toBe('<h2>Pealkiri</h2>')
    selectWhole(root)
    applyBlockTag(doc, root, 'p')
    expect(root.innerHTML).toBe('<p>Pealkiri</p>')
  })

  it('renames only the touched paragraph among several', () => {
    const root = makeRoot('<p>esimene</p><p>teine</p><p>kolmas</p>')
    const second = root.children[1]
    if (!second) throw new Error('missing second paragraph')
    selectRange(second, 0, second, 0)
    applyBlockTag(doc, root, 'h3')
    expect(root.innerHTML).toBe('<p>esimene</p><h3>teine</h3><p>kolmas</p>')
  })
})

describe('toggleList', () => {
  it('wraps consecutive paragraphs into an unordered list', () => {
    const root = makeRoot('<p>üks</p><p>kaks</p>')
    selectWhole(root)
    toggleList(doc, root, 'ul')
    expect(root.innerHTML).toBe('<ul><li>üks</li><li>kaks</li></ul>')
  })

  it('unwraps when every block is already in that list kind', () => {
    const root = makeRoot('<ul><li>üks</li><li>kaks</li></ul>')
    selectWhole(root)
    toggleList(doc, root, 'ul')
    expect(root.innerHTML).toBe('<p>üks</p><p>kaks</p>')
  })

  it('converts an unordered list into an ordered one', () => {
    const root = makeRoot('<ul><li>üks</li><li>kaks</li></ul>')
    selectWhole(root)
    toggleList(doc, root, 'ol')
    expect(root.innerHTML).toBe('<ol><li>üks</li><li>kaks</li></ol>')
  })
})

describe('applyLink', () => {
  it('wraps the selection and forces rel noopener', () => {
    const root = makeRoot('<p>vaata siia</p>')
    const text = firstText(root)
    selectRange(text, 6, text, 10)
    expect(applyLink(doc, root, 'https://näide.ee/leht')).toBe(true)
    expect(root.innerHTML).toBe('<p>vaata <a href="https://näide.ee/leht" rel="noopener">siia</a></p>')
  })

  it('rejects unsafe URLs without changing the content', () => {
    const root = makeRoot('<p>vaata siia</p>')
    selectWhole(root)
    expect(applyLink(doc, root, 'javascript:alert(1)')).toBe(false)
    expect(root.innerHTML).toBe('<p>vaata siia</p>')
  })

  it('updates the href when the caret is inside an existing link', () => {
    const root = makeRoot('<p><a href="https://vana.ee" rel="noopener">link</a></p>')
    const text = firstText(root)
    selectRange(text, 0, text, 4)
    expect(applyLink(doc, root, 'https://uus.ee')).toBe(true)
    expect(root.innerHTML).toBe('<p><a href="https://uus.ee" rel="noopener">link</a></p>')
  })
})

describe('insertTable', () => {
  it('inserts a table with a header row and a trailing paragraph', () => {
    const root = makeRoot('<p>kursor siin</p>')
    selectWhole(root)
    insertTable(doc, root, 2, 2)
    expect(root.querySelector('table')).not.toBeNull()
    expect(root.querySelectorAll('th')).toHaveLength(2)
    expect(root.querySelectorAll('td')).toHaveLength(2)
    expect(root.innerHTML).toContain('<tbody>')
  })
})

describe('insertImage', () => {
  it('inserts an image with alt text from the media library', () => {
    const root = makeRoot('<p>enne</p>')
    selectWhole(root)
    expect(insertImage(doc, root, { url: 'https://cdn.erametsad.ee/mets.jpg', alt: 'Mets' })).toBe(true)
    const img = root.querySelector('img')
    expect(img?.getAttribute('src')).toBe('https://cdn.erametsad.ee/mets.jpg')
    expect(img?.getAttribute('alt')).toBe('Mets')
  })

  it('refuses unsafe sources', () => {
    const root = makeRoot('<p>enne</p>')
    selectWhole(root)
    expect(insertImage(doc, root, { url: 'javascript:alert(1)', alt: 'x' })).toBe(false)
    expect(root.querySelector('img')).toBeNull()
  })
})

describe('insertSanitizedHtml (paste path)', () => {
  it('inserts only allowlisted markup at the caret', () => {
    const root = makeRoot('<p>algus</p>')
    selectWhole(root)
    insertSanitizedHtml(doc, root, '<p>puhas</p><script>alert(1)</script><p onclick="x()">otsa</p>')
    expect(root.querySelector('script')).toBeNull()
    expect(root.innerHTML).toBe('<p>puhas</p><p>otsa</p>')
  })

  it('treats plain text with angle brackets as text, not markup', () => {
    const root = makeRoot('')
    selectRange(root, 0, root, 0)
    insertSanitizedHtml(doc, root, '<p>tavatekst &lt; nogurkid alt &gt;</p>')
    expect(root.querySelector('script')).toBeNull()
    expect(root.textContent).toContain('< nogurkid alt >')
  })
})

describe('output helpers', () => {
  it('getEditorHtml sanitizes output and maps blank content to empty string', () => {
    const root = makeRoot('<p>ok<script>alert(1)</script></p>')
    expect(getEditorHtml(root)).toBe('<p>ok</p>')
    const blank = makeRoot('<p><br></p>')
    expect(getEditorHtml(blank)).toBe('')
  })

  it('isEmptyEditorHtml covers br, whitespace, and nbsp-only content', () => {
    expect(isEmptyEditorHtml('')).toBe(true)
    expect(isEmptyEditorHtml('<p><br></p>')).toBe(true)
    expect(isEmptyEditorHtml('<p>&nbsp;</p>')).toBe(true)
    expect(isEmptyEditorHtml('<p>sisu</p>')).toBe(false)
  })

  it('setEditorContent hydrates sanitized markup', () => {
    const root = makeRoot('')
    setEditorContent(doc, root, '<h2>Pealkiri</h2><script>alert(1)</script>')
    expect(root.innerHTML).toBe('<h2>Pealkiri</h2>')
  })
})
