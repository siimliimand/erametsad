import { zipSync, type Zippable } from 'fflate'

import { listUserSessions } from '@/lib/auth/session'
import type {
  CoreRepositories,
  ServiceRequestDoc,
  UserDoc,
} from '@/lib/data/repositories'
import type { Bid } from '@/lib/data/schema'
import { RateLimiter } from '@/lib/rate-limit'

export interface ExportZipEntry {
  name: string
  data: Uint8Array
}

// Own instance with user-scoped keys: a ZIP build is heavier than a normal
// API read, so the export quota never shares the general API bucket.
export const exportRateLimiter = new RateLimiter({ tokensPerInterval: 5, intervalMs: 60_000 })

export function exportZipFilename(now: Date = new Date()): string {
  return `erametsad-andmed-${now.toISOString().slice(0, 10)}.zip`
}

function jsonEntry(name: string, value: unknown): ExportZipEntry {
  return { name, data: new TextEncoder().encode(JSON.stringify(value, null, 2)) }
}

// Explicit projection: credential and ciphertext columns (isikukood *,
// password *) never leave the server.
function toExportableUser(user: UserDoc): Record<string, unknown> {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    role: user.role,
    status: user.status,
    authMethod: user.authMethod,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }
}

// Sealed-bid identity snapshots hold isikukood ciphertext; the self-export
// carries the bid rows without them.
function toExportableBid(bid: Bid): Record<string, unknown> {
  return { ...bid, identitySnapshot: undefined }
}

function normalizePhone(phone: string | null | undefined): string {
  return typeof phone === 'string' ? phone.replace(/[\s-]/g, '') : ''
}

function requestContact(payload: unknown): { email: string; phone: string } | null {
  if (typeof payload !== 'object' || payload === null) return null
  const contact = (payload as { contact?: unknown }).contact
  if (typeof contact !== 'object' || contact === null) return null
  const email = (contact as { email?: unknown }).email
  const phone = (contact as { phone?: unknown }).phone
  return {
    email: typeof email === 'string' ? email.trim().toLowerCase() : '',
    phone: typeof phone === 'string' ? normalizePhone(phone) : '',
  }
}

// Service requests have no user column either: a request belongs to the
// caller when its contact email or phone matches the account.
function isOwnServiceRequest(
  doc: ServiceRequestDoc,
  email: string,
  phone: string,
): boolean {
  const contact = requestContact(doc.payload)
  if (!contact) return false
  if (contact.email !== '' && contact.email === email) return true
  return phone !== '' && contact.phone !== '' && contact.phone === phone
}

/**
 * The single module that lists the exported record groups (design D6): a new
 * table becomes one more find plus one more jsonEntry here. Every query is
 * scoped to the verified caller id; the trusted (unguarded) repository is
 * acceptable because no other user's rows are ever read.
 */
export async function buildUserExportEntries(
  repos: CoreRepositories,
  userId: string,
  sessionId: string | null,
): Promise<ExportZipEntry[] | null> {
  const user = await repos.findByID({ collection: 'users', id: userId })
  if (!user) return null

  const [profiles, bids, autobidders, rights, serviceRequests, rightsRequests] = await Promise.all([
    repos.find({ collection: 'profile', where: { user: { equals: userId } }, pagination: false }),
    repos.find({
      collection: 'bids',
      where: { user: { equals: userId } },
      sort: '-createdAt',
      pagination: false,
    }),
    repos.find({
      collection: 'autobidders',
      where: { user: { equals: userId } },
      sort: '-createdAt',
      pagination: false,
    }),
    repos.find({
      collection: 'auction-rights',
      where: { user: { equals: userId } },
      sort: '-createdAt',
      pagination: false,
    }),
    repos.find({ collection: 'service-requests', pagination: false }),
    repos.find({
      collection: 'rights-request',
      where: { user: { equals: userId } },
      sort: '-createdAt',
      pagination: false,
    }),
  ])

  // The consent log carries no user column; the data subject's entries are
  // resolved through the salted IP hashes recorded on their own bids (the
  // same resolution the admin GDPR export uses).
  const bidIpHashes = [
    ...new Set(
      bids.docs
        .map((bid) => bid.ipHash)
        .filter((ipHash): ipHash is string => typeof ipHash === 'string' && ipHash !== ''),
    ),
  ]
  const consents =
    bidIpHashes.length > 0
      ? (
          await repos.find({
            collection: 'consent-log',
            where: { ipHash: { in: bidIpHashes } },
            sort: '-createdAt',
            pagination: false,
          })
        ).docs
      : []

  const ownEmail = user.email.trim().toLowerCase()
  const ownPhone = normalizePhone(user.phone)
  const ownServiceRequests = serviceRequests.docs.filter((doc) =>
    isOwnServiceRequest(doc, ownEmail, ownPhone),
  )

  const sessions = await listUserSessions(userId, sessionId ?? undefined)

  return [
    jsonEntry('kasutaja.json', toExportableUser(user)),
    jsonEntry('profiilid.json', profiles.docs),
    jsonEntry(
      'teavituste-eelistused.json',
      profiles.docs.map((profile) => ({
        profileId: profile.id,
        notificationPreferences: profile.notificationPreferences ?? null,
      })),
    ),
    jsonEntry('pakkumised.json', bids.docs.map(toExportableBid)),
    jsonEntry('autobidid.json', autobidders.docs),
    jsonEntry('oksjonioigused.json', rights.docs),
    jsonEntry('nõusolekud.json', consents),
    jsonEntry(
      'sessioonid.json',
      sessions.map((session) => ({
        id: session.sessionId,
        createdAt: session.createdAt.toISOString(),
        current: session.current,
      })),
    ),
    jsonEntry('teenustellimused.json', ownServiceRequests),
    jsonEntry('oiguste-taotlused.json', rightsRequests.docs),
  ]
}

/** Exact-size ArrayBuffer so the bytes can go straight into a Response body. */
export function buildExportZip(entries: ExportZipEntry[]): ArrayBuffer {
  const files: Zippable = {}
  for (const entry of entries) {
    files[entry.name] = entry.data
  }
  return zipSync(files).slice().buffer
}
