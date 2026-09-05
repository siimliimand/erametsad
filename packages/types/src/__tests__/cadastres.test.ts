import { describe, it, expect } from 'vitest'

import {
  EECadastralList,
  parseCadastres,
  splitCadastreInput,
} from '../cadastres'

describe('splitCadastreInput', () => {
  it('splits a single code', () => {
    expect(splitCadastreInput('12345:001:0001')).toEqual(['12345:001:0001'])
  })

  it('splits on spaces', () => {
    expect(splitCadastreInput('12345:001:0001 12345:001:0002')).toEqual([
      '12345:001:0001',
      '12345:001:0002',
    ])
  })

  it('splits on commas', () => {
    expect(splitCadastreInput('12345:001:0001,12345:001:0002')).toEqual([
      '12345:001:0001',
      '12345:001:0002',
    ])
  })

  it('splits on newlines and collapses duplicate separators', () => {
    expect(
      splitCadastreInput('12345:001:0001,\n 12345:001:0002 , 12345:001:0003'),
    ).toEqual(['12345:001:0001', '12345:001:0002', '12345:001:0003'])
  })

  it('returns empty list for empty input', () => {
    expect(splitCadastreInput('')).toEqual([])
    expect(splitCadastreInput('  ,  ')).toEqual([])
  })

  it('accepts an array of entries', () => {
    expect(splitCadastreInput(['12345:001:0001', '12345:001:0002'])).toEqual([
      '12345:001:0001',
      '12345:001:0002',
    ])
  })

  it('tolerates comma-joined entries inside array items', () => {
    expect(splitCadastreInput(['12345:001:0001, 12345:001:0002'])).toEqual([
      '12345:001:0001',
      '12345:001:0002',
    ])
  })
})

describe('parseCadastres', () => {
  it('parses valid mixed input', () => {
    const result = parseCadastres('12345:001:0001, 67890:002:0003 45678:003:0004')
    expect(result.cadastres).toEqual([
      '12345:001:0001',
      '67890:002:0003',
      '45678:003:0004',
    ])
    expect(result.invalid).toEqual([])
  })

  it('rejects an invalid entry with index info', () => {
    const result = parseCadastres('12345:001:0001, not-a-cadastre')
    expect(result.cadastres).toEqual(['12345:001:0001'])
    expect(result.invalid).toEqual([{ index: 2, value: 'not-a-cadastre' }])
  })

  it('reports index info for multiple invalid entries', () => {
    const result = parseCadastres(['1234:001:0001', '12345:001:0002', 'x'])
    expect(result.cadastres).toEqual(['12345:001:0002'])
    expect(result.invalid).toEqual([
      { index: 1, value: '1234:001:0001' },
      { index: 3, value: 'x' },
    ])
  })

  it('rejects entries with wrong digit counts', () => {
    const result = parseCadastres('123456:001:0001')
    expect(result.cadastres).toEqual([])
    expect(result.invalid).toEqual([{ index: 1, value: '123456:001:0001' }])
  })
})

describe('EECadastralList', () => {
  it('accepts a tolerant single string and outputs an array', () => {
    const result = EECadastralList.safeParse('12345:001:0001, 67890:002:0003')
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual(['12345:001:0001', '67890:002:0003'])
    }
  })

  it('accepts an array input', () => {
    const result = EECadastralList.safeParse(['12345:001:0001'])
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual(['12345:001:0001'])
    }
  })

  it('rejects an empty string with an at-least-one message', () => {
    const result = EECadastralList.safeParse('  ')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        'Sisestage vähemalt üks katastriüksus',
      )
    }
  })

  it('rejects invalid entries with per-entry index messages', () => {
    const result = EECadastralList.safeParse('12345:001:0001, oops')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toEqual([
        '2. katastriüksus peab vastama vormingule NNNNN:NNN:NNNN',
      ])
    }
  })

  it('rejects non-string non-array input', () => {
    expect(EECadastralList.safeParse(42).success).toBe(false)
    expect(EECadastralList.safeParse(null).success).toBe(false)
  })

  it('rejects an array containing non-strings', () => {
    expect(EECadastralList.safeParse(['12345:001:0001', 5]).success).toBe(false)
  })
})
