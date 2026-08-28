import { describe, expect, it } from 'vitest'

import { JsonFieldError } from '../errors'
import { decodeJsonFields, encodeJsonFields, parseJsonText, stringifyJsonText } from '../json-fields'
import { auctionsJsonFields, coreCollections, notificationsJsonFields } from '../registry'

describe('parseJsonText', () => {
  it('parses a json object', () => {
    expect(parseJsonText('payload', '{"a":1}', 'json')).toEqual({ a: 1 })
  })

  it('parses a json array under the json kind', () => {
    expect(parseJsonText('deadlines', '[1,2]', 'json')).toEqual([1, 2])
  })

  it('parses an array under the array kind', () => {
    expect(parseJsonText('cadastres', '[{"nr":"1"}]', 'array')).toEqual([{ nr: '1' }])
  })

  it('passes null through', () => {
    expect(parseJsonText('payload', null, 'json')).toBeNull()
  })

  it('rejects a non-array under the array kind', () => {
    expect(() => parseJsonText('cadastres', '{"nr":"1"}', 'array')).toThrow(JsonFieldError)
  })

  it('rejects invalid JSON text', () => {
    expect(() => parseJsonText('payload', '{nope', 'json')).toThrow(JsonFieldError)
  })

  it('rejects non-TEXT stored values', () => {
    expect(() => parseJsonText('payload', 42, 'json')).toThrow(JsonFieldError)
  })
})

describe('stringifyJsonText', () => {
  it('serializes objects', () => {
    expect(stringifyJsonText('payload', { a: 1 })).toBe('{"a":1}')
  })

  it('serializes arrays', () => {
    expect(stringifyJsonText('cadastres', [{ nr: '1' }])).toBe('[{"nr":"1"}]')
  })

  it('keeps null as null', () => {
    expect(stringifyJsonText('payload', null)).toBeNull()
  })
})

describe('decodeJsonFields / encodeJsonFields', () => {
  it('decodes every configured field of a row', () => {
    const row = {
      id: 'a1',
      cadastres: '[{"nr":"123"}]',
      deadlines: '{"viewing":"2026-09-01"}',
      minBidCents: 50000,
    }
    const doc = decodeJsonFields(row, auctionsJsonFields)
    expect(doc.cadastres).toEqual([{ nr: '123' }])
    expect(doc.deadlines).toEqual({ viewing: '2026-09-01' })
    expect(doc.minBidCents).toBe(50000)
  })

  it('encodes parsed values back to TEXT', () => {
    const data = { id: 'n1', payload: { amount: 10 } }
    const encoded = encodeJsonFields(data, notificationsJsonFields)
    expect(encoded.payload).toBe('{"amount":10}')
  })

  it('round-trips decode after encode', () => {
    const data = { payload: { a: [1, 2] } }
    const encoded = encodeJsonFields(data, notificationsJsonFields)
    const decoded = decodeJsonFields({ payload: encoded.payload }, notificationsJsonFields)
    expect(decoded.payload).toEqual({ a: [1, 2] })
  })

  it('drops undefined fields on encode so updates leave them untouched', () => {
    const encoded = encodeJsonFields({ payload: undefined, event: 'bid.created' }, notificationsJsonFields)
    expect('payload' in encoded).toBe(false)
    expect(encoded.event).toBe('bid.created')
  })

  it('keeps null on encode and decode', () => {
    const encoded = encodeJsonFields({ payload: null }, notificationsJsonFields)
    expect(encoded.payload).toBeNull()
    expect(decodeJsonFields({ payload: null }, notificationsJsonFields).payload).toBeNull()
  })

  it('returns the row unchanged for collections without json fields', () => {
    const row = { id: 'b1', status: 'leading' }
    expect(decodeJsonFields(row, coreCollections.bids.jsonFields)).toBe(row)
  })

  it('throws on corrupt stored JSON', () => {
    expect(() => decodeJsonFields({ cadastres: 'oops' }, auctionsJsonFields)).toThrow(JsonFieldError)
  })
})
