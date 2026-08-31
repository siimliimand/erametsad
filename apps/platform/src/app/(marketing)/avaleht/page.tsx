import type { Metadata } from 'next'

export const revalidate = 3600

// The default host rewrites '/' to this route (see host-areas.ts), so the
// canonical URL is the site root, not '/avaleht'. Task 3.1 replaces the body.
export const metadata: Metadata = {
  alternates: {
    canonical: '/',
  },
}

export default function AvalehtPage() {
  return (
    <main>
      <h1>Avaleht</h1>
    </main>
  )
}
