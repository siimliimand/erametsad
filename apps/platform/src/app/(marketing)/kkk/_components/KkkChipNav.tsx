import Link from 'next/link'

export interface KkkChipNavCategory {
  slug: string
  title: string
}

/**
 * Link-based chip navigation for the KKK hub and category pages. The
 * packages/ui ChipNav is a callback-driven filter control, so routing chips
 * are plain anchors styled to match it (active chip = primary fill,
 * aria-current per design 08).
 */
export function KkkChipNav({
  categories,
  activeSlug,
}: {
  categories: KkkChipNavCategory[]
  activeSlug?: string
}) {
  return (
    <nav aria-label="KKK kategooriad">
      <div className="flex flex-row gap-2 overflow-x-auto flex-nowrap pb-1">
        {categories.map((category) => {
          const active = category.slug === activeSlug
          return (
            <Link
              key={category.slug}
              href={`/kkk/${category.slug}`}
              aria-current={active ? 'page' : undefined}
              className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-pill px-4 py-2 text-bodySm font-semibold transition-colors duration-hover ease-hover motion-reduce:transition-none ${
                active
                  ? 'bg-primary text-inkInverse'
                  : 'border border-border bg-bgMist text-ink hover:bg-primaryLight'
              }`}
            >
              {category.title}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
