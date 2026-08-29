'use server'

import { revalidatePath } from 'next/cache'

import { requireAdminRepositories } from '../_lib/admin'
import {
  MAX_IMPORT_BYTES,
  parseImportPayload,
  planArticleUpserts,
  planPageUpserts,
  summarize,
  type ImportItemResult,
  type ImportReport,
} from '../admin/content/import-export/_lib/import-export'
const articlesPath = '/admin/content/articles'
const pagesPath = '/admin/content/pages'

function errorReport(message: string, dryRun: boolean): ImportReport {
  return {
    status: 'error',
    message,
    dryRun,
    items: [],
    summary: { created: 0, updated: 0, failed: 0 },
  }
}

function byEntityThenIndex(a: ImportItemResult, b: ImportItemResult): number {
  if (a.entity !== b.entity) return a.entity === 'articles' ? -1 : 1
  return a.index - b.index
}

export async function importContentAction(
  _previous: ImportReport | null,
  formData: FormData,
): Promise<ImportReport> {
  const { repositories } = await requireAdminRepositories()

  const dryRun = formData.get('dryRun') === 'true'
  const entityValue = formData.get('entity')
  const entity = typeof entityValue === 'string' ? entityValue : ''
  const file = formData.get('file')

  if (!(file instanceof File)) return errorReport('Vali JSON-fail.', dryRun)
  if (file.size === 0) return errorReport('Fail on tühi.', dryRun)
  if (file.size > MAX_IMPORT_BYTES) {
    const sizeMiB = (file.size / (1024 * 1024)).toFixed(1)
    return errorReport(
      `Fail on liiga suur (${sizeMiB} MiB); lubatud on kuni 2 MiB.`,
      dryRun,
    )
  }

  let payload: unknown
  try {
    payload = JSON.parse(await file.text()) as unknown
  } catch {
    return errorReport('Fail ei ole korrektne JSON.', dryRun)
  }

  const parsed = parseImportPayload(payload, entity)
  if (!parsed.ok) return errorReport(parsed.error, dryRun)

  const [articleDocs, pageDocs] = await Promise.all([
    repositories.find({ collection: 'articles', pagination: false }),
    repositories.find({ collection: 'pages', pagination: false }),
  ])
  const articleBySlug = new Map(
    articleDocs.docs.map((doc) => [doc.slug, { id: doc.id, publishedAt: doc.publishedAt }]),
  )
  const pageBySlug = new Map(
    pageDocs.docs.map((doc) => [doc.slug, { id: doc.id, publishedAt: doc.publishedAt }]),
  )

  const now = new Date().toISOString()
  const articlePlan = planArticleUpserts(parsed.parsed.articles, articleBySlug, now)
  const pagePlan = planPageUpserts(parsed.parsed.pages, pageBySlug, now)

  if (dryRun) {
    const items: ImportItemResult[] = [
      ...articlePlan.invalid,
      ...articlePlan.plans.map((plan): ImportItemResult => ({
        entity: 'articles',
        index: plan.index,
        slug: plan.slug,
        title: plan.title,
        outcome: plan.action === 'create' ? 'would-create' : 'would-update',
      })),
      ...pagePlan.invalid,
      ...pagePlan.plans.map((plan): ImportItemResult => ({
        entity: 'pages',
        index: plan.index,
        slug: plan.slug,
        title: plan.title,
        outcome: plan.action === 'create' ? 'would-create' : 'would-update',
      })),
    ].sort(byEntityThenIndex)
    return {
      status: 'dry-run',
      message: 'Kontroll valmis; midagi ei salvestatud.',
      dryRun: true,
      items,
      summary: summarize(items),
    }
  }

  const items: ImportItemResult[] = [...articlePlan.invalid, ...pagePlan.invalid]

  for (const plan of articlePlan.plans) {
    const result: ImportItemResult = {
      entity: 'articles',
      index: plan.index,
      slug: plan.slug,
      title: plan.title,
      outcome: plan.action === 'create' ? 'created' : 'updated',
    }
    items.push(result)
    try {
      if (plan.existingId) {
        await repositories.update({ collection: 'articles', id: plan.existingId, data: plan.data })
      } else {
        await repositories.create({ collection: 'articles', data: plan.data })
      }
    } catch (error) {
      result.outcome = 'failed'
      result.reason = error instanceof Error ? error.message : String(error)
    }
  }

  for (const plan of pagePlan.plans) {
    const result: ImportItemResult = {
      entity: 'pages',
      index: plan.index,
      slug: plan.slug,
      title: plan.title,
      outcome: plan.action === 'create' ? 'created' : 'updated',
    }
    items.push(result)
    try {
      if (plan.existingId) {
        await repositories.update({ collection: 'pages', id: plan.existingId, data: plan.data })
      } else {
        await repositories.create({ collection: 'pages', data: plan.data })
      }
    } catch (error) {
      result.outcome = 'failed'
      result.reason = error instanceof Error ? error.message : String(error)
    }
  }

  revalidatePath(articlesPath)
  revalidatePath(pagesPath)

  items.sort(byEntityThenIndex)
  const summary = summarize(items)
  return {
    status: summary.failed > 0 ? 'partial' : 'success',
    message: `Import valmis: ${String(summary.created)} loodud, ${String(summary.updated)} uuendatud, ${String(summary.failed)} ebaõnnestus.`,
    dryRun: false,
    items,
    summary,
  }
}
