import {
  ArticleCard,
  EmptyState,
  LeadForm,
  LotCard,
  type LotCardProps,
} from '@eametsad/ui'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'

import { buildMetadata } from '../../_lib/seo'

import { packageTotals } from '@/lib/auction/queries'
import { centsToEuros, type ArticleDoc, type AuctionDoc } from '@/lib/data/repositories'
import { getRepositories } from '@/lib/data/runtime'
import type { AuctionObjectType, Specialist } from '@/lib/data/schema'
import { PORTAL_HOSTNAME } from '@/lib/routing/host-areas'

// See kkk/[category]/page.tsx: force-dynamic keeps DB-less CI builds green;
// revalidate = 3600 applies once build-time D1 seeding exists.
export const dynamic = 'force-dynamic'

interface SpecialistProfilePageProps {
  params: Promise<{ slug: string }>
}

// CSP allows only 'self' data: blob: for images, so lots without media get
// the same inline SVG placeholder as the portal listing (LiveListing.tsx).
const LOT_IMAGE_FALLBACK = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" role="img" aria-label="Erametsad"><rect width="640" height="400" fill="#2E6B4F"/><text x="320" y="208" fill="#FFFFFF" font-family="sans-serif" font-size="28" text-anchor="middle">Erametsad</text></svg>',
)}`

// Mirrors LiveListing.tsx; a new AuctionObjectType fails the typecheck here
// until it gets a label.
const OBJECT_TYPE_LABELS: Record<AuctionObjectType, string> = {
  raieoigus: 'Raieõigus',
  kinnistu: 'Metskinnistu',
  kiire: 'Kiiroksjon',
  pakett: 'Pakett',
}

async function loadSpecialist(slug: string): Promise<Specialist | null> {
  const repos = await getRepositories()
  const { docs } = await repos.find({
    collection: 'specialists',
    where: { slug: { equals: slug } },
    limit: 1,
  })
  return docs[0] ?? null
}

interface LexicalNodeLike {
  text?: unknown
  children?: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function nodeText(node: unknown): string {
  if (!isRecord(node)) return ''
  if (typeof node.text === 'string') return node.text
  if (!Array.isArray(node.children)) return ''
  return node.children.map((child) => nodeText(child as LexicalNodeLike)).join('')
}

// specialists.bio is Payload richText stored as raw Lexical JSON TEXT (see
// registry.ts); unwrap paragraph texts, echoing unparsable values as-is.
function bioParagraphs(bio: string | null): string[] {
  const raw = bio?.trim() ?? ''
  if (raw === '') return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed) || !isRecord(parsed.root) || !Array.isArray(parsed.root.children)) {
      return [raw]
    }
    const paragraphs = parsed.root.children
      .map((child) => nodeText(child as LexicalNodeLike))
      .filter((text) => text.trim() !== '')
    return paragraphs.length > 0 ? paragraphs : [raw]
  } catch {
    return [raw]
  }
}

function firstMediaUrl(media: unknown): string | null {
  if (!Array.isArray(media)) return null
  for (const entry of media) {
    if (isRecord(entry)) {
      const url = entry.url
      if (typeof url === 'string' && url !== '') return url
    }
  }
  return null
}

interface LotContext {
  countyNameById: Map<string, string>
  parishNameById: Map<string, string>
}

function lotCardProps(doc: AuctionDoc, ctx: LotContext): LotCardProps {
  const totals = packageTotals(doc.packageRows)
  const county = doc.countyId !== null ? ctx.countyNameById.get(doc.countyId) : undefined
  const parish = doc.parishId !== null ? ctx.parishNameById.get(doc.parishId) : undefined
  return {
    image: { src: firstMediaUrl(doc.media) ?? LOT_IMAGE_FALLBACK, alt: doc.title },
    title: doc.title,
    typeLabel: OBJECT_TYPE_LABELS[doc.objectType],
    ...(parish !== undefined ? { parish } : {}),
    ...(totals.volume !== null ? { volumeM3: totals.volume } : {}),
    alghind: centsToEuros(doc.minBidCents),
    county: county ?? doc.address ?? 'Eesti',
    area: totals.area ?? 0,
    endsAt: doc.endsAt ?? new Date().toISOString(),
    status: 'active',
    href: `https://${PORTAL_HOSTNAME}/oksjon/${doc.id}`,
  }
}

function articleDate(article: ArticleDoc): string {
  const time = Date.parse(article.publishedAt ?? article.createdAt)
  if (Number.isNaN(time)) return ''
  return new Date(time).toLocaleDateString('et-EE', { dateStyle: 'long' })
}

function subtitleBits(specialist: Specialist): string[] {
  return [specialist.role ?? 'Metsaspetsialist', specialist.region].filter(
    (value): value is string => value !== null && value !== '',
  )
}

export async function generateMetadata({
  params,
}: SpecialistProfilePageProps): Promise<Metadata> {
  const { slug } = await params
  const specialist = await loadSpecialist(slug)
  if (!specialist) return { title: 'Metsaspetsialistid' }
  const summary = bioParagraphs(specialist.bio)[0] ?? subtitleBits(specialist).join(' · ')
  return buildMetadata({
    title: `${specialist.name} — metsaspetsialist`,
    description: summary.length > 160 ? `${summary.slice(0, 157)}...` : summary,
    path: `/meist/${specialist.slug}`,
  })
}

export default async function SpecialistProfilePage({
  params,
}: SpecialistProfilePageProps) {
  const { slug } = await params
  const specialist = await loadSpecialist(slug)
  if (!specialist) notFound()
  // Task 5.2 leaves the roster and profile routing semantics here: a
  // deactivated specialist's URL points visitors back to the team page.
  if (!specialist.active) permanentRedirect('/meist/metsaspetsialistid')

  const repos = await getRepositories()
  const [lotsResult, countiesResult, parishesResult, articlesResult] = await Promise.all([
    repos.find({
      collection: 'auctions',
      where: { specialistId: { equals: specialist.id }, status: { equals: 'active' } },
      sort: 'endsAt',
      pagination: false,
    }),
    repos.find({ collection: 'counties', pagination: false }),
    repos.find({ collection: 'parishes', pagination: false }),
    // Articles have no specialist FK: `author` is free text, so the section
    // renders only when a published article names the specialist.
    repos.find({
      collection: 'articles',
      where: { author: { equals: specialist.name }, status: { equals: 'published' } },
      sort: '-publishedAt',
      pagination: false,
    }),
  ])
  const articles = articlesResult.docs

  const photoIds = [
    ...new Set(
      [specialist.photoId, ...articles.map((article) => article.featuredImageId)].filter(
        (photoId): photoId is string => photoId !== null,
      ),
    ),
  ]
  const imageUrlById = new Map<string, string>()
  if (photoIds.length > 0) {
    const mediaResult = await repos.find({
      collection: 'media',
      where: { id: { in: photoIds }, url: { exists: true } },
      pagination: false,
    })
    for (const mediaAsset of mediaResult.docs) {
      if (mediaAsset.url) {
        imageUrlById.set(mediaAsset.id, mediaAsset.url)
      }
    }
  }

  const lotCtx: LotContext = {
    countyNameById: new Map(countiesResult.docs.map((county) => [county.id, county.name])),
    parishNameById: new Map(parishesResult.docs.map((parish) => [parish.id, parish.name])),
  }
  const paragraphs = bioParagraphs(specialist.bio)
  const photoUrl = specialist.photoId !== null ? imageUrlById.get(specialist.photoId) : undefined
  const bits = subtitleBits(specialist)

  return (
    <main className="mx-auto w-full max-w-container-xl px-md py-xl lg:px-lg">
      <Link
        href="/meist/metsaspetsialistid"
        className="text-bodySm text-inkMuted transition-colors duration-hover ease-hover hover:text-ink"
      >
        ← Kõik spetsialistid
      </Link>

      <section className="mt-md flex flex-col gap-lg sm:flex-row sm:items-start">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={specialist.name}
            className="h-32 w-32 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-32 w-32 shrink-0 items-center justify-center rounded-full bg-bgMist">
            <span className="font-heading text-h2 text-inkMuted">
              {specialist.name.charAt(0)}
            </span>
          </div>
        )}
        <div>
          <h1 className="font-heading text-h1 text-ink">{specialist.name}</h1>
          {bits.length > 0 && (
            <p className="mt-xs font-body text-body text-inkMuted">{bits.join(' · ')}</p>
          )}
          {(specialist.phone !== null || specialist.email !== null) && (
            <div className="mt-sm flex flex-col gap-2xs sm:flex-row sm:gap-md">
              {specialist.phone !== null && (
                <a
                  href={`tel:${specialist.phone.replace(/\s/g, '')}`}
                  className="font-semibold text-primary underline transition-colors duration-hover ease-hover hover:text-primaryHover"
                >
                  {specialist.phone}
                </a>
              )}
              {specialist.email !== null && (
                <a
                  href={`mailto:${specialist.email}`}
                  className="font-semibold text-primary underline transition-colors duration-hover ease-hover hover:text-primaryHover"
                >
                  {specialist.email}
                </a>
              )}
            </div>
          )}
          {paragraphs.length > 0 && (
            <div className="mt-md max-w-container-sm space-y-sm">
              {paragraphs.map((paragraph) => (
                <p key={paragraph.slice(0, 40)} className="font-body text-body text-inkMuted">
                  {paragraph}
                </p>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="mt-xl">
        <h2 className="font-heading text-h2 text-ink">Aktiivsed oksjonid</h2>
        {lotsResult.docs.length === 0 ? (
          <div className="mt-md max-w-container-sm">
            <EmptyState
              title="Aktiivseid oksjoneid ei ole praegu"
              description="Selle spetsialisti uued oksjonid ilmuvad siia. Vahepeal saad kõiki aktiivseid pakkumisi vaadata oksjonite portaalis."
              action={
                <a
                  href={`https://${PORTAL_HOSTNAME}/`}
                  className="inline-flex h-12 items-center justify-center rounded-button border border-primary bg-transparent px-6 font-label font-semibold text-primary transition-colors duration-hover ease-hover hover:bg-primary-light"
                >
                  Vaata aktiivseid oksjoneid
                </a>
              }
            />
          </div>
        ) : (
          <ul className="mt-md grid gap-lg sm:grid-cols-2 lg:grid-cols-3">
            {lotsResult.docs.map((doc) => (
              <li key={doc.id}>
                <LotCard {...lotCardProps(doc, lotCtx)} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {articles.length > 0 && (
        <section className="mt-xl">
          <h2 className="font-heading text-h2 text-ink">Artiklid</h2>
          <ul className="mt-md grid gap-lg sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => {
              const image =
                article.featuredImageId !== null
                  ? imageUrlById.get(article.featuredImageId)
                  : undefined
              return (
                <li key={article.id}>
                  <ArticleCard
                    title={article.title}
                    excerpt={article.excerpt ?? ''}
                    date={articleDate(article)}
                    href={`/artiklid/${article.slug}`}
                    {...(image !== undefined ? { image } : {})}
                  />
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <section className="mt-xl max-w-container-sm rounded-card bg-bgMist p-lg">
        <h2 className="font-heading text-h3 text-ink">Küsi nõu spetsialistilt</h2>
        <p className="mt-xs font-body text-body text-inkMuted">
          Kirjuta oma küsimus — võtame ühendust 1 tööpäevaga.
        </p>
        <div className="mt-md">
          <LeadForm slug={`spetsialist-${specialist.slug}`} />
        </div>
      </section>
    </main>
  )
}
