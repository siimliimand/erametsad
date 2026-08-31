import { HeaderDropdown, type HeaderFaqCategory } from './HeaderDropdown'

import { publicContext } from '@/lib/data/guards'
import { getRepositories } from '@/lib/data/runtime'

async function fetchFaqCategories(): Promise<HeaderFaqCategory[]> {
  try {
    const repositories = await getRepositories(publicContext)
    const { docs } = await repositories.find({
      collection: 'faq-categories',
      sort: 'order',
      pagination: false,
    })
    return docs.map((doc) => ({ slug: doc.slug, title: doc.title }))
  } catch {
    // Build/preview runs without a D1 binding still ship the header; the
    // KKK dropdown degrades to a plain hub link (shell states spec).
    return []
  }
}

// Marketing shell header (design 00-global-shell §1). Skip-link target:
// task 2.4 wires <main id="peasisu"> in (marketing)/layout.tsx.
export async function MarketingHeader() {
  const categories = await fetchFaqCategories()

  return (
    <>
      <a
        href="#peasisu"
        className="sr-only focus:not-sr-only focus:absolute focus:left-xs focus:top-xs focus:z-50 focus:rounded-button focus:bg-primary focus:px-sm focus:py-xs focus:font-heading focus:text-bodySm focus:font-semibold focus:text-inkInverse"
      >
        Otse sisuni
      </a>
      <HeaderDropdown categories={categories} />
    </>
  )
}
