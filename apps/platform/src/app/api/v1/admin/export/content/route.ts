import type { NextRequest } from 'next/server'

import { requireAdminRepositories } from '@/app/(admin)/_lib/admin'
import {
  toExportArticle,
  toExportPage,
} from '@/app/(admin)/admin/content/import-export/_lib/import-export'

export const dynamic = 'force-dynamic'

const exportTypes = ['articles', 'pages', 'all'] as const
type ExportType = (typeof exportTypes)[number]

function isExportType(value: string): value is ExportType {
  return (exportTypes as readonly string[]).includes(value)
}

export async function GET(request: NextRequest) {
  const typeParam = request.nextUrl.searchParams.get('type') ?? 'all'
  if (!isExportType(typeParam)) {
    return Response.json(
      { error: 'Tundmatu tüüp; kasuta articles, pages või all.' },
      { status: 400 },
    )
  }

  // Redirects to the login page when the admin cookie is missing or invalid.
  const { repositories } = await requireAdminRepositories()

  const [articles, pages] = await Promise.all([
    typeParam === 'pages' ? null : repositories.find({ collection: 'articles', pagination: false }),
    typeParam === 'articles' ? null : repositories.find({ collection: 'pages', pagination: false }),
  ])

  const date = new Date().toISOString().slice(0, 10)
  let filename: string
  let body: string
  if (typeParam === 'articles') {
    filename = `artiklid-${date}.json`
    body = JSON.stringify(articles ? articles.docs.map(toExportArticle) : [], null, 2)
  } else if (typeParam === 'pages') {
    filename = `lehed-${date}.json`
    body = JSON.stringify(pages ? pages.docs.map(toExportPage) : [], null, 2)
  } else {
    filename = `sisu-${date}.json`
    body = JSON.stringify(
      {
        articles: articles ? articles.docs.map(toExportArticle) : [],
        pages: pages ? pages.docs.map(toExportPage) : [],
      },
      null,
      2,
    )
  }

  return new Response(body, {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
    },
  })
}
