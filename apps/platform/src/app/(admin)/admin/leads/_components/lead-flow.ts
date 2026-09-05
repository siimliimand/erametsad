import type { LeadStatus } from '@/lib/data/schema'

export interface KanbanColumn {
  status: LeadStatus
  label: string
  hint: string
}

/** Board columns in pipeline order (design 09); labels per the task copy. */
export const kanbanColumns: readonly KanbanColumn[] = [
  { status: 'new', label: 'Uus', hint: 'Väljumine eeldab määratud spetsialisti' },
  { status: 'contacted', label: 'Võetud ühendust', hint: '' },
  { status: 'qualified', label: 'Kvalifitseeritud', hint: 'Nõuab kvalifitseerimise märkust' },
  { status: 'contract', label: 'Leping', hint: '' },
  { status: 'disqualified', label: 'Mittekvalifitseeritud', hint: 'Nõuab tüüpitud põhjust' },
]

export const NOTE_MIN_LENGTH = 5

export interface LeadExitGuardInput {
  from: LeadStatus
  to: LeadStatus
  assignedSpecialistId: string | null
  note?: string
}

export type LeadExitGuardResult = { ok: true } | { ok: false; error: string }

/**
 * Exit guards for status moves (design 09, status semantics). Enforced in
 * the action layer before persisting; the Kanban only pre-collects the
 * note/reason input.
 */
export function evaluateLeadExitGuard(input: LeadExitGuardInput): LeadExitGuardResult {
  if (input.from === input.to) return { ok: true }
  if (input.from === 'new' && !input.assignedSpecialistId) {
    return { ok: false, error: 'Enne oleku muutmist määrake juhtlõimele spetsialist.' }
  }
  if (input.to === 'qualified' && (input.note ?? '').trim().length < NOTE_MIN_LENGTH) {
    return { ok: false, error: 'Kvalifitseerimise märkus on kohustuslik (vähemalt 5 tähemärki).' }
  }
  if (input.to === 'disqualified' && (input.note ?? '').trim().length < NOTE_MIN_LENGTH) {
    return { ok: false, error: 'Tagasilükkamise põhjus on kohustuslik (vähemalt 5 tähemärki).' }
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
