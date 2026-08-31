import { createElement, type ReactElement, type ReactNode } from 'react'
import { prerender } from 'react-dom/static'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/link', () => ({
  default: (props: { href: string; children?: ReactNode }) =>
    createElement('a', { href: props.href }, props.children),
}))

vi.mock('next/image', () => ({
  default: (props: { src: string; alt?: string }) =>
    createElement('img', { src: props.src, alt: props.alt }),
}))

// TrustStats wraps its read in unstable_cache; outside a request context
// the passthrough keeps the read live against the seeded repositories.
vi.mock('next/cache', () => ({
  unstable_cache: (fn: unknown) => fn,
}))

vi.mock('@/lib/data/runtime', () => ({
  getRepositories: vi.fn(),
}))

import AvalehtPage from '../page'

import {
  createSqliteTestDb,
  sqliteBatchRunner,
  type SqliteTestDb,
} from '@/lib/data/__tests__/sqlite'
import {
  createCoreRepositories,
  nodeIsikukoodCodec,
  type CoreRepositories,
  type FindOptions,
  type RepositorySlug,
} from '@/lib/data/repositories'
import { getRepositories } from '@/lib/data/runtime'

process.env.ISIKUKOOD_ENCRYPTION_KEY =
  process.env.ISIKUKOOD_ENCRYPTION_KEY ?? 'avaleht-page-test-key'

let testDb: SqliteTestDb
let repos: CoreRepositories

beforeEach(async () => {
  testDb = createSqliteTestDb()
  repos = createCoreRepositories(testDb.database, {
    isikukoodCodec: nodeIsikukoodCodec,
    batch: sqliteBatchRunner(testDb.raw),
  })
  await seedHomeContent(repos)
  vi.mocked(getRepositories).mockImplementation(() => Promise.resolve(repos))
})

afterEach(() => {
  vi.mocked(getRepositories).mockReset()
  testDb.close()
})

// One representative row per DB-backed section, following the repository
// integration-test seeding style (repos.create over migrated SQLite).
async function seedHomeContent(target: CoreRepositories): Promise<void> {
  await target.create({
    collection: 'counties',
    data: { id: 'county-harju', name: 'Harju maakond', code: 'HA' },
  })
  await target.create({
    collection: 'parishes',
    data: { id: 'parish-keila', name: 'Keila vald', county: 'county-harju' },
  })
  await target.create({
    collection: 'auctions',
    data: {
      id: 'ticker-lot-1',
      title: 'Metsavald Keilas',
      slug: 'ticker-lot-1',
      objectType: 'raieoigus',
      minBidCents: 1_500_000,
      status: 'active',
      countyId: 'county-harju',
      parishId: 'parish-keila',
      endsAt: '2026-12-31T12:00:00.000Z',
      cadastres: ['12345:678:9101'],
      species: ['mänd'],
      packageRows: [{ area: 3.2, volume: 540 }],
    },
  })
  await target.create({
    collection: 'settings',
    data: { id: 'settings-1', orgName: 'Erametsad OÜ', orgAddress: 'Tartu mnt 1, Tartu' },
  })
  await target.create({
    collection: 'media',
    data: {
      id: 'media-1',
      filename: 'metsavald.jpg',
      url: 'https://media.erametsad.ww0.dev/metsavald.jpg',
      status: 'published',
    },
  })
  await target.create({
    collection: 'specialists',
    data: {
      id: 'specialist-1',
      name: 'Mari Mets',
      slug: 'mari-mets',
      role: 'Metsaspetsialist',
      phone: '+37251234567',
      active: true,
    },
  })
  await target.create({
    collection: 'articles',
    data: {
      id: 'article-1',
      title: 'Metsa müügi ABC',
      slug: 'metsa-muugi-abc',
      status: 'published',
      publishedAt: '2026-06-15T00:00:00.000Z',
      excerpt: 'Kuidas müügiga alustada.',
      featuredImageId: 'media-1',
      tags: ['nõuanded'],
    },
  })
  await target.create({
    collection: 'statistics-snapshots',
    data: {
      date: '2026-08-01T00:00:00.000Z',
      objectType: 'raieoigus',
      count: 12,
      area: 44.5,
      volume: 620.5,
      eur: 128_000,
    },
  })
  await target.create({
    collection: 'testimonials',
    data: {
      id: 'testimonial-1',
      name: 'Peeter Puu',
      role: 'Metsaomanik',
      content: 'Müük läks kiiresti ja sujuvalt.',
    },
  })
}

// React SSR separates adjacent text nodes with <!-- --> comments; strip
// them so index assertions read like the page text.
function plain(html: string): string {
  return html.replace(/<!--.*?-->/g, '')
}

// The page is an async server component containing a nested async section
// (TrustStats), so the tree is rendered with react-dom/static's prerender,
// which awaits async components, instead of the sync renderToString.
async function renderPage(): Promise<string> {
  const tree = (await AvalehtPage()) as ReactElement
  const { prelude } = await prerender(tree)
  return plain(await new Response(prelude).text())
}

describe('avaleht render smoke with seeded data', () => {
  it('renders every key section in spec order with the seeded rows', async () => {
    const html = await renderPage()

    const markers = [
      'Sinu mets, õigem hind.', // 1. hero
      'Plaanis metsa müük?', // 2. band
      'Aktiivsed oksjonid', // 3. auction ticker
      '12345:678:9101', //    seeded lot card (cadastre headline)
      'Meie kollektiiv', //    4. specialists
      'Mari Mets',
      'Müüdud oksjonit', //   5. trust statistics
      'Kuidas müük käib?', //  6. process
      'Viimased artiklid', //  7. articles
      'Metsa müügi ABC',
      'Uudiskiri', //          8. newsletter
      'Kliendilood', //        9. testimonials
      'Müük läks kiiresti ja sujuvalt.',
      'id="kontaktvorm"', //   10. closing lead form
    ]
    for (const marker of markers) {
      expect(html).toContain(marker)
    }

    // Spec order: hero < ticker < stats < process < articles < newsletter
    // < testimonials < closing form.
    const positions = markers.map((marker) => html.indexOf(marker))
    for (let index = 1; index < positions.length; index += 1) {
      const previous = positions[index - 1]
      const current = positions[index]
      if (previous === undefined || current === undefined) continue
      expect(current).toBeGreaterThan(previous)
    }

    // The closing form section embeds the full lead form.
    expect(html).toContain('name="consent"')
    expect(html).toContain('Saada')

    // The seeded specialist card carries the phone number.
    expect(html).toContain('+37251234567')

    // The organization JSON-LD carries the seeded settings.
    expect(html).toContain('type="application/ld+json"')
    expect(html).toContain('Erametsad OÜ')
  })

  it('still renders every other section when one source rejects', async () => {
    const failing: CoreRepositories = {
      ...repos,
      find: async <C extends RepositorySlug>(findOptions: FindOptions<C>) => {
        if (findOptions.collection === 'testimonials') {
          throw new Error('testimonials source down')
        }
        return repos.find(findOptions)
      },
    }
    vi.mocked(getRepositories).mockImplementation(() => Promise.resolve(failing))

    const html = await renderPage()

    // Degraded section hides instead of crashing the page...
    expect(html).not.toContain('Kliendilood')
    // ...and the rest survives, including the list-driven sections.
    expect(html).toContain('Sinu mets, õigem hind.')
    expect(html).toContain('Aktiivsed oksjonid')
    expect(html).toContain('Müüdud oksjonit')
    expect(html).toContain('Kuidas müük käib?')
    expect(html).toContain('Viimased artiklid')
    expect(html).toContain('Uudiskiri')
    expect(html).toContain('id="kontaktvorm"')
  })

  it('degrades every DB-backed section when no repository is reachable', async () => {
    vi.mocked(getRepositories).mockImplementation(() =>
      Promise.reject(new Error('no D1 binding')),
    )

    const html = await renderPage()

    // Static sections stay...
    expect(html).toContain('Sinu mets, õigem hind.')
    expect(html).toContain('Plaanis metsa müük?')
    expect(html).toContain('Kuidas müük käib?')
    expect(html).toContain('Uudiskiri')
    expect(html).toContain('id="kontaktvorm"')
    // ...while the DB-backed ones hide or fall back.
    expect(html).toContain('Hetkel pole avatud oksjoneid')
    expect(html).not.toContain('Meie kollektiiv')
    expect(html).not.toContain('Viimased artiklid')
    expect(html).not.toContain('Kliendilood')
    expect(html).not.toContain('Müüdud oksjonit')
  })
})
