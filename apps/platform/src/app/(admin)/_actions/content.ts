'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireAdminRepositories } from '../_lib/admin'
import { assertCan } from '../_lib/permissions'
import {
  contentPublicPath,
  redirectPathsForSlugChange,
  resolvePublishDecision,
  tallinnWallTimeToUtcIso,
  type PublishedSlugCollection,
} from '../admin/content/_components/scheduled-publish'
import {
  featureFlagDefinitions,
  isValidReason,
  maskSecretValues,
  parseAuctionDefaults,
  readFlagObject,
  settingsBounds,
  withAuctionDefaults,
  withNamedFlags,
  type FeatureFlagKey,
} from '../admin/content/_components/settings-audit'
import { MAX_IMPORT_BYTES } from '../admin/content/import-export/_lib/import-export'
import {
  parseRedirectCsv,
  planRedirectCsvUpserts,
  summarizeRedirectItems,
  type RedirectImportItemResult,
  type RedirectImportReport,
} from '../admin/content/import-export/_lib/redirects-csv'
import { validateRedirect } from '../admin/content/redirects/_lib/redirect-validation'

import type { BlockConfig } from '@/lib/content/blocks'
import { safeParseBlockConfig, serializeBlockConfig } from '@/lib/content/blocks'
import type { CoreRepositories, PageBlockDoc, UpdateDataFor } from '@/lib/data/repositories'
import { getRepositories } from '@/lib/data/runtime'
import {
  auctionObjectTypes,
  contentStatuses,
  legalDocumentTypes,
  pageBlockTypes,
  redirectTypes,
} from '@/lib/data/schema'
import type {
  AuctionObjectType,
  ContentStatus,
  LegalDocumentType,
  PageBlockType,
  RedirectType,
} from '@/lib/data/schema'
import { adminUrl } from '@/lib/routing/admin-base-server'

const articlesPath = '/admin/content/articles'
const pagesPath = '/admin/content/pages'
const faqCategoriesPath = '/admin/content/faq/categories'
const faqItemsPath = '/admin/content/faq/items'
const testimonialsPath = '/admin/content/testimonials'
const partnerServicesPath = '/admin/content/partner-services'
const legalDocumentsPath = '/admin/content/legal-documents'
const redirectsPath = '/admin/content/redirects'
const specialistsPath = '/admin/content/specialists'
const statisticsPath = '/admin/content/statistics'
const settingsPath = '/admin/settings'

function readText(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function readOptionalText(formData: FormData, key: string): string | null {
  const value = readText(formData, key)
  return value.length > 0 ? value : null
}

function readInt(formData: FormData, key: string): number {
  return Number.parseInt(readText(formData, key), 10)
}

function readNumber(formData: FormData, key: string): number {
  return Number(readText(formData, key).replace(',', '.'))
}

function readOptionalNumber(formData: FormData, key: string): number | null {
  const raw = readText(formData, key)
  return raw.length > 0 ? Number(raw.replace(',', '.')) : null
}

function readBool(formData: FormData, key: string): boolean {
  return formData.getAll(key).some((value) => value === 'true')
}

function readOptionalInt(formData: FormData, key: string): number | null {
  const raw = readText(formData, key)
  if (raw.length === 0) return null
  const value = Number.parseInt(raw, 10)
  return Number.isNaN(value) ? null : value
}

function readTags(formData: FormData): string[] {
  return readText(formData, 'tags')
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0)
}

function readJsonValue(formData: FormData, key: string): { invalid: boolean; value: unknown } {
  const raw = readText(formData, key)
  if (raw.length === 0) {
    return { invalid: false, value: null }
  }
  try {
    return { invalid: false, value: JSON.parse(raw) as unknown }
  } catch {
    return { invalid: true, value: null }
  }
}

async function redirectWithError(path: string, message: string): Promise<never> {
  redirect(await adminUrl(`${path}?viga=${encodeURIComponent(message)}`))
}

function formPath(basePath: string, id: string): string {
  return id.length > 0 ? `${basePath}/${id}` : `${basePath}/new`
}

// Redirect must never run inside the try block: it throws NEXT_REDIRECT.
async function persist<T>(path: string, prefix: string, write: () => Promise<T>): Promise<T> {
  try {
    return await write()
  } catch (error) {
    return redirectWithError(path, `${prefix}${error instanceof Error ? error.message : String(error)}`)
  }
}

function revalidate(basePath: string, id: string): void {
  revalidatePath(basePath)
  if (id.length > 0) {
    revalidatePath(`${basePath}/${id}`)
  }
}

async function readPublishAt(formData: FormData, errorPath: string, label: string): Promise<string | null> {
  const raw = readText(formData, 'publishAt')
  if (raw.length === 0) {
    return null
  }
  const iso = tallinnWallTimeToUtcIso(raw)
  if (!iso) {
    await redirectWithError(errorPath, `${label} peab olema korrektne kuupäev ja kellaaeg.`)
  }
  return iso
}

type ScheduledCollection = Extract<PublishedSlugCollection, 'pages' | 'articles' | 'legal-documents'>

const scheduledCollections: readonly ScheduledCollection[] = ['pages', 'articles', 'legal-documents']

function auditEntityType(collection: ScheduledCollection): string {
  switch (collection) {
    case 'articles':
      return 'article'
    case 'legal-documents':
      return 'legal-document'
    case 'pages':
      return 'page'
  }
}

/**
 * Lazy scheduled publishing: rows kept as drafts with a due `publishedAt`
 * flip to published before every write to a status-bearing collection. The
 * live site reads only `published` rows, so the flip makes scheduled content
 * visible without a manual publish. Limitation: nothing sweeps while no
 * admin action runs (no cron or DO alarm is in scope); the next content
 * write catches up, and revalidatePath refreshes the public routes.
 */
async function publishDueScheduledContent(
  repositories: CoreRepositories,
  actorId: string,
): Promise<void> {
  const nowIso = new Date().toISOString()
  for (const collection of scheduledCollections) {
    try {
      const { docs } = await repositories.find({
        collection,
        where: {
          and: [
            { status: { equals: 'draft' } },
            { publishedAt: { less_than_equal: nowIso } },
          ],
        },
        pagination: false,
      })
      for (const doc of docs) {
        if (!doc.publishedAt) {
          continue
        }
        // A due page going live counts as a publish: snapshot its blocks
        // before the flip. The surrounding catch keeps the sweep
        // opportunistic when the snapshot fails.
        if (collection === 'pages') {
          await createPageVersionSnapshot(doc.id, actorId)
        }
        await repositories.update({
          collection,
          id: doc.id,
          data: { status: 'published' },
        })
        await writeAudit(repositories, {
          actorId,
          action: 'content.publish',
          entityType: auditEntityType(collection),
          entityId: doc.id,
          before: { status: 'draft' },
          after: { status: 'published', slug: doc.slug, publishedAt: doc.publishedAt },
        })
        revalidatePath(contentPublicPath(collection, doc.slug))
      }
    } catch {
      // Opportunistic sweep: never block an unrelated admin write.
    }
  }
}

interface SlugChangeRedirectSource {
  slug: string
  status: ContentStatus
}

/**
 * Slug-change redirect offer (spec: published documents). The form checkbox
 * defaults to on; nothing happens for drafts, unchanged slugs, or a cleared
 * checkbox. An existing redirect for the old path is re-pointed instead of
 * creating a duplicate.
 */
async function persistSlugChangeRedirect(
  repositories: CoreRepositories,
  actorId: string,
  collection: PublishedSlugCollection,
  formData: FormData,
  current: SlugChangeRedirectSource | null,
  nextSlug: string,
  errorPath: string,
): Promise<void> {
  if (current?.status !== 'published') {
    return
  }
  if (current.slug === nextSlug || !readBool(formData, 'createRedirect')) {
    return
  }
  const { from, to } = redirectPathsForSlugChange(collection, current.slug, nextSlug)
  let failure: string | null = null
  try {
    const existing = await repositories.find({
      collection: 'redirects',
      where: { from: { equals: from } },
      limit: 1,
    })
    const doc = existing.docs[0]
    if (doc) {
      await repositories.update({
        collection: 'redirects',
        id: doc.id,
        data: { to, type: '301', active: true },
      })
    } else {
      await repositories.create({
        collection: 'redirects',
        data: { from, to, type: '301', active: true },
      })
      await writeAudit(repositories, {
        actorId,
        action: 'redirect.create',
        entityType: 'redirect',
        entityId: from,
        after: { from, to, type: '301' },
      })
    }
    revalidatePath(from)
    revalidatePath(to)
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }
  if (failure) {
    return redirectWithError(errorPath, `Suunamise loomine ebaõnnestus: ${failure}`)
  }
}

export async function saveArticleAction(formData: FormData): Promise<void> {
  const { session, repositories } = await requireAdminRepositories()
  assertCan(session.role, 'content:write')

  const id = readText(formData, 'id')
  const errorPath = formPath(articlesPath, id)
  const title = readText(formData, 'title')
  const slug = readText(formData, 'slug')
  const status = readText(formData, 'status') as ContentStatus

  if (!title) return redirectWithError(errorPath, 'Pealkiri on kohustuslik.')
  if (!slug) return redirectWithError(errorPath, 'URL-nimi on kohustuslik.')
  if (!contentStatuses.includes(status)) return redirectWithError(errorPath, 'Vali sobiv olek.')

  await publishDueScheduledContent(repositories, session.userId)

  const publishAtIso = await readPublishAt(formData, errorPath, 'Avaldamise aeg')
  const current = id
    ? await persist(errorPath, 'Artikli lugemine ebaõnnestus: ', () =>
        repositories.findByID({ collection: 'articles', id }),
      )
    : null
  if (id && !current) return redirectWithError(errorPath, 'Artiklit ei leitud.')

  const decision = resolvePublishDecision({
    requestedStatus: status,
    publishAtIso,
    currentPublishedAt: current?.publishedAt ?? null,
    currentStatus: current?.status ?? null,
    nowIso: new Date().toISOString(),
  })

  const data = {
    title,
    slug,
    status: decision.status,
    excerpt: readOptionalText(formData, 'excerpt'),
    content: readOptionalText(formData, 'content'),
    author: readOptionalText(formData, 'author'),
    tags: readTags(formData),
    featuredImageId: readOptionalText(formData, 'featuredImageId'),
    publishedAt: decision.publishedAt,
  }

  await persist(errorPath, 'Artikli salvestamine ebaõnnestus: ', async () => {
    const saved = current
      ? await repositories.update({ collection: 'articles', id, data })
      : await repositories.create({ collection: 'articles', data })
    if (decision.scheduled) {
      await writeAudit(repositories, {
        actorId: session.userId,
        action: 'content.schedule',
        entityType: 'article',
        entityId: saved.id,
        after: { slug, publishedAt: decision.publishedAt },
      })
    } else if (decision.publishTransition) {
      await writeAudit(repositories, {
        actorId: session.userId,
        action: 'content.publish',
        entityType: 'article',
        entityId: saved.id,
        before: {
          status: current?.status ?? null,
          slug: current?.slug ?? null,
          publishedAt: current?.publishedAt ?? null,
        },
        after: { ...data },
      })
    }
  })

  await persistSlugChangeRedirect(
    repositories,
    session.userId,
    'articles',
    formData,
    current ? { slug: current.slug, status: current.status } : null,
    slug,
    errorPath,
  )

  revalidate(articlesPath, id)
  revalidatePath(contentPublicPath('articles', slug))
  redirect(await adminUrl(articlesPath))
}

export async function setArticleStatusAction(formData: FormData): Promise<void> {
  const { session, repositories } = await requireAdminRepositories()
  assertCan(session.role, 'content:write')

  const id = readText(formData, 'id')
  const status = readText(formData, 'status') as ContentStatus
  if (!id) return redirectWithError(articlesPath, 'Artikli identifikaator puudub.')
  if (!contentStatuses.includes(status)) return redirectWithError(articlesPath, 'Vali sobiv olek.')

  await publishDueScheduledContent(repositories, session.userId)

  const current = await persist(articlesPath, 'Artikli lugemine ebaõnnestus: ', () =>
    repositories.findByID({ collection: 'articles', id }),
  )
  if (!current) return redirectWithError(articlesPath, 'Artiklit ei leitud.')

  const decision = resolvePublishDecision({
    requestedStatus: status,
    publishAtIso: null,
    currentPublishedAt: current.publishedAt,
    currentStatus: current.status,
    nowIso: new Date().toISOString(),
  })

  await persist(articlesPath, 'Artikli oleku muutmine ebaõnnestus: ', async () => {
    await repositories.update({
      collection: 'articles',
      id,
      data: { status: decision.status, publishedAt: decision.publishedAt },
    })
    if (decision.publishTransition) {
      await writeAudit(repositories, {
        actorId: session.userId,
        action: 'content.publish',
        entityType: 'article',
        entityId: id,
        before: { status: current.status, publishedAt: current.publishedAt },
        after: { status: decision.status, publishedAt: decision.publishedAt },
      })
    }
  })

  revalidate(articlesPath, id)
  revalidatePath(contentPublicPath('articles', current.slug))
  redirect(await adminUrl(articlesPath))
}

export async function deleteArticleAction(formData: FormData): Promise<void> {
  const { session, repositories } = await requireAdminRepositories()
  assertCan(session.role, 'content:write')

  const id = readText(formData, 'id')
  if (!id) return redirectWithError(articlesPath, 'Artikli identifikaator puudub.')

  await persist(articlesPath, 'Artikli kustutamine ebaõnnestus: ', () =>
    repositories.delete({ collection: 'articles', id }),
  )

  revalidate(articlesPath, id)
  redirect(await adminUrl(articlesPath))
}

export async function savePageAction(formData: FormData): Promise<void> {
  const { session, repositories } = await requireAdminRepositories()
  assertCan(session.role, 'content:write')

  const id = readText(formData, 'id')
  const errorPath = formPath(pagesPath, id)
  const title = readText(formData, 'title')
  const slug = readText(formData, 'slug')
  // The editor's Ajasta button submits intent=schedule with no status field;
  // publishing semantics stay with resolvePublishDecision below.
  const scheduleIntent = readText(formData, 'intent') === 'schedule'
  const status = (scheduleIntent ? 'published' : readText(formData, 'status')) as ContentStatus
  const layout = readJsonValue(formData, 'layout')

  if (!title) return redirectWithError(errorPath, 'Pealkiri on kohustuslik.')
  if (!slug) return redirectWithError(errorPath, 'URL-nimi on kohustuslik.')
  if (!contentStatuses.includes(status)) return redirectWithError(errorPath, 'Vali sobiv olek.')
  if (layout.invalid) return redirectWithError(errorPath, 'Paigutus peab olema korrektne JSON.')

  await publishDueScheduledContent(repositories, session.userId)

  const publishAtIso = await readPublishAt(formData, errorPath, 'Avaldamise aeg')
  if (scheduleIntent && (publishAtIso === null || publishAtIso <= new Date().toISOString())) {
    return redirectWithError(errorPath, 'Ajastamiseks vali tulevikus olev avaldamise aeg.')
  }
  const current = id
    ? await persist(errorPath, 'Lehe lugemine ebaõnnestus: ', () =>
        repositories.findByID({ collection: 'pages', id }),
      )
    : null
  if (id && !current) return redirectWithError(errorPath, 'Lehte ei leitud.')

  const decision = resolvePublishDecision({
    requestedStatus: status,
    publishAtIso,
    currentPublishedAt: current?.publishedAt ?? null,
    currentStatus: current?.status ?? null,
    nowIso: new Date().toISOString(),
  })

  const data = {
    title,
    slug,
    status: decision.status,
    seoTitle: readOptionalText(formData, 'seoTitle'),
    seoDescription: readOptionalText(formData, 'seoDescription'),
    layout: layout.value,
    publishedAt: decision.publishedAt,
  }

  await persist(errorPath, 'Lehe salvestamine ebaõnnestus: ', async () => {
    const saved = current
      ? await repositories.update({ collection: 'pages', id, data })
      : await repositories.create({ collection: 'pages', data })
    if (decision.scheduled) {
      await writeAudit(repositories, {
        actorId: session.userId,
        action: 'content.schedule',
        entityType: 'page',
        entityId: saved.id,
        after: { slug, publishedAt: decision.publishedAt },
      })
    } else if (decision.publishTransition) {
      // Published pages are versioned: the snapshot goes into the same
      // persist block, so a failed snapshot fails the save like any
      // other write.
      await createPageVersionSnapshot(saved.id, session.userId)
      await writeAudit(repositories, {
        actorId: session.userId,
        action: 'content.publish',
        entityType: 'page',
        entityId: saved.id,
        before: {
          status: current?.status ?? null,
          slug: current?.slug ?? null,
          publishedAt: current?.publishedAt ?? null,
        },
        after: { ...data },
      })
    }
  })

  await persistSlugChangeRedirect(
    repositories,
    session.userId,
    'pages',
    formData,
    current ? { slug: current.slug, status: current.status } : null,
    slug,
    errorPath,
  )

  revalidate(pagesPath, id)
  revalidatePath(contentPublicPath('pages', slug))
  redirect(await adminUrl(pagesPath))
}

export async function deletePageAction(formData: FormData): Promise<void> {
  const { session, repositories } = await requireAdminRepositories()
  assertCan(session.role, 'content:write')

  const id = readText(formData, 'id')
  if (!id) return redirectWithError(pagesPath, 'Lehe identifikaator puudub.')

  await persist(pagesPath, 'Lehe kustutamine ebaõnnestus: ', () =>
    repositories.delete({ collection: 'pages', id }),
  )

  revalidate(pagesPath, id)
  redirect(await adminUrl(pagesPath))
}

/** One validated block as stored in snapshots and `page_blocks.config_json`. */
interface SnapshotBlock {
  type: PageBlockType
  config: BlockConfig
}

/** A block row as read back from D1: the config has not been revalidated. */
interface StoredBlock {
  type: PageBlockType
  config: unknown
}

const maxBlocksPerPage = 100

/**
 * Validates a raw blocks payload (builder JSON or a version snapshot) through
 * the per-type registry schemas. Runs fully before any mutation so a bad
 * payload can never leave a page with half-replaced blocks.
 */
function parseSnapshotBlocks(raw: unknown): { ok: true; blocks: SnapshotBlock[] } | { ok: false; error: string } {
  if (!Array.isArray(raw)) {
    return { ok: false, error: 'Blokid peavad olema loend.' }
  }
  if (raw.length > maxBlocksPerPage) {
    return { ok: false, error: `Blokke võib olla kuni ${String(maxBlocksPerPage)}.` }
  }
  const blocks: SnapshotBlock[] = []
  for (const [index, entry] of raw.entries()) {
    const record = (entry ?? {}) as Record<string, unknown>
    const type = record.type
    if (typeof type !== 'string' || !pageBlockTypes.includes(type as PageBlockType)) {
      return { ok: false, error: `Bloki ${String(index + 1)} tüüp on tundmatu.` }
    }
    const parsed = safeParseBlockConfig(type as PageBlockType, record.config ?? {})
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      const detail = issue ? ` (${issue.path}: ${issue.message})` : ''
      return { ok: false, error: `Bloki ${String(index + 1)} sisu ei vasta skeemile${detail}.` }
    }
    blocks.push({ type: type as PageBlockType, config: parsed.data })
  }
  return { ok: true, blocks }
}

function readPageBlocks(
  repositories: CoreRepositories,
  pageId: string,
): Promise<StoredBlock[]> {
  return repositories
    .find({
      collection: 'page-blocks',
      where: { pageId: { equals: pageId } },
      sort: 'ordinal',
      pagination: false,
    })
    .then(({ docs }) =>
      docs.map((doc) => ({ type: doc.type, config: doc.configJson ?? {} })),
    )
}

/**
 * Replace-all block write: existing rows for the page are deleted, the new
 * set is inserted with ordinals 0..n. The repository layer exposes no
 * transaction, so the payload is fully validated up front (parseSnapshotBlocks)
 * and rows are rewritten in one pass; a mid-write failure surfaces through the
 * action's error redirect instead of leaving a mixed config behind silently.
 * Returns the previous rows for the audit `before` payload.
 */
async function replacePageBlocks(
  repositories: CoreRepositories,
  pageId: string,
  blocks: readonly SnapshotBlock[],
): Promise<PageBlockDoc[]> {
  const { docs } = await repositories.find({
    collection: 'page-blocks',
    where: { pageId: { equals: pageId } },
    pagination: false,
  })
  for (const doc of docs) {
    await repositories.delete({ collection: 'page-blocks', id: doc.id })
  }
  for (const [ordinal, block] of blocks.entries()) {
    await repositories.create({
      collection: 'page-blocks',
      data: {
        pageId,
        type: block.type,
        ordinal,
        configJson: serializeBlockConfig(block.config),
      },
    })
  }
  return docs
}

/**
 * Append-only publish snapshot: the page's current blocks serialized into
 * `page_versions` with the next per-page version number. Runs on a trusted
 * repository (page_versions has no guard rule); the admin permission was
 * already asserted by the calling action.
 */
async function createPageVersionSnapshot(pageId: string, actorId: string): Promise<void> {
  const repositories = await getRepositories()
  const blocks = await readPageBlocks(repositories, pageId)
  const { docs } = await repositories.find({
    collection: 'page-versions',
    where: { pageId: { equals: pageId } },
    sort: '-version',
    limit: 1,
  })
  const version = (docs[0]?.version ?? 0) + 1
  await repositories.create({
    collection: 'page-versions',
    data: { pageId, version, snapshotJson: JSON.stringify(blocks) },
  })
  await writeAudit(repositories, {
    actorId,
    action: 'content.version.create',
    entityType: 'page',
    entityId: pageId,
    after: { version, blockCount: blocks.length },
  })
}

export async function savePageBlocksAction(formData: FormData): Promise<void> {
  const { session } = await requireAdminRepositories()
  assertCan(session.role, 'content:write')

  const pageId = readText(formData, 'pageId')
  if (!pageId) return redirectWithError(pagesPath, 'Lehe identifikaator puudub.')
  const errorPath = formPath(pagesPath, pageId)

  const raw = readJsonValue(formData, 'blocks')
  if (raw.invalid) return redirectWithError(errorPath, 'Blokid peavad olema korrektne JSON.')
  const parsed = parseSnapshotBlocks(raw.value)
  if (!parsed.ok) return redirectWithError(errorPath, parsed.error)

  const repositories = await getRepositories()
  const page = await persist(errorPath, 'Lehe lugemine ebaõnnestus: ', () =>
    repositories.findByID({ collection: 'pages', id: pageId }),
  )
  if (!page) return redirectWithError(errorPath, 'Lehte ei leitud.')

  await persist(errorPath, 'Blokide salvestamine ebaõnnestus: ', async () => {
    const previousDocs = await replacePageBlocks(repositories, pageId, parsed.blocks)
    await writeAudit(repositories, {
      actorId: session.userId,
      action: 'content.blocks.save',
      entityType: 'page',
      entityId: pageId,
      before: { blockCount: previousDocs.length },
      after: {
        blockCount: parsed.blocks.length,
        types: parsed.blocks.map((block) => block.type),
      },
    })
  })

  revalidate(pagesPath, pageId)
  revalidatePath(contentPublicPath('pages', page.slug))
}

export async function restorePageVersionAction(formData: FormData): Promise<void> {
  const { session } = await requireAdminRepositories()
  assertCan(session.role, 'content:write')

  const pageId = readText(formData, 'pageId')
  if (!pageId) return redirectWithError(pagesPath, 'Lehe identifikaator puudub.')
  const errorPath = formPath(pagesPath, pageId)
  const versionId = readText(formData, 'versionId')
  if (!versionId) return redirectWithError(errorPath, 'Versiooni identifikaator puudub.')
  // Restores overwrite the current blocks: reason-required like settings saves.
  const reason = readText(formData, 'reason')
  if (!isValidReason(reason)) {
    return redirectWithError(errorPath, 'Põhjendus peab olema vähemalt 5 tähemärki.')
  }

  const repositories = await getRepositories()
  const page = await persist(errorPath, 'Lehe lugemine ebaõnnestus: ', () =>
    repositories.findByID({ collection: 'pages', id: pageId }),
  )
  if (!page) return redirectWithError(errorPath, 'Lehte ei leitud.')

  const version = await persist(errorPath, 'Versiooni lugemine ebaõnnestus: ', () =>
    repositories.findByID({ collection: 'page-versions', id: versionId }),
  )
  if (version?.pageId !== pageId) {
    return redirectWithError(errorPath, 'Versiooni ei leitud.')
  }

  const parsed = parseSnapshotBlocks(version.snapshotJson)
  if (!parsed.ok) {
    return redirectWithError(errorPath, `Versiooni andmed ei ole korrektsed: ${parsed.error}`)
  }

  await persist(errorPath, 'Versiooni taastamine ebaõnnestus: ', async () => {
    const previous = await replacePageBlocks(repositories, pageId, parsed.blocks)
    await writeAudit(repositories, {
      actorId: session.userId,
      action: 'content.version.restore',
      entityType: 'page',
      entityId: pageId,
      before: { blockCount: previous.length },
      after: {
        restoredVersion: version.version,
        blockCount: parsed.blocks.length,
        reason,
      },
    })
  })

  revalidate(pagesPath, pageId)
  revalidatePath(contentPublicPath('pages', page.slug))
  redirect(await adminUrl(errorPath))
}

export async function saveFaqCategoryAction(formData: FormData): Promise<void> {
  const { session, repositories } = await requireAdminRepositories()
  assertCan(session.role, 'content:write')

  const id = readText(formData, 'id')
  const errorPath = formPath(faqCategoriesPath, id)
  const title = readText(formData, 'title')
  const slug = readText(formData, 'slug')
  const order = readInt(formData, 'order')

  if (!title) return redirectWithError(errorPath, 'Pealkiri on kohustuslik.')
  if (!slug) return redirectWithError(errorPath, 'URL-nimi on kohustuslik.')
  if (!Number.isInteger(order) || order < 0) {
    return redirectWithError(errorPath, 'Järjekord peab olema mitte negatiivne täisarv.')
  }

  const data = { title, slug, order, active: readBool(formData, 'active') }

  await persist(errorPath, 'Kategooria salvestamine ebaõnnestus: ', () =>
    id
      ? repositories.update({ collection: 'faq-categories', id, data })
      : repositories.create({ collection: 'faq-categories', data }),
  )

  revalidate(faqCategoriesPath, id)
  redirect(await adminUrl(faqCategoriesPath))
}

export async function deleteFaqCategoryAction(formData: FormData): Promise<void> {
  const { session, repositories } = await requireAdminRepositories()
  assertCan(session.role, 'content:write')

  const id = readText(formData, 'id')
  if (!id) return redirectWithError(faqCategoriesPath, 'Kategooria identifikaator puudub.')

  await persist(faqCategoriesPath, 'Kategooria kustutamine ebaõnnestus: ', () =>
    repositories.delete({ collection: 'faq-categories', id }),
  )

  revalidate(faqCategoriesPath, id)
  redirect(await adminUrl(faqCategoriesPath))
}

export async function saveFaqItemAction(formData: FormData): Promise<void> {
  const { session, repositories } = await requireAdminRepositories()
  assertCan(session.role, 'content:write')

  const id = readText(formData, 'id')
  const errorPath = formPath(faqItemsPath, id)
  const question = readText(formData, 'question')
  const answer = readText(formData, 'answer')
  const categoryId = readText(formData, 'categoryId')
  const order = readInt(formData, 'order')

  if (!question) return redirectWithError(errorPath, 'Küsimus on kohustuslik.')
  if (!answer) return redirectWithError(errorPath, 'Vastus on kohustuslik.')
  if (!categoryId) return redirectWithError(errorPath, 'Vali kategooria.')
  if (!Number.isInteger(order) || order < 0) {
    return redirectWithError(errorPath, 'Järjekord peab olema mitte negatiivne täisarv.')
  }

  const category = await persist(errorPath, 'Kategooria lugemine ebaõnnestus: ', () =>
    repositories.findByID({ collection: 'faq-categories', id: categoryId }),
  )
  if (!category) return redirectWithError(errorPath, 'Valitud kategooriat ei leitud.')

  const data = {
    question,
    answer,
    categoryId,
    order,
    slug: readOptionalText(formData, 'slug'),
    shortAnswer: readOptionalText(formData, 'shortAnswer'),
    active: readBool(formData, 'active'),
  }

  await persist(errorPath, 'Küsimuse salvestamine ebaõnnestus: ', () =>
    id
      ? repositories.update({ collection: 'faq-items', id, data })
      : repositories.create({ collection: 'faq-items', data }),
  )

  revalidate(faqItemsPath, id)
  redirect(await adminUrl(faqItemsPath))
}

export async function deleteFaqItemAction(formData: FormData): Promise<void> {
  const { session, repositories } = await requireAdminRepositories()
  assertCan(session.role, 'content:write')

  const id = readText(formData, 'id')
  if (!id) return redirectWithError(faqItemsPath, 'Küsimuse identifikaator puudub.')

  await persist(faqItemsPath, 'Küsimuse kustutamine ebaõnnestus: ', () =>
    repositories.delete({ collection: 'faq-items', id }),
  )

  revalidate(faqItemsPath, id)
  redirect(await adminUrl(faqItemsPath))
}

export async function saveTestimonialAction(formData: FormData): Promise<void> {
  const { session, repositories } = await requireAdminRepositories()
  assertCan(session.role, 'content:write')

  const id = readText(formData, 'id')
  const errorPath = formPath(testimonialsPath, id)
  const name = readText(formData, 'name')
  const content = readText(formData, 'content')
  const status = readText(formData, 'status') as ContentStatus
  const rating = readOptionalNumber(formData, 'rating')

  if (!name) return redirectWithError(errorPath, 'Nimi on kohustuslik.')
  if (!content) return redirectWithError(errorPath, 'Tsitaat on kohustuslik.')
  if (!contentStatuses.includes(status)) return redirectWithError(errorPath, 'Vali sobiv olek.')
  if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
    return redirectWithError(errorPath, 'Hinne peab olema täisarv vahemikus 1 kuni 5.')
  }

  const data = {
    name,
    content,
    role: readOptionalText(formData, 'role'),
    avatarId: readOptionalText(formData, 'avatarId'),
    featured: readBool(formData, 'featured'),
    status,
    rating,
  }

  await persist(errorPath, 'Tagasiside salvestamine ebaõnnestus: ', () =>
    id
      ? repositories.update({ collection: 'testimonials', id, data })
      : repositories.create({ collection: 'testimonials', data }),
  )

  revalidate(testimonialsPath, id)
  redirect(await adminUrl(testimonialsPath))
}

export async function deleteTestimonialAction(formData: FormData): Promise<void> {
  const { session, repositories } = await requireAdminRepositories()
  assertCan(session.role, 'content:write')

  const id = readText(formData, 'id')
  if (!id) return redirectWithError(testimonialsPath, 'Tagasiside identifikaator puudub.')

  await persist(testimonialsPath, 'Tagasiside kustutamine ebaõnnestus: ', () =>
    repositories.delete({ collection: 'testimonials', id }),
  )

  revalidate(testimonialsPath, id)
  redirect(await adminUrl(testimonialsPath))
}

export async function savePartnerServiceAction(formData: FormData): Promise<void> {
  const { session, repositories } = await requireAdminRepositories()
  assertCan(session.role, 'content:write')

  const id = readText(formData, 'id')
  const errorPath = formPath(partnerServicesPath, id)
  const name = readText(formData, 'name')
  const slug = readText(formData, 'slug')
  const order = readInt(formData, 'order')

  if (!name) return redirectWithError(errorPath, 'Nimi on kohustuslik.')
  if (!slug) return redirectWithError(errorPath, 'URL-nimi on kohustuslik.')
  if (!Number.isInteger(order) || order < 0) {
    return redirectWithError(errorPath, 'Järjekord peab olema mitte negatiivne täisarv.')
  }

  const data = {
    name,
    slug,
    description: readOptionalText(formData, 'description'),
    icon: readOptionalText(formData, 'icon'),
    link: readOptionalText(formData, 'link'),
    order,
    active: readBool(formData, 'active'),
  }

  await persist(errorPath, 'Teenuse salvestamine ebaõnnestus: ', () =>
    id
      ? repositories.update({ collection: 'partner-services', id, data })
      : repositories.create({ collection: 'partner-services', data }),
  )

  revalidate(partnerServicesPath, id)
  redirect(await adminUrl(partnerServicesPath))
}

export async function deletePartnerServiceAction(formData: FormData): Promise<void> {
  const { session, repositories } = await requireAdminRepositories()
  assertCan(session.role, 'content:write')

  const id = readText(formData, 'id')
  if (!id) return redirectWithError(partnerServicesPath, 'Teenuse identifikaator puudub.')

  await persist(partnerServicesPath, 'Teenuse kustutamine ebaõnnestus: ', () =>
    repositories.delete({ collection: 'partner-services', id }),
  )

  revalidate(partnerServicesPath, id)
  redirect(await adminUrl(partnerServicesPath))
}

export async function saveLegalDocumentAction(formData: FormData): Promise<void> {
  const { session, repositories } = await requireAdminRepositories()
  assertCan(session.role, 'content:write')

  const id = readText(formData, 'id')
  const errorPath = formPath(legalDocumentsPath, id)
  const title = readText(formData, 'title')
  const slug = readText(formData, 'slug')
  const content = readText(formData, 'content')
  const status = readText(formData, 'status') as ContentStatus
  const typeRaw = readText(formData, 'type')

  if (!title) return redirectWithError(errorPath, 'Pealkiri on kohustuslik.')
  if (!slug) return redirectWithError(errorPath, 'URL-nimi on kohustuslik.')
  if (!content) return redirectWithError(errorPath, 'Sisu on kohustuslik.')
  if (!contentStatuses.includes(status)) return redirectWithError(errorPath, 'Vali sobiv olek.')
  if (typeRaw.length > 0 && !legalDocumentTypes.includes(typeRaw as LegalDocumentType)) {
    return redirectWithError(errorPath, 'Vali sobiv dokumendi tüüp.')
  }

  await publishDueScheduledContent(repositories, session.userId)

  const publishAtIso = await readPublishAt(formData, errorPath, 'Avaldamise aeg')
  const current = id
    ? await persist(errorPath, 'Dokumendi lugemine ebaõnnestus: ', () =>
        repositories.findByID({ collection: 'legal-documents', id }),
      )
    : null
  if (id && !current) return redirectWithError(errorPath, 'Dokumenti ei leitud.')

  const decision = resolvePublishDecision({
    requestedStatus: status,
    publishAtIso,
    currentPublishedAt: current?.publishedAt ?? null,
    currentStatus: current?.status ?? null,
    nowIso: new Date().toISOString(),
  })

  const data = {
    title,
    slug,
    type: (typeRaw.length > 0 ? typeRaw : null) as LegalDocumentType | null,
    content,
    version: readOptionalText(formData, 'version'),
    effectiveDate: readOptionalText(formData, 'effectiveDate'),
    status: decision.status,
    publishedAt: decision.publishedAt,
  }

  await persist(errorPath, 'Dokumendi salvestamine ebaõnnestus: ', async () => {
    const saved = current
      ? await repositories.update({ collection: 'legal-documents', id, data })
      : await repositories.create({ collection: 'legal-documents', data })
    if (decision.scheduled) {
      await writeAudit(repositories, {
        actorId: session.userId,
        action: 'content.schedule',
        entityType: 'legal-document',
        entityId: saved.id,
        after: { slug, publishedAt: decision.publishedAt },
      })
    } else if (decision.publishTransition) {
      await writeAudit(repositories, {
        actorId: session.userId,
        action: 'content.publish',
        entityType: 'legal-document',
        entityId: saved.id,
        before: {
          status: current?.status ?? null,
          slug: current?.slug ?? null,
          publishedAt: current?.publishedAt ?? null,
        },
        after: { ...data },
      })
    }
  })

  await persistSlugChangeRedirect(
    repositories,
    session.userId,
    'legal-documents',
    formData,
    current ? { slug: current.slug, status: current.status } : null,
    slug,
    errorPath,
  )

  revalidate(legalDocumentsPath, id)
  revalidatePath(contentPublicPath('legal-documents', slug))
  redirect(await adminUrl(legalDocumentsPath))
}

export async function deleteLegalDocumentAction(formData: FormData): Promise<void> {
  const { session, repositories } = await requireAdminRepositories()
  assertCan(session.role, 'content:write')

  const id = readText(formData, 'id')
  if (!id) return redirectWithError(legalDocumentsPath, 'Dokumendi identifikaator puudub.')

  await persist(legalDocumentsPath, 'Dokumendi kustutamine ebaõnnestus: ', () =>
    repositories.delete({ collection: 'legal-documents', id }),
  )

  revalidate(legalDocumentsPath, id)
  redirect(await adminUrl(legalDocumentsPath))
}

/** from→to map over the stored redirects, the input of the chain validator. */
async function redirectChainMap(repositories: CoreRepositories): Promise<Map<string, string>> {
  const { docs } = await repositories.find({ collection: 'redirects', pagination: false })
  return new Map(docs.map((doc) => [doc.from, doc.to]))
}

/**
 * Save with the task-3.5 rules: both paths start with "/", no
 * self-redirect, and the target chain stays within the hop cap. The save
 * is audited with the previous values so chain edits stay traceable.
 */
export async function saveRedirectAction(formData: FormData): Promise<void> {
  const { session, repositories } = await requireAdminRepositories()
  assertCan(session.role, 'content:write')

  const id = readText(formData, 'id')
  const errorPath = formPath(redirectsPath, id)
  const from = readText(formData, 'from')
  const to = readText(formData, 'to')
  const type = readText(formData, 'type') as RedirectType

  if (!from) return redirectWithError(errorPath, 'Kust on kohustuslik.')
  if (!to) return redirectWithError(errorPath, 'Kuhu on kohustuslik.')
  if (!redirectTypes.includes(type)) return redirectWithError(errorPath, 'Vali suunamise tüüp.')

  const current = id
    ? await persist(errorPath, 'Suunamise lugemine ebaõnnestus: ', () =>
        repositories.findByID({ collection: 'redirects', id }),
      )
    : null
  if (id && !current) return redirectWithError(errorPath, 'Suunamist ei leitud.')

  const byFrom = await redirectChainMap(repositories)
  // The row being edited keeps its old mapping in the loaded map; drop it so
  // the chain walk sees the post-save state and cannot count it as a hop.
  if (current) byFrom.delete(current.from)
  const validationError = validateRedirect(from, to, byFrom)
  if (validationError) return redirectWithError(errorPath, validationError)

  const data = { from, to, type, active: readBool(formData, 'active') }

  await persist(errorPath, 'Suunamise salvestamine ebaõnnestus: ', async () => {
    const saved = current
      ? await repositories.update({ collection: 'redirects', id, data })
      : await repositories.create({ collection: 'redirects', data })
    await writeAudit(repositories, {
      actorId: session.userId,
      action: current ? 'redirect.update' : 'redirect.create',
      entityType: 'redirect',
      entityId: saved.id,
      before: current
        ? { from: current.from, to: current.to, type: current.type, active: current.active }
        : undefined,
      after: { from, to, type, active: data.active },
    })
  })

  revalidate(redirectsPath, id)
  if (current && current.from !== from) {
    revalidatePath(current.from)
  }
  revalidatePath(from)
  revalidatePath(to)
  redirect(await adminUrl(redirectsPath))
}

/** Delete requires a typed reason and lands on the append-only audit log. */
export async function deleteRedirectAction(formData: FormData): Promise<void> {
  const { session, repositories } = await requireAdminRepositories()
  assertCan(session.role, 'content:write')

  const id = readText(formData, 'id')
  const reason = readText(formData, 'reason')
  if (!id) return redirectWithError(redirectsPath, 'Suunamise identifikaator puudub.')
  if (!isValidReason(reason)) {
    return redirectWithError(redirectsPath, 'Kustutamise põhjus peab olema vähemalt 5 tähemärki.')
  }

  const current = await persist(redirectsPath, 'Suunamise lugemine ebaõnnestus: ', () =>
    repositories.findByID({ collection: 'redirects', id }),
  )
  if (!current) return redirectWithError(redirectsPath, 'Suunamist ei leitud.')

  await persist(redirectsPath, 'Suunamise kustutamine ebaõnnestus: ', async () => {
    await repositories.delete({ collection: 'redirects', id })
    await writeAudit(repositories, {
      actorId: session.userId,
      action: 'redirect.delete',
      entityType: 'redirect',
      entityId: id,
      before: { from: current.from, to: current.to, type: current.type, hits: current.hits },
      after: { deleted: true, reason },
    })
  })

  revalidate(redirectsPath, id)
  revalidatePath(current.from)
  redirect(await adminUrl(redirectsPath))
}

// ── Redirects CSV bulk import (task 3.5) ────────────────────────────────────

function csvErrorReport(message: string, dryRun: boolean): RedirectImportReport {
  return {
    status: 'error',
    message,
    dryRun,
    items: [],
    summary: { created: 0, updated: 0, failed: 0 },
  }
}

/**
 * Bulk import for redirects from a CSV file (columns: from,to,type,active;
 * a header row is required). Upserts by `from` like the JSON importer
 * upserts by slug; the same validation rules and hop cap apply per row.
 */
export async function importRedirectsCsvAction(
  _previous: RedirectImportReport | null,
  formData: FormData,
): Promise<RedirectImportReport> {
  const { session, repositories } = await requireAdminRepositories()
  assertCan(session.role, 'content:write')

  const dryRun = formData.get('dryRun') === 'true'
  const file = formData.get('file')
  if (!(file instanceof File)) return csvErrorReport('Vali CSV-fail.', dryRun)
  if (file.size === 0) return csvErrorReport('Fail on tühi.', dryRun)
  if (file.size > MAX_IMPORT_BYTES) {
    const sizeMiB = (file.size / (1024 * 1024)).toFixed(1)
    return csvErrorReport(`Fail on liiga suur (${sizeMiB} MiB); lubatud on kuni 2 MiB.`, dryRun)
  }

  const parsed = parseRedirectCsv(await file.text())
  if (!parsed.ok) return csvErrorReport(parsed.error, dryRun)

  const { docs } = await repositories.find({ collection: 'redirects', pagination: false })
  const byFrom = new Map(docs.map((doc) => [doc.from, doc.id]))
  const chainMap = new Map(docs.map((doc) => [doc.from, doc.to]))

  const plan = planRedirectCsvUpserts(parsed.rows, byFrom, chainMap)

  const items: RedirectImportItemResult[] = [...plan.invalid]
  if (dryRun) {
    items.push(
      ...plan.plans.map(
        (plan): RedirectImportItemResult => ({
          index: plan.index,
          from: plan.from,
          to: plan.to,
          outcome: plan.action === 'create' ? 'would-create' : 'would-update',
        }),
      ),
    )
    return {
      status: 'dry-run',
      message: 'Kontroll valmis; midagi ei salvestatud.',
      dryRun: true,
      items,
      summary: summarizeRedirectItems(items),
    }
  }

  for (const rowPlan of plan.plans) {
    const result: RedirectImportItemResult = {
      index: rowPlan.index,
      from: rowPlan.from,
      to: rowPlan.to,
      outcome: rowPlan.action === 'create' ? 'created' : 'updated',
    }
    items.push(result)
    try {
      const data = { from: rowPlan.from, to: rowPlan.to, type: rowPlan.type, active: rowPlan.active }
      if (rowPlan.existingId) {
        await repositories.update({ collection: 'redirects', id: rowPlan.existingId, data })
      } else {
        const created = await repositories.create({ collection: 'redirects', data })
        await writeAudit(repositories, {
          actorId: session.userId,
          action: 'redirect.create',
          entityType: 'redirect',
          entityId: created.id,
          after: data,
        })
      }
    } catch (error) {
      result.outcome = 'failed'
      result.reason = error instanceof Error ? error.message : String(error)
    }
  }

  revalidatePath(redirectsPath)
  const summary = summarizeRedirectItems(items)
  return {
    status: summary.failed > 0 ? 'partial' : 'success',
    message: `Import valmis: ${String(summary.created)} loodud, ${String(summary.updated)} uuendatud, ${String(summary.failed)} ebaõnnestus.`,
    dryRun: false,
    items,
    summary,
  }
}

export async function saveSpecialistAction(formData: FormData): Promise<void> {
  const { session, repositories } = await requireAdminRepositories()
  assertCan(session.role, 'content:write')

  const id = readText(formData, 'id')
  const errorPath = formPath(specialistsPath, id)
  const name = readText(formData, 'name')
  const slug = readText(formData, 'slug')

  if (!name) return redirectWithError(errorPath, 'Nimi on kohustuslik.')
  if (!slug) return redirectWithError(errorPath, 'URL-nimi on kohustuslik.')

  const data = {
    name,
    slug,
    role: readOptionalText(formData, 'role'),
    phone: readOptionalText(formData, 'phone'),
    email: readOptionalText(formData, 'email'),
    photoId: readOptionalText(formData, 'photoId'),
    bio: readOptionalText(formData, 'bio'),
    region: readOptionalText(formData, 'region'),
    active: readBool(formData, 'active'),
    featured: readBool(formData, 'featured'),
  }

  await persist(errorPath, 'Spetsialisti salvestamine ebaõnnestus: ', () =>
    id
      ? repositories.update({ collection: 'specialists', id, data })
      : repositories.create({ collection: 'specialists', data }),
  )

  revalidate(specialistsPath, id)
  redirect(await adminUrl(specialistsPath))
}

export async function deleteSpecialistAction(formData: FormData): Promise<void> {
  const { session, repositories } = await requireAdminRepositories()
  assertCan(session.role, 'content:write')

  const id = readText(formData, 'id')
  if (!id) return redirectWithError(specialistsPath, 'Spetsialisti identifikaator puudub.')

  await persist(specialistsPath, 'Spetsialisti kustutamine ebaõnnestus: ', () =>
    repositories.delete({ collection: 'specialists', id }),
  )

  revalidate(specialistsPath, id)
  redirect(await adminUrl(specialistsPath))
}

export async function saveStatisticsSnapshotAction(formData: FormData): Promise<void> {
  const { repositories } = await requireAdminRepositories()

  const id = readText(formData, 'id')
  const errorPath = formPath(statisticsPath, id)
  const date = readText(formData, 'date')
  const objectType = readText(formData, 'objectType') as AuctionObjectType
  const count = readInt(formData, 'count')
  const area = readOptionalNumber(formData, 'area')
  const volume = readOptionalNumber(formData, 'volume')
  const eur = readNumber(formData, 'eur')

  if (!date) return redirectWithError(errorPath, 'Kuupäev on kohustuslik.')
  if (!auctionObjectTypes.includes(objectType)) {
    return redirectWithError(errorPath, 'Vali sobiv objekti tüüp.')
  }
  if (!Number.isInteger(count) || count < 0) {
    return redirectWithError(errorPath, 'Arv peab olema mitte negatiivne täisarv.')
  }
  if (area !== null && (!Number.isFinite(area) || area < 0)) {
    return redirectWithError(errorPath, 'Pindala peab olema mitte negatiivne number.')
  }
  if (volume !== null && (!Number.isFinite(volume) || volume < 0)) {
    return redirectWithError(errorPath, 'Maht peab olema mitte negatiivne number.')
  }
  if (!Number.isFinite(eur) || eur < 0) {
    return redirectWithError(errorPath, 'Summa peab olema mitte negatiivne number.')
  }

  const data = { date, objectType, count, area, volume, eur }

  await persist(errorPath, 'Statistikakirje salvestamine ebaõnnestus: ', () =>
    id
      ? repositories.update({ collection: 'statistics-snapshots', id, data })
      : repositories.create({ collection: 'statistics-snapshots', data }),
  )

  revalidate(statisticsPath, id)
  redirect(await adminUrl(statisticsPath))
}

export async function deleteStatisticsSnapshotAction(formData: FormData): Promise<void> {
  const { repositories } = await requireAdminRepositories()

  const id = readText(formData, 'id')
  if (!id) return redirectWithError(statisticsPath, 'Statistikakirje identifikaator puudub.')

  await persist(statisticsPath, 'Statistikakirje kustutamine ebaõnnestus: ', () =>
    repositories.delete({ collection: 'statistics-snapshots', id }),
  )

  revalidate(statisticsPath, id)
  redirect(await adminUrl(statisticsPath))
}

const settingsSections = ['uldine', 'tasud', 'oksjonid', 'lipud'] as const

/** Append-only audit write; the schema has a dedicated `before` JSON column. */
async function writeAudit(
  repositories: CoreRepositories,
  entry: {
    actorId: string
    action: string
    entityType: string
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
      entityType: entry.entityType,
      entityId: entry.entityId,
      ...(entry.before !== undefined ? { before: entry.before } : {}),
      after: entry.after,
    },
  })
}

export async function updateSettingsAction(formData: FormData): Promise<void> {
  const { session, repositories } = await requireAdminRepositories()
  assertCan(session.role, 'settings:write')

  const section = readText(formData, 'section')
  if (!settingsSections.includes(section as (typeof settingsSections)[number])) {
    return redirectWithError(settingsPath, 'Tundmatu seadete sektsioon.')
  }
  // Reason-required saves (design D7): without a valid reason nothing changes.
  const reason = readText(formData, 'reason')
  if (!isValidReason(reason)) {
    return redirectWithError(settingsPath, 'Põhjendus peab olema vähemalt 5 tähemärki.')
  }

  const { docs } = await persist(settingsPath, 'Sätete lugemine ebaõnnestus: ', () =>
    repositories.find({ collection: 'settings', limit: 1 }),
  )
  const current = docs[0]
  const currentFlags = readFlagObject(current?.featureFlags)

  let data: UpdateDataFor<'settings'>
  let beforeValues: Record<string, unknown>
  let afterValues: Record<string, unknown>
  let feeChanged = false

  if (section === 'uldine') {
    const supportEmail = readOptionalText(formData, 'supportEmail')
    const supportPhone = readOptionalText(formData, 'supportPhone')
    const aliasDomain = readOptionalText(formData, 'aliasDomain')
    if (supportEmail !== null && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(supportEmail)) {
      return redirectWithError(settingsPath, 'Klienditoe e-post peab olema korrektne e-posti aadress.')
    }
    if (supportPhone !== null && !/^\+?[\d ()-]{5,20}$/.test(supportPhone)) {
      return redirectWithError(settingsPath, 'Klienditoe telefon peab koosnema numbritest (lubatud +, tühik ja sidekriips).')
    }
    if (
      aliasDomain !== null &&
      !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(
        aliasDomain.toLowerCase(),
      )
    ) {
      return redirectWithError(
        settingsPath,
        'Alias-domeen peab olema korrektne domeeninimi (näiteks oksjonid.erametsad.ee).',
      )
    }
    data = {
      orgName: readOptionalText(formData, 'orgName'),
      orgRegCode: readOptionalText(formData, 'orgRegCode'),
      orgVatCode: readOptionalText(formData, 'orgVatCode'),
      orgAddress: readOptionalText(formData, 'orgAddress'),
      supportEmail,
      supportPhone,
      aliasDomain,
    }
    beforeValues = {
      orgName: current?.orgName ?? null,
      orgRegCode: current?.orgRegCode ?? null,
      orgVatCode: current?.orgVatCode ?? null,
      orgAddress: current?.orgAddress ?? null,
      supportEmail: current?.supportEmail ?? null,
      supportPhone: current?.supportPhone ?? null,
      aliasDomain: current?.aliasDomain ?? null,
    }
    afterValues = {
      orgName: data.orgName,
      orgRegCode: data.orgRegCode,
      orgVatCode: data.orgVatCode,
      orgAddress: data.orgAddress,
      supportEmail,
      supportPhone,
      aliasDomain,
    }
  } else if (section === 'tasud') {
    const feePercent = readInt(formData, 'feePercent')
    const vatPercent = readInt(formData, 'vatPercent')
    const quickAuctionFeePercent = readOptionalInt(formData, 'quickAuctionFeePercent')
    // The form collects the minimum fee in euros; storage is integer cents.
    const minimumFeeEur = readOptionalNumber(formData, 'minimumFeeEur')
    const minimumFeeCents = minimumFeeEur === null ? 0 : Math.round(minimumFeeEur * 100)
    const { feePercent: feeBounds, quickAuctionFeePercent: quickFeeBounds, minimumFeeCents: minFeeBounds } =
      settingsBounds
    if (!Number.isInteger(feePercent) || feePercent < feeBounds.min || feePercent > feeBounds.max) {
      return redirectWithError(
        settingsPath,
        `Vahendustasu peab olema täisarv vahemikus ${String(feeBounds.min)} kuni ${String(feeBounds.max)}.`,
      )
    }
    if (!Number.isInteger(vatPercent) || vatPercent < 0 || vatPercent > 100) {
      return redirectWithError(settingsPath, 'Käibemaks peab olema täisarv vahemikus 0 kuni 100.')
    }
    if (
      quickAuctionFeePercent !== null &&
      (!Number.isInteger(quickAuctionFeePercent) ||
        quickAuctionFeePercent < quickFeeBounds.min ||
        quickAuctionFeePercent > quickFeeBounds.max)
    ) {
      return redirectWithError(
        settingsPath,
        `Kiiroksjoni teenustasu peab olema täisarv vahemikus ${String(quickFeeBounds.min)} kuni ${String(quickFeeBounds.max)} või tühi (kasutatakse vaikemäära).`,
      )
    }
    if (
      !Number.isFinite(minimumFeeCents) ||
      minimumFeeCents < minFeeBounds.min ||
      minimumFeeCents > minFeeBounds.max
    ) {
      return redirectWithError(
        settingsPath,
        `Minimaalne tasu peab olema vahemikus 0 kuni ${String(minFeeBounds.max / 100)} eurot.`,
      )
    }
    feeChanged =
      current
        ? current.feePercent !== feePercent ||
          current.vatPercent !== vatPercent ||
          current.quickAuctionFeePercent !== quickAuctionFeePercent ||
          current.minimumFeeCents !== minimumFeeCents
        : true
    data = { feePercent, vatPercent, quickAuctionFeePercent, minimumFeeCents }
    beforeValues = {
      feePercent: current?.feePercent ?? null,
      quickAuctionFeePercent: current?.quickAuctionFeePercent ?? null,
      minimumFeeCents: current?.minimumFeeCents ?? null,
      vatPercent: current?.vatPercent ?? null,
    }
    afterValues = { feePercent, quickAuctionFeePercent, minimumFeeCents, vatPercent }
  } else if (section === 'oksjonid') {
    const antiSnipeDurationMinutes = readInt(formData, 'antiSnipeDurationMinutes')
    const sealedRevisionCap = readInt(formData, 'sealedRevisionCap')
    const minAuctionDurationHours = readInt(formData, 'minAuctionDurationHours')
    const { minAuctionDurationHours: minDurationBounds } = settingsBounds
    if (
      !Number.isInteger(antiSnipeDurationMinutes) ||
      antiSnipeDurationMinutes < 1 ||
      antiSnipeDurationMinutes > 30
    ) {
      return redirectWithError(settingsPath, 'Aja pikendamise minutid peavad olema täisarv vahemikus 1 kuni 30.')
    }
    if (!Number.isInteger(sealedRevisionCap) || sealedRevisionCap < 0 || sealedRevisionCap > 5) {
      return redirectWithError(settingsPath, 'Paranduste limiit peab olema täisarv vahemikus 0 kuni 5.')
    }
    if (
      !Number.isInteger(minAuctionDurationHours) ||
      minAuctionDurationHours < minDurationBounds.min ||
      minAuctionDurationHours > minDurationBounds.max
    ) {
      return redirectWithError(
        settingsPath,
        `Minimaalne oksjoni kestus peab olema täisarv vahemikus ${String(minDurationBounds.min)} kuni ${String(minDurationBounds.max)} tundi.`,
      )
    }
    const parsedDefaults = parseAuctionDefaults({
      alapakkumineDecisionDeadlineDays: readInt(formData, 'alapakkumineDecisionDeadlineDays'),
      kiiroksjonDurationHours: readInt(formData, 'kiiroksjonDurationHours'),
      sealedApproverRole: readText(formData, 'sealedApproverRole'),
    })
    if (!parsedDefaults.ok) {
      return redirectWithError(settingsPath, parsedDefaults.error)
    }
    const previousDefaults = readFlagObject(currentFlags.auctionDefaults ?? {})
    data = {
      antiSnipeDurationMinutes,
      sealedRevisionCap,
      alapakkumineEnabled: readBool(formData, 'alapakkumineEnabled'),
      autobidderEnabled: readBool(formData, 'autobidderEnabled'),
      minAuctionDurationHours,
      featureFlags: withAuctionDefaults(currentFlags, parsedDefaults.value),
    }
    beforeValues = {
      antiSnipeDurationMinutes: current?.antiSnipeDurationMinutes ?? null,
      alapakkumineEnabled: current?.alapakkumineEnabled ?? null,
      autobidderEnabled: current?.autobidderEnabled ?? null,
      minAuctionDurationHours: current?.minAuctionDurationHours ?? null,
      sealedRevisionCap: current?.sealedRevisionCap ?? null,
      auctionDefaults: previousDefaults,
    }
    afterValues = {
      antiSnipeDurationMinutes,
      alapakkumineEnabled: data.alapakkumineEnabled,
      autobidderEnabled: data.autobidderEnabled,
      minAuctionDurationHours,
      sealedRevisionCap,
      auctionDefaults: parsedDefaults.value,
    }
  } else {
    // Lipud save: named toggles only. Toggles absent from the form data save
    // as false; unknown legacy keys and the reserved auctionDefaults key
    // survive via withNamedFlags.
    const toggles = {} as Record<FeatureFlagKey, boolean>
    for (const definition of featureFlagDefinitions) {
      toggles[definition.key] = readBool(formData, definition.key)
    }
    const mergedFlags = withNamedFlags(currentFlags, toggles)
    data = { featureFlags: mergedFlags }
    beforeValues = { featureFlags: currentFlags }
    afterValues = { featureFlags: mergedFlags }
  }

  // Secrets are masked in both snapshots; the audit shows that a value
  // changed without recording it (spec 14).
  await persist(settingsPath, 'Sätete salvestamine ebaõnnestus: ', async () => {
    const saved = current
      ? await repositories.update({ collection: 'settings', id: current.id, data })
      : await repositories.create({ collection: 'settings', data })
    await writeAudit(repositories, {
      actorId: session.userId,
      action: 'settings.change',
      entityType: 'settings',
      entityId: saved.id,
      before: maskSecretValues({ ...beforeValues, reason }),
      after: maskSecretValues({ ...afterValues, reason }),
    })
  })

  revalidatePath(settingsPath)
  redirect(await adminUrl(feeChanged ? `${settingsPath}?ok=tasud` : settingsPath))
}
