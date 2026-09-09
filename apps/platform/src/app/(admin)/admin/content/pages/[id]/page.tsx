import { notFound } from 'next/navigation'

import { ErrorNotice } from '../../../../_components/ErrorNotice'
import { PageHeader } from '../../../../_components/PageHeader'
import { requireAdminRepositories } from '../../../../_lib/admin'
import {
  redirectPathsForSlugChange,
  utcIsoToTallinnInputValue,
} from '../../_components/scheduled-publish'
import { PageEditor } from '../_components/PageEditor'
import type { BuilderBlock } from '../_components/builder-types'
import {
  parseVersionBlocks,
  type DrawerBlock,
  type PageVersionOption,
} from '../_components/version-blocks'

import { safeParseBlockConfig } from '@/lib/content/blocks'

export const metadata = { title: 'Muuda lehte' }

export default async function EditContentPagePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ viga?: string }>
}) {
  const { id } = await params
  const { viga } = await searchParams
  const { repositories } = await requireAdminRepositories()

  const page = await repositories.findByID({ collection: 'pages', id })
  if (!page) notFound()

  const { docs: blockDocs } = await repositories.find({
    collection: 'page-blocks',
    where: { pageId: { equals: page.id } },
    sort: 'ordinal',
    pagination: false,
  })
  const { docs: versionDocs } = await repositories.find({
    collection: 'page-versions',
    where: { pageId: { equals: page.id } },
    sort: '-version',
    pagination: false,
  })

  // A row whose config no longer parses is skipped (and so kept out of the
  // builder) instead of breaking the editor; a save rewrites the rest.
  const initialBlocks: BuilderBlock[] = []
  const savedBlocks: DrawerBlock[] = []
  for (const doc of blockDocs) {
    const parsed = safeParseBlockConfig(doc.type, doc.configJson ?? {})
    if (!parsed.success) continue
    initialBlocks.push({ id: doc.id, type: doc.type, config: parsed.data } as BuilderBlock)
    savedBlocks.push({ type: doc.type, config: parsed.data })
  }

  const versions: PageVersionOption[] = versionDocs.map((doc) => ({
    id: doc.id,
    version: doc.version,
    label: doc.label,
    createdAt: doc.createdAt,
    blocks: parseVersionBlocks(doc.snapshotJson),
  }))

  return (
    <div>
      {viga ? <ErrorNotice message={viga} /> : null}
      <PageHeader
        title={page.title}
        description="Muuda lehe blokke, SEO andmeid ja avaldamist."
        backHref="/admin/content/pages"
      />
      <PageEditor
        pageId={page.id}
        title={page.title}
        slug={page.slug}
        seoTitle={page.seoTitle ?? ''}
        seoDescription={page.seoDescription ?? ''}
        status={page.status}
        publishedAtInput={utcIsoToTallinnInputValue(page.publishedAt)}
        redirectOffer={
          page.status === 'published'
            ? redirectPathsForSlugChange('pages', page.slug, page.slug)
            : null
        }
        initialBlocks={initialBlocks}
        versions={versions}
        savedBlocks={savedBlocks}
      />
    </div>
  )
}
