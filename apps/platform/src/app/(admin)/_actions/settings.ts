'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireAdminRepositories } from '../_lib/admin'
import { assertCan } from '../_lib/permissions'
import { isValidReason, readFlagObject } from '../admin/content/_components/settings-audit'
import {
  INTEGRATION_CHECKS_FLAGS_KEY,
  INTEGRATION_SECRETS_FLAGS_KEY,
  integrationKeyDefinitions,
} from '../admin/settings/_components/integration-keys'
import type { IntegrationCheckState, IntegrationProbe } from '../admin/settings/_components/integration-keys'

import type { CoreRepositories } from '@/lib/data/repositories'
import { maintenanceScopes, type MaintenanceScope } from '@/lib/data/schema'
import { db } from '@/lib/db'

const settingsPath = '/admin/settings'
const maintenanceConfirmWord = 'HOOLDUS'

function readText(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function redirectWithError(message: string): never {
  redirect(`${settingsPath}?viga=${encodeURIComponent(message)}`)
}

/** Append-only audit write; the hash chain is handled by the repository. */
async function writeAudit(
  repositories: CoreRepositories,
  entry: {
    actorId: string
    action: string
    entityId: string
    entityType?: string
    before?: unknown
    after: unknown
  },
): Promise<unknown> {
  return repositories.create({
    collection: 'audit-entry',
    data: {
      actorId: entry.actorId,
      action: entry.action,
      entityType: entry.entityType ?? 'settings',
      entityId: entry.entityId,
      ...(entry.before !== undefined ? { before: entry.before } : {}),
      after: entry.after,
    },
  })
}

async function findSettingsRow(repositories: CoreRepositories) {
  const { docs } = await repositories.find({ collection: 'settings', limit: 1 })
  return docs[0] ?? null
}

function settingsFlags(row: { featureFlags?: unknown } | null): Record<string, unknown> {
  return readFlagObject(row?.featureFlags)
}

/** Effective secret for a key: a rotated settings-JSON override wins over env. */
function readEffectiveSecret(flags: Record<string, unknown>, keyId: string): string {
  const secrets = readFlagObject(flags[INTEGRATION_SECRETS_FLAGS_KEY])
  const rotated = secrets[keyId]
  if (typeof rotated === 'string' && rotated.trim().length > 0) {
    return rotated.trim()
  }
  return ''
}

async function persistFeatureFlags(
  repositories: CoreRepositories,
  current: { id: string; featureFlags?: unknown } | null,
  flags: Record<string, unknown>,
): Promise<void> {
  await (current
    ? repositories.update({ collection: 'settings', id: current.id, data: { featureFlags: flags } })
    : repositories.create({ collection: 'settings', data: { featureFlags: flags } }))
}

/**
 * Maintenance mode toggle (demo 13-settings "Platvorm"). Enabling requires
 * the typed confirm word HOOLDUS plus a reason; disabling goes straight
 * through the switch. Both directions write a maintenance.start /
 * maintenance.end audit entry. API routes stay available by design — the
 * middleware gate only blocks public page routes.
 */
export async function setMaintenanceModeAction(formData: FormData): Promise<void> {
  const { session, repositories } = await requireAdminRepositories()
  assertCan(session.role, 'settings:write')

  const enabled = readText(formData, 'enabled') === 'true'
  const confirmWord = readText(formData, 'confirm')
  const reason = readText(formData, 'reason')

  if (enabled) {
    if (!isValidReason(reason)) {
      redirectWithError('Põhjendus peab olema vähemalt 5 tähemärki.')
    }
    if (confirmWord.toUpperCase() !== maintenanceConfirmWord) {
      redirectWithError(
        `Kinnitussõna ei sobi. Trüki ${maintenanceConfirmWord}, et hooldusrežiimi sisse lülitada.`,
      )
    }
  }

  const current = await findSettingsRow(repositories)
  if ((current?.maintenanceEnabled ?? false) === enabled) {
    redirectWithError(
      enabled
        ? 'Hooldusrežiim on juba sisse lülitatud.'
        : 'Hooldusrežiim on juba välja lülitatud.',
    )
  }

  const data = { maintenanceEnabled: enabled }
  await (current
    ? repositories.update({ collection: 'settings', id: current.id, data })
    : repositories.create({ collection: 'settings', data }))

  await writeAudit(repositories, {
    actorId: session.userId,
    action: enabled ? 'maintenance.start' : 'maintenance.end',
    entityId: current?.id ?? 'settings',
    before: { maintenanceEnabled: current?.maintenanceEnabled ?? false, ...(reason ? { reason } : {}) },
    after: { maintenanceEnabled: enabled, ...(reason ? { reason } : {}) },
  })

  revalidatePath(settingsPath)
  redirect(settingsPath)
}

export interface RevealKeyResult {
  ok: boolean
  value?: string
  error?: string
}

/**
 * Reveals one integration key to an authorized admin. The raw value exists
 * only in this return path (never in logs or audit data); every call writes
 * a settings.key_reveal audit entry naming the key, not its value (demo
 * 13-settings "Integratsioonid"). A rotated value stored in the settings
 * JSON overrides the environment variable.
 */
export async function revealIntegrationKeyAction(keyId: string): Promise<RevealKeyResult> {
  const { session, repositories } = await requireAdminRepositories()
  assertCan(session.role, 'settings:write')

  const key = integrationKeyDefinitions.find((definition) => definition.id === keyId)
  if (!key) {
    return { ok: false, error: 'Tundmatu võti.' }
  }
  const rotated = readEffectiveSecret(settingsFlags(await findSettingsRow(repositories)), key.id)
  const value = rotated.length > 0 ? rotated : (process.env[key.envVar]?.trim() ?? '')
  if (!value) {
    return { ok: false, error: 'Võti pole seadistatud.' }
  }

  await writeAudit(repositories, {
    actorId: session.userId,
    action: 'settings.key_reveal',
    entityId: key.id,
    after: {
      key: key.id,
      env: key.envVar,
      ...(rotated ? { source: 'settings' } : { source: 'env' }),
    },
  })

  return { ok: true, value }
}

export type IntegrationTestResult = IntegrationCheckState

export interface IntegrationRotateResult {
  ok: boolean
  error?: string
}

const httpProbeTimeoutMs = 5_000

/** Keys without a descriptor fall back to an env-presence check of envVar. */
function probeOf(key: (typeof integrationKeyDefinitions)[number]): IntegrationProbe {
  return key.probe ?? { kind: 'presence', envVars: [key.envVar] }
}

/**
 * Runs one probe. Presence checks never touch the network; HTTP probes do
 * a single GET with a short timeout and treat only a 2xx as healthy.
 */
async function runProbe(
  probe: IntegrationProbe,
): Promise<Omit<IntegrationCheckState, 'checkedAt'>> {
  const startedAt = Date.now()
  const missing = probe.envVars.filter((envVar) => !(process.env[envVar] ?? '').trim())
  if (missing.length > 0) {
    return { latencyMs: Date.now() - startedAt, ok: false, error: 'Võti pole seadistatud.' }
  }
  if (probe.kind === 'presence') {
    return { latencyMs: Date.now() - startedAt, ok: true }
  }

  const override = probe.urlEnvVar ? process.env[probe.urlEnvVar]?.trim() : undefined
  const url = override !== undefined && override.length > 0 ? override : probe.url
  const headers: Record<string, string> = probe.bearerEnvVar
    ? { authorization: `Bearer ${(process.env[probe.bearerEnvVar] ?? '').trim()}` }
    : {}
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(httpProbeTimeoutMs),
    })
    if (!response.ok) {
      return {
        latencyMs: Date.now() - startedAt,
        ok: false,
        error: `Test ebaõnnestus: HTTP ${String(response.status)}.`,
      }
    }
    return { latencyMs: Date.now() - startedAt, ok: true }
  } catch (error) {
    return {
      latencyMs: Date.now() - startedAt,
      ok: false,
      error: `Ühendus ebaõnnestus: ${error instanceof Error ? error.message : 'tundmatu viga'}.`,
    }
  }
}

/**
 * "Testi ühendust": runs the probe for one integration, persists the last
 * check (timestamp, latency, result) under the reserved featureFlags key
 * and writes a settings.change audit entry. No reason is required — the
 * probe changes diagnostic state only, not settings the operator edits.
 */
export async function testIntegrationConnectionAction(
  keyId: string,
): Promise<IntegrationTestResult> {
  const { session, repositories } = await requireAdminRepositories()
  assertCan(session.role, 'settings:write')

  const key = integrationKeyDefinitions.find((definition) => definition.id === keyId)
  if (!key) {
    return { checkedAt: new Date().toISOString(), latencyMs: 0, ok: false, error: 'Tundmatu võti.' }
  }

  const current = await findSettingsRow(repositories)
  const flags = settingsFlags(current)
  const checks = readFlagObject(flags[INTEGRATION_CHECKS_FLAGS_KEY])

  const state: IntegrationCheckState = {
    checkedAt: new Date().toISOString(),
    ...(await runProbe(probeOf(key))),
  }
  await persistFeatureFlags(repositories, current, {
    ...flags,
    [INTEGRATION_CHECKS_FLAGS_KEY]: { ...checks, [key.id]: state },
  })

  await writeAudit(repositories, {
    actorId: session.userId,
    action: 'settings.change',
    entityId: current?.id ?? 'settings',
    after: { integrationCheck: { key: key.id, ok: state.ok, latencyMs: state.latencyMs } },
  })

  return state
}

/** Read-only helper so a card can show the persisted last-check state. */
export async function getIntegrationCheckAction(
  keyId: string,
): Promise<IntegrationCheckState | null> {
  const { repositories } = await requireAdminRepositories()

  const key = integrationKeyDefinitions.find((definition) => definition.id === keyId)
  if (!key) {
    return null
  }
  const flags = settingsFlags(await findSettingsRow(repositories))
  const checks = readFlagObject(flags[INTEGRATION_CHECKS_FLAGS_KEY])
  const state = checks[key.id]
  if (
    typeof state !== 'object' ||
    state === null ||
    typeof (state as IntegrationCheckState).checkedAt !== 'string'
  ) {
    return null
  }
  return state as IntegrationCheckState
}

/**
 * Write-only rotation: stores the new secret in the settings featureFlags
 * JSON under a reserved key. The value is never rendered back, logged, or
 * written to the audit trail — the entry names the key and records that a
 * rotation happened. Requires the mandatory written reason.
 */
export async function rotateIntegrationKeyAction(
  keyId: string,
  newValue: string,
  reason: string,
): Promise<IntegrationRotateResult> {
  const { session, repositories } = await requireAdminRepositories()
  assertCan(session.role, 'settings:write')

  const key = integrationKeyDefinitions.find((definition) => definition.id === keyId)
  if (!key) {
    return { ok: false, error: 'Tundmatu võti.' }
  }
  if (!isValidReason(reason)) {
    return { ok: false, error: 'Põhjendus peab olema vähemalt 5 tähemärki.' }
  }
  if (!newValue.trim()) {
    return { ok: false, error: 'Uus võti on tühi.' }
  }

  const current = await findSettingsRow(repositories)
  const flags = settingsFlags(current)
  const secrets = readFlagObject(flags[INTEGRATION_SECRETS_FLAGS_KEY])
  await persistFeatureFlags(repositories, current, {
    ...flags,
    [INTEGRATION_SECRETS_FLAGS_KEY]: { ...secrets, [key.id]: newValue.trim() },
  })

  await writeAudit(repositories, {
    actorId: session.userId,
    action: 'settings.change',
    entityId: key.id,
    before: { key: key.id, env: key.envVar },
    after: { key: key.id, env: key.envVar, rotated: true, reason: reason.trim() },
  })

  return { ok: true }
}

/**
 * Hooldusaknad (task 4.4): planned maintenance windows. The windows table
 * is not in the repository registry, so rows go through the raw D1
 * executor (same escape hatch as _actions/users.ts) while audit entries
 * ride the audited repository. Saving a window that contains an auction
 * end is blocked with the auction list unless the operator force-confirms.
 */

export interface MaintenanceWindowRow {
  id: string
  startsAt: string
  endsAt: string
  scope: MaintenanceScope
  createdBy: string | null
  note: string | null
  createdAt: string
  updatedAt: string
}

export interface MaintenanceConflict {
  id: string
  title: string
  status: string
  endsAt: string
}

export type SaveWindowResult =
  | { ok: true }
  | { ok: false; error: string }
  | { ok: false; conflict: true; conflicts: MaintenanceConflict[] }

export async function listMaintenanceWindowsAction(): Promise<MaintenanceWindowRow[]> {
  await requireAdminRepositories()

  const { results } = await db.query(
    `SELECT id, starts_at AS startsAt, ends_at AS endsAt, scope,
      created_by AS createdBy, note, created_at AS createdAt, updated_at AS updatedAt
     FROM maintenance_windows ORDER BY starts_at ASC`,
  )
  return results.map((row) => ({
    id: String(row.id),
    startsAt: String(row.startsAt),
    endsAt: String(row.endsAt),
    scope:
      typeof row.scope === 'string' && row.scope === 'admin'
        ? 'admin'
        : row.scope === 'all'
          ? 'all'
          : 'portal',
    createdBy: typeof row.createdBy === 'string' ? row.createdBy : null,
    note: typeof row.note === 'string' ? row.note : null,
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
  }))
}

/** Accepts datetime-local ("YYYY-MM-DDTHH:mm") or full ISO timestamps. */
function parseWindowDate(value: string): string | null {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

/** Auctions whose end time falls inside [startsAt, endsAt]. */
async function findConflictingAuctions(
  startsAt: string,
  endsAt: string,
): Promise<MaintenanceConflict[]> {
  const { results } = await db.query(
    `SELECT id, title, status, ends_at AS endsAt FROM auctions
     WHERE ends_at IS NOT NULL AND ends_at >= ? AND ends_at <= ?
       AND status IN ('draft', 'scheduled', 'active')
     ORDER BY ends_at ASC LIMIT 20`,
    [startsAt, endsAt],
  )
  return results.map((row) => ({
    id: String(row.id),
    title: String(row.title),
    status: String(row.status),
    endsAt: String(row.endsAt),
  }))
}

export async function saveMaintenanceWindowAction(input: {
  startsAt: string
  endsAt: string
  scope: string
  note: string
  reason: string
  force: boolean
}): Promise<SaveWindowResult> {
  const { session, repositories } = await requireAdminRepositories()
  assertCan(session.role, 'settings:write')

  const reason = input.reason.trim()
  if (!isValidReason(reason)) {
    return { ok: false, error: 'Põhjendus peab olema vähemalt 5 tähemärki.' }
  }
  const startsAt = parseWindowDate(input.startsAt.trim())
  const endsAt = parseWindowDate(input.endsAt.trim())
  if (!startsAt || !endsAt) {
    return { ok: false, error: 'Sisesta korrektne algus- ja lõpuaeg.' }
  }
  if (endsAt <= startsAt) {
    return { ok: false, error: 'Akna lõpp peab olema pärast algust.' }
  }
  const scope = (maintenanceScopes as readonly string[]).includes(input.scope)
    ? (input.scope as MaintenanceScope)
    : 'portal'

  const conflicts = await findConflictingAuctions(startsAt, endsAt)
  if (conflicts.length > 0 && !input.force) {
    return { ok: false, conflict: true, conflicts }
  }

  const id = crypto.randomUUID()
  const timestamp = new Date().toISOString()
  await db.query(
    `INSERT INTO maintenance_windows
      (id, starts_at, ends_at, scope, created_by, note, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, startsAt, endsAt, scope, session.userId, input.note.trim() || null, timestamp, timestamp],
  )

  await writeAudit(repositories, {
    actorId: session.userId,
    action: 'maintenance.window_create',
    entityType: 'maintenance_window',
    entityId: id,
    after: {
      startsAt,
      endsAt,
      scope,
      note: input.note.trim() || null,
      reason,
      conflictCount: conflicts.length,
      forced: conflicts.length > 0,
    },
  })

  revalidatePath(settingsPath)
  return { ok: true }
}

export async function deleteMaintenanceWindowAction(
  id: string,
  reason: string,
): Promise<{ ok: boolean; error?: string }> {
  const { session, repositories } = await requireAdminRepositories()
  assertCan(session.role, 'settings:write')

  const trimmed = reason.trim()
  if (!isValidReason(trimmed)) {
    return { ok: false, error: 'Põhjendus peab olema vähemalt 5 tähemärki.' }
  }
  const { results } = await db.query(
    `SELECT id, starts_at AS startsAt, ends_at AS endsAt, scope, note
     FROM maintenance_windows WHERE id = ? LIMIT 1`,
    [id],
  )
  const window = results[0]
  if (!window) {
    return { ok: false, error: 'Akna ei leitud.' }
  }

  await db.query(`DELETE FROM maintenance_windows WHERE id = ?`, [id])

  await writeAudit(repositories, {
    actorId: session.userId,
    action: 'maintenance.window_delete',
    entityType: 'maintenance_window',
    entityId: id,
    before: {
      startsAt: window.startsAt,
      endsAt: window.endsAt,
      scope: window.scope,
      note: window.note ?? null,
      reason: trimmed,
    },
    after: { deleted: true, reason: trimmed },
  })

  revalidatePath(settingsPath)
  return { ok: true }
}
