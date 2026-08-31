import type { Metadata } from 'next'
import Link from 'next/link'

import { KkkChipNav } from './_components/KkkChipNav'
import { KkkHubSearch, type KkkHubSearchEntry } from './_components/KkkHubSearch'
import { isFaqItemVisible } from './_lib/faq-items'

import { getRepositories } from '@/lib/data/runtime'

// D7 asks for ISR (revalidate = 3600) on content pages, but CI and deploy
// builds run `next build` without a seeded D1, so prerendering against the
// CMS would fail the build or bake empty pages. Request-time rendering is
// the repo-wide convention for DB-backed pages; drop `force-dynamic` and
// add generateStaticParams once build-time D1 seeding exists.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'KKK',
  description:
    'Korduma kippuvad küsimused metsa müügi, oksjonite, maksmise ja metsanduse kohta.',
  alternates: { canonical: '/kkk' },
}

export default async function KkkHubPage() {
  const repos = await getRepositories()
  const [categories, items] = await Promise.all([
    repos.find({ collection: 'faq-categories', sort: 'order', pagination: false }),
    repos.find({ collection: 'faq-items', sort: 'order', pagination: false }),
  ])

  const visibleItems = items.docs.filter((item) => isFaqItemVisible(item))
  const categoryById = new Map(categories.docs.map((category) => [category.id, category]))

  const searchEntries: KkkHubSearchEntry[] = visibleItems.flatMap((item) => {
    const category = categoryById.get(item.categoryId)
    if (!category) return []
    return [
      {
        question: item.question,
        slug: item.slug ?? item.id,
        categorySlug: category.slug,
        categoryTitle: category.title,
      },
    ]
  })

  return (
    <main className="mx-auto w-full max-w-container-xl px-md py-lg">
      <h1 className="font-heading text-h1 text-ink">Korduma kippuvad küsimused</h1>
      <p className="mt-xs max-w-container-sm text-body text-inkMuted">
        Vastused metsa müügi, oksjonite, maksmise ja metsanduse kohta. Otsi või vali kategooria.
      </p>

      <div className="mt-md flex flex-col gap-md">
        <KkkHubSearch entries={searchEntries} />
        <KkkChipNav categories={categories.docs.map(({ slug, title }) => ({ slug, title }))} />
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
