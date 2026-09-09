import type { LeadStatus } from '@/lib/data/schema'

export interface KanbanColumn {
  status: LeadStatus
  label: string
  hint: string
}

/** Board columns in pipeline order (design 09); labels per the task copy. */
export const kanbanColumns: readonly KanbanColumn[] = [
  { status: 'new', label: 'Uus', hint: 'Väljumine eeldab määratud spetsialisti' },
  { status: 'contacted', label: 'Võetud ühendust', hint: 'Nõuab esimest märkust' },
  { status: 'qualified', label: 'Kvalifitseeritud', hint: 'Nõuab kvalifitseerimise märkust' },
  { status: 'contract', label: 'Leping', hint: 'Nõuab oksjoni/lepingu viidet või märkust' },
  { status: 'disqualified', label: 'Mittekvalifitseeritud', hint: 'Nõuab tüüpitud põhjust' },
]

export const NOTE_MIN_LENGTH = 5

export interface LeadExitGuardInput {
  from: LeadStatus
  to: LeadStatus
  assignedSpecialistId: string | null
  note?: string
  /** Auction or contract reference; satisfies the Leping guard with a note. */
  reference?: string
}

export type LeadExitGuardResult = { ok: true } | { ok: false; error: string }

function hasNote(value: string | undefined): boolean {
  return (value ?? '').trim().length >= NOTE_MIN_LENGTH
}

/**
 * Exit guards for status moves (design 09, status semantics). Enforced in
 * the action layer before persisting; the Kanban only pre-collects the
 * note/reason input. Reaching Võetud ühendust needs the first note; reaching
 * Leping needs an auction/contract reference or a note.
 */
export function evaluateLeadExitGuard(input: LeadExitGuardInput): LeadExitGuardResult {
  if (input.from === input.to) return { ok: true }
  if (input.from === 'new' && !input.assignedSpecialistId) {
    return { ok: false, error: 'Enne oleku muutmist määrake juhtlõimele spetsialist.' }
  }
  if (input.to === 'contacted' && !hasNote(input.note)) {
    return { ok: false, error: 'Esimene märkus on kohustuslik (vähemalt 5 tähemärki).' }
  }
  if (input.to === 'qualified' && !hasNote(input.note)) {
    return { ok: false, error: 'Kvalifitseerimise märkus on kohustuslik (vähemalt 5 tähemärki).' }
  }
  if (input.to === 'disqualified' && !hasNote(input.note)) {
    return { ok: false, error: 'Tagasilükkamise põhjus on kohustuslik (vähemalt 5 tähemärki).' }
  }
  if (input.to === 'contract' && (input.reference ?? '').trim() === '' && !hasNote(input.note)) {
    return {
      ok: false,
      error: 'Sisestage oksjoni või lepingu viide või märkus (vähemalt 5 tähemärki).',
    }
  }
  return { ok: true }
}

export interface LeadSlaBadge {
  hours: number
  level: 'amber' | 'red'
  label: string
}

/**
 * SLA badge for the Uus column: amber past 24 h unhandled, red past 48 h.
 */
export function leadSlaBadge(
  createdAt: string,
  status: LeadStatus,
  nowMs: number = Date.now(),
): LeadSlaBadge | null {
  if (status !== 'new') return null
  const created = Date.parse(createdAt)
  if (Number.isNaN(created)) return null
  const hours = Math.floor((nowMs - created) / 3600000)
  if (hours > 48) {
    return { hours, level: 'red', label: `SLA ületatud ${String(hours)} h` }
  }
  if (hours > 24) {
    return { hours, level: 'amber', label: `→ ${String(hours)} h` }
  }
  return null
}

export interface RoundRobinCandidate {
  id: string
  name: string
  active: boolean
  openLeadCount: number
}

/**
 * Round-robin suggestion (design 09): the active specialist with the
 * fewest open-pipeline leads; the manual override always wins.
 */
export function roundRobinSuggestion(
  candidates: readonly RoundRobinCandidate[],
): RoundRobinCandidate | null {
  const active = candidates.filter((candidate) => candidate.active)
  if (active.length === 0) return null
  return active.reduce((best, candidate) =>
    candidate.openLeadCount < best.openLeadCount ? candidate : best,
  )
}

export interface LeadContactKey {
  phone?: string | null
  email?: string | null
}

/**
 * Duplicate heuristic (design 09): same phone or e-mail inside the last
 * 30 days; returns the most recent matching lead or null.
 */
export function findDuplicateLead<T extends LeadContactKey & { id: string; createdAt: string }>(
  leads: readonly T[],
  contact: LeadContactKey,
  excludeId: string,
  nowMs: number = Date.now(),
): T | null {
  const windowStart = nowMs - 30 * 24 * 3600 * 1000
  const phone = contact.phone?.trim().toLowerCase() ?? ''
  const email = contact.email?.trim().toLowerCase() ?? ''
  let best: T | null = null
  for (const lead of leads) {
    if (lead.id === excludeId) continue
    const created = Date.parse(lead.createdAt)
    if (Number.isNaN(created) || created < windowStart) continue
    const phoneMatch = phone !== '' && (lead.phone ?? '').trim().toLowerCase() === phone
    const emailMatch = email !== '' && (lead.email ?? '').trim().toLowerCase() === email
    if (!phoneMatch && !emailMatch) continue
    if (!best || Date.parse(best.createdAt) < created) {
      best = lead
    }
  }
  return best
}

// ---------------------------------------------------------------------------
// Settings-driven auto-assignment (task 8.2). The settings row has no
// dedicated column, so the switch rides the featureFlags TEXT-JSON under a
// reserved key — the same additive pattern as companyApproveRights and
// auctionDefaults. Until the Seaded form gains the field, the documented
// design default (automatic assignment with county round-robin) applies.
// ---------------------------------------------------------------------------

export const LEAD_AUTO_ASSIGN_FLAGS_KEY = 'leadAutoAssign'

export interface LeadAutoAssignSettings {
  enabled: boolean
}

export const DEFAULT_LEAD_AUTO_ASSIGN_SETTINGS: LeadAutoAssignSettings = { enabled: true }

export function leadAutoAssignSettings(flags: unknown): LeadAutoAssignSettings {
  if (typeof flags !== 'object' || flags === null || Array.isArray(flags)) {
    return { ...DEFAULT_LEAD_AUTO_ASSIGN_SETTINGS }
  }
  const raw = (flags as Record<string, unknown>)[LEAD_AUTO_ASSIGN_FLAGS_KEY]
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ...DEFAULT_LEAD_AUTO_ASSIGN_SETTINGS }
  }
  return { enabled: (raw as Record<string, unknown>).enabled !== false }
}

export interface CountyRoundRobinCandidate {
  id: string
  active: boolean
  /** Leads already assigned to this specialist inside the target county. */
  countyLeadCount: number
}

/**
 * County round-robin (task 8.2): the active specialist with the fewest
 * leads in the target county; the specialist list order breaks ties, so
 * consecutive creations rotate through the roster deterministically.
 */
export function countyRoundRobinPick(
  candidates: readonly CountyRoundRobinCandidate[],
): CountyRoundRobinCandidate | null {
  const active = candidates.filter((candidate) => candidate.active)
  if (active.length === 0) return null
  return active.reduce((best, candidate) =>
    candidate.countyLeadCount < best.countyLeadCount ? candidate : best,
  )
}

// ---------------------------------------------------------------------------
// Soft delete + duplicate merge lifecycle (task 8.2). The leads table has no
// deleted/merged columns, so the flags live in the append-only lead audit
// trail (lead.delete / lead.merge entries) and every list resolves them.
// ---------------------------------------------------------------------------

export interface LeadLifecycleAuditLike {
  action: string
  after?: unknown
}

export interface LeadLifecycleFlags {
  /** Set when the lead was merged away into another lead. */
  mergedIntoId: string | null
  deleted: boolean
  deleteReason: string | null
}

export const EMPTY_LEAD_LIFECYCLE: LeadLifecycleFlags = {
  mergedIntoId: null,
  deleted: false,
  deleteReason: null,
}

function lifecycleAfter(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}

export function resolveLeadLifecycleFlags(
  audits: readonly LeadLifecycleAuditLike[],
): LeadLifecycleFlags {
  const flags: LeadLifecycleFlags = { ...EMPTY_LEAD_LIFECYCLE }
  for (const entry of audits) {
    const after = lifecycleAfter(entry.after)
    if (entry.action === 'lead.merge' && typeof after.mergedInto === 'string') {
      flags.mergedIntoId = after.mergedInto
    }
    if (entry.action === 'lead.delete' && after.deleted === true) {
      flags.deleted = true
      flags.deleteReason = typeof after.reason === 'string' ? after.reason : null
    }
  }
  return flags
}
