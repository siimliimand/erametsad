import { ArticleCard, StickyTOC } from '@eametsad/ui'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { buildArticleJsonLd, toJsonLdScript } from '../../_lib/jsonld'
import { buildMetadata } from '../../_lib/seo'
import { ArticleRichText } from '../_lib/article-body'
import { extractHeadings } from '../_lib/article-text'
import { articleCardCategory, loadPublishedArticles, toStringTags } from '../_lib/articles'
import { ARTICLE_CATEGORIES } from '../_lib/categories'

import { getRepositories } from '@/lib/data/runtime'

// See kkk/page.tsx: force-dynamic keeps DB-less CI builds green; D7's
// revalidate = 3600 applies once build-time D1 seeding exists.
export const dynamic = 'force-dynamic'

const CTA_TITLE = 'Konsultatsioon on tasuta'
const CTA_TEXT =
  'Kahtled, kas oksjon sinu metsa jaoks sobib? Kirjuta meile — vaatame olukorra läbi ja anname ausa hinnanguli.'

function formatDate(iso: string | null): string {
  if (!iso) return ''
  const parsed = new Date(iso)
  return Number.isNaN(parsed.getTime())
    ? ''
    : parsed.toLocaleDateString('et-EE', { dateStyle: 'long' })
}

async function loadArticle(slug: string) {
  const repos = await getRepositories()
  const { docs } = await repos.find({
    collection: 'articles',
    where: { slug: { equals: slug }, status: { equals: 'published' } },
    limit: 1,
  })
  return (
    docs.map((doc) => ({
      slug: doc.slug,
      title: doc.title,
      excerpt: doc.excerpt ?? '',
      content: doc.content,
      author: doc.author,
      publishedAt: doc.publishedAt,
      tags: toStringTags(doc.tags),
    }))[0] ?? null
  )
}

/** Same known category first, then shared tags; newest first; limit 3. */
function relatedArticles(
  all: Awaited<ReturnType<typeof loadPublishedArticles>>,
  current: { slug: string; tags: string[] },
  limit = 3,
) {
  const currentCategory = ARTICLE_CATEGORIES.find((category) =>
    current.tags.includes(category.tag),
  )
  return all
    .filter((article) => article.slug !== current.slug)
    .map((article) => {
      let score = 0
      if (currentCategory && article.tags.includes(currentCategory.tag)) score += 2
      score += article.tags.filter((tag) => current.tags.includes(tag)).length
      return { article, score }
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ article }) => article)
}

interface ArticlePageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const { slug } = await params
  const article = await loadArticle(slug)
  if (!article) return { title: 'Artikkel' }
  return buildMetadata({
    title: article.title,
    description: article.excerpt,
    path: `/artiklid/${article.slug}`,
    ogType: 'article',
  })
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params
  const [article, all] = await Promise.all([loadArticle(slug), loadPublishedArticles()])
  if (!article) notFound()

  const related = relatedArticles(all, article)
  const headings = article.content ? extractHeadings(article.content) : []
  const categoryLabel = articleCardCategory(article)

  const jsonLd = buildArticleJsonLd({
    headline: article.title,
    path: `/artiklid/${article.slug}`,
    publishedAt: article.publishedAt,
    author: article.author,
  })

  return (
    <div className="mx-auto w-full max-w-container-xl px-md py-lg">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toJsonLdScript(jsonLd) }}
      />

      <Link
        href="/artiklid"
        className="text-bodySm text-inkMuted transition-colors hover:text-ink"
      >
        ← Artiklid
      </Link>

      <article>
        <header className="mt-md max-w-container-sm">
          <div className="flex flex-wrap items-center gap-2">
            {categoryLabel && (
              <span className="inline-block rounded-full bg-primaryLight px-2.5 py-0.5 font-body text-label text-primary">
                {categoryLabel}
              </span>
            )}
            <time className="font-body text-label text-inkMuted">
              {formatDate(article.publishedAt)}
            </time>
            {article.author && (
              // The articles schema stores author as plain text (no
              // specialist linkage), so this renders as text, not a link.
              <span className="font-body text-label text-inkMuted">
                · Autor: {article.author}
              </span>
            )}
          </div>
          <h1 className="mt-sm font-heading text-h1 text-ink">{article.title}</h1>
          {article.excerpt && (
            <p className="mt-sm text-body text-inkMuted">{article.excerpt}</p>
          )}
        </header>

        <div className="mt-lg grid gap-gutter lg:grid-cols-12">
          {headings.length > 0 && (
            <aside className="lg:col-span-4 lg:order-2" aria-label="Artikli sisukord">
              <StickyTOC sections={headings} className="lg:pl-md" />
            </aside>
          )}
          <div className={headings.length > 0 ? 'lg:col-span-8 lg:order-1' : 'lg:col-span-12'}>
            {article.content && <ArticleRichText content={article.content} />}
          </div>
        </div>
      </article>

      {/* Design 15: the CTA band text is CMS-editable with the default copy;
      no settings key exists yet, so the default ships statically. */}
      <section
        aria-label="Konsultatsioon"
        className="mt-xl rounded-card bg-gradient-to-br from-primaryLight via-bgMist to-primary/10 p-md md:p-lg"
      >
        <h2 className="font-heading text-h2 text-ink">{CTA_TITLE}</h2>
        <p className="mt-xs max-w-container-sm text-body text-inkMuted">{CTA_TEXT}</p>
        <Link
          href="/kontakt"
          className="mt-md inline-flex items-center rounded-button bg-primary px-6 py-3 font-label font-semibold text-inkInverse transition-colors duration-hover ease-hover hover:bg-primaryHover"
        >
          Küsi nõu
        </Link>
      </section>

      {related.length > 0 && (
        <section aria-labelledby="seotud-artiklid" className="mt-xl">
          <h2 id="seotud-artiklid" className="font-heading text-h3 text-ink">
            Seotud artiklid
          </h2>
          <div className="mt-md grid gap-gutter sm:grid-cols-2 lg:grid-cols-3">
            {related.map((item) => {
              const category = articleCardCategory(item)
              return (
                <ArticleCard
                  key={item.slug}
                  title={item.title}
                  excerpt={item.excerpt}
                  date={formatDate(item.publishedAt)}
                  href={`/artiklid/${item.slug}`}
                  {...(category && { category })}
                />
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
