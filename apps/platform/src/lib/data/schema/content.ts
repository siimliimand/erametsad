// Drafts replacement for the four content collections that used Payload
// versions.drafts (decision 0001 §1: simple status select, no draft UI).
export const contentStatuses = ['draft', 'published'] as const
export type ContentStatus = (typeof contentStatuses)[number]
