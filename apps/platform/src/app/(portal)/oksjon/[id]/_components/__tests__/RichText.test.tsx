import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { RichText, richTextBlocks } from '../RichText'

function lexicalDoc(children: unknown[]): string {
  return JSON.stringify({ root: { type: 'root', children } })
}

function textNode(text: string): unknown {
  return { type: 'text', text, mode: 'normal', version: 1 }
}

function block(type: string, extra: Record<string, unknown>, text: string): unknown {
  return { type, version: 1, ...extra, children: [textNode(text)] }
}

describe('richTextBlocks', () => {
  it('returns no blocks for null or blank input', () => {
    expect(richTextBlocks(null)).toEqual([])
    expect(richTextBlocks('   ')).toEqual([])
  })

  it('keeps heading blocks from Lexical JSON', () => {
    const value = lexicalDoc([
      block('heading', { tag: 'h2' }, 'Raieõigus'),
      block('paragraph', {}, 'Esimene lõik.'),
      block('paragraph', {}, 'Teine lõik.'),
    ])

    expect(richTextBlocks(value)).toEqual([
      { kind: 'heading', text: 'Raieõigus' },
      { kind: 'paragraph', text: 'Esimene lõik.' },
      { kind: 'paragraph', text: 'Teine lõik.' },
    ])
  })

  it('renders heading blocks as h3 elements', () => {
    const value = lexicalDoc([
      block('heading', { tag: 'h3' }, 'Lisatingimused'),
      block('paragraph', {}, 'Tekst.'),
    ])

    const html = renderToString(createElement(RichText, { blocks: richTextBlocks(value) }))
    expect(html).toContain('<h3')
    expect(html).toContain('Lisatingimused')
  })

  it('splits list items into separate paragraph blocks', () => {
    const value = lexicalDoc([
      block('heading', { tag: 'h2' }, 'Tingimused'),
      {
        type: 'list',
        listType: 'bullet',
        version: 1,
        children: [
          block('listitem', {}, 'Esimene punkt.'),
          block('listitem', {}, 'Teine punkt.'),
        ],
      },
    ])

    expect(richTextBlocks(value)).toEqual([
      { kind: 'heading', text: 'Tingimused' },
      { kind: 'paragraph', text: 'Esimene punkt.' },
      { kind: 'paragraph', text: 'Teine punkt.' },
    ])
  })

  it('joins inline text nodes within one block', () => {
    const value = lexicalDoc([
      {
        type: 'paragraph',
        version: 1,
        children: [
          { type: 'link', version: 1, children: [textNode('Link ')] },
          textNode('jätkub'),
        ],
      },
    ])

    expect(richTextBlocks(value)).toEqual([
      { kind: 'paragraph', text: 'Link jätkub' },
    ])
  })

  it('falls back to plain-text paragraphs for non-JSON input', () => {
    expect(richTextBlocks('Esimene rida\n\nTeine rida')).toEqual([
      { kind: 'paragraph', text: 'Esimene rida' },
      { kind: 'paragraph', text: 'Teine rida' },
    ])
  })

  it('returns no blocks for JSON without text', () => {
    expect(richTextBlocks(lexicalDoc([]))).toEqual([])
  })

  it('renders nothing for an empty block list', () => {
    expect(renderToString(createElement(RichText, { blocks: [] }))).toBe('')
  })
})
