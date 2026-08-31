import type { Metadata } from 'next'

import { ArtiklidHub } from '../_components/ArtiklidHub'
import { findArticleCategory } from '../_lib/categories'

// See kkk/page.tsx: force-dynamic keeps DB-less CI builds green; D7's
// revalidate = 3600 applies once build-time D1 seeding exists.
export const dynamic = 'force-dynamic'

// Static category route: the same hub, prefilled with one category and the
// chip marked active. The category slug must match a seeded tag value.
const CATEGORY = findArticleCategory('klientide-lood')

export const metadata: Metadata = {
  title: 'Artiklid — Kliendilood',
  description: 'Kliendilood metsaomanikest, kes müüsid oma metsa oksjonil.',
  alternates: { canonical: '/artiklid/klientide-lood' },
}

export default function KlientideLoodPage() {
  if (!CATEGORY) return null
  return <ArtiklidHub activeSlug={CATEGORY.slug} category={CATEGORY} />
}
