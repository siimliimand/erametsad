import { describe, expect, it } from 'vitest'

import {
  buildArticleJsonLd,
  buildBreadcrumbJsonLd,
  buildCollectionPageJsonLd,
  buildFaqPageJsonLd,
  buildHowToJsonLd,
  buildItemListJsonLd,
  buildOrganizationJsonLd,
  buildServiceJsonLd,
  toJsonLdScript,
} from '../jsonld'

// base-url.ts resolves the origin from NEXT_PUBLIC_APP_URL when it already
// serves the default host, otherwise from the routing constant. Tests run
// without the env var, so every URL below canonicalizes to the default host.
const ORIGIN = 'https://erametsad.ww0.dev'

describe('toJsonLdScript', () => {
  it('stringifies the payload and escapes < so CMS strings cannot close the script tag', () => {
    const script = toJsonLdScript({ name: 'Mets </script><script>alert(1)</script>' })
    // Every raw < is escaped, so no closing tag can appear in the output.
    expect(script).not.toContain('</script>')
    expect(script).toContain('\\u003c/script>')
    // The escape is reversible: unescaping restores the original payload.
    expect(JSON.parse(script.replace(/\\u003c/g, '<'))).toEqual({
      name: 'Mets </script><script>alert(1)</script>',
    })
  })
})

describe('buildOrganizationJsonLd', () => {
  it('builds the full organization with address and sameAs', () => {
    expect(
      buildOrganizationJsonLd({
        name: 'Erametsad OÜ',
        url: `${ORIGIN}/`,
        address: 'Tartu mnt 1, Tartu',
        sameAs: ['https://facebook.com/erametsad', 'https://instagram.com/erametsad'],
      }),
    ).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Erametsad OÜ',
      url: `${ORIGIN}/`,
      address: { '@type': 'PostalAddress', streetAddress: 'Tartu mnt 1, Tartu', addressCountry: 'EE' },
      sameAs: ['https://facebook.com/erametsad', 'https://instagram.com/erametsad'],
    })
  })

  it('omits address when null and sameAs when empty', () => {
    const org = buildOrganizationJsonLd({ name: 'Eametsad', url: `${ORIGIN}/`, address: null, sameAs: [] })
    expect(org).not.toHaveProperty('address')
    expect(org).not.toHaveProperty('sameAs')
  })
})

describe('buildServiceJsonLd', () => {
  it('fills the Eametsad provider and Eesti areaServed, keeping optional fields only when set', () => {
    expect(
      buildServiceJsonLd({
        name: 'Raieõiguse müük',
        description: 'Müü raieõigus oksjonil',
        url: `${ORIGIN}/teenused/raieoiguse-muuk`,
        offers: { price: 0, priceCurrency: 'EUR', description: 'Tasuta konsultatsioon' },
      }),
    ).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: 'Raieõiguse müük',
      description: 'Müü raieõigus oksjonil',
      areaServed: 'Eesti',
      provider: { '@type': 'Organization', name: 'Eametsad', url: ORIGIN },
      url: `${ORIGIN}/teenused/raieoiguse-muuk`,
      offers: { '@type': 'Offer', price: 0, priceCurrency: 'EUR', description: 'Tasuta konsultatsioon' },
    })

    const minimal = buildServiceJsonLd({ name: 'Hindamine' })
    expect(minimal).not.toHaveProperty('description')
    expect(minimal).not.toHaveProperty('url')
    expect(minimal).not.toHaveProperty('offers')
  })
})

describe('buildBreadcrumbJsonLd', () => {
  it('numbers positions from 1 and resolves every path to the marketing host', () => {
    const list = buildBreadcrumbJsonLd([
      { name: 'Avaleht', path: '/' },
      { name: 'Teenused', path: '/teenused' },
      { name: 'Hindamine', path: '/teenused/hindamine' },
    ])
    expect(list).toEqual({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Avaleht', item: ORIGIN },
        { '@type': 'ListItem', position: 2, name: 'Teenused', item: `${ORIGIN}/teenused` },
        { '@type': 'ListItem', position: 3, name: 'Hindamine', item: `${ORIGIN}/teenused/hindamine` },
      ],
    })
  })
})

describe('buildFaqPageJsonLd', () => {
  it('maps entries to Question entities under the page URL', () => {
    expect(
      buildFaqPageJsonLd(
        [
          { question: 'Kui kaua oksjon kestab?', answer: '7–14 päeva.' },
          { question: 'Kas hind sisaldab käibemaksu?', answer: 'Jah.' },
        ],
        `${ORIGIN}/kkk`,
      ),
    ).toEqual({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      url: `${ORIGIN}/kkk`,
      mainEntity: [
        {
          '@type': 'Question',
          name: 'Kui kaua oksjon kestab?',
          acceptedAnswer: { '@type': 'Answer', text: '7–14 päeva.' },
        },
        {
          '@type': 'Question',
          name: 'Kas hind sisaldab käibemaksu?',
          acceptedAnswer: { '@type': 'Answer', text: 'Jah.' },
        },
      ],
    })
  })
})

describe('buildHowToJsonLd', () => {
  it('numbers steps in order', () => {
    expect(
      buildHowToJsonLd({
        name: 'Metsa müük oksjonil',
        description: 'Kolm sammu müügini.',
        steps: [
          { title: 'Eeltöö', text: 'Konsultatsioon ja dokumendid.' },
          { title: 'Oksjon', text: 'Pakkumised portaalis.' },
          { title: 'Tulemus', text: 'Lepingu sõlmimine.' },
        ],
      }),
    ).toEqual({
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: 'Metsa müük oksjonil',
      description: 'Kolm sammu müügini.',
      step: [
        { '@type': 'HowToStep', position: 1, name: 'Eeltöö', text: 'Konsultatsioon ja dokumendid.' },
        { '@type': 'HowToStep', position: 2, name: 'Oksjon', text: 'Pakkumised portaalis.' },
        { '@type': 'HowToStep', position: 3, name: 'Tulemus', text: 'Lepingu sõlmimine.' },
      ],
    })
  })
})

describe('buildItemListJsonLd', () => {
  it('numbers plain name items from 1', () => {
    expect(
      buildItemListJsonLd([{ name: 'Raieõigus' }, { name: 'Metskinnistu' }]),
    ).toEqual({
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Raieõigus' },
        { '@type': 'ListItem', position: 2, name: 'Metskinnistu' },
      ],
    })
  })
})

describe('buildCollectionPageJsonLd', () => {
  it('resolves the collection URL on the marketing host', () => {
    expect(
      buildCollectionPageJsonLd({ name: 'Artiklid', path: '/artiklid' }),
    ).toEqual({
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'Artiklid',
      url: `${ORIGIN}/artiklid`,
    })
  })
})

describe('buildArticleJsonLd', () => {
  it('adds datePublished and author only when present, and always the publisher', () => {
    const full = buildArticleJsonLd({
      headline: 'Metsa hind 2026',
      path: '/artiklid/metsa-hind',
      publishedAt: '2026-03-01T00:00:00.000Z',
      author: 'Mari Mets',
    })
    expect(full).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: 'Metsa hind 2026',
      datePublished: '2026-03-01T00:00:00.000Z',
      author: { '@type': 'Person', name: 'Mari Mets' },
      mainEntityOfPage: `${ORIGIN}/artiklid/metsa-hind`,
      publisher: { '@type': 'Organization', name: 'Eametsad', url: ORIGIN },
    })

    const minimal = buildArticleJsonLd({ headline: 'Uudis', path: '/artiklid/uudis' })
    expect(minimal).not.toHaveProperty('datePublished')
    expect(minimal).not.toHaveProperty('author')
    expect(minimal.publisher).toEqual({
      '@type': 'Organization',
      name: 'Eametsad',
      url: ORIGIN,
    })
  })
})
