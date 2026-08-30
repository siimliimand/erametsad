import { z } from 'zod'

import type { ArticleDoc, PageDoc } from '@/lib/data/repositories'
import { contentStatuses } from '@/lib/data/schema'
import type { ContentStatus } from '@/lib/data/schema'

export const MAX_IMPORT_BYTES = 2 * 1024 * 1024
export const MAX_IMPORT_ITEMS = 500

export type ImportEntity = 'articles' | 'pages'

export function isImportEntity(value: string): value is ImportEntity {
  return value === 'articles' || value === 'pages'
}

const statusField = z.enum(contentStatuses, {
  errorMap: () => ({ message: 'Olek peab olema "draft" või "published".' }),
})

function optionalText(message: string) {
  return z.string({ invalid_type_error: message }).nullable().optional()
}

const titleField = z
  .string({
    required_error: 'Pealkiri on kohustuslik.',
    invalid_type_error: 'Pealkiri peab olema sõne.',
  })
  .trim()
  .min(1, 'Pealkiri on kohustuslik.')

const slugField = z
  .string({
    required_error: 'URL-nimi on kohustuslik.',
    invalid_type_error: 'URL-nimi peab olema sõne.',
  })
  .trim()
  .min(1, 'URL-nimi on kohustuslik.')

export const articleImportSchema = z.strictObject({
  title: titleField,
  slug: slugField,
  status: statusField.default('draft'),
  excerpt: optionalText('Lühikirjeldus peab olema sõne.'),
  content: optionalText('Sisu peab olema sõne.'),
  author: optionalText('Autor peab olema sõne.'),
  featuredImageId: optionalText('Pildi ID peab olema sõne.'),
  tags: z
    .array(z.string({ invalid_type_error: 'Silt peab olema sõne.' }), {
      invalid_type_error: 'Sildid peavad olema sõnede massiiv.',
    })
    .default([]),
  publishedAt: optionalText('Avaldamise aeg peab olema sõne.'),
})

export const pageImportSchema = z.strictObject({
  title: titleField,
  slug: slugField,
  status: statusField.default('draft'),
  seoTitle: optionalText('SEO pealkiri peab olema sõne.'),
  seoDescription: optionalText('SEO kirjeldus peab olema sõne.'),
  layout: z.unknown().optional(),
  publishedAt: optionalText('Avaldamise aeg peab olema sõne.'),
})

export type ArticleImportInput = z.infer<typeof articleImportSchema>
export type PageImportInput = z.infer<typeof pageImportSchema>

export type AnyImportInput = ArticleImportInput | PageImportInput

function firstIssueMessage(error: z.ZodError): string {
  const issue = error.issues[0]
  if (!issue) return 'Tundmatu viga.'
  if (issue.code === 'unrecognized_keys') {
    const { keys } = issue as { keys?: unknown }
    const names = Array.isArray(keys) ? keys.map(String).join(', ') : ''
    return `Tundmatud väljad: ${names}.`
  }
  return issue.message
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export interface ParsedImport {
  articles: unknown[]
  pages: unknown[]
}

export type ParseResult =
  | { ok: true; parsed: ParsedImport }
  | { ok: false; error: string }

/**
 * Accepts two file shapes: a bare array of one entity (the selected type
 * decides which) or the grouped `{ articles, pages }` object that the
 * `type=all` export produces.
 */
export function parseImportPayload(payload: unknown, defaultEntity: string): ParseResult {
  if (!isImportEntity(defaultEntity)) {
    return { ok: false, error: 'Vali, kas fail sisaldab artikleid või lehti.' }
  }
  let articles: unknown[] = []
  let pages: unknown[] = []
  if (Array.isArray(payload)) {
    if (defaultEntity === 'articles') {
      articles = payload
    } else {
      pages = payload
    }
  } else if (isRecord(payload)) {
    const rawArticles = payload.articles
    const rawPages = payload.pages
    if (rawArticles !== undefined && !Array.isArray(rawArticles)) {
      return { ok: false, error: 'Väli "articles" peab olema massiiv.' }
    }
    if (rawPages !== undefined && !Array.isArray(rawPages)) {
      return { ok: false, error: 'Väli "pages" peab olema massiiv.' }
    }
    articles = rawArticles ?? []
    pages = rawPages ?? []
  } else {
    return {
      ok: false,
      error: 'Fail peab olema JSON-massiiiv või objekt võtmetega "articles" ja "pages".',
    }
  }
  const total = articles.length + pages.length
  if (total === 0) {
    return { ok: false, error: 'Fail ei sisalda ühtegi kirjet.' }
  }
  if (total > MAX_IMPORT_ITEMS) {
    return {
      ok: false,
      error: `Liiga palju kirjeid (${String(total)}); lubatud on kuni ${String(MAX_IMPORT_ITEMS)}.`,
    }
  }
  return { ok: true, parsed: { articles, pages } }
}

/**
 * Same rule as the 7.5 content actions: an explicit imported value wins,
 * otherwise an existing value is kept, and publishing stamps the time only
 * when none exists yet.
 */
export function resolvePublishedAt(
  status: ContentStatus,
  imported: string | null | undefined,
  existing: string | null | undefined,
  now: string,
): string | null {
  if (imported !== null && imported !== undefined) return imported
  if (existing) return existing
  return status === 'published' ? now : null
}

export type ItemOutcome =
  | 'created'
  | 'updated'
  | 'would-create'
  | 'would-update'
  | 'invalid'
  | 'failed'

export interface ImportItemResult {
  entity: ImportEntity
  index: number
  slug: string
  title: string
  outcome: ItemOutcome
  reason?: string
}

export interface ImportSummary {
  created: number
  updated: number
  failed: number
}

export function summarize(items: readonly ImportItemResult[]): ImportSummary {
  let created = 0
  let updated = 0
  let failed = 0
  for (const item of items) {
    if (item.outcome === 'created' || item.outcome === 'would-create') {
      created += 1
    } else if (item.outcome === 'updated' || item.outcome === 'would-update') {
      updated += 1
    } else {
      failed += 1
    }
  }
  return { created, updated, failed }
}

export interface ExistingEntity {
  id: string
  publishedAt: string | null
}

export interface UpsertPlan<T extends AnyImportInput> {
  action: 'create' | 'update'
  index: number
  slug: string
  title: string
  existingId: string | null
  data: T
}

export interface EntityUpsertPlan<T extends AnyImportInput> {
  plans: UpsertPlan<T>[]
  invalid: ImportItemResult[]
}

function displayField(raw: unknown, key: string): string {
  const value = isRecord(raw) ? raw[key] : undefined
  return typeof value === 'string' && value.length > 0 ? value : '(puudub)'
}

function planItems<T extends AnyImportInput>(
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  entity: ImportEntity,
  items: readonly unknown[],
  existingBySlug: ReadonlyMap<string, ExistingEntity>,
  now: string,
): EntityUpsertPlan<T> {
  const plans: UpsertPlan<T>[] = []
  const invalid: ImportItemResult[] = []
  const seenSlugs = new Set<string>()

  items.forEach((raw, position) => {
    const index = position + 1
    if (!isRecord(raw)) {
      invalid.push({
        entity,
        index,
        slug: displayField(raw, 'slug'),
        title: displayField(raw, 'title'),
        outcome: 'invalid',
        reason: 'Kirje peab olema JSON-objekt.',
      })
      return
    }
    const parsed = schema.safeParse(raw)
    if (!parsed.success) {
      invalid.push({
        entity,
        index,
        slug: displayField(raw, 'slug'),
        title: displayField(raw, 'title'),
        outcome: 'invalid',
        reason: firstIssueMessage(parsed.error),
      })
      return
    }
    const data = parsed.data
    if (seenSlugs.has(data.slug)) {
      invalid.push({
        entity,
        index,
        slug: data.slug,
        title: data.title,
        outcome: 'invalid',
        reason: `URL-nimi "${data.slug}" esineb failis mitu korda.`,
      })
      return
    }
    seenSlugs.add(data.slug)
    const existing = existingBySlug.get(data.slug)
    plans.push({
      action: existing ? 'update' : 'create',
      index,
      slug: data.slug,
      title: data.title,
      existingId: existing?.id ?? null,
      data: { ...data, publishedAt: resolvePublishedAt(data.status, data.publishedAt, existing?.publishedAt, now) },
    })
  })

  return { plans, invalid }
}

export function planArticleUpserts(
  items: readonly unknown[],
  existingBySlug: ReadonlyMap<string, ExistingEntity>,
  now: string,
): EntityUpsertPlan<ArticleImportInput> {
  return planItems(articleImportSchema, 'articles', items, existingBySlug, now)
}

export function planPageUpserts(
  items: readonly unknown[],
  existingBySlug: ReadonlyMap<string, ExistingEntity>,
  now: string,
): EntityUpsertPlan<PageImportInput> {
  return planItems(pageImportSchema, 'pages', items, existingBySlug, now)
}

export interface ArticleExport {
  title: string
  slug: string
  status: ContentStatus
  excerpt: string | null
  content: string | null
  featuredImageId: string | null
  author: string | null
  publishedAt: string | null
  tags: unknown[] | null
}

export interface PageExport {
  title: string
  slug: string
  status: ContentStatus
  layout: unknown
  seoTitle: string | null
  seoDescription: string | null
  publishedAt: string | null
}

export function toExportArticle(doc: ArticleDoc): ArticleExport {
  const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...editable } = doc
  return editable
}

export function toExportPage(doc: PageDoc): PageExport {
  const {
    id: _id,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    seoOgImageId: _seoOgImageId,
    ...editable
  } = doc
  return editable
}

export const sampleImportFile = {
  articles: [
    {
      title: 'Näidisartikkel',
      slug: 'naidisartikkel',
      status: 'published',
      excerpt: 'Lühike kokkuvõte lugejale.',
      content: 'Artikli täistekst tuleb siia.',
      author: 'Erametsad',
      featuredImageId: null,
      tags: ['mets', 'naidis'],
      publishedAt: null,
    },
  ],
  pages: [
    {
      title: 'Näidisleht',
      slug: 'naidisleht',
      status: 'draft',
      seoTitle: null,
      seoDescription: null,
      layout: { blocks: [] },
      publishedAt: null,
    },
  ],
} as const

export interface ImportReport {
  status: 'success' | 'partial' | 'dry-run' | 'error'
  message: string
  dryRun: boolean
  items: ImportItemResult[]
  summary: ImportSummary
}
