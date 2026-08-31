function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function nodeText(node: unknown): string {
  if (!isRecord(node)) return ''
  if (typeof node.text === 'string') return node.text
  if (!Array.isArray(node.children)) return ''
  return node.children.map((child) => nodeText(child)).join('')
}

function rootChildren(raw: string): unknown[] | null {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (
      !isRecord(parsed) ||
      !isRecord(parsed.root) ||
      !Array.isArray(parsed.root.children)
    ) {
      return null
    }
    return parsed.root.children as unknown[]
  } catch {
    return null
  }
}

/**
 * Payload richText columns are stored as raw Lexical JSON TEXT (same storage
 * and unwrap approach as kkk/_lib/faq-text.ts). Unparsable content is echoed
 * back as-is so nothing disappears from the page.
 */
export function richTextToText(raw: string): string {
  const children = rootChildren(raw)
  if (!children) return raw
  const paragraphs = children
    .map((child) => nodeText(child))
    .filter((text) => text.trim() !== '')
  return paragraphs.length > 0 ? paragraphs.join('\n') : raw
}

const ANCHOR_DIACRITIC_MAP: Record<string, string> = {
  õ: 'o', ä: 'a', ö: 'o', ü: 'u',
  Õ: 'o', Ä: 'a', Ö: 'o', Ü: 'u',
}

// Diacritic-insensitive slug for heading anchor ids; the index keeps ids
// unique when two headings share a title.
export function headingAnchor(title: string, index: number): string {
  const slug = title
    .split('')
    .map((ch) => ANCHOR_DIACRITIC_MAP[ch] ?? ch)
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return `h-${String(index)}-${slug || 'pealkiri'}`
}

export interface ArticleHeading {
  id: string
  title: string
}

/** H2/H3 sections for the article table of contents, in document order. */
export function extractHeadings(raw: string): ArticleHeading[] {
  const children = rootChildren(raw)
  if (!children) return []
  const headings: ArticleHeading[] = []
  children.forEach((child, index) => {
    if (!isRecord(child) || child.type !== 'heading') return
    if (child.tag !== 'h2' && child.tag !== 'h3') return
    const title = nodeText(child).trim()
    if (title === '') return
    headings.push({ id: headingAnchor(title, index), title })
  })
  return headings
}
