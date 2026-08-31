import Link from 'next/link'

import { ARTICLE_CATEGORIES } from '../_lib/categories'

/**
 * Link-based chip navigation for the articles hub and category pages. The
 * packages/ui ChipNav is a callback-driven filter control, so routing chips
 * are plain anchors styled to match it (same approach as KkkChipNav).
 */
export function ArtiklidChipNav({ activeSlug }: { activeSlug?: string | undefined }) {
  const chipClass = (active: boolean) =>
    `inline-flex shrink-0 items-center whitespace-nowrap rounded-pill px-4 py-2 text-bodySm font-semibold transition-colors duration-hover ease-hover motion-reduce:transition-none ${
      active
        ? 'bg-primary text-inkInverse'
        : 'border border-border bg-bgMist text-ink hover:bg-primaryLight'
    }`

  return (
    <nav aria-label="Artiklite kategooriad">
      <div className="flex flex-row gap-2 overflow-x-auto flex-nowrap pb-1">
        <Link
          href="/artiklid"
          aria-current={activeSlug === undefined ? 'page' : undefined}
          className={chipClass(activeSlug === undefined)}
        >
          Kõik
        </Link>
        {ARTICLE_CATEGORIES.map((category) => (
          <Link
            key={category.slug}
            href={`/artiklid/${category.slug}`}
            aria-current={activeSlug === category.slug ? 'page' : undefined}
            className={chipClass(activeSlug === category.slug)}
          >
            {category.label}
          </Link>
        ))}
      </div>
    </nav>
  )
}
