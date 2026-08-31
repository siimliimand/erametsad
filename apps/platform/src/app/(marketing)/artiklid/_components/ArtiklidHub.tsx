import { ArticleCard, EmptyState } from '@eametsad/ui'
import { Newspaper } from 'lucide-react'
import Link from 'next/link'

import { ArtiklidChipNav } from './ArtiklidChipNav'
import { NewsletterSignup } from './NewsletterSignup'
import { marketingUrl } from '../../_lib/base-url'
import {
  articleCardCategory,
  filterByCategory,
  loadPublishedArticles,
  paginateArticles,
  searchArticles,
} from '../_lib/articles'
import type { ArticleCategory } from '../_lib/categories'

const MIN_QUERY_LENGTH = 2

function formatDate(iso: string | null): string {
  if (!iso) return ''
  const parsed = new Date(iso)
  return Number.isNaN(parsed.getTime())
    ? ''
    : parsed.toLocaleDateString('et-EE', { dateStyle: 'long' })
}

function buildBreadcrumbJsonLd(parts: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: parts.map((part, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: part.name,
      item: marketingUrl(part.path),
    })),
  }
}

interface ArtiklidHubProps {
  activeSlug?: string | undefined
  category?: ArticleCategory | undefined
  q?: string | undefined
  pageParam?: string | undefined
}

export async function ArtiklidHub({ activeSlug, category, q, pageParam }: ArtiklidHubProps) {
  const all = await loadPublishedArticles()

  const query = typeof q === 'string' ? q : ''
  const searching = query.trim().length >= MIN_QUERY_LENGTH

  const filtered = category && !searching ? filterByCategory(all, category) : all
  const searchResults = searching ? searchArticles(all, query) : []
  const listing = searching ? searchResults : filtered

  const [featured, ...rest] = listing
  const gridSource = searching ? searchResults : rest
  const { items, page, totalPages } = paginateArticles(gridSource, pageParam)

  const basePath = category ? `/artiklid/${category.slug}` : '/artiklid'
  const heading = category ? category.label : 'Artiklid ja uudised'

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: heading,
      url: marketingUrl(basePath),
    },
    buildBreadcrumbJsonLd([
      { name: 'Avaleht', path: '/' },
      { name: 'Artiklid', path: '/artiklid' },
      ...(category ? [{ name: category.label, path: basePath }] : []),
    ]),
  ]

  return (
    <div className="mx-auto w-full max-w-container-xl px-md py-lg">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <h1 className="font-heading text-h1 text-ink">{heading}</h1>
      <p className="mt-xs max-w-container-sm text-body text-inkMuted">
        Uudised, kliendilood ja teadmised metsa müügiks oksjonil.
      </p>

      <div className="mt-md">
        <ArtiklidChipNav activeSlug={activeSlug} />
      </div>

      {searching ? (
        <section aria-label="Otsingutulemused" className="mt-lg">
          <p className="text-body text-inkMuted" role="status">
            Otsing „{query.trim()}": leiti {String(searchResults.length)} tulemust
          </p>
          {searchResults.length === 0 ? (
            <EmptyState
              icon={Newspaper}
              title="Ei leidnud artikleid"
              description="Proovi teist otsingusõna või sirvi kõiki artikleid."
              action={
                <Link
                  href="/artiklid"
                  className="inline-flex items-center rounded-button bg-primary px-4 py-2 text-bodySm font-semibold text-inkInverse transition-colors duration-hover ease-hover hover:bg-primaryHover"
                >
                  Kõik artiklid
                </Link>
              }
            />
          ) : (
            <div className="mt-md grid gap-gutter sm:grid-cols-2 lg:grid-cols-3">
              {searchResults.map((article) => {
                const category = articleCardCategory(article)
                return (
                  <ArticleCard
                    key={article.slug}
                    title={article.title}
                    excerpt={article.excerpt}
                    date={formatDate(article.publishedAt)}
                    href={`/artiklid/${article.slug}`}
                    {...(category && { category })}
                  />
                )
              })}
            </div>
          )}
        </section>
      ) : (
        <>
          {featured ? (
            <section aria-label="Esiletõstetud artikkel" className="mt-lg">
              <div className="grid overflow-hidden rounded-card border border-border bg-bgMist lg:grid-cols-2">
                <div className="flex aspect-[16/10] items-center justify-center bg-gradient-to-br from-primaryLight via-bgMist to-primary/20 lg:aspect-auto">
                  <Newspaper className="h-12 w-12 text-primary/60" aria-hidden="true" />
                </div>
                <div className="flex flex-col justify-center gap-sm p-md md:p-lg">
                  <div className="flex items-center gap-2">
                    {articleCardCategory(featured) && (
                      <span className="inline-block rounded-full bg-primaryLight px-2.5 py-0.5 font-body text-label text-primary">
                        {articleCardCategory(featured)}
                      </span>
                    )}
                    <time className="font-body text-label text-inkMuted">
                      {formatDate(featured.publishedAt)}
                    </time>
                  </div>
                  <h2 className="font-heading text-h2 text-ink">{featured.title}</h2>
                  <p className="text-body text-inkMuted">{featured.excerpt}</p>
                  <Link
                    href={`/artiklid/${featured.slug}`}
                    className="inline-flex w-fit items-center rounded-button bg-primary px-6 py-3 font-label font-semibold text-inkInverse transition-colors duration-hover ease-hover hover:bg-primaryHover"
                  >
                    Loe artiklit
                  </Link>
                </div>
              </div>
            </section>
          ) : (
            <div className="mt-lg">
              <EmptyState
                icon={Newspaper}
                title="Selles kategoorias pole veel artikleid"
                description="Vahepeal sirvi kõiki artikleid."
                action={
                  <Link
                    href="/artiklid"
                    className="inline-flex items-center rounded-button bg-primary px-4 py-2 text-bodySm font-semibold text-inkInverse transition-colors duration-hover ease-hover hover:bg-primaryHover"
                  >
                    Kõik artiklid
                  </Link>
                }
              />
            </div>
          )}

          {items.length > 0 && (
            <section aria-label="Artiklite loend" className="mt-lg">
              <div className="grid gap-gutter sm:grid-cols-2 lg:grid-cols-3">
                {items.map((article) => {
                  const category = articleCardCategory(article)
                  return (
                    <ArticleCard
                      key={article.slug}
                      title={article.title}
                      excerpt={article.excerpt}
                      date={formatDate(article.publishedAt)}
                      href={`/artiklid/${article.slug}`}
                      {...(category && { category })}
                    />
                  )
                })}
              </div>
            </section>
          )}

          {totalPages > 1 && (
            <nav
              aria-label="Artiklite lehitsemine"
              className="mt-lg flex items-center justify-between gap-sm"
            >
              {page > 1 ? (
                <Link
                  href={`${basePath}?page=${String(page - 1)}`}
                  className="rounded-button border border-border bg-bgMist px-4 py-2 text-bodySm font-semibold text-ink transition-colors duration-hover ease-hover hover:bg-primaryLight"
                >
                  ← Uuemad artiklid
                </Link>
              ) : (
                <span />
              )}
              <span className="text-bodySm text-inkMuted">
                Lehekülg {String(page)} / {String(totalPages)}
              </span>
              {page < totalPages ? (
                <Link
                  href={`${basePath}?page=${String(page + 1)}`}
                  className="rounded-button border border-border bg-bgMist px-4 py-2 text-bodySm font-semibold text-ink transition-colors duration-hover ease-hover hover:bg-primaryLight"
                >
                  Vanemad artiklid →
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}
        </>
      )}

      <div className="mt-xl">
        <NewsletterSignup />
      </div>
    </div>
  )
}
