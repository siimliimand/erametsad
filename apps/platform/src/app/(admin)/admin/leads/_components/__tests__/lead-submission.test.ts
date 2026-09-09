import { describe, expect, it } from 'vitest'

import { leadAttachmentUrl, resolveLeadSubmission } from '../lead-submission'

const createAudit = (createdAt: string, after: unknown) => ({
  action: 'lead.create',
  createdAt,
  after,
})

describe('resolveLeadSubmission (task 8.3)', () => {
  it('reads the original message and attachments from the creation audit', () => {
    expect(
      resolveLeadSubmission([
        createAudit('2026-01-02T00:00:00.000Z', { message: 'teine sõnum' }),
        createAudit('2026-01-01T00:00:00.000Z', {
          message: 'Palun pakkumine metsa müügiks.',
          attachments: ['leads/metsaplaan.pdf'],
        }),
      ]),
    ).toEqual({
      message: 'Palun pakkumine metsa müügiks.',
      attachments: ['leads/metsaplaan.pdf'],
    })
  })

  it('returns empty data when no creation entry carries a submission', () => {
    expect(
      resolveLeadSubmission([
        { action: 'lead.create_manual', createdAt: '2026-01-01T00:00:00.000Z', after: null },
        { action: 'lead.note', createdAt: '2026-01-02T00:00:00.000Z', after: { text: 'märkus' } },
      ]),
    ).toEqual({ message: null, attachments: [] })
  })

  it('tolerates blank messages and malformed attachment lists', () => {
    expect(
      resolveLeadSubmission([
        createAudit('2026-01-01T00:00:00.000Z', {
          message: '   ',
          attachments: ['x.pdf', 42, ''],
        }),
      ]),
    ).toEqual({ message: null, attachments: ['x.pdf'] })
  })
})

describe('leadAttachmentUrl', () => {
  it('builds a download link for an attachment key', () => {
    expect(leadAttachmentUrl('leads/metsaplaan.pdf')).toBe(
      '/api/v1/media/leads%2Fmetsaplaan.pdf',
    )
  })
})
