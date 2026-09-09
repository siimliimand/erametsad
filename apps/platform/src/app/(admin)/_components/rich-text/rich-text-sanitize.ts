/**
 * Allowlist HTML sanitizer for rich text editor output.
 *
 * Hand-rolled tokenizer instead of a DOM-based sanitizer so the same code
 * runs in the browser, in node, and in Cloudflare Workers (no DOMParser,
 * no jsdom dependency). Parses the input once, rebuilds only allowlisted
 * markup, and escapes everything else. The output is balanced HTML: every
 * emitted open tag is closed, so hosts can store it without a repair pass.
 *
 * Allowed vocabulary mirrors the editor toolbar: p, h2, h3, strong, em,
 * ul, ol, li, a, img, and simple tables. b/i from pasted Word/Google Docs
 * HTML are renamed to strong/em. Everything else is unwrapped (text kept)
 * except raw-text elements (script, style, iframe, ...), whose entire
 * content is dropped.
 */

const ALLOWED_TAGS = new Set([
  'p',
  'br',
  'h2',
  'h3',
  'strong',
  'em',
  'ul',
  'ol',
  'li',
  'a',
  'img',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
])

const RENAME_TAGS: Record<string, string> = { b: 'strong', i: 'em' }

const VOID_TAGS = new Set(['br', 'img'])

const DROP_CONTENT_TAGS = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'noscript',
  'noembed',
  'noframes',
  'template',
  'textarea',
  'title',
  'svg',
  'math',
  'head',
  'xmp',
])

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'title']),
  img: new Set(['src', 'alt']),
  th: new Set(['colspan', 'rowspan']),
  td: new Set(['colspan', 'rowspan']),
}

/** Implicit close rules keep pasted sibling blocks from nesting. */
const CLOSES_ON_OPEN: Record<string, string[]> = {
  p: ['p', 'h2', 'h3', 'li'],
  h2: ['p', 'h2', 'h3', 'li'],
  h3: ['p', 'h2', 'h3', 'li'],
  li: ['li'],
  tr: ['tr', 'td', 'th'],
  td: ['td', 'th'],
  th: ['td', 'th'],
}

const SAFE_HREF_SCHEMES = new Set(['http:', 'https:', 'mailto:', 'tel:'])
const SAFE_SRC_SCHEMES = new Set(['http:', 'https:'])

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  colon: ':',
  semi: ';',
  sol: '/',
  bsol: '\\',
  lpar: '(',
  rpar: ')',
  equals: '=',
  excl: '!',
  quest: '?',
  num: '#',
  percnt: '%',
  tab: '\t',
  newline: '\n',
  copy: '©',
  reg: '®',
  trade: '™',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  laquo: '«',
  raquo: '»',
  ldquo: '“',
  rdquo: '”',
  lsquo: '‘',
  rsquo: '’',
  auml: 'ä',
  ouml: 'ö',
  uuml: 'ü',
  otilde: 'õ',
  szlig: 'ß',
  eacute: 'é',
}

const ENTITY_RE = /&(#[xX][0-9a-fA-F]{1,6}|#[0-9]{1,7}|[a-zA-Z][a-zA-Z0-9]{1,31});/g

export function decodeEntities(value: string): string {
  return value.replace(ENTITY_RE, (match, body: string) => {
    if (body.startsWith('#')) {
      const codePoint =
        body[1] === 'x' || body[1] === 'X'
          ? Number.parseInt(body.slice(2), 16)
          : Number.parseInt(body.slice(1), 10)
      if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff) {
        return '�'
      }
      return String.fromCodePoint(codePoint)
    }
    const named = NAMED_ENTITIES[body.toLowerCase()]
    return named ?? match
  })
}

/**
 * Returns the URL unchanged when safe for an href/src attribute, else null.
 * Entities are decoded and control characters removed before the scheme
 * check, so `java&#115;cript:` and `jav\tascript:` are rejected.
 */
export function sanitizeUrl(rawUrl: string, allowCommunicationSchemes = true): string | null {
  const decoded = decodeEntities(rawUrl).replace(/[\u0000-\u0020\u007f]/g, '')
  if (decoded === '') return null
  const colon = decoded.indexOf(':')
  if (colon === -1) return decoded
  const firstBoundary = Math.min(
    ...['/', '?', '#'].map((ch) => {
      const at = decoded.indexOf(ch)
      return at === -1 ? Number.POSITIVE_INFINITY : at
    }),
  )
  if (colon > firstBoundary) return decoded
  const scheme = decoded.slice(0, colon + 1).toLowerCase()
  if (allowCommunicationSchemes && SAFE_HREF_SCHEMES.has(scheme)) return decoded
  if (!allowCommunicationSchemes && SAFE_SRC_SCHEMES.has(scheme)) return decoded
  return null
}

/** Escapes text content; entity-shaped sequences survive unescaped. */
function escapeText(text: string): string {
  const stripped = text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
  return stripped
    .replace(/&(?!(?:#[0-9]+|#x[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]{1,31});)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * Full escaping for text the sanitizer would otherwise read as markup, e.g.
 * plain-text clipboard content pasted as paragraphs.
 */
export function escapePlainText(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeAttrValue(value: string): string {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

interface ParsedAttrs {
  attrs: [string, string][]
  failed: boolean
}

function parseAttrs(input: string, start: number): ParsedAttrs & { end: number; selfClosing: boolean } {
  const attrs: [string, string][] = []
  let i = start
  const len = input.length
  for (;;) {
    let sawSlash = false
    while (i < len && /[\s/]/.test(input[i] ?? '')) {
      if (input[i] === '/') sawSlash = true
      i += 1
    }
    if (i >= len) return { attrs, end: len, selfClosing: false, failed: true }
    const ch = input[i]
    if (ch === '>') return { attrs, end: i + 1, selfClosing: sawSlash, failed: false }
    if (ch === '<') return { attrs, end: i, selfClosing: false, failed: true }
    let nameStart = i
    while (i < len && !/[\s=/>]/.test(input[i] ?? '')) i += 1
    if (i === nameStart) {
      i += 1
      continue
    }
    const name = input.slice(nameStart, i).toLowerCase()
    let j = i
    while (j < len && /\s/.test(input[j] ?? '')) j += 1
    let value = ''
    if (input[j] === '=') {
      j += 1
      while (j < len && /\s/.test(input[j] ?? '')) j += 1
      const quote = input[j]
      if (quote === '"' || quote === "'") {
        const close = input.indexOf(quote, j + 1)
        if (close === -1) {
          value = input.slice(j + 1)
          i = len
        } else {
          value = input.slice(j + 1, close)
          i = close + 1
        }
      } else {
        const valueStart = j
        while (j < len && !/[\s>]/.test(input[j] ?? '')) j += 1
        value = input.slice(valueStart, j)
        i = j
      }
    }
    if (!attrs.some(([existing]) => existing === name)) {
      attrs.push([name, decodeEntities(value)])
    }
  }
}

function findRawContentEnd(input: string, tagName: string): number {
  const closeRe = new RegExp(`</${tagName}(\\s|>|/)`, 'i')
  const match = closeRe.exec(input)
  if (!match) return input.length
  const gt = input.indexOf('>', match.index)
  return gt === -1 ? input.length : gt + 1
}

export function sanitizeHtml(input: string): string {
  const out: string[] = []
  const stack: string[] = []
  let i = 0
  const len = input.length

  const closeUntil = (name: string) => {
    const at = stack.lastIndexOf(name)
    if (at === -1) return
    while (stack.length > at) {
      const top = stack.pop()
      if (top === undefined) break
      out.push(`</${top}>`)
    }
  }

  while (i < len) {
    const lt = input.indexOf('<', i)
    if (lt === -1) {
      out.push(escapeText(input.slice(i)))
      break
    }
    if (lt > i) out.push(escapeText(input.slice(i, lt)))

    if (input.startsWith('<!--', lt)) {
      const commentEnd = input.indexOf('-->', lt + 4)
      i = commentEnd === -1 ? len : commentEnd + 3
      continue
    }
    const next = input[lt + 1]
    if (next === '!' || next === '?') {
      const gt = input.indexOf('>', lt + 2)
      i = gt === -1 ? len : gt + 1
      continue
    }

    if (next === '/') {
      const nameMatch = /^<\/([a-zA-Z][a-zA-Z0-9-]*)/.exec(input.slice(lt))
      if (!nameMatch?.[1]) {
        out.push('&lt;/')
        i = lt + 2
        continue
      }
      const gt = input.indexOf('>', lt)
      i = gt === -1 ? len : gt + 1
      // Close by the renamed tag: </b> must close a pushed <strong>.
      const raw = nameMatch[1].toLowerCase()
      const closeName = RENAME_TAGS[raw] ?? raw
      if (ALLOWED_TAGS.has(closeName)) closeUntil(closeName)
      continue
    }

    const openMatch = /^<([a-zA-Z][a-zA-Z0-9-]*)/.exec(input.slice(lt))
    if (!openMatch?.[1]) {
      out.push('&lt;')
      i = lt + 1
      continue
    }
    const rawName = openMatch[1].toLowerCase()
    const parsed = parseAttrs(input, lt + 1 + openMatch[1].length)
    if (parsed.failed) {
      out.push(escapeText(input.slice(lt, parsed.end)))
      i = parsed.end
      continue
    }
    i = parsed.end

    if (DROP_CONTENT_TAGS.has(rawName)) {
      i = findRawContentEnd(input, rawName)
      continue
    }

    const name = RENAME_TAGS[rawName] ?? rawName
    if (!ALLOWED_TAGS.has(name)) continue

    for (;;) {
      const top = stack[stack.length - 1]
      if (top === undefined || !(CLOSES_ON_OPEN[name]?.includes(top) ?? false)) break
      stack.pop()
      out.push(`</${top}>`)
    }

    const attrAllowlist = ALLOWED_ATTRS[name]
    const parts: string[] = [`<${name}`]
    for (const [attr, value] of parsed.attrs) {
      if (!attrAllowlist?.has(attr)) continue
      if (attr === 'href' || attr === 'src') {
        const safe = sanitizeUrl(value, attr === 'href')
        if (safe === null) continue
        parts.push(` ${attr}="${escapeAttrValue(safe)}"`)
        continue
      }
      if (attr === 'colspan' || attr === 'rowspan') {
        const span = Number.parseInt(value, 10)
        if (!Number.isInteger(span) || span < 1 || span > 1000) continue
        parts.push(` ${attr}="${String(span)}"`)
        continue
      }
      parts.push(` ${attr}="${escapeAttrValue(value)}"`)
    }
    if (name === 'a') parts.push(' rel="noopener"')

    if (VOID_TAGS.has(name)) {
      parts.push('>')
      out.push(parts.join(''))
      continue
    }
    if (parsed.selfClosing) {
      parts.push('></' + name + '>')
      out.push(parts.join(''))
      continue
    }
    parts.push('>')
    out.push(parts.join(''))
    stack.push(name)
  }

  while (stack.length > 0) {
    const name = stack.pop()
    if (name) out.push(`</${name}>`)
  }
  return out.join('')
}
