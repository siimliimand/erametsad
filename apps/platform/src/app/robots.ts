import type { MetadataRoute } from 'next'

import { DEFAULT_HOSTNAME } from '@/lib/routing/host-areas'

// Shared path (host-areas.ts SHARED_PATHS): both hosts serve robots.txt
// identically, so the sitemap pointer uses the canonical marketing host.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin',
          '/api',
          '/user',
          '/login',
          '/register',
          '/reset-password',
          '/select-profile',
          '/update-password',
          '/lepingud/raamleping',
          '/lepingud/oksjonileping',
        ],
      },
    ],
    sitemap: `https://${DEFAULT_HOSTNAME}/sitemap.xml`,
  }
}
