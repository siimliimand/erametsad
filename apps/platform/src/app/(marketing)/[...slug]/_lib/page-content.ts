import type { LotCardProps, PageBlockView, TestimonialItemConfig } from '@erametsad/ui'

import { listAuctions, type AuctionSummary } from '@/lib/auction/queries'
import { safeParseBlockConfig } from '@/lib/content/blocks'
import type { PageDoc } from '@/lib/data/repositories'
import { getRepositories } from '@/lib/data/runtime'
import type { AuctionObjectType } from '@/lib/data/schema'
import { PORTAL_HOSTNAME } from '@/lib/routing/host-areas'

// Mirrors HomeTicker/meist label maps; a new AuctionObjectType fails the
// typecheck here until it gets a label.
const OBJECT_TYPE_LABELS: Record<AuctionObjectType, string> = {
  raieoigus: 'Raieõigus',
  kinnistu: 'Metskinnistu',
  kiire: 'Kiiroksjon',
  pakett: 'Pakett',
}

// LotCard requires an image; lots without media get the same placeholder
// as HomeTicker.
const FALLBACK_LOT_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 100'%3E%3Crect width='160' height='100' fill='%23e7efe9'/%3E%3C/svg%3E"

function toLotProps(summary: AuctionSummary): LotCardProps {
  const title = summary.registryNumber ?? summary.title
  return {
    image: { src: summary.image ?? FALLBACK_LOT_IMAGE, alt: title },
    title,
    alghind: summary.minBid,
    county: summary.county?.name ?? summary.address ?? 'Eesti',
    area: summary.area ?? 0,
    endsAt: summary.endsAt ?? new Date().toISOString(),
    status: 'active',
    href: `https://${PORTAL_HOSTNAME}/oksjon/${summary.id}`,
    ctaLabel: 'Vaata oksjonit',
    objectType: summary.objectType,
    typeLabel: OBJECT_TYPE_LABELS[summary.objectType],
    ...(summary.parish ? { parish: summary.parish.name } : {}),
    ...(summary.volume !== null ? { volumeM3: summary.volume } : {}),
    ...(summary.species.length > 0 ? { speciesNames: summary.species } : {}),
  }
}

/**
 * Loads the published page for a slug, or null when the D1 binding is
 * absent (DB-less builds), the page is missing, or it is still a draft.
 */
export async function loadPublishedPage(slug: string): Promise<PageDoc | null> {
  let repos
  try {
    repos = await getRepositories()
  } catch {
    return null
  }
  try {
    const { docs } = await repos.find({
      collection: 'pages',
      where: { slug: { equals: slug }, status: { equals: 'published' } },
      limit: 1,
    })
    return docs[0] ?? null
  } catch {
    return null
  }
}

/**
 * Loads a page's blocks in ordinal order with every config zod-parsed
 * through the block registry. A parse failure skips that block only — a
 * malformed row must never break the page render.
 */
export async function loadPageBlockViews(pageId: string): Promise<PageBlockView[]> {
  let repos
  try {
    repos = await getRepositories()
  } catch {
    return []
  }
  const { docs } = await repos.find({
    collection: 'page-blocks',
    where: { pageId: { equals: pageId } },
    sort: 'ordinal',
    pagination: false,
  })
  const views: PageBlockView[] = []
  for (const doc of docs) {
    const result = safeParseBlockConfig(doc.type, doc.configJson)
    if (result.success) {
      views.push({ id: doc.id, type: doc.type, config: result.data })
    }
  }
  return views
}

/**
 * Active auctions for `ticker` blocks, capped at the registry limit (10).
 * Empty on failure; the ticker block then renders the package's built-in
 * empty state.
 */
export async function loadTickerLots(): Promise<LotCardProps[]> {
  try {
    const repos = await getRepositories()
    const search = new URLSearchParams({
      auctionStatus: 'active',
      sort: 'endTime',
      order: 'asc',
      limit: '10',
    })
    const { auctions } = await listAuctions(repos, search)
    return auctions
      .filter((lot): lot is AuctionSummary & { endsAt: string } => lot.endsAt !== null)
      .map(toLotProps)
  } catch {
    return []
  }
}

/**
 * Published testimonials for `testimonials` blocks, newest first, with
 * avatar media resolved to URLs. Empty on failure; the block then renders
 * nothing (mirrors the ticker empty-state contract).
 */
export async function loadPageTestimonials(): Promise<TestimonialItemConfig[]> {
  try {
    const repos = await getRepositories()
    const { docs } = await repos.find({
      collection: 'testimonials',
      where: { status: { equals: 'published' } },
      sort: '-createdAt',
      pagination: false,
    })
    const avatarIds = [
      ...new Set(
        docs
          .map((testimonial) => testimonial.avatarId)
          .filter((avatarId): avatarId is string => avatarId !== null),
      ),
    ]
    const imageUrlByAvatarId = new Map<string, string>()
    if (avatarIds.length > 0) {
      const mediaResult = await repos.find({
        collection: 'media',
        where: { id: { in: avatarIds }, url: { exists: true } },
        pagination: false,
      })
      for (const asset of mediaResult.docs) {
        if (asset.url) imageUrlByAvatarId.set(asset.id, asset.url)
      }
    }
    return docs.map((testimonial) => {
      const image = testimonial.avatarId
        ? imageUrlByAvatarId.get(testimonial.avatarId)
        : undefined
      return {
        quote: testimonial.content,
        author: testimonial.name,
        ...(testimonial.role !== null ? { role: testimonial.role } : {}),
        ...(image !== undefined ? { image } : {}),
      }
    })
  } catch {
    return []
  }
}
