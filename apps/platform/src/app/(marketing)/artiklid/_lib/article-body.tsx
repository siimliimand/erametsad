import type { ReactNode } from 'react'

import { headingAnchor } from './article-text'

// Lexical text format flags.
const FORMAT_BOLD = 1
const FORMAT_ITALIC = 2
const FORMAT_STRIKETHROUGH = 4
const FORMAT_UNDERLINE = 8
const FORMAT_CODE = 16

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function childrenOf(node: unknown): unknown[] {
  if (!isRecord(node) || !Array.isArray(node.children)) return []
  return node.children
}

function renderText(node: Record<string, unknown>, key: number): ReactNode {
  const text = typeof node.text === 'string' ? node.text : ''
  const format = typeof node.format === 'number' ? node.format : 0
  let out: ReactNode = text
  if (format & FORMAT_CODE) out = <code key={key}>{out}</code>
  if (format & FORMAT_BOLD) out = <strong key={key}>{out}</strong>
  if (format & FORMAT_ITALIC) out = <em key={key}>{out}</em>
  if (format & FORMAT_STRIKETHROUGH) out = <s key={key}>{out}</s>
  if (format & FORMAT_UNDERLINE) out = <u key={key}>{out}</u>
  return out
}

function renderInline(nodes: unknown[]): ReactNode[] {
  return nodes.map((node, index): ReactNode => {
    if (!isRecord(node)) return null
    if (node.type === 'linebreak') return <br key={index} />
    if (node.type === 'link' || node.type === 'autolink') {
      const url = typeof node.url === 'string' ? node.url : '#'
      return (
        <a
          key={index}
          href={url}
          className="font-semibold text-primary underline hover:no-underline"
        >
          {renderInline(childrenOf(node))}
        </a>
      )
    }
    if (typeof node.text === 'string') return renderText(node, index)
    if (Array.isArray(node.children)) return <span key={index}>{renderInline(node.children)}</span>
    return null
  })
}

function headingTag(node: Record<string, unknown>): 'h2' | 'h3' {
  return node.tag === 'h3' ? 'h3' : 'h2'
}

function anchorTextOf(node: unknown): string {
  return childrenOf(node)
    .map((child) => (isRecord(child) && typeof child.text === 'string' ? child.text : ''))
    .join('')
    .trim()
}

function renderBlock(node: unknown, index: number): ReactNode {
  if (!isRecord(node)) return null
  const inline = renderInline(childrenOf(node))
  switch (node.type) {
    case 'heading': {
      const Tag = headingTag(node)
      return (
        <Tag key={index} id={headingAnchor(anchorTextOf(node), index)} className="scroll-mt-28 lg:scroll-mt-20">
          {inline}
        </Tag>
      )
    }
    case 'quote':
      return (
        <blockquote
          key={index}
          className="border-l-4 border-accent bg-bgMist px-md py-sm text-ink"
        >
          {inline}
        </blockquote>
      )
    case 'list': {
      const ordered = node.listType === 'number'
      const items = childrenOf(node).map((item, itemIndex) => (
        <li key={itemIndex} className="leading-relaxed">
          {renderBlock(item, itemIndex) ?? renderInline(childrenOf(item))}
        </li>
      ))
      return ordered ? (
        <ol key={index} className="list-decimal space-y-2 pl-6 marker:text-primary">
          {items}
        </ol>
      ) : (
        <ul key={index} className="list-disc space-y-2 pl-6 marker:text-primary">
          {items}
        </ul>
      )
    }
    case 'listitem':
      return <span key={index}>{inline}</span>
    case 'paragraph':
      return (
        <p key={index} className="leading-relaxed">
          {inline}
        </p>
      )
    default:
      if (Array.isArray(node.children)) {
        return (
          <p key={index} className="leading-relaxed">
            {renderInline(node.children)}
          </p>
        )
      }
      return null
  }
}

/**
 * Renders Payload richText (raw Lexical JSON TEXT) as article body blocks.
 * Unparsable content falls back to a plain paragraph, mirroring
 * article-text.ts.
 */
export function ArticleRichText({ content }: { content: string }) {
  let children: unknown[] | null
  try {
    const parsed: unknown = JSON.parse(content)
    children =
      isRecord(parsed) && isRecord(parsed.root) && Array.isArray(parsed.root.children)
        ? parsed.root.children
        : null
  } catch {
    children = null
  }

  if (!children) {
    return <p className="leading-relaxed">{content}</p>
  }

  return (
    <div className="space-y-md text-body text-inkMuted">{children.map(renderBlock)}</div>
  )
}
