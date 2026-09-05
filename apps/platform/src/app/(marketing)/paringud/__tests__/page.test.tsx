import { createElement, type ReactElement, type ReactNode } from 'react'
import { prerender } from 'react-dom/static'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/link', () => ({
  default: (props: { href: string; 'aria-label'?: string; children?: ReactNode }) =>
    createElement(
      'a',
      { href: props.href, 'aria-label': props['aria-label'] },
      props.children,
    ),
}))

vi.mock('@/lib/data/runtime', () => ({
  getRepositories: vi.fn(),
}))

import ParingudPage from '../page'

import {
  createSqliteTestDb,
  sqliteBatchRunner,
  type SqliteTestDb,
} from '@/lib/data/__tests__/sqlite'
import {
  createCoreRepositories,
  nodeIsikukoodCodec,
  type CoreRepositories,
} from '@/lib/data/repositories'
import { getRepositories } from '@/lib/data/runtime'

process.env.ISIKUKOOD_ENCRYPTION_KEY =
  process.env.ISIKUKOOD_ENCRYPTION_KEY ?? 'paringud-page-test-key'

let testDb: SqliteTestDb
let repos: CoreRepositories

beforeEach(() => {
  testDb = createSqliteTestDb()
  repos = createCoreRepositories(testDb.database, {
    isikukoodCodec: nodeIsikukoodCodec,
    batch: sqliteBatchRunner(testDb.raw),
  })
  vi.mocked(getRepositories).mockImplementation(() => Promise.resolve(repos))
})

afterEach(() => {
  vi.mocked(getRepositories).mockReset()
  testDb.close()
})

// React SSR separates adjacent text nodes with <!-- --> comments; strip
// them so index assertions read like the page text.
function plain(html: string): string {
  return html.replace(/<!--.*?-->/g, '')
}

async function renderPage(): Promise<string> {
  const tree = (await ParingudPage()) as ReactElement
  const { prelude } = await prerender(tree)
  return plain(await new Response(prelude).text())
}

async function seedActivePartners(target: CoreRepositories): Promise<void> {
  await target.create({
    collection: 'partners',
    data: {
      id: 'partner-kava-1',
      name: 'Metsakonsult OÜ',
      serviceTypes: ['kava', 'hooldusraie'],
      capacity: 10,
      active: true,
    },
  })
  await target.create({
    collection: 'partners',
    data: {
      id: 'partner-kava-2',
      name: 'Kavabüroo OÜ',
      serviceTypes: ['kava'],
      capacity: 5,
      active: true,
    },
  })
  await target.create({
    collection: 'partners',
    data: {
      id: 'partner-istutamine-1',
      name: 'Istutusring OÜ',
      serviceTypes: ['istutamine'],
      capacity: 5,
      active: true,
    },
  })
  // Inactive partners must not count toward any service.
  await target.create({
    collection: 'partners',
    data: {
      id: 'partner-inactive',
      name: 'Puhkav OÜ',
      serviceTypes: ['kava', 'hooldusraie', 'istutamine'],
      capacity: 5,
      active: false,
    },
  })
}

describe('paringud hub render smoke', () => {
  it('renders spec blocks in order with anonymized counts from active partners', async () => {
    await seedActivePartners(repos)

    const html = await renderPage()

    const markers = [
      'Teenuste päringud', //                     1. hero
      'Pakkujad vastavad 7 päeva jooksul',
      'Vali sobiv teenus', //                     2. service cards
      'Metsamajanduskava',
      'Kava on raiete ja toetuste alus.',
      'Hooldusraie',
      'Metsa istutamine',
      'Kuidas see toimib?', //                    3. how it works
      'Täida ja saada päring',
      'Erametsad on vahendaja — leping sõlmid otse firmaga',
      'Päringu edastamine on omanikule tasuta', // 4. partner info
      '2 pakkujat', //                            kava: 2 active
      '1 pakkuja', //                             hooldusraie / istutamine: 1 each
    ]
    for (const marker of markers) {
      expect(html).toContain(marker)
    }

    // Spec order: hero < cards < how-it-works < partner info. Only
    // markers unique to one block: the JSON-LD scripts above the hero
    // repeat the service names and the page title.
    const orderMarkers = [
      'Pakkujad vastavad 7 päeva jooksul',
      'Vali sobiv teenus',
      'Kuidas see toimib?',
      'Päringu edastamine on omanikule tasuta',
    ]
    const positions = orderMarkers.map((marker) => html.indexOf(marker))
    for (let index = 1; index < positions.length; index += 1) {
      const previous = positions[index - 1]
      const current = positions[index]
      if (previous === undefined || current === undefined) continue
      expect(current).toBeGreaterThan(previous)
    }

    // Cards link to the per-service request pages.
    expect(html).toContain('href="/paringud/metsamajanduskava"')
    expect(html).toContain('href="/paringud/hooldusraie"')
    expect(html).toContain('href="/paringud/metsa-istutamine"')

    // react-dom/static emits the script payload unescaped.
    expect(html).toContain('"@type":"ItemList"')
    expect(html).toContain('"@type":"BreadcrumbList"')
    // Whole-card links announce the request intent (spec 09 a11y).
    expect(html).toContain('aria-label="Esita päring — Metsamajanduskava"')

    // The hub has no LeadForm (spec 09) and no /liitu link (Phase 5).
    expect(html).not.toContain('name="consent"')
    expect(html).not.toContain('/liitu')
  })

  it('disables every card when the partners table is empty', async () => {
    const html = await renderPage()

    expect(html).toContain('Hetkel pole saadaval')
    expect(html).not.toContain('aria-label="Esita päring — Metsamajanduskava"')
    expect(html).not.toContain('href="/paringud/metsamajanduskava"')
    // Anonymized counts only list services with active partners.
    expect(html).not.toContain('2 pakkujat')
  })

  it('degrades to disabled cards when no repository is reachable', async () => {
    vi.mocked(getRepositories).mockImplementation(() =>
      Promise.reject(new Error('no D1 binding')),
    )

    const html = await renderPage()

    expect(html).toContain('Teenuste päringud')
    expect(html).toContain('Vali sobiv teenus')
    expect(html).toContain('Hetkel pole saadaval')
    expect(html).not.toContain('href="/paringud/hooldusraie"')
  })
})
