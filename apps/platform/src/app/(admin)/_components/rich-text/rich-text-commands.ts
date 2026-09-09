/**
 * DOM operations behind the rich text editor toolbar.
 *
 * Hand-rolled on contentEditable + Selection/Range APIs: document.execCommand
 * is deprecated and cannot be styled or tested deterministically, so every
 * toolbar action rewrites the DOM directly. Each function receives its
 * Document and editor root explicitly, which keeps the module free of global
 * DOM state and unit-testable in jsdom without a live React tree.
 *
 * The component calls these with onMouseDown preventDefault so the toolbar
 * never steals the text selection it operates on.
 */

import { sanitizeHtml, sanitizeUrl } from './rich-text-sanitize'

export type BlockTag = 'p' | 'h2' | 'h3'
export type ListKind = 'ul' | 'ol'

const RENAMEABLE_BLOCKS = new Set(['p', 'h2', 'h3'])
const LIST_TAGS = new Set(['ul', 'ol'])

function currentRange(doc: Document, root: HTMLElement): Range | null {
  const selection = doc.getSelection()
  if (!selection || selection.rangeCount === 0) return null
  const range = selection.getRangeAt(0)
  if (!root.contains(range.commonAncestorContainer)) return null
  return range
}

function setSelection(doc: Document, range: Range): void {
  const selection = doc.getSelection()
  if (!selection) return
  selection.removeAllRanges()
  selection.addRange(range)
}

/** Snapshot of the editor selection, kept across focus-moving UI (link row, media picker). */
export function captureSelection(doc: Document, root: HTMLElement): Range | null {
  return currentRange(doc, root)?.cloneRange() ?? null
}

export function restoreSelection(doc: Document, root: HTMLElement, range: Range): void {
  if (!root.contains(range.commonAncestorContainer)) return
  setSelection(doc, range)
}

function rangeIntersectsNode(doc: Document, range: Range, node: Node): boolean {
  try {
    return range.intersectsNode(node)
  } catch {
    const nodeRange = doc.createRange()
    nodeRange.selectNode(node)
    const startAfterEnd =
      range.compareBoundaryPoints(Range.START_TO_END, nodeRange) >= 0
    const endBeforeStart =
      range.compareBoundaryPoints(Range.END_TO_START, nodeRange) <= 0
    return !(startAfterEnd || endBeforeStart)
  }
}

function elementName(element: Element): string {
  return element.tagName.toLowerCase()
}

function intersectingChildren(doc: Document, root: HTMLElement, range: Range): Element[] {
  const blocks: Element[] = []
  for (const child of Array.from(root.children)) {
    if (rangeIntersectsNode(doc, range, child)) blocks.push(child)
  }
  return blocks
}

function selectedTextNodes(doc: Document, root: HTMLElement, range: Range): Text[] {
  const nodes: Text[] = []
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node as Text
    if (text.length > 0 && rangeIntersectsNode(doc, range, text)) nodes.push(text)
  }
  return nodes
}

/** Splits boundary text nodes so the range aligns with node boundaries. */
function alignRangeToTextBoundaries(range: Range): void {
  const start = range.startContainer
  if (start.nodeType === Node.TEXT_NODE && range.startOffset > 0) {
    const right = (start as Text).splitText(range.startOffset)
    range.setStart(right, 0)
  }
  const end = range.endContainer
  if (end.nodeType === Node.TEXT_NODE && range.endOffset < (end as Text).length) {
    ;(end as Text).splitText(range.endOffset)
  }
}

function nearestAnchor(root: HTMLElement, node: Node): HTMLAnchorElement | null {
  let current: Node | null = node
  while (current && current !== root) {
    if (current.nodeType === Node.ELEMENT_NODE) {
      const element = current as Element
      if (elementName(element) === 'a') return element as HTMLAnchorElement
    }
    current = current.parentNode
  }
  return null
}

function renameBlock(doc: Document, block: Element, tag: BlockTag): Element {
  const renamed = doc.createElement(tag)
  while (block.firstChild) renamed.appendChild(block.firstChild)
  block.parentNode?.replaceChild(renamed, block)
  return renamed
}

function placeCaretAtEnd(doc: Document, node: Node): void {
  const range = doc.createRange()
  range.selectNodeContents(node)
  range.collapse(false)
  setSelection(doc, range)
}

function insertAtCaret(
  doc: Document,
  root: HTMLElement,
  node: Node,
  ensureTrailingParagraph: boolean,
): void {
  const range = currentRange(doc, root)
  if (!range) return
  if (!range.collapsed) range.deleteContents()
  range.insertNode(node)
  if (ensureTrailingParagraph) {
    const next = node.nextSibling
    if (!next || (next.nodeType === Node.ELEMENT_NODE && LIST_TAGS.has(elementName(next as Element)))) {
      const paragraph = doc.createElement('p')
      node.parentNode?.insertBefore(paragraph, next)
      placeCaretAtEnd(doc, paragraph)
      return
    }
  }
  range.collapse(false)
  setSelection(doc, range)
}

export function toggleBold(doc: Document, root: HTMLElement): void {
  const range = currentRange(doc, root)
  if (!range || range.collapsed) return
  alignRangeToTextBoundaries(range)
  const nodes = selectedTextNodes(doc, root, range)
  if (nodes.length === 0) return

  const anchors = nodes.map((node) => {
    let current: Node | null = node.parentNode
    while (current && current !== root) {
      if (current.nodeType === Node.ELEMENT_NODE && elementName(current as Element) === 'strong') {
        return current as HTMLElement
      }
      current = current.parentNode
    }
    return null
  })
  const allBold = anchors.every((anchor) => anchor !== null)

  if (allBold) {
    // every() narrowing makes anchors HTMLElement[] here.
    const seen = new Set<HTMLElement>()
    for (const anchor of anchors) {
      if (seen.has(anchor)) continue
      seen.add(anchor)
      const parent = anchor.parentNode
      if (!parent) continue
      while (anchor.firstChild) parent.insertBefore(anchor.firstChild, anchor)
      parent.removeChild(anchor)
    }
  } else {
    for (let i = 0; i < nodes.length; i += 1) {
      const node = nodes[i]
      const anchor = anchors[i]
      if (!node?.parentNode || anchor) continue
      const strong = doc.createElement('strong')
      node.parentNode.insertBefore(strong, node)
      strong.appendChild(node)
    }
  }
  const last = nodes[nodes.length - 1]
  if (last) placeCaretAtEnd(doc, last.parentNode ?? last)
}

export function applyBlockTag(doc: Document, root: HTMLElement, tag: BlockTag): void {
  const range = currentRange(doc, root)
  if (!range) return
  const blocks = intersectingChildren(doc, root, range)

  if (blocks.length === 0) {
    if (root.textContent && root.textContent.trim() !== '') {
      const wrapper = doc.createElement(tag)
      while (root.firstChild) wrapper.appendChild(root.firstChild)
      root.appendChild(wrapper)
      placeCaretAtEnd(doc, wrapper)
    }
    return
  }

  let last: Element | null = null
  for (const block of blocks) {
    const name = elementName(block)
    if (RENAMEABLE_BLOCKS.has(name) && name !== tag) {
      last = renameBlock(doc, block, tag)
    } else if (name === tag) {
      last = block
    }
  }
  if (last) placeCaretAtEnd(doc, last)
}

export function toggleList(doc: Document, root: HTMLElement, kind: ListKind): void {
  const range = currentRange(doc, root)
  if (!range) return
  const blocks = intersectingChildren(doc, root, range)
  if (blocks.length === 0) return

  // Unwrap only when every selected block already belongs to this list kind;
  // mixing a ul selection into an ol request converts instead.
  const allInTargetList =
    blocks.length > 0 && blocks.every((block) => elementName(block) === kind)

  if (allInTargetList) {
    for (const list of blocks) {
      const parent = list.parentNode
      if (!parent) continue
      for (const item of Array.from(list.children)) {
        if (elementName(item) !== 'li') continue
        const paragraph = doc.createElement('p')
        while (item.firstChild) paragraph.appendChild(item.firstChild)
        parent.insertBefore(paragraph, list)
      }
      parent.removeChild(list)
    }
    return
  }

  const list = doc.createElement(kind)
  const first = blocks[0]
  first?.parentNode?.insertBefore(list, first)

  let lastItem: Element | null = null
  for (const block of blocks) {
    const name = elementName(block)
    if (LIST_TAGS.has(name)) {
      for (const item of Array.from(block.children)) {
        if (elementName(item) !== 'li') continue
        list.appendChild(item)
        lastItem = item
      }
      block.parentNode?.removeChild(block)
      continue
    }
    const item = doc.createElement('li')
    while (block.firstChild) item.appendChild(block.firstChild)
    list.appendChild(item)
    block.parentNode?.removeChild(block)
    lastItem = item
  }
  if (lastItem) placeCaretAtEnd(doc, lastItem)
}

/** Wraps the selection in an anchor; returns false when nothing was linked. */
export function applyLink(doc: Document, root: HTMLElement, rawHref: string): boolean {
  const href = sanitizeUrl(rawHref)
  if (!href) return false
  const range = currentRange(doc, root)
  if (!range) return false

  const anchorNode =
    range.startContainer.nodeType === Node.ELEMENT_NODE
      ? (range.startContainer as Element)
      : range.startContainer.parentNode
  const existing = anchorNode ? nearestAnchor(root, anchorNode) : null
  if (existing) {
    existing.setAttribute('href', href)
    existing.setAttribute('rel', 'noopener')
    return true
  }
  if (range.collapsed) return false

  const anchor = doc.createElement('a')
  anchor.setAttribute('href', href)
  anchor.setAttribute('rel', 'noopener')
  const fragment = range.extractContents()
  anchor.appendChild(fragment)
  range.insertNode(anchor)
  range.selectNodeContents(anchor)
  range.collapse(false)
  setSelection(doc, range)
  return true
}

export function insertTable(doc: Document, root: HTMLElement, rows = 3, cols = 3): void {
  const table = doc.createElement('table')
  const body = doc.createElement('tbody')
  for (let r = 0; r < rows; r += 1) {
    const tr = doc.createElement('tr')
    for (let c = 0; c < cols; c += 1) {
      const cell = doc.createElement(r === 0 ? 'th' : 'td')
      tr.appendChild(cell)
    }
    body.appendChild(tr)
  }
  table.appendChild(body)
  insertAtCaret(doc, root, table, true)
}

export interface RichTextImage {
  url: string
  alt: string
}

export function insertImage(doc: Document, root: HTMLElement, image: RichTextImage): boolean {
  const url = sanitizeUrl(image.url, false)
  if (!url) return false
  const img = doc.createElement('img')
  img.setAttribute('src', url)
  img.setAttribute('alt', image.alt)
  insertAtCaret(doc, root, img, true)
  return true
}

/** Paste path: the HTML is sanitized before it ever touches the editor DOM. */
export function insertSanitizedHtml(doc: Document, root: HTMLElement, html: string): void {
  const template = doc.createElement('template')
  template.innerHTML = sanitizeHtml(html)
  const fragment = template.content
  if (!fragment.firstChild) return
  insertAtCaret(doc, root, fragment, false)
}

/** Serialized editor output; always sanitized and empty for blank content. */
export function getEditorHtml(root: HTMLElement): string {
  const html = sanitizeHtml(root.innerHTML)
  return isEmptyEditorHtml(html) ? '' : html
}

export function isEmptyEditorHtml(html: string): boolean {
  return (
    html
      .replace(/<br\s*\/?>/gi, '')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;| /gi, ' ')
      .trim() === ''
  )
}

/** Hydrates the editable area; the value is sanitized, never trusted. */
export function setEditorContent(doc: Document, root: HTMLElement, value: string): void {
  root.textContent = null
  const template = doc.createElement('template')
  template.innerHTML = sanitizeHtml(value)
  while (template.content.firstChild) {
    root.appendChild(template.content.firstChild)
  }
}
