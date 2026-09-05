import { describe, expect, it } from 'vitest'

import {
  AUCTION_DEFAULTS_KEY,
  defaultAuctionDefaults,
  isValidReason,
  maskSecretValues,
  mergeFlagPayload,
  parseAuctionDefaults,
  parseFlagObject,
  readAuctionDefaultsFromFlags,
  withAuctionDefaults,
} from './settings-audit'

describe('isValidReason', () => {
  it('rejects reasons shorter than 5 characters', () => {
    expect(isValidReason('')).toBe(false)
    expect(isValidReason('  a  ')).toBe(false)
    expect(isValidReason('ab c')).toBe(false)
  })

  it('accepts reasons with at least 5 characters', () => {
    expect(isValidReason('fee update')).toBe(true)
    expect(isValidReason('  tasu muudatus  ')).toBe(true)
  })
})

describe('maskSecretValues', () => {
  it('masks secret string values but keeps other values', () => {
    const input = {
      apiKey: 'sk-123',
      vatPercent: 22,
      nested: { apiToken: 't', label: 'keep' },
      emptySecret: '',
    }
    expect(maskSecretValues(input)).toEqual({
      apiKey: '<salajane>',
      vatPercent: 22,
      nested: { apiToken: '<salajane>', label: 'keep' },
      emptySecret: '',
    })
  })

  it('masks values inside arrays', () => {
    expect(maskSecretValues([{ password: 'x' }, { keep: 'y' }])).toEqual([
      { password: '<salajane>' },
      { keep: 'y' },
    ])
  })

  it('leaves non secret keys untouched', () => {
    expect(maskSecretValues({ featureFlags: { map_view: true }, monkey: 1 })).toEqual({
      featureFlags: { map_view: true },
      monkey: 1,
    })
  })
})

describe('auction defaults flag storage', () => {
  it('falls back to defaults for missing or invalid flags', () => {
    expect(readAuctionDefaultsFromFlags({})).toEqual(defaultAuctionDefaults)
    expect(readAuctionDefaultsFromFlags({ [AUCTION_DEFAULTS_KEY]: 'nope' })).toEqual(
      defaultAuctionDefaults,
    )
    expect(
      readAuctionDefaultsFromFlags({
        [AUCTION_DEFAULTS_KEY]: { alapakkumineDecisionDeadlineDays: 99, kiiroksjonDurationHours: 1 },
      }),
    ).toEqual(defaultAuctionDefaults)
  })

  it('reads valid stored values', () => {
    expect(
      readAuctionDefaultsFromFlags({
        [AUCTION_DEFAULTS_KEY]: {
          alapakkumineDecisionDeadlineDays: 7,
          kiiroksjonDurationHours: 48,
          sealedApproverRole: 'admin',
        },
      }),
    ).toEqual({
      alapakkumineDecisionDeadlineDays: 7,
      kiiroksjonDurationHours: 48,
      sealedApproverRole: 'admin',
    })
  })

  it('validates raw form input against the spec bounds', () => {
    expect(
      parseAuctionDefaults({
        alapakkumineDecisionDeadlineDays: 3,
        kiiroksjonDurationHours: 48,
        sealedApproverRole: 'superadmin',
      }),
    ).toEqual({
      ok: true,
      value: {
        alapakkumineDecisionDeadlineDays: 3,
        kiiroksjonDurationHours: 48,
        sealedApproverRole: 'superadmin',
      },
    })
    expect(
      parseAuctionDefaults({
        alapakkumineDecisionDeadlineDays: 0,
        kiiroksjonDurationHours: 48,
        sealedApproverRole: 'superadmin',
      }),
    ).toMatchObject({ ok: false })
    expect(
      parseAuctionDefaults({
        alapakkumineDecisionDeadlineDays: 3,
        kiiroksjonDurationHours: 73,
        sealedApproverRole: 'superadmin',
      }),
    ).toMatchObject({ ok: false })
    expect(
      parseAuctionDefaults({
        alapakkumineDecisionDeadlineDays: 3,
        kiiroksjonDurationHours: 48,
        sealedApproverRole: 'specialist',
      }),
    ).toMatchObject({ ok: false })
  })

  it('merges defaults into the current flags without dropping user flags', () => {
    const current = { requireFrameworkContract: true, [AUCTION_DEFAULTS_KEY]: { old: true } }
    const next = withAuctionDefaults(current, {
      alapakkumineDecisionDeadlineDays: 5,
      kiiroksjonDurationHours: 24,
      sealedApproverRole: 'admin',
    })
    expect(next.requireFrameworkContract).toBe(true)
    expect(next[AUCTION_DEFAULTS_KEY]).toEqual({
      alapakkumineDecisionDeadlineDays: 5,
      kiiroksjonDurationHours: 24,
      sealedApproverRole: 'admin',
    })
  })
})

describe('flag payload merge (Lipud section)', () => {
  it('preserves the reserved auctionDefaults key from current flags', () => {
    const current = { [AUCTION_DEFAULTS_KEY]: { kiiroksjonDurationHours: 48 }, map_view: true }
    const merged = mergeFlagPayload(current, { map_view: false, sms_notifications: true })
    expect(merged).toEqual({
      map_view: false,
      sms_notifications: true,
      [AUCTION_DEFAULTS_KEY]: { kiiroksjonDurationHours: 48 },
    })
  })

  it('ignores a pasted auctionDefaults payload', () => {
    const current = { [AUCTION_DEFAULTS_KEY]: { kiiroksjonDurationHours: 48 } }
    const merged = mergeFlagPayload(current, { [AUCTION_DEFAULTS_KEY]: { hacked: true } })
    expect(merged).toEqual({ [AUCTION_DEFAULTS_KEY]: { kiiroksjonDurationHours: 48 } })
  })

  it('omits the reserved key when it does not exist yet', () => {
    expect(mergeFlagPayload({}, { map_view: true })).toEqual({ map_view: true })
  })
})

describe('parseFlagObject', () => {
  it('accepts empty input as an empty object', () => {
    expect(parseFlagObject('')).toEqual({ ok: true, value: {} })
    expect(parseFlagObject('   ')).toEqual({ ok: true, value: {} })
  })

  it('rejects invalid JSON and non objects', () => {
    expect(parseFlagObject('{nope')).toMatchObject({ ok: false })
    expect(parseFlagObject('[1,2]')).toMatchObject({ ok: false })
    expect(parseFlagObject('"text"')).toMatchObject({ ok: false })
  })

  it('parses a valid flags object', () => {
    expect(parseFlagObject('{"map_view":true}')).toEqual({ ok: true, value: { map_view: true } })
  })
})
