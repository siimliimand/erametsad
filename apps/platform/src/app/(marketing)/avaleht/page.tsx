import { Card, LeadForm, SpecialistCard, Testimonial, ArticleCard } from '@eametsad/ui';
import { BadgeCheck, ClipboardList, Gavel } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { HomeTicker, type TickerLotSummary } from '../_components/HomeTicker';
import { NewsletterBlock } from '../_components/NewsletterBlock';
import { TrustStats } from '../_components/TrustStats';
import { marketingUrl } from '../_lib/base-url';

import { listAuctions, type AuctionSummary } from '@/lib/auction/queries';
import type { CoreRepositories, SettingsDoc } from '@/lib/data/repositories';
import { getRepositories } from '@/lib/data/runtime';
import { PORTAL_HOSTNAME } from '@/lib/routing/host-areas';

// DB-backed sections need the D1 binding, which CI and deploy builds run
// without, so prerendering would fail or bake empty sections. Request-time
// rendering is the repo-wide convention for DB-backed pages; drop
// `force-dynamic` and add generateStaticParams once build-time D1 seeding
// exists. The statistics read caches independently for 24h (TrustStats).
export const dynamic = 'force-dynamic'

// The default host rewrites '/' to this route (see host-areas.ts), so the
// canonical URL is the site root, not '/avaleht'.
export const metadata: Metadata = {
  title: { absolute: 'Eametsad — metsa ja raieõiguse müük oksjonil' },
  description:
    'Metsa müük oksjonil: müü raieõigus või metsakinnistu läbipaistval metsaoksjonil, kus konkureerivad pakkumised tagavad turuhinna. Tasuta konsultatsioon.',
  alternates: {
    canonical: '/',
  },
}

const PORTAL_URL = `https://${PORTAL_HOSTNAME}`

// Mirrors MarketingFooter: Settings owns social URLs once the schema gains
// org social columns; a null href contributes nothing to JSON-LD sameAs.
const SOCIAL_LINKS: readonly { label: string; href: string | null }[] = [
  { label: 'Facebook', href: null },
  { label: 'Instagram', href: null },
  { label: 'YouTube', href: null },
]

const PROCESS_STEPS = [
  {
    anchor: 'eeltöö',
    title: 'Eeltöö',
    icon: ClipboardList,
    points: [
      'Tasuta konsultatsioon ja hinnaülevaade.',
      'Fotod, kaardid ja müügidokument koostame meie.',
      'Alghind kinnitame koos sinuga.',
    ],
  },
  {
    anchor: 'oksjon',
    title: 'Oksjon',
    icon: Gavel,
    points: [
      'Oksjon kestab 7–14 päeva.',
      'Ostjad pakuvad portaali teavituste toel.',
      'Pakkumine viimastel minutitel pikendab tähtaega.',
    ],
  },
  {
    anchor: 'tulemus',
    title: 'Tulemus',
    icon: BadgeCheck,
    points: [
      'Võitjaga sõlmime lepingu portaalis.',
      'Edukustasu ainult pärast tehingu lõppu.',
      'Müük kantud ametlikult üle.',
    ],
  },
] as const

const heroCtaClass =
  'inline-flex h-12 items-center justify-center gap-2 rounded-button bg-cta px-6 font-label font-semibold text-ink transition-all duration-hover ease-hover hover:bg-cta-hover motion-reduce:transition-none'
const heroSecondaryClass =
  'inline-flex h-12 items-center justify-center gap-2 rounded-button border border-white/70 px-6 font-label font-semibold text-white transition-colors duration-hover ease-hover hover:bg-white/10'

async function loadTickerLots(repos: CoreRepositories | null): Promise<TickerLotSummary[]> {
  if (!repos) return []
  try {
    const search = new URLSearchParams({
      auctionStatus: 'active',
      sort: 'endTime',
      order: 'asc',
      limit: '4',
    })
    const { auctions } = await listAuctions(repos, search)
    return auctions.filter(
      (lot): lot is AuctionSummary & { endsAt: string } => lot.endsAt !== null,
    )
  } catch {
    return []
  }
}

interface HomeArticle {
  title: string
  href: string
  date: string
  excerpt: string
  image?: string
  category?: string
}

function formatArticleDate(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('et-EE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

async function loadLatestArticles(
  repos: CoreRepositories | null,
): Promise<HomeArticle[]> {
  if (!repos) return []
  try {
    const { docs } = await repos.find({
      collection: 'articles',
      where: { status: { equals: 'published' } },
      sort: '-publishedAt',
      limit: 3,
    })
    const imageIds = [
      ...new Set(
        docs
          .map((article) => article.featuredImageId)
          .filter((imageId): imageId is string => imageId !== null),
      ),
    ]
    const imageUrlById = new Map<string, string>()
    if (imageIds.length > 0) {
      const mediaResult = await repos.find({
        collection: 'media',
        where: { id: { in: imageIds }, url: { exists: true } },
        pagination: false,
      })
      for (const asset of mediaResult.docs) {
        if (asset.url) imageUrlById.set(asset.id, asset.url)
      }
    }
    return docs.map((article) => {
      const image = article.featuredImageId
        ? imageUrlById.get(article.featuredImageId)
        : undefined
      const category = Array.isArray(article.tags)
        ? article.tags.find((tag): tag is string => typeof tag === 'string')
        : undefined
      return {
        title: article.title,
        href: `/artiklid/${article.slug}`,
        date: formatArticleDate(article.publishedAt),
        excerpt: article.excerpt ?? '',
        ...(image ? { image } : {}),
        ...(category ? { category } : {}),
      }
    })
  } catch {
    return []
  }
}

interface HomeSpecialist {
  id: string
  name: string
  role: string
  phone?: string
  email?: string
  image?: string
}

async function loadSpecialists(repos: CoreRepositories | null): Promise<HomeSpecialist[]> {
  if (!repos) return []
  try {
    const { docs } = await repos.find({
      collection: 'specialists',
      where: { active: { equals: true } },
      sort: 'name',
      limit: 4,
    })
    const photoIds = [
      ...new Set(
        docs
          .map((specialist) => specialist.photoId)
          .filter((photoId): photoId is string => photoId !== null),
      ),
    ]
    const imageUrlByPhotoId = new Map<string, string>()
    if (photoIds.length > 0) {
      const mediaResult = await repos.find({
        collection: 'media',
        where: { id: { in: photoIds }, url: { exists: true } },
        pagination: false,
      })
      for (const asset of mediaResult.docs) {
        if (asset.url) imageUrlByPhotoId.set(asset.id, asset.url)
      }
    }
    return docs.map((specialist) => {
      const image = specialist.photoId
        ? imageUrlByPhotoId.get(specialist.photoId)
        : undefined
      return {
        id: specialist.id,
        name: specialist.name,
        role: specialist.role ?? '',
        ...(specialist.phone ? { phone: specialist.phone } : {}),
        ...(specialist.email ? { email: specialist.email } : {}),
        ...(image ? { image } : {}),
      }
    })
  } catch {
    return []
  }
}

interface HomeTestimonial {
  id: string
  quote: string
  author: string
  role?: string
  image?: string
}

async function loadTestimonials(repos: CoreRepositories | null): Promise<HomeTestimonial[]> {
  if (!repos) return []
  try {
    const { docs } = await repos.find({
      collection: 'testimonials',
      sort: '-createdAt',
      limit: 3,
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
        id: testimonial.id,
        quote: testimonial.content,
        author: testimonial.name,
        ...(testimonial.role ? { role: testimonial.role } : {}),
        ...(image ? { image } : {}),
      }
    })
  } catch {
    return []
  }
}

async function loadSettings(repos: CoreRepositories | null): Promise<SettingsDoc | null> {
  if (!repos) return null
  try {
    const { docs } = await repos.find({ collection: 'settings', limit: 1 })
    return docs[0] ?? null
  } catch {
    return null
  }
}

// Colocated so task 6.1 can move it into a shared jsonld helper without
// touching page markup.
function buildOrganizationJsonLd(input: {
  name: string
  url: string
  address: string | null
  sameAs: string[]
}): Record<string, unknown> {
  const org: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: input.name,
    url: input.url,
  }
  if (input.address) {
    org.address = {
      '@type': 'PostalAddress',
      streetAddress: input.address,
      addressCountry: 'EE',
    }
  }
  if (input.sameAs.length > 0) {
    org.sameAs = input.sameAs
  }
  return org
}

const sectionHeadingClass = 'font-heading text-h2 text-ink'

export default async function AvalehtPage() {
  let repos: CoreRepositories | null = null
  try {
    repos = await getRepositories()
  } catch {
    // No D1 binding: every block degrades independently to its fallback.
  }

  const [tickerLots, articles, specialists, testimonials, settings] = await Promise.all([
    loadTickerLots(repos),
    loadLatestArticles(repos),
    loadSpecialists(repos),
    loadTestimonials(repos),
    loadSettings(repos),
  ])

  const organizationJsonLd = buildOrganizationJsonLd({
    name: settings?.orgName ?? 'Eametsad',
    url: marketingUrl('/'),
    address: settings?.orgAddress ?? null,
    sameAs: SOCIAL_LINKS.flatMap((social) => (social.href ? [social.href] : [])),
  })

  return (
    <main className="pb-2xl">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />

      {/* 1. Hero — photo overlay treatment; the photo asset itself lands
          with the Phase 0 design decision (design doc open question). */}
      <section className="bg-[linear-gradient(90deg,rgba(22,56,42,0.92),rgba(22,56,42,0.55))]">
        <div className="mx-auto grid max-w-container-xl gap-lg px-md py-xl md:px-lg lg:grid-cols-2 lg:items-center">
          <div>
            <h1 className="font-heading text-h1 text-inkInverse">
              Sinu mets, õigem hind.
            </h1>
            <p className="mt-md max-w-container-sm text-body text-white/90">
              Müü raieõigus või metsakinnistu oksjonil, kus konkureerivad
              pakkumised tagavad turuhinna. Konsultatsioon on tasuta.
            </p>
            <div className="mt-lg flex flex-col gap-xs sm:flex-row">
              <a href={PORTAL_URL} className={heroCtaClass}>
                Vaata aktiivseid oksjoneid
              </a>
              <a href={`${PORTAL_URL}/ajalugu`} className={heroSecondaryClass}>
                Oksjonite ajalugu
              </a>
            </div>
          </div>
          <Card hover={false} className="p-6">
            <h2 className="font-heading text-h3 text-ink">Tasuta konsultatsioon</h2>
            <p className="mt-2xs text-bodySm text-inkMuted">
              Soovid konsultatsiooni? Jäta meile enda andmed.
            </p>
            <div className="mt-md">
              <LeadForm slug="avaleht" />
            </div>
          </Card>
        </div>
      </section>

      {/* 2. "Plaanis metsa müük?" band */}
      <section className="bg-bgMist">
        <div className="mx-auto flex max-w-container-xl flex-col gap-md px-md py-lg md:flex-row md:items-center md:justify-between md:px-lg">
          <h2 className="max-w-container-sm font-heading text-h3 text-ink">
            Plaanis metsa müük? Räägime läbi, ilma kohustusteta.
          </h2>
          <a
            href="#kontaktvorm"
            className="inline-flex h-12 shrink-0 items-center justify-center rounded-button bg-primary px-6 font-label font-semibold text-ink-inverse transition-all duration-hover ease-hover hover:bg-primary-hover motion-reduce:transition-none"
          >
            Räägime detailsemalt
          </a>
        </div>
      </section>

      {/* 3. AuctionTicker — server-rendered once, 60s client refresh */}
      <section className="mx-auto max-w-container-xl px-md py-xl md:px-lg">
        <div className="flex flex-wrap items-baseline justify-between gap-md">
          <h2 className={sectionHeadingClass}>Aktiivsed oksjonid</h2>
          <a
            href={PORTAL_URL}
            className="font-semibold text-primary underline hover:text-primary-hover"
          >
            Kõik oksjonid
          </a>
        </div>
        <div className="mt-md">
          <HomeTicker initialLots={tickerLots} />
        </div>
      </section>

      {/* 4. Mini SpecialistCards */}
      {specialists.length > 0 && (
        <section className="mx-auto max-w-container-xl px-md pb-xl md:px-lg">
          <div className="flex flex-wrap items-baseline justify-between gap-md">
            <h2 className={sectionHeadingClass}>Meie kollektiiv</h2>
            <Link
              href="/meist/metsaspetsialistid"
              className="font-semibold text-primary underline hover:text-primary-hover"
            >
              Vaata kõiki spetsialiste
            </Link>
          </div>
          <ul className="mt-md grid gap-lg sm:grid-cols-2 lg:grid-cols-4">
            {specialists.map((specialist) => (
              <li key={specialist.id}>
                <SpecialistCard
                  mini
                  name={specialist.name}
                  role={specialist.role}
                  {...(specialist.phone ? { phone: specialist.phone } : {})}
                  {...(specialist.email ? { email: specialist.email } : {})}
                  {...(specialist.image ? { image: specialist.image } : {})}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 5. Trust statistics — hides itself on failure */}
      <TrustStats />

      {/* 6. Process — column headings deep-link to the service anchors */}
      <section className="mx-auto max-w-container-xl px-md py-xl md:px-lg">
        <h2 className={sectionHeadingClass}>Kuidas müük käib?</h2>
        <div className="mt-md grid gap-lg md:grid-cols-3">
          {PROCESS_STEPS.map(({ anchor, title, icon: Icon, points }) => (
            <Card key={anchor} hover={false} className="p-6">
              <Icon className="h-6 w-6 text-primary" aria-hidden="true" />
              <h3 className="mt-xs">
                <Link
                  href={`/teenused/raieoiguse-muuk#${anchor}`}
                  className="font-heading text-h4 text-ink underline-offset-4 hover:text-primary hover:underline"
                >
                  {title}
                </Link>
              </h3>
              <ul className="mt-sm list-disc space-y-2 pl-5 text-bodySm text-inkMuted marker:text-primary">
                {points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </section>

      {/* 7. Latest articles — hidden when there are none */}
      {articles.length > 0 && (
        <section className="mx-auto max-w-container-xl px-md pb-xl md:px-lg">
          <div className="flex flex-wrap items-baseline justify-between gap-md">
            <h2 className={sectionHeadingClass}>Viimased artiklid</h2>
            <Link
              href="/artiklid"
              className="font-semibold text-primary underline hover:text-primary-hover"
            >
              Vaata kõiki uudiseid
            </Link>
          </div>
          <div className="mt-md grid gap-lg md:grid-cols-3">
            {articles.map((article) => (
              <ArticleCard
                key={article.href}
                title={article.title}
                excerpt={article.excerpt}
                date={article.date}
                href={article.href}
                {...(article.image ? { image: article.image } : {})}
                {...(article.category ? { category: article.category } : {})}
              />
            ))}
          </div>
        </section>
      )}

      {/* 8. Newsletter */}
      <NewsletterBlock />

      {/* 9. Testimonials */}
      {testimonials.length > 0 && (
        <section className="mx-auto max-w-container-xl px-md py-xl md:px-lg">
          <h2 className={sectionHeadingClass}>Kliendilood</h2>
          <div className="mt-md grid gap-lg md:grid-cols-3">
            {testimonials.map((testimonial) => (
              <Testimonial
                key={testimonial.id}
                quote={testimonial.quote}
                author={testimonial.author}
                {...(testimonial.role ? { role: testimonial.role } : {})}
                {...(testimonial.image ? { image: testimonial.image } : {})}
              />
            ))}
          </div>
        </section>
      )}

      {/* 10. Closing LeadForm */}
      <section
        id="kontaktvorm"
        className="mx-auto max-w-container-xl scroll-mt-28 px-md pt-xl md:px-lg lg:scroll-mt-20"
      >
        <div className="rounded-card bg-bgMist p-lg">
          <h2 className="max-w-container-sm font-heading text-h3 text-ink">
            Soovid konsultatsiooni? Jäta meile enda andmed.
          </h2>
          <div className="mt-md max-w-container-sm">
            <LeadForm slug="avaleht" />
          </div>
        </div>
      </section>
    </main>
  )
}
