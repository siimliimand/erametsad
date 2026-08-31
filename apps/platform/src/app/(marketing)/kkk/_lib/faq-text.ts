interface LexicalNodeLike {
  text?: unknown
  children?: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function nodeText(node: unknown): string {
  if (!isRecord(node)) return ''
  if (typeof node.text === 'string') return node.text
  if (!Array.isArray(node.children)) return ''
  return node.children.map((child) => nodeText(child as LexicalNodeLike)).join('')
}

/**
 * Payload richText columns are stored as raw Lexical JSON TEXT. FAQ answers
 * render as plain text (accordion body and FAQPage JSON-LD), so unwrap the
 * paragraph texts; anything unparsable is echoed back as-is.
 */
export function richTextToText(raw: string): string {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed) || !isRecord(parsed.root) || !Array.isArray(parsed.root.children)) {
      return raw
    }
    const paragraphs = parsed.root.children
      .map((child) => nodeText(child as LexicalNodeLike))
      .filter((text) => text.trim() !== '')
    return paragraphs.length > 0 ? paragraphs.join('\n') : raw
  } catch {
    return raw
  }
}
