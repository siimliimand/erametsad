import { describe, expect, it } from 'vitest'

import {
  formatCountdown,
  REVEAL_GRACE_MS,
  SIGNATURE_TTL_MS,
} from '../_components/use-ceremony-clock'

describe('formatCountdown', () => {
  it('clamps non-positive remainders to 0:00', () => {
    expect(formatCountdown(0)).toBe('0:00')
    expect(formatCountdown(-1500)).toBe('0:00')
  })

  it('formats minutes with zero-padded seconds', () => {
    expect(formatCountdown(5000)).toBe('0:05')
    expect(formatCountdown(60000)).toBe('1:00')
    expect(formatCountdown(65000)).toBe('1:05')
    expect(formatCountdown(600000)).toBe('10:00')
  })
})

describe('ceremony display constants', () => {
  it('mirror the server ceremony windows', () => {
    expect(REVEAL_GRACE_MS).toBe(60000)
    expect(SIGNATURE_TTL_MS).toBe(1800000)
  })
})
