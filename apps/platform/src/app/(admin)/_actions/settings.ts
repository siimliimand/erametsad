'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireAdminRepositories } from '../_lib/admin'
import { assertCan } from '../_lib/permissions'
import { isValidReason } from '../admin/content/_components/settings-audit'
import { integrationKeyDefinitions } from '../admin/settings/_components/integration-keys'

import type { CoreRepositories } from '@/lib/data/repositories'

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
    before?: unknown
    after: unknown
  },
): Promise<unknown> {
  return repositories.create({
    collection: 'audit-entry',
    data: {
      actorId: entry.actorId,
      action: entry.action,
      entityType: 'settings',
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
 * Reveals one env-backed integration key to an authorized admin. The raw
 * value exists only in this return path (never in logs or audit data);
 * every call writes a settings.key_reveal audit entry naming the key, not
 * its value (demo 13-settings "Integratsioonid").
 */
export async function revealIntegrationKeyAction(keyId: string): Promise<RevealKeyResult> {
  const { session, repositories } = await requireAdminRepositories()
  assertCan(session.role, 'settings:write')

  const key = integrationKeyDefinitions.find((definition) => definition.id === keyId)
  if (!key) {
    return { ok: false, error: 'Tundmatu võti.' }
  }
  const value = process.env[key.envVar]?.trim() ?? ''
  if (!value) {
    return { ok: false, error: 'Võti pole seadistatud.' }
  }

  await writeAudit(repositories, {
    actorId: session.userId,
    action: 'settings.key_reveal',
    entityId: key.id,
    after: { key: key.id, env: key.envVar },
  })

  return { ok: true, value }
}
