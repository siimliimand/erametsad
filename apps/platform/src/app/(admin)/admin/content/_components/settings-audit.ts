import type { SettingsDoc } from '@/lib/data/repositories'

/**
 * Pure helpers for the audited settings sections (Üldine / Tasud / Oksjonid /
 * Lipud). The settings row has no dedicated columns for the Oksjonid
 * defaults added in phase 5, so they live additively inside the existing
 * `featureFlags` TEXT-JSON column under a reserved key. Promoting them to
 * real columns later is a forward-only migration.
 */

export const AUCTION_DEFAULTS_KEY = 'auctionDefaults'

export const sealedApproverRoles = ['superadmin', 'admin'] as const
export type SealedApproverRole = (typeof sealedApproverRoles)[number]

export interface AuctionDefaults {
  /** Days a seller has to decide an alapakkumine offer. */
  alapakkumineDecisionDeadlineDays: number
  /** Quick-auction (kiiroksjon) duration in hours, allowed 24-72. */
  kiiroksjonDurationHours: number
  /** Role allowed to confirm a two-part sealed-bid opening. */
  sealedApproverRole: SealedApproverRole
}

/** Inclusive [min, max] bounds per task 6.2 and design 13. */
export const settingsBounds = {
  antiSnipeDurationMinutes: { min: 1, max: 30, default: 5 },
  alapakkumineDecisionDeadlineDays: { min: 1, max: 14, default: 3 },
  sealedRevisionCap: { min: 0, max: 5, default: 3 },
  kiiroksjonDurationHours: { min: 24, max: 72, default: 48 },
} as const

export const defaultAuctionDefaults: AuctionDefaults = {
  alapakkumineDecisionDeadlineDays: settingsBounds.alapakkumineDecisionDeadlineDays.default,
  kiiroksjonDurationHours: settingsBounds.kiiroksjonDurationHours.default,
  sealedApproverRole: 'superadmin',
}

/** Reason-required saves (design D7): at least 5 characters. */
export function isValidReason(reason: string): boolean {
  return reason.trim().length >= 5
}

const SECRET_KEY_PATTERN = /(secret|key|token|password|passphrase|isikukood)/i

/**
 * Replaces secret string values with a placeholder so the audit diff shows
 * that a change happened without recording the value (spec 14: secrets
 * excluded, rendered as `<salajane>`).
 */
export function maskSecretValues(value: unknown, depth = 0): unknown {
  if (depth > 8) {
    return value
  }
  if (Array.isArray(value)) {
    return value.map((item) => maskSecretValues(item, depth + 1))
  }
  if (typeof value === 'object' && value !== null) {
    const masked: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      masked[key] =
        SECRET_KEY_PATTERN.test(key) && typeof item === 'string' && item.length > 0
          ? '<salajane>'
          : maskSecretValues(item, depth + 1)
    }
    return masked
  }
  return value
}

/** The flexible flags column may hold null or non-objects; normalize. */
export function readFlagObject(raw: unknown): Record<string, unknown> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return {}
  }
  return raw as Record<string, unknown>
}

export function readAuctionDefaults(settings?: SettingsDoc): AuctionDefaults {
  const flags = readFlagObject(settings?.featureFlags)
  return readAuctionDefaultsFromFlags(flags)
}

export function readAuctionDefaultsFromFlags(flags: Record<string, unknown>): AuctionDefaults {
  const raw = flags[AUCTION_DEFAULTS_KEY]
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ...defaultAuctionDefaults }
  }
  const source = raw as Record<string, unknown>
  return {
    alapakkumineDecisionDeadlineDays: clampInt(
      source.alapakkumineDecisionDeadlineDays,
      settingsBounds.alapakkumineDecisionDeadlineDays,
    ),
    kiiroksjonDurationHours: clampInt(
      source.kiiroksjonDurationHours,
      settingsBounds.kiiroksjonDurationHours,
    ),
    sealedApproverRole: sealedApproverRoles.includes(
      source.sealedApproverRole as SealedApproverRole,
    )
      ? (source.sealedApproverRole as SealedApproverRole)
      : defaultAuctionDefaults.sealedApproverRole,
  }
}

function clampInt(value: unknown, bounds: { min: number; max: number; default: number }): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= bounds.min && value <= bounds.max
    ? value
    : bounds.default
}

export interface AuctionDefaultsInput {
  alapakkumineDecisionDeadlineDays: number
  kiiroksjonDurationHours: number
  sealedApproverRole: string
}

export type ParseAuctionDefaultsResult =
  | { ok: true; value: AuctionDefaults }
  | { ok: false; error: string }

/** Validates the raw form numbers against the spec bounds (Estonian errors). */
export function parseAuctionDefaults(input: AuctionDefaultsInput): ParseAuctionDefaultsResult {
  if (
    !Number.isInteger(input.alapakkumineDecisionDeadlineDays) ||
    input.alapakkumineDecisionDeadlineDays < settingsBounds.alapakkumineDecisionDeadlineDays.min ||
    input.alapakkumineDecisionDeadlineDays > settingsBounds.alapakkumineDecisionDeadlineDays.max
  ) {
    return {
      ok: false,
      error: 'Alapakkumise otsuse tähtaeg peab olema täisarv vahemikus 1 kuni 14.',
    }
  }
  if (
    !Number.isInteger(input.kiiroksjonDurationHours) ||
    input.kiiroksjonDurationHours < settingsBounds.kiiroksjonDurationHours.min ||
    input.kiiroksjonDurationHours > settingsBounds.kiiroksjonDurationHours.max
  ) {
    return {
      ok: false,
      error: 'Kiiroksjoni kestus peab olema täisarv vahemikus 24 kuni 72 tundi.',
    }
  }
  if (!sealedApproverRoles.includes(input.sealedApproverRole as SealedApproverRole)) {
    return { ok: false, error: 'Vali sobiv kinnitaja roll.' }
  }
  return {
    ok: true,
    value: {
      alapakkumineDecisionDeadlineDays: input.alapakkumineDecisionDeadlineDays,
      kiiroksjonDurationHours: input.kiiroksjonDurationHours,
      sealedApproverRole: input.sealedApproverRole as SealedApproverRole,
    },
  }
}

/** Oksjonid save: merge the validated defaults into the current flags object. */
export function withAuctionDefaults(
  currentFlags: Record<string, unknown>,
  defaults: AuctionDefaults,
): Record<string, unknown> {
  return { ...currentFlags, [AUCTION_DEFAULTS_KEY]: defaults }
}

/**
 * Lipud save: the textarea edits the user flags only. A pasted
 * `auctionDefaults` key is ignored and the current defaults are preserved so
 * the two sections never clobber each other.
 */
export function mergeFlagPayload(
  currentFlags: Record<string, unknown>,
  parsedFlags: Record<string, unknown>,
): Record<string, unknown> {
  const { [AUCTION_DEFAULTS_KEY]: _reserved, ...flags } = parsedFlags
  if (AUCTION_DEFAULTS_KEY in currentFlags) {
    return { ...flags, [AUCTION_DEFAULTS_KEY]: currentFlags[AUCTION_DEFAULTS_KEY] }
  }
  return flags
}

export type ParseFlagsResult =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; error: string }

export function parseFlagObject(rawText: string): ParseFlagsResult {
  if (rawText.trim().length === 0) {
    return { ok: true, value: {} }
  }
  try {
    const parsed: unknown = JSON.parse(rawText)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return { ok: false, error: 'Lipud peavad olema JSON-i objekt.' }
    }
    return { ok: true, value: parsed as Record<string, unknown> }
  } catch {
    return { ok: false, error: 'Lipud peavad olema korrektne JSON.' }
  }
}
