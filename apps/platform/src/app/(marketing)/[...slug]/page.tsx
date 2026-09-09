import { PageBlocks } from '@erametsad/ui'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { LegacyPageLayout } from './_components/LegacyPageLayout'
import {
  loadPageBlockViews,
  loadPageTestimonials,
  loadPublishedPage,
  loadTickerLots,
} from './_lib/page-content'
import { buildMetadata } from '../_lib/seo'

// DB-backed pages need the D1 binding, which CI and deploy builds run
// without; request-time rendering is the repo-wide convention here (see
// avaleht/page.tsx). No caching-strategy change.
export const dynamic = 'force-dynamic'

interface CmsPageRouteProps {
  params: Promise<{ slug: string[] }>
}

function pageSlug(slug: string[]): string {
  return slug.join('/')
}

export async function generateMetadata({
  params,
}: CmsPageRouteProps): Promise<Metadata> {
  const { slug } = await params
  const page = await loadPublishedPage(pageSlug(slug))
  if (!page) {
    return buildMetadata({
      title: 'Lehekülge ei leitud',
      description: '',
      path: `/${pageSlug(slug)}`,
    })
  }
  return buildMetadata({
    title: page.seoTitle ?? page.title,
    description: page.seoDescription ?? '',
    path: `/${pageSlug(slug)}`,
  })
}

/**
 * CMS pages route: renders a published page's `page_blocks` rows through the
 * shared PageBlocks renderer in ordinal order. Pages without blocks fall
 * back to the legacy `layout` column rendering; an unknown slug is a 404.
 */
export default async function CmsPage({ params }: CmsPageRouteProps) {
  const { slug } = await params
  const page = await loadPublishedPage(pageSlug(slug))
  if (!page) notFound()

  const blocks = await loadPageBlockViews(page.id)
  if (blocks.length === 0) {
    return (
      <main className="pb-2xl">
        <LegacyPageLayout title={page.title} layout={page.layout} />
      </main>
    )
  }

  // Ticker blocks never fetch inside the renderer: load once here, capped at
  // the registry limit (10), and let each block slice its own limit.
  const hasTicker = blocks.some((block) => block.type === 'ticker')
  const tickerLots = hasTicker ? await loadTickerLots() : []

  // Testimonials blocks read the published collection the same way: the
  // caller loads, each block slices its own limit.
  const hasTestimonials = blocks.some((block) => block.type === 'testimonials')
  const testimonials = hasTestimonials ? await loadPageTestimonials() : []

  return (
    <main className="pb-2xl">
      <PageBlocks
        blocks={blocks}
        tickerLots={tickerLots}
        testimonials={testimonials}
      />
    </main>
  )
}
