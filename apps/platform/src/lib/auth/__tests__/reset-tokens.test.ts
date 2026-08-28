import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  RESET_TOKEN_TTL_MS,
  consumeResetToken,
  createResetToken,
} from '../reset-tokens'

describe('reset tokens', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('consumes a valid token once and returns the user id', async () => {
    const token = await createResetToken('user-1')

    expect(await consumeResetToken(token)).toBe('user-1')
    expect(await consumeResetToken(token)).toBeNull()
  })

  it('rejects an unknown token', async () => {
    expect(await consumeResetToken('does-not-exist')).toBeNull()
  })

  it('rejects an expired token', async () => {
    const token = await createResetToken('user-1')

    vi.setSystemTime(Date.now() + RESET_TOKEN_TTL_MS + 1)

    expect(await consumeResetToken(token)).toBeNull()
  })

  it('rejects a reused token even after the password was set', async () => {
    const token = await createResetToken('user-2')

    expect(await consumeResetToken(token)).toBe('user-2')
    vi.setSystemTime(Date.now() + 1000)
    expect(await consumeResetToken(token)).toBeNull()
  })
})
