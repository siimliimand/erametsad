import { describe, expect, it } from 'vitest'

import {
  activePeriodsByTemplateId,
  countContractsByTemplate,
  uploaderByTemplateId,
} from './template-version-meta'
import type { TemplateAuditEntry } from './template-version-meta'

function entry(
  entityId: string,
  action: string,
  createdAt: string,
  actorId = 'admin-1',
): TemplateAuditEntry {
  return { entityId, action, actorId, createdAt }
}

// Newest-first, mirroring the page's audit query sort.
const entries: TemplateAuditEntry[] = [
  entry('v2', 'template.activate', '2026-09-01T10:00:00.000Z'),
  entry('v1', 'template.deactivate', '2026-09-01T09:59:00.000Z', 'admin-2'),
  entry('v2', 'template.draft_save', '2026-08-30T12:00:00.000Z', 'admin-3'),
  entry('v1', 'template.upload', '2026-08-01T09:00:00.000Z', 'admin-2'),
  entry('v0', 'template.deactivate', '2026-07-01T09:00:00.000Z'),
]

describe('uploaderByTemplateId', () => {
  it('resolves the first uploader per version from upload and draft-save entries', () => {
    const uploaders = uploaderByTemplateId(entries)
    expect(uploaders.get('v1')).toBe('admin-2')
    expect(uploaders.get('v2')).toBe('admin-3')
  })

  it('skips versions without an upload action and drops null entities', () => {
    const uploaders = uploaderByTemplateId(entries)
    expect(uploaders.has('v0')).toBe(false)
    expect(uploaders.size).toBe(2)
    expect(uploaderByTemplateId([{ entityId: null, action: 'template.upload', actorId: 'a', createdAt: '' }]).size).toBe(0)
  })
})

describe('activePeriodsByTemplateId', () => {
  it('spans from the first activation to a later deactivation', () => {
    const periods = activePeriodsByTemplateId(entries, new Set(['v2']))
    expect(periods.get('v1')).toEqual({ from: null, to: '2026-09-01T09:59:00.000Z' })
    expect(periods.get('v2')).toEqual({ from: '2026-09-01T10:00:00.000Z', to: null })
  })

  it('keeps the window open for a version without a recorded deactivation', () => {
    const periods = activePeriodsByTemplateId(entries, new Set())
    expect(periods.get('v2')).toEqual({ from: '2026-09-01T10:00:00.000Z', to: null })
  })

  it('reopens the window for a version whose row is active again', () => {
    const periods = activePeriodsByTemplateId(entries, new Set(['v1']))
    expect(periods.get('v1')?.to).toBeNull()
  })

  it('returns no periods when the trail has no lifecycle actions', () => {
    expect(
      activePeriodsByTemplateId(
        [entry('v1', 'template.upload', '2026-08-01T09:00:00.000Z')],
        new Set(),
      ).size,
    ).toBe(0)
  })
})

describe('countContractsByTemplate', () => {
  it('counts generated contracts per template version row', () => {
    const counts = countContractsByTemplate([
      { templateId: 'v1' },
      { templateId: 'v1' },
      { templateId: 'v1' },
      { templateId: 'v2' },
    ])
    expect(counts.get('v1')).toBe(3)
    expect(counts.get('v2')).toBe(1)
    expect(counts.size).toBe(2)
  })

  it('returns an empty map for zero contracts', () => {
    expect(countContractsByTemplate([]).size).toBe(0)
  })
})
