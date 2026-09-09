import { describe, expect, it } from 'vitest'

import { formatAuditDateTime } from '../../../../_lib/labels'

/**
 * Task 4.7: the audit viewer formats createdAt with millisecond precision,
 * always in Europe/Tallinn regardless of the process zone.
 */
describe('formatAuditDateTime', () => {
  it('renders millisecond precision', () => {
    const formatted = formatAuditDateTime('2026-01-15T10:20:30.456Z')
    // Milliseconds are zone-independent; the wall clock must keep them.
    expect(formatted).toMatch(/\.456$/)
  })

  it('renders the Europe/Tallinn wall clock (UTC+2 in winter, UTC+3 in summer)', () => {
    // 10:20:30 UTC is 12:20:30 in Tallinn winter time.
    expect(formatAuditDateTime('2026-01-15T10:20:30.123Z')).toContain('12:20:30.123')
    expect(formatAuditDateTime('2026-01-15T10:20:30.123Z')).toContain('15.01.2026')
    // 10:20:30 UTC is 13:20:30 in Tallinn summer time.
    expect(formatAuditDateTime('2026-07-15T10:20:30.789Z')).toContain('13:20:30.789')
  })

  it('keeps the empty and invalid fallbacks', () => {
    expect(formatAuditDateTime(null)).toBe('—')
    expect(formatAuditDateTime(undefined)).toBe('—')
    expect(formatAuditDateTime('pole-kuupäev')).toBe('pole-kuupäev')
  })
})
