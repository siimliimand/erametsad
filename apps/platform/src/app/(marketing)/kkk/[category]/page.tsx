import { EmptyState, type SearchableItem } from '@erametsad/ui'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { marketingUrl } from '../../_lib/base-url'
import { buildFaqPageJsonLd, toJsonLdScript } from '../../_lib/jsonld'
import { buildMetadata } from '../../_lib/seo'
import { KkkChipNav, type KkkChipNavCategory } from '../_components/KkkChipNav'
import { KkkFaqAccordion } from '../_components/KkkFaqAccordion'
import { isFaqItemVisible } from '../_lib/faq-items'
import { richTextToText } from '../_lib/faq-text'

import { getRepositories } from '@/lib/data/runtime'

// See kkk/page.tsx: force-dynamic keeps DB-less CI builds green; D7's
// revalidate = 3600 applies once build-time D1 seeding exists.
export const dynamic = 'force-dynamic'

interface KkkCategoryPageProps {
  params: Promise<{ category: string }>
}

interface KkkCategoryData {
  categories: KkkChipNavCategory[]
  category: { id: string; slug: string; title: string } | null
  items: { question: string; answer: string; slug: string | null; id: string }[]
}

async function loadCategoryPage(slug: string): Promise<KkkCategoryData> {
  const repos = await getRepositories()
  const [categoryDocs, currentDocs] = await Promise.all([
    repos.find({ collection: 'faq-categories', sort: 'order', pagination: false }),
    repos.find({
      collection: 'faq-categories',
      where: { slug: { equals: slug } },
      pagination: false,
    }),
  ])

  const current = currentDocs.docs[0] ?? null
  if (!current) {
    return { categories: [], category: null, items: [] }
  }

  const { docs: itemDocs } = await repos.find({
    collection: 'faq-items',
    where: { category: { equals: current.id } },
    sort: 'order',
    pagination: false,
  })

  return {
    categories: categoryDocs.docs.map(({ slug: categorySlug, title }) => ({
      slug: categorySlug,
      title,
    })),
    category: { id: current.id, slug: current.slug, title: current.title },
    items: itemDocs.map(({ question, answer, slug: itemSlug, id }) => ({
      question,
      answer,
      slug: itemSlug,
      id,
    })),
  }
}

export async function generateMetadata({
  params,
}: KkkCategoryPageProps): Promise<Metadata> {
  const { category: slug } = await params
  const { category } = await loadCategoryPage(slug)
  if (!category) return { title: 'KKK' }
  return buildMetadata({
    title: `KKK — ${category.title}`,
    description: `Korduma kippuvad küsimused teemal ${category.title.toLowerCase()}.`,
    path: `/kkk/${category.slug}`,
  })
}

export default async function KkkCategoryPage({ params }: KkkCategoryPageProps) {
  const { category: slug } = await params
  const { categories, category, items } = await loadCategoryPage(slug)
  if (!category) notFound()

  const faqEntries = items
    .filter((item) => isFaqItemVisible(item))
    .map((item) => ({
      question: item.question,
      answer: richTextToText(item.answer),
      slug: item.slug ?? item.id,
    }))

  const jsonLd = buildFaqPageJsonLd(
    faqEntries
      .filter((entry) => entry.answer.trim() !== '')
      .map((entry) => ({ question: entry.question, answer: entry.answer })),
    marketingUrl(`/kkk/${category.slug}`),
  )

  const accordionItems: SearchableItem[] = faqEntries.map(
    ({ question, answer, slug }) => ({ q: question, a: answer, slug }),
  )

  return (
    <main className="mx-auto w-full max-w-container-xl px-md py-lg">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toJsonLdScript(jsonLd) }}
      />

      <Link href="/kkk" className="text-bodySm text-inkMuted transition-colors hover:text-ink">
        ← Kõik küsimused
      </Link>

      <div className="mt-md">
        <KkkChipNav categories={categories} activeSlug={category.slug} />
      </div>

      <h1 className="mt-md font-heading text-h1 text-ink">{category.title}</h1>

      <div className="mt-md">
        {accordionItems.length === 0 ? (
          <EmptyState
            title="Siin kategoorias ei ole veel küsimusi"
            description="Küsimusi ei ole veel lisatud. Vahepeal vastame teie küsimustele otse."
            action={
              <Link
                href="/kontakt"
                className="inline-flex items-center rounded-button bg-primary px-4 py-2 text-bodySm font-semibold text-inkInverse transition-colors duration-hover ease-hover hover:bg-primaryHover"
              >
                Kirjuta meile
              </Link>
            }
          />
        ) : (
          <KkkFaqAccordion items={accordionItems} />
        )}
      </div>

      <div className="mt-lg rounded-card border border-border bg-bgMist p-md text-body text-inkMuted">
        Ei leidnud vastust?{' '}
        <Link
          href="/kontakt"
          className="font-semibold text-primary underline hover:no-underline"
        >
          Kirjuta meile
        </Link>{' '}
        või helista.
      </div>
    </main>
  )
}
