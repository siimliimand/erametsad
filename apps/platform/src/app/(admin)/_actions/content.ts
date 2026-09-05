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
  isValidReason,
  maskSecretValues,
  mergeFlagPayload,
  parseAuctionDefaults,
  parseFlagObject,
  readFlagObject,
  withAuctionDefaults,
} from '../admin/content/_components/settings-audit'

import type { CoreRepositories, UpdateDataFor } from '@/lib/data/repositories'
import {
  auctionObjectTypes,
  contentStatuses,
  legalDocumentTypes,
  redirectTypes,
} from '@/lib/data/schema'
import type {
  AuctionObjectType,
  ContentStatus,
  LegalDocumentType,
  RedirectType,
} from '@/lib/data/schema'

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
const settingsPath = '/admin/content/settings'

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

function redirectWithError(path: string, message: string): never {
  redirect(`${path}?viga=${encodeURIComponent(message)}`)
}

function formPath(basePath: string, id: string): string {
  return id.length > 0 ? `${basePath}/${id}` : `${basePath}/new`
}

// Redirect must never run inside the try block: it throws NEXT_REDIRECT.
async function persist<T>(path: string, prefix: string, write: () => Promise<T>): Promise<T> {
  try {
    return await write()
  } catch (error) {
    redirectWithError(path, `${prefix}${error instanceof Error ? error.message : String(error)}`)
  }
}

function revalidate(basePath: string, id: string): void {
  revalidatePath(basePath)
  if (id.length > 0) {
    revalidatePath(`${basePath}/${id}`)
  }
}

function readPublishAt(formData: FormData, errorPath: string, label: string): string | null {
  const raw = readText(formData, 'publishAt')
  if (raw.length === 0) {
    return null
  }
  const iso = tallinnWallTimeToUtcIso(raw)
  if (!iso) {
    redirectWithError(errorPath, `${label} peab olema korrektne kuupäev ja kellaaeg.`)
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
    redirectWithError(errorPath, `Suunamise loomine ebaõnnestus: ${failure}`)
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

  if (!title) redirectWithError(errorPath, 'Pealkiri on kohustuslik.')
  if (!slug) redirectWithError(errorPath, 'URL-nimi on kohustuslik.')
  if (!contentStatuses.includes(status)) redirectWithError(errorPath, 'Vali sobiv olek.')

  await publishDueScheduledContent(repositories, session.userId)

  const publishAtIso = readPublishAt(formData, errorPath, 'Avaldamise aeg')
  const current = id
    ? await persist(errorPath, 'Artikli lugemine ebaõnnestus: ', () =>
        repositories.findByID({ collection: 'articles', id }),
      )
    : null
  if (id && !current) redirectWithError(errorPath, 'Artiklit ei leitud.')

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
  redirect(articlesPath)
}

export async function setArticleStatusAction(formData: FormData): Promise<void> {
  const { session, repositories } = await requireAdminRepositories()
  assertCan(session.role, 'content:write')

  const id = readText(formData, 'id')
  const status = readText(formData, 'status') as ContentStatus
  if (!id) redirectWithError(articlesPath, 'Artikli identifikaator puudub.')
  if (!contentStatuses.includes(status)) redirectWithError(articlesPath, 'Vali sobiv olek.')

  await publishDueScheduledContent(repositories, session.userId)

  const current = await persist(articlesPath, 'Artikli lugemine ebaõnnestus: ', () =>
    repositories.findByID({ collection: 'articles', id }),
  )
  if (!current) redirectWithError(articlesPath, 'Artiklit ei leitud.')

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
  redirect(articlesPath)
}

export async function deleteArticleAction(formData: FormData): Promise<void> {
  const { session, repositories } = await requireAdminRepositories()
  assertCan(session.role, 'content:write')

  const id = readText(formData, 'id')
  if (!id) redirectWithError(articlesPath, 'Artikli identifikaator puudub.')

  await persist(articlesPath, 'Artikli kustutamine ebaõnnestus: ', () =>
    repositories.delete({ collection: 'articles', id }),
  )

  revalidate(articlesPath, id)
  redirect(articlesPath)
}

export async function savePageAction(formData: FormData): Promise<void> {
  const { session, repositories } = await requireAdminRepositories()
  assertCan(session.role, 'content:write')

  const id = readText(formData, 'id')
  const errorPath = formPath(pagesPath, id)
  const title = readText(formData, 'title')
  const slug = readText(formData, 'slug')
  const status = readText(formData, 'status') as ContentStatus
  const layout = readJsonValue(formData, 'layout')

  if (!title) redirectWithError(errorPath, 'Pealkiri on kohustuslik.')
  if (!slug) redirectWithError(errorPath, 'URL-nimi on kohustuslik.')
  if (!contentStatuses.includes(status)) redirectWithError(errorPath, 'Vali sobiv olek.')
  if (layout.invalid) redirectWithError(errorPath, 'Paigutus peab olema korrektne JSON.')

  await publishDueScheduledContent(repositories, session.userId)

  const publishAtIso = readPublishAt(formData, errorPath, 'Avaldamise aeg')
  const current = id
    ? await persist(errorPath, 'Lehe lugemine ebaõnnestus: ', () =>
        repositories.findByID({ collection: 'pages', id }),
      )
    : null
  if (id && !current) redirectWithError(errorPath, 'Lehte ei leitud.')

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
  redirect(pagesPath)
}

export async function deletePageAction(formData: FormData): Promise<void> {
  const { session, repositories } = await requireAdminRepositories()
  assertCan(session.role, 'content:write')

  const id = readText(formData, 'id')
  if (!id) redirectWithError(pagesPath, 'Lehe identifikaator puudub.')

  await persist(pagesPath, 'Lehe kustutamine ebaõnnestus: ', () =>
    repositories.delete({ collection: 'pages', id }),
  )

  revalidate(pagesPath, id)
  redirect(pagesPath)
}

export async function saveFaqCategoryAction(formData: FormData): Promise<void> {
  const { session, repositories } = await requireAdminRepositories()
  assertCan(session.role, 'content:write')

  const id = readText(formData, 'id')
  const errorPath = formPath(faqCategoriesPath, id)
  const title = readText(formData, 'title')
  const slug = readText(formData, 'slug')
  const order = readInt(formData, 'order')

  if (!title) redirectWithError(errorPath, 'Pealkiri on kohustuslik.')
  if (!slug) redirectWithError(errorPath, 'URL-nimi on kohustuslik.')
  if (!Number.isInteger(order) || order < 0) {
    redirectWithError(errorPath, 'Järjekord peab olema mitte negatiivne täisarv.')
  }

  const data = { title, slug, order }

  await persist(errorPath, 'Kategooria salvestamine ebaõnnestus: ', () =>
    id
      ? repositories.update({ collection: 'faq-categories', id, data })
      : repositories.create({ collection: 'faq-categories', data }),
  )

  revalidate(faqCategoriesPath, id)
  redirect(faqCategoriesPath)
}

export async function deleteFaqCategoryAction(formData: FormData): Promise<void> {
  const { session, repositories } = await requireAdminRepositories()
  assertCan(session.role, 'content:write')

  const id = readText(formData, 'id')
  if (!id) redirectWithError(faqCategoriesPath, 'Kategooria identifikaator puudub.')

  await persist(faqCategoriesPath, 'Kategooria kustutamine ebaõnnestus: ', () =>
    repositories.delete({ collection: 'faq-categories', id }),
  )

  revalidate(faqCategoriesPath, id)
  redirect(faqCategoriesPath)
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

  if (!question) redirectWithError(errorPath, 'Küsimus on kohustuslik.')
  if (!answer) redirectWithError(errorPath, 'Vastus on kohustuslik.')
  if (!categoryId) redirectWithError(errorPath, 'Vali kategooria.')
  if (!Number.isInteger(order) || order < 0) {
    redirectWithError(errorPath, 'Järjekord peab olema mitte negatiivne täisarv.')
  }

  const category = await persist(errorPath, 'Kategooria lugemine ebaõnnestus: ', () =>
    repositories.findByID({ collection: 'faq-categories', id: categoryId }),
  )
  if (!category) redirectWithError(errorPath, 'Valitud kategooriat ei leitud.')

  const data = {
    question,
    answer,
    categoryId,
    order,
    slug: readOptionalText(formData, 'slug'),
  }

  await persist(errorPath, 'Küsimuse salvestamine ebaõnnestus: ', () =>
    id
      ? repositories.update({ collection: 'faq-items', id, data })
      : repositories.create({ collection: 'faq-items', data }),
  )

  revalidate(faqItemsPath, id)
  redirect(faqItemsPath)
}

export async function deleteFaqItemAction(formData: FormData): Promise<void> {
  const { session, repositories } = await requireAdminRepositories()
  assertCan(session.role, 'content:write')

  const id = readText(formData, 'id')
  if (!id) redirectWithError(faqItemsPath, 'Küsimuse identifikaator puudub.')

  await persist(faqItemsPath, 'Küsimuse kustutamine ebaõnnestus: ', () =>
    repositories.delete({ collection: 'faq-items', id }),
  )

  revalidate(faqItemsPath, id)
  redirect(faqItemsPath)
}

export async function saveTestimonialAction(formData: FormData): Promise<void> {
  const { session, repositories } = await requireAdminRepositories()
  assertCan(session.role, 'content:write')

  const id = readText(formData, 'id')
  const errorPath = formPath(testimonialsPath, id)
  const name = readText(formData, 'name')
  const content = readText(formData, 'content')

  if (!name) redirectWithError(errorPath, 'Nimi on kohustuslik.')
  if (!content) redirectWithError(errorPath, 'Tsitaat on kohustuslik.')

  const data = {
    name,
    content,
    role: readOptionalText(formData, 'role'),
    avatarId: readOptionalText(formData, 'avatarId'),
    featured: readBool(formData, 'featured'),
  }

  await persist(errorPath, 'Tagasiside salvestamine ebaõnnestus: ', () =>
    id
      ? repositories.update({ collection: 'testimonials', id, data })
      : repositories.create({ collection: 'testimonials', data }),
  )

  revalidate(testimonialsPath, id)
  redirect(testimonialsPath)
}

export async function deleteTestimonialAction(formData: FormData): Promise<void> {
  const { session, repositories } = await requireAdminRepositories()
  assertCan(session.role, 'content:write')

  const id = readText(formData, 'id')
  if (!id) redirectWithError(testimonialsPath, 'Tagasiside identifikaator puudub.')

  await persist(testimonialsPath, 'Tagasiside kustutamine ebaõnnestus: ', () =>
    repositories.delete({ collection: 'testimonials', id }),
  )

  revalidate(testimonialsPath, id)
  redirect(testimonialsPath)
}

export async function savePartnerServiceAction(formData: FormData): Promise<void> {
  const { session, repositories } = await requireAdminRepositories()
  assertCan(session.role, 'content:write')

  const id = readText(formData, 'id')
  const errorPath = formPath(partnerServicesPath, id)
  const name = readText(formData, 'name')
  const slug = readText(formData, 'slug')
  const order = readInt(formData, 'order')

  if (!name) redirectWithError(errorPath, 'Nimi on kohustuslik.')
  if (!slug) redirectWithError(errorPath, 'URL-nimi on kohustuslik.')
  if (!Number.isInteger(order) || order < 0) {
    redirectWithError(errorPath, 'Järjekord peab olema mitte negatiivne täisarv.')
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
  redirect(partnerServicesPath)
}

export async function deletePartnerServiceAction(formData: FormData): Promise<void> {
  const { session, repositories } = await requireAdminRepositories()
  assertCan(session.role, 'content:write')

  const id = readText(formData, 'id')
  if (!id) redirectWithError(partnerServicesPath, 'Teenuse identifikaator puudub.')

  await persist(partnerServicesPath, 'Teenuse kustutamine ebaõnnestus: ', () =>
    repositories.delete({ collection: 'partner-services', id }),
  )

  revalidate(partnerServicesPath, id)
  redirect(partnerServicesPath)
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

  if (!title) redirectWithError(errorPath, 'Pealkiri on kohustuslik.')
  if (!slug) redirectWithError(errorPath, 'URL-nimi on kohustuslik.')
  if (!content) redirectWithError(errorPath, 'Sisu on kohustuslik.')
  if (!contentStatuses.includes(status)) redirectWithError(errorPath, 'Vali sobiv olek.')
  if (typeRaw.length > 0 && !legalDocumentTypes.includes(typeRaw as LegalDocumentType)) {
    redirectWithError(errorPath, 'Vali sobiv dokumendi tüüp.')
  }

  await publishDueScheduledContent(repositories, session.userId)

  const publishAtIso = readPublishAt(formData, errorPath, 'Avaldamise aeg')
  const current = id
    ? await persist(errorPath, 'Dokumendi lugemine ebaõnnestus: ', () =>
        repositories.findByID({ collection: 'legal-documents', id }),
      )
    : null
  if (id && !current) redirectWithError(errorPath, 'Dokumenti ei leitud.')

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
  redirect(legalDocumentsPath)
}

export async function deleteLegalDocumentAction(formData: FormData): Promise<void> {
  const { session, repositories } = await requireAdminRepositories()
  assertCan(session.role, 'content:write')

  const id = readText(formData, 'id')
  if (!id) redirectWithError(legalDocumentsPath, 'Dokumendi identifikaator puudub.')

  await persist(legalDocumentsPath, 'Dokumendi kustutamine ebaõnnestus: ', () =>
    repositories.delete({ collection: 'legal-documents', id }),
  )

  revalidate(legalDocumentsPath, id)
  redirect(legalDocumentsPath)
}

export async function saveRedirectAction(formData: FormData): Promise<void> {
  const { session, repositories } = await requireAdminRepositories()
  assertCan(session.role, 'content:write')

  const id = readText(formData, 'id')
  const errorPath = formPath(redirectsPath, id)
  const from = readText(formData, 'from')
  const to = readText(formData, 'to')
  const type = readText(formData, 'type') as RedirectType

  if (!from) redirectWithError(errorPath, 'Kust on kohustuslik.')
  if (!to) redirectWithError(errorPath, 'Kuhu on kohustuslik.')
  if (!redirectTypes.includes(type)) redirectWithError(errorPath, 'Vali suunamise tüüp.')

  const data = { from, to, type, active: readBool(formData, 'active') }

  await persist(errorPath, 'Suunamise salvestamine ebaõnnestus: ', () =>
    id
      ? repositories.update({ collection: 'redirects', id, data })
      : repositories.create({ collection: 'redirects', data }),
  )

  revalidate(redirectsPath, id)
  redirect(redirectsPath)
}

export async function deleteRedirectAction(formData: FormData): Promise<void> {
  const { session, repositories } = await requireAdminRepositories()
  assertCan(session.role, 'content:write')

  const id = readText(formData, 'id')
  if (!id) redirectWithError(redirectsPath, 'Suunamise identifikaator puudub.')

  await persist(redirectsPath, 'Suunamise kustutamine ebaõnnestus: ', () =>
    repositories.delete({ collection: 'redirects', id }),
  )

  revalidate(redirectsPath, id)
  redirect(redirectsPath)
}

export async function saveSpecialistAction(formData: FormData): Promise<void> {
  const { session, repositories } = await requireAdminRepositories()
  assertCan(session.role, 'content:write')

  const id = readText(formData, 'id')
  const errorPath = formPath(specialistsPath, id)
  const name = readText(formData, 'name')
  const slug = readText(formData, 'slug')

  if (!name) redirectWithError(errorPath, 'Nimi on kohustuslik.')
  if (!slug) redirectWithError(errorPath, 'URL-nimi on kohustuslik.')

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
  redirect(specialistsPath)
}

export async function deleteSpecialistAction(formData: FormData): Promise<void> {
  const { session, repositories } = await requireAdminRepositories()
  assertCan(session.role, 'content:write')

  const id = readText(formData, 'id')
  if (!id) redirectWithError(specialistsPath, 'Spetsialisti identifikaator puudub.')

  await persist(specialistsPath, 'Spetsialisti kustutamine ebaõnnestus: ', () =>
    repositories.delete({ collection: 'specialists', id }),
  )

  revalidate(specialistsPath, id)
  redirect(specialistsPath)
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

  if (!date) redirectWithError(errorPath, 'Kuupäev on kohustuslik.')
  if (!auctionObjectTypes.includes(objectType)) {
    redirectWithError(errorPath, 'Vali sobiv objekti tüüp.')
  }
  if (!Number.isInteger(count) || count < 0) {
    redirectWithError(errorPath, 'Arv peab olema mitte negatiivne täisarv.')
  }
  if (area !== null && (!Number.isFinite(area) || area < 0)) {
    redirectWithError(errorPath, 'Pindala peab olema mitte negatiivne number.')
  }
  if (volume !== null && (!Number.isFinite(volume) || volume < 0)) {
    redirectWithError(errorPath, 'Maht peab olema mitte negatiivne number.')
  }
  if (!Number.isFinite(eur) || eur < 0) {
    redirectWithError(errorPath, 'Summa peab olema mitte negatiivne number.')
  }

  const data = { date, objectType, count, area, volume, eur }

  await persist(errorPath, 'Statistikakirje salvestamine ebaõnnestus: ', () =>
    id
      ? repositories.update({ collection: 'statistics-snapshots', id, data })
      : repositories.create({ collection: 'statistics-snapshots', data }),
  )

  revalidate(statisticsPath, id)
  redirect(statisticsPath)
}

export async function deleteStatisticsSnapshotAction(formData: FormData): Promise<void> {
  const { repositories } = await requireAdminRepositories()

  const id = readText(formData, 'id')
  if (!id) redirectWithError(statisticsPath, 'Statistikakirje identifikaator puudub.')

  await persist(statisticsPath, 'Statistikakirje kustutamine ebaõnnestus: ', () =>
    repositories.delete({ collection: 'statistics-snapshots', id }),
  )

  revalidate(statisticsPath, id)
  redirect(statisticsPath)
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
    redirectWithError(settingsPath, 'Tundmatu seadete sektsioon.')
  }
  // Reason-required saves (design D7): without a valid reason nothing changes.
  const reason = readText(formData, 'reason')
  if (!isValidReason(reason)) {
    redirectWithError(settingsPath, 'Põhjendus peab olema vähemalt 5 tähemärki.')
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
    data = {
      orgName: readOptionalText(formData, 'orgName'),
      orgRegCode: readOptionalText(formData, 'orgRegCode'),
      orgAddress: readOptionalText(formData, 'orgAddress'),
    }
    beforeValues = {
      orgName: current?.orgName ?? null,
      orgRegCode: current?.orgRegCode ?? null,
      orgAddress: current?.orgAddress ?? null,
    }
    afterValues = {
      orgName: data.orgName,
      orgRegCode: data.orgRegCode,
      orgAddress: data.orgAddress,
    }
  } else if (section === 'tasud') {
    const feePercent = readInt(formData, 'feePercent')
    const vatPercent = readInt(formData, 'vatPercent')
    if (!Number.isInteger(feePercent) || feePercent < 0 || feePercent > 100) {
      redirectWithError(settingsPath, 'Vahendustasu peab olema täisarv vahemikus 0 kuni 100.')
    }
    if (!Number.isInteger(vatPercent) || vatPercent < 0 || vatPercent > 100) {
      redirectWithError(settingsPath, 'Käibemaks peab olema täisarv vahemikus 0 kuni 100.')
    }
    feeChanged = current ? current.feePercent !== feePercent || current.vatPercent !== vatPercent : true
    data = { feePercent, vatPercent }
    beforeValues = {
      feePercent: current?.feePercent ?? null,
      vatPercent: current?.vatPercent ?? null,
    }
    afterValues = { feePercent, vatPercent }
  } else if (section === 'oksjonid') {
    const antiSnipeDurationMinutes = readInt(formData, 'antiSnipeDurationMinutes')
    const sealedRevisionCap = readInt(formData, 'sealedRevisionCap')
    if (
      !Number.isInteger(antiSnipeDurationMinutes) ||
      antiSnipeDurationMinutes < 1 ||
      antiSnipeDurationMinutes > 30
    ) {
      redirectWithError(settingsPath, 'Aja pikendamise minutid peavad olema täisarv vahemikus 1 kuni 30.')
    }
    if (!Number.isInteger(sealedRevisionCap) || sealedRevisionCap < 0 || sealedRevisionCap > 5) {
      redirectWithError(settingsPath, 'Paranduste limiit peab olema täisarv vahemikus 0 kuni 5.')
    }
    const parsedDefaults = parseAuctionDefaults({
      alapakkumineDecisionDeadlineDays: readInt(formData, 'alapakkumineDecisionDeadlineDays'),
      kiiroksjonDurationHours: readInt(formData, 'kiiroksjonDurationHours'),
      sealedApproverRole: readText(formData, 'sealedApproverRole'),
    })
    if (!parsedDefaults.ok) {
      redirectWithError(settingsPath, parsedDefaults.error)
    }
    const previousDefaults = readFlagObject(currentFlags.auctionDefaults ?? {})
    data = {
      antiSnipeDurationMinutes,
      sealedRevisionCap,
      alapakkumineEnabled: readBool(formData, 'alapakkumineEnabled'),
      featureFlags: withAuctionDefaults(currentFlags, parsedDefaults.value),
    }
    beforeValues = {
      antiSnipeDurationMinutes: current?.antiSnipeDurationMinutes ?? null,
      alapakkumineEnabled: current?.alapakkumineEnabled ?? null,
      sealedRevisionCap: current?.sealedRevisionCap ?? null,
      auctionDefaults: previousDefaults,
    }
    afterValues = {
      antiSnipeDurationMinutes,
      alapakkumineEnabled: data.alapakkumineEnabled,
      sealedRevisionCap,
      auctionDefaults: parsedDefaults.value,
    }
  } else {
    const parsedFlags = parseFlagObject(readText(formData, 'featureFlags'))
    if (!parsedFlags.ok) {
      redirectWithError(settingsPath, parsedFlags.error)
    }
    const mergedFlags = mergeFlagPayload(currentFlags, parsedFlags.value)
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
  redirect(feeChanged ? `${settingsPath}?ok=tasud` : settingsPath)
}
