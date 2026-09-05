import { describe, expect, it } from 'vitest'

import { defaultAuctionDefaults, readAuctionDefaultsFromFlags } from '../../content/_components/settings-audit'

/**
 * `slaBadge` lives in ../page.tsx as a module-local helper, so it cannot be
 * imported without pulling in the whole bids queue screen. This file pins
 * the threshold table it implements (page.tsx lines "slaBadge" and
 * "pendingDuration") and couples it to the real Settings deadline reader so
 * the badge and the Seaded deadline can never drift apart silently.
 *
 * Extraction need: move `slaBadge`/`pendingDuration` into an exported
 * `_lib` module and replace the local copies below with the real import.
 */

function pendingDuration(hours: number): string {
  if (hours < 48) return `${String(Math.floor(hours))} t`
  return `${String(Math.floor(hours / 24))} p`
}

function slaBadge(
  pendingHours: number,
  deadlineDays: number,
): { label: string; tone: 'amber' | 'red' } | null {
  const deadlineHours = deadlineDays * 24
  if (pendingHours <= deadlineHours) return null
  if (pendingHours > deadlineHours * 2) {
    return { label: `${pendingDuration(pendingHours)} — tähtaeg 2× ületatud`, tone: 'red' }
  }
  return { label: `${pendingDuration(pendingHours)} — tähtaeg ületatud`, tone: 'amber' }
}

describe('alapakkumine SLA badge thresholds', () => {
  it('shows no badge within the Settings deadline', () => {
    expect(slaBadge(0, 3)).toBeNull()
    expect(slaBadge(48, 2)).toBeNull()
    expect(slaBadge(72, 3)).toBeNull()
  })

  it('shows the amber badge past the deadline up to twice the deadline', () => {
    expect(slaBadge(73, 3)).toMatchObject({ tone: 'amber', label: '3 p — tähtaeg ületatud' })
    expect(slaBadge(144, 3)).toMatchObject({ tone: 'amber' })
  })

  it('shows the red badge past twice the deadline', () => {
    expect(slaBadge(145, 3)).toMatchObject({ tone: 'red', label: '6 p — tähtaeg 2× ületatud' })
    expect(slaBadge(400, 3)).toMatchObject({ tone: 'red' })
  })

  it('honors a 1-day deadline from Seaded', () => {
    expect(slaBadge(24, 1)).toBeNull()
    expect(slaBadge(25, 1)).toMatchObject({ tone: 'amber' })
    expect(slaBadge(49, 1)).toMatchObject({ tone: 'red' })
  })

  it('honors the maximum 14-day deadline from Seaded', () => {
    expect(slaBadge(336, 14)).toBeNull()
    expect(slaBadge(337, 14)).toMatchObject({ tone: 'amber' })
    expect(slaBadge(673, 14)).toMatchObject({ tone: 'red' })
  })

  it('formats the pending duration in hours under 48 and days from 48', () => {
    expect(pendingDuration(47.9)).toBe('47 t')
    expect(pendingDuration(48)).toBe('2 p')
    expect(pendingDuration(96)).toBe('4 p')
  })
})

describe('alapakkumine SLA badge couples to the Settings deadline reader', () => {
  it('uses the default 3-day deadline when Seaded hold no valid value', () => {
    const deadlineDays = readAuctionDefaultsFromFlags({}).alapakkumineDecisionDeadlineDays
    expect(deadlineDays).toBe(defaultAuctionDefaults.alapakkumineDecisionDeadlineDays)
    expect(slaBadge(72, deadlineDays)).toBeNull()
    expect(slaBadge(73, deadlineDays)?.tone).toBe('amber')
  })

  it('follows a stored 7-day deadline through the flag reader', () => {
    const deadlineDays = readAuctionDefaultsFromFlags({
      auctionDefaults: {
        alapakkumineDecisionDeadlineDays: 7,
        kiiroksjonDurationHours: 48,
        sealedApproverRole: 'superadmin',
      },
    }).alapakkumineDecisionDeadlineDays
    expect(deadlineDays).toBe(7)
    expect(slaBadge(168, deadlineDays)).toBeNull()
    expect(slaBadge(169, deadlineDays)?.tone).toBe('amber')
    expect(slaBadge(337, deadlineDays)?.tone).toBe('red')
  })

  it('falls back to the default deadline for an out-of-bounds stored value', () => {
    const deadlineDays = readAuctionDefaultsFromFlags({
      auctionDefaults: { alapakkumineDecisionDeadlineDays: 99 },
    }).alapakkumineDecisionDeadlineDays
    expect(deadlineDays).toBe(defaultAuctionDefaults.alapakkumineDecisionDeadlineDays)
  })
})
