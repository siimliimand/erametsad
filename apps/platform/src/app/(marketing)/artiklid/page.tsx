import { ArtiklidHub } from './_components/ArtiklidHub'
import { buildMetadata } from '../_lib/seo'

// See kkk/page.tsx: force-dynamic keeps DB-less CI builds green; D7's
// revalidate = 3600 applies once build-time D1 seeding exists.
export const dynamic = 'force-dynamic'

export const metadata = buildMetadata({
  title: 'Artiklid ja uudised',
  description:
    'Uudised, kliendilood ja teadmised metsa müügiks oksjonil — raieõigusest hindamiseni.',
  path: '/artiklid',
})

interface ArtiklidPageProps {
  searchParams: Promise<{ q?: string; page?: string }>
}

export default async function ArtiklidPage({ searchParams }: ArtiklidPageProps) {
  const { q, page } = await searchParams
  return <ArtiklidHub q={q} pageParam={page} />
}
