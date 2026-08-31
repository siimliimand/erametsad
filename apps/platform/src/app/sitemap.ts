import type { MetadataRoute } from 'next'

import type { CoreRepositories } from '@/lib/data/repositories'
import { getRepositories } from '@/lib/data/runtime'
import { DEFAULT_HOSTNAME, PORTAL_HOSTNAME } from '@/lib/routing/host-areas'

// Shared path (host-areas.ts SHARED_PATHS): both hosts serve the sitemap
// identically, so every entry carries its canonical host URL (D7). Listing
// DB-driven pages needs the runtime D1 binding, which builds lack.
export const dynamic = 'force-dynamic'

// Mirrors (marketing)/_lib/base-url.ts: NEXT_PUBLIC_APP_URL only supplies
// the scheme when it already serves the default host.
function resolveMarketingOrigin(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (appUrl !== undefined && appUrl !== '') {
    try {
      const parsed = new URL(appUrl)
      if (parsed.hostname === DEFAULT_HOSTNAME) return parsed.origin
    } catch {
      // Unparseable URL: fall through to the canonical constant.
    }
  }
  return `https://${DEFAULT_HOSTNAME}`
}

const MARKETING_BASE_URL = resolveMarketingOrigin()
const PORTAL_BASE_URL = `https://${PORTAL_HOSTNAME}`

// /avaleht stays unlisted: the middleware rewrite makes '/' its canonical
// URL, so listing both would submit a duplicate. Portal auth and signing
// surfaces are excluded on purpose.
const STATIC_MARKETING_PATHS = [
  '/',
  '/teenused/raieoiguse-muuk',
  '/teenused/kinnistu-muuk',
  '/teenused/metsa-hindamine',
  '/metsateatis',
  '/hindamisaktid',
  '/kiiroksjon',
  '/kontakt',
  '/kkk',
  '/meist',
  '/meist/metsaspetsialistid',
  '/artiklid',
  '/artiklid/uudised',
  '/artiklid/klientide-lood',
  '/artiklid/kasutustingimused',
  '/lepingud/dokumendid',
]

// Public portal surface: the auction listing and its history. Lot pages
// come from the DB below; /user, /login, /register and /lepingud signing
// pages are auth-gated and stay out.
const STATIC_PORTAL_PATHS = ['/', '/ajalugu']

type SitemapEntry = MetadataRoute.Sitemap[number]

function entry(url: string, modifiedAt: string): SitemapEntry {
  const time = Date.parse(modifiedAt)
  return Number.isNaN(time) ? { url } : { url, lastModified: new Date(time) }
}

function absoluteEntries(baseUrl: string, paths: string[]): SitemapEntry[] {
  return paths.map((path) =>
    path === '/' ? { url: baseUrl } : { url: `${baseUrl}${path}` },
  )
}

// Each DB source degrades independently: an unavailable D1 drops that
// group instead of failing the whole sitemap.
async function dbEntries(
  load: (repos: CoreRepositories) => Promise<SitemapEntry[]>,
): Promise<SitemapEntry[]> {
  try {
    return await load(await getRepositories())
  } catch {
    return []
  }
}

async function faqCategoryEntries(repos: CoreRepositories): Promise<SitemapEntry[]> {
  const { docs } = await repos.find({
    collection: 'faq-categories',
    sort: 'order',
    pagination: false,
  })
  return docs.map((doc) => entry(`${MARKETING_BASE_URL}/kkk/${doc.slug}`, doc.updatedAt))
}

async function specialistEntries(repos: CoreRepositories): Promise<SitemapEntry[]> {
  const { docs } = await repos.find({
    collection: 'specialists',
    where: { active: { equals: true } },
    sort: 'slug',
    pagination: false,
  })
  return docs.map((doc) => entry(`${MARKETING_BASE_URL}/meist/${doc.slug}`, doc.updatedAt))
}

async function articleEntries(repos: CoreRepositories): Promise<SitemapEntry[]> {
  const { docs } = await repos.find({
    collection: 'articles',
    where: { status: { equals: 'published' } },
    sort: '-publishedAt',
    pagination: false,
  })
  return docs.map((doc) => entry(`${MARKETING_BASE_URL}/artiklid/${doc.slug}`, doc.updatedAt))
}

async function activeLotEntries(repos: CoreRepositories): Promise<SitemapEntry[]> {
  const { docs } = await repos.find({
    collection: 'auctions',
    where: { status: { equals: 'active' } },
    sort: '-updatedAt',
    pagination: false,
  })
  return docs.map((doc) => entry(`${PORTAL_BASE_URL}/oksjon/${doc.id}`, doc.updatedAt))
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [faqCategories, specialists, articles, activeLots] = await Promise.all([
    dbEntries(faqCategoryEntries),
    dbEntries(specialistEntries),
    dbEntries(articleEntries),
    dbEntries(activeLotEntries),
  ])

  return [
    ...absoluteEntries(MARKETING_BASE_URL, STATIC_MARKETING_PATHS),
    ...faqCategories,
    ...specialists,
    ...articles,
    ...absoluteEntries(PORTAL_BASE_URL, STATIC_PORTAL_PATHS),
    ...activeLots,
  ]
}
