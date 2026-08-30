import type { ReactNode } from 'react'

export interface RichTextBlock {
  kind: 'heading' | 'paragraph'
  text: string
}

/**
 * Node types that carry one block of inline text. Anything else with a
 * `children` array (root, list, …) is a container, so its children are
 * visited as blocks of their own.
 */
const INLINE_BLOCK_TYPES = new Set(['paragraph', 'heading', 'listitem', 'quote'])

function inlineTextOf(children: unknown[]): string {
  let text = ''
  const walk = (node: unknown): void => {
    if (typeof node === 'string') {
      text += node
      return
    }
    if (Array.isArray(node)) {
      for (const child of node) walk(child)
      return
    }
    if (typeof node !== 'object' || node === null) return
    const record = node as Record<string, unknown>
    if (Array.isArray(record.children)) {
      for (const child of record.children) walk(child)
      return
    }
    if (typeof record.text === 'string') text += record.text
  }
  for (const child of children) walk(child)
  return text.trim()
}

function pushBlock(node: unknown, out: RichTextBlock[]): void {
  if (Array.isArray(node)) {
    for (const child of node) pushBlock(child, out)
    return
  }
  if (typeof node !== 'object' || node === null) return
  const record = node as Record<string, unknown>
  if ('root' in record) {
    pushBlock(record.root, out)
    return
  }
  const kind: RichTextBlock['kind'] =
    record.type === 'heading' ? 'heading' : 'paragraph'
  if (Array.isArray(record.children) && INLINE_BLOCK_TYPES.has(String(record.type))) {
    const text = inlineTextOf(record.children)
    if (text !== '') out.push({ kind, text })
    return
  }
  if (Array.isArray(record.children)) {
    for (const child of record.children) pushBlock(child, out)
    return
  }
  if (typeof record.text === 'string' && record.text.trim() !== '') {
    out.push({ kind, text: record.text.trim() })
  }
}

/**
 * Payload Lexical JSON or plain text → renderable blocks. Headings survive
 * as `heading` blocks; plain text becomes paragraphs. Never returns HTML.
 */
export function richTextBlocks(value: string | null): RichTextBlock[] {
  if (value === null || value.trim() === '') return []
  try {
    const parsed: unknown = JSON.parse(value)
    const blocks: RichTextBlock[] = []
    pushBlock(parsed, blocks)
    return blocks
  } catch {
    // Not JSON — fall through to the plain-text split below.
  }
  return value
    .split(/\n+/)
    .map((text) => text.trim())
    .filter((text) => text !== '')
    .map((text): RichTextBlock => ({ kind: 'paragraph', text }))
}

export function RichText({ blocks }: { blocks: RichTextBlock[] }): ReactNode {
  if (blocks.length === 0) return null
  return (
    <div className="flex flex-col gap-xs">
      {blocks.map((block, index) =>
        block.kind === 'heading' ? (
          <h3 key={index} className="font-heading text-h4 text-ink">
            {block.text}
          </h3>
        ) : (
          <p key={index} className="text-body text-ink">
            {block.text}
          </p>
        ),
      )}
    </div>
  )
}
