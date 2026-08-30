import { describe, expect, it } from 'vitest'

import { JsonFieldError } from '../errors'
import { decodeJsonFields, encodeJsonFields } from '../json-fields'
import { articlesJsonFields, contentCollections, pagesJsonFields } from '../registry'

describe('articles TEXT-JSON fields', () => {
  it('encodes the tags array to TEXT JSON', () => {
    const encoded = encodeJsonFields({ tags: ['mets', 'oksjon'] }, articlesJsonFields)
    expect(encoded.tags).toBe('["mets","oksjon"]')
  })

  it('decodes stored tags back to an array', () => {
    const doc = decodeJsonFields({ tags: '["mets","oksjon"]' }, articlesJsonFields)
    expect(doc.tags).toEqual(['mets', 'oksjon'])
  })

  it('round-trips tags through encode then decode', () => {
    const encoded = encodeJsonFields({ tags: ['a', 'b'] }, articlesJsonFields)
    expect(decodeJsonFields(encoded, articlesJsonFields).tags).toEqual(['a', 'b'])
  })

  it('rejects a stored tags value that is not a JSON array', () => {
    expect(() => decodeJsonFields({ tags: '"mets"' }, articlesJsonFields)).toThrow(JsonFieldError)
  })

  it('leaves the richText content column as raw TEXT', () => {
    const content = '{"root":{"children":[]}}'
    const doc = decodeJsonFields({ content }, contentCollections.articles.jsonFields)
    expect(doc.content).toBe(content)
    const encoded = encodeJsonFields({ content }, contentCollections.articles.jsonFields)
    expect(encoded.content).toBe(content)
  })
})

describe('pages TEXT-JSON fields', () => {
  it('encodes the layout blocks to TEXT JSON', () => {
    const layout = [{ hero: { heading: 'Osta mets' } }, { form: { formType: 'lead' } }]
    const encoded = encodeJsonFields({ layout }, pagesJsonFields)
    expect(encoded.layout).toBe(JSON.stringify(layout))
  })

  it('decodes stored layout blocks back to an object tree', () => {
    const layout = [{ cta: { text: 'Vota uhendust', buttonText: 'Saada' } }]
    const raw = JSON.stringify(layout)
    const doc = decodeJsonFields({ layout: raw }, pagesJsonFields)
    expect(doc.layout).toEqual(layout)
  })

  it('keeps a null layout as null', () => {
    expect(encodeJsonFields({ layout: null }, pagesJsonFields).layout).toBeNull()
    expect(decodeJsonFields({ layout: null }, pagesJsonFields).layout).toBeNull()
  })

  it('throws on corrupt stored layout JSON', () => {
    expect(() => decodeJsonFields({ layout: 'oops' }, pagesJsonFields)).toThrow(JsonFieldError)
  })
})

describe('content collections without json fields', () => {
  it('passes rows through unchanged', () => {
    const row = { id: 'r1', from: '/vana', to: '/uus', type: '301' }
    expect(decodeJsonFields(row, contentCollections.redirects.jsonFields)).toBe(row)
  })
})
