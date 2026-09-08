import type { ReactNode } from 'react'

/**
 * Fallback renderer for pages without `page_blocks` rows: the legacy
 * `pages.layout` column stores Payload-style blocks as TEXT-JSON. Shapes
 * follow the seeded data; anything unparsable or of an unknown blockType is
 * skipped, so a legacy page always renders without error.
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined
}

interface LexicalNodeLike {
  text?: unknown
  children?: unknown
}

// Legacy richText columns store raw Lexical JSON; unwrap paragraph texts,
// echoing unparsable values as-is (same approach as the specialist bio).
function richTextParagraphs(value: unknown): string[] {
  if (typeof value === 'string') {
    return value.trim() !== '' ? [value.trim()] : []
  }
  if (!isRecord(value) || !isRecord(value.root) || !Array.isArray(value.root.children)) {
    return []
  }
  const nodeText = (node: unknown): string => {
    if (typeof (node as LexicalNodeLike).text === 'string') {
      return (node as LexicalNodeLike).text as string
    }
    const children = (node as LexicalNodeLike).children
    if (!Array.isArray(children)) return ''
    return children.map((child) => nodeText(child)).join('')
  }
  return value.root.children
    .map((child) => nodeText(child))
    .filter((paragraph) => paragraph !== '')
}

interface LegacyRow {
  title?: string
  body?: ReactNode
}

function notNull<T>(value: T | null): value is T {
  return value !== null
}

function cardRows(entry: Record<string, unknown>): LegacyRow[] {
  const rows = entry.cards ?? entry.steps
  if (!Array.isArray(rows)) return []
  return rows
    .filter(isRecord)
    .map((row): LegacyRow | null => {
      const title = text(row.title)
      if (title === undefined) return null
      const description = text(row.description)
      return {
        title,
        body:
          description !== undefined ? (
            <p className="mt-xs text-bodySm text-inkMuted">{description}</p>
          ) : null,
      }
    })
    .filter(notNull)
}

function Paragraphs({ body }: { body: string }) {
  const blocks = body
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph !== '')
  return (
    <div className="space-y-sm text-body text-inkMuted">
      {blocks.map((paragraph) => (
        <p key={paragraph.slice(0, 40)}>{paragraph}</p>
      ))}
    </div>
  )
}

function legacySection(entry: Record<string, unknown>): LegacyRow | null {
  switch (entry.blockType) {
    case 'hero':
    case 'text': {
      const heading = text(entry.heading)
      const bodyText = [
        ...richTextParagraphs(entry.content),
        ...richTextParagraphs(entry.subheading),
      ].join('\n\n')
      if (heading === undefined && bodyText === '') return null
      return {
        ...(heading !== undefined ? { title: heading } : {}),
        body: bodyText !== '' ? <Paragraphs body={bodyText} /> : null,
      }
    }
    case 'cards':
    case 'steps': {
      const rows = cardRows(entry)
      if (rows.length === 0) return null
      const heading = text(entry.heading)
      return {
        ...(heading !== undefined ? { title: heading } : {}),
        body: (
          <ul className="grid gap-lg sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((row, index) => (
              <li key={[row.title, index].join('-')} className="rounded-card bg-bgPage p-6 shadow-card">
                <h3 className="font-heading text-h4 text-ink">{row.title}</h3>
                {row.body}
              </li>
            ))}
          </ul>
        ),
      }
    }
    case 'accordion': {
      const rows = Array.isArray(entry.items) ? entry.items : []
      const items = rows
        .filter(isRecord)
        .map((row) => {
          const title = text(row.title)
          const body = richTextParagraphs(row.content).join('\n\n')
          return title !== undefined && body !== '' ? { title, body } : null
        })
        .filter((row): row is { title: string; body: string } => row !== null)
      if (items.length === 0) return null
      const heading = text(entry.heading)
      return {
        ...(heading !== undefined ? { title: heading } : {}),
        body: (
          <div className="space-y-sm">
            {items.map((item, index) => (
              <details
                key={[item.title, index].join('-')}
                className="rounded-card border border-border bg-bgPage px-md py-sm shadow-card"
              >
                <summary className="cursor-pointer font-medium text-ink">{item.title}</summary>
                <p className="mt-xs text-body text-inkMuted">{item.body}</p>
              </details>
            ))}
          </div>
        ),
      }
    }
    case 'stats': {
      const rows = Array.isArray(entry.items) ? entry.items : []
      const items = rows
        .filter(isRecord)
        .map((row) => ({ value: text(row.value), label: text(row.label) }))
        .filter(
          (row): row is { value: string; label: string } =>
            row.value !== undefined && row.label !== undefined,
        )
      if (items.length === 0) return null
      return {
        body: (
          <div className="grid gap-lg text-center sm:grid-cols-2 md:grid-cols-4">
            {items.map((item, index) => (
              <div key={[item.label, index].join('-')}>
                <p
                  className="font-heading text-h1 text-ink"
                  style={{ fontFeatureSettings: '"tnum" 1' }}
                >
                  {item.value}
                </p>
                <p className="mt-xs text-body text-inkMuted">{item.label}</p>
              </div>
            ))}
          </div>
        ),
      }
    }
    case 'cta': {
      const body = text(entry.text)
      const buttonLabel = text(entry.buttonText)
      const buttonHref = text(entry.buttonLink)
      if (body === undefined) return null
      return {
        body: (
          <>
            <p className="max-w-container-sm text-body text-inkMuted">{body}</p>
            {buttonLabel !== undefined && buttonHref !== undefined && (
              <a
                href={buttonHref}
                className="mt-md inline-flex h-12 items-center justify-center rounded-button bg-primary px-6 font-label font-semibold text-ink-inverse transition-all duration-hover ease-hover hover:bg-primary-hover motion-reduce:transition-none"
              >
                {buttonLabel}
              </a>
            )}
          </>
        ),
      }
    }
    default:
      // Unknown legacy blockType (testimonial, ...): skipped, never thrown.
      return null
  }
}

export function LegacyPageLayout({ title, layout }: { title: string; layout: unknown }) {
  const sections = Array.isArray(layout)
    ? layout.filter(isRecord).map(legacySection).filter((section): section is LegacyRow => section !== null)
    : []
  return (
    <article>
      <header className="mx-auto max-w-container-xl px-md pt-xl md:px-lg">
        <h1 className="font-heading text-h1 text-ink">{title}</h1>
      </header>
      {sections.map((section, index) => (
        <section key={[section.title, index].join('-')} className={index % 2 === 1 ? 'bg-bgMist' : ''}>
          <div className="mx-auto max-w-container-xl px-md py-xl md:px-lg">
            {section.title !== undefined && (
              <h2 className="font-heading text-h2 text-ink">{section.title}</h2>
            )}
            <div className={section.title !== undefined ? 'mt-md' : ''}>{section.body}</div>
          </div>
        </section>
      ))}
    </article>
  )
}
