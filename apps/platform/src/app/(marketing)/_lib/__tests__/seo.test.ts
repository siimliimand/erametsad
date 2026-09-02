import { describe, expect, it, vi } from 'vitest'

// base-url.ts reads NEXT_PUBLIC_APP_URL once at import time. Pin it to the
// default host so the expected canonical origin is deterministic even when
// a CI environment exports a different value.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_APP_URL = 'https://erametsad.ww0.dev'
})

import { buildMetadata } from '../seo'

const ORIGIN = 'https://erametsad.ww0.dev'

describe('buildMetadata', () => {
  it('resolves canonical and og:url to the marketing host for every path', () => {
    const metadata = buildMetadata({
      title: 'Küsimused ja vastused',
      description: 'Kõige sagedasemad küsimused.',
      path: '/kkk',
    })

    expect(metadata.alternates).toEqual({ canonical: `${ORIGIN}/kkk` })
    expect(metadata.openGraph).toEqual({
      title: 'Küsimused ja vastused',
      description: 'Kõige sagedasemad küsimused.',
      url: `${ORIGIN}/kkk`,
      siteName: 'Erametsad',
      locale: 'et_EE',
      type: 'website',
    })
  })

  it('canonicalizes the site root to the bare origin', () => {
    const metadata = buildMetadata({
      title: 'Erametsad — metsa ja raieõiguse müük oksjonil',
      description: 'Metsa müük oksjonil.',
      path: '/',
    })
    expect(metadata.alternates).toEqual({ canonical: ORIGIN })
    expect(metadata.openGraph?.url).toBe(ORIGIN)
  })

  it('lets the layout own the title unless absoluteTitle is requested', () => {
    const templated = buildMetadata({
      title: 'Kontakt',
      description: 'Kirjuta meile.',
      path: '/kontakt',
    })
    expect(templated.title).toBe('Kontakt')

    const absolute = buildMetadata({
      title: 'Erametsad — metsa ja raieõiguse müük oksjonil',
      description: 'Metsa müük oksjonil.',
      path: '/',
      absoluteTitle: true,
    })
    expect(absolute.title).toEqual({
      absolute: 'Erametsad — metsa ja raieõiguse müük oksjonil',
    })
  })

  it('passes the OpenGraph type through for articles', () => {
    const metadata = buildMetadata({
      title: 'Metsa hind 2026',
      description: 'Ülevaade.',
      path: '/artiklid/metsa-hind',
      ogType: 'article',
    })
    expect(metadata.openGraph).toMatchObject({ type: 'article' })
  })
})
