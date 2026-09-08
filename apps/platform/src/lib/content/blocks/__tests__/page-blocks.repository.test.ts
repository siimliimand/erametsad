import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  createSqliteTestDb,
  sqliteBatchRunner,
  type SqliteTestDb,
} from '../../../data/__tests__/sqlite'
import {
  createCoreRepositories,
  nodeIsikukoodCodec,
  type CoreRepositories,
} from '../../../data/repositories'
import { parseBlockConfig, parseBlockConfigJson, serializeBlockConfig } from '../serialize'

import { pageBlockTypes, type PageBlockType } from '@/lib/data/schema'

process.env.ISIKUKOOD_ENCRYPTION_KEY =
  process.env.ISIKUKOOD_ENCRYPTION_KEY ?? 'integration-test-key'

const ctaLink = { label: 'Vaata oksjoneid', href: '/oksjonid' }

const validConfigs: Record<PageBlockType, unknown> = {
  hero: { heading: 'Müü oma mets hoolitsetult', primaryCta: ctaLink },
  text: { heading: 'Mis me teeme', body: 'Esimene lõik.\n\nTeine lõik.' },
  cards: {
    heading: 'Kuidas müük käib',
    items: [{ title: 'Raieõigus', description: 'Esita pakkumus' }],
  },
  accordion: {
    heading: 'Protsess',
    items: [{ title: 'Kuidas see käib?', content: 'Vali objekt ja esita pakkumus.' }],
  },
  form: { heading: 'Küsi hinnapakkumist', slug: 'metsa-hindamine' },
  ticker: { heading: 'Aktiivsed oksjonid', linkLabel: 'Kõik oksjonid', linkHref: '/oksjonid', limit: 3 },
  stats: { heading: 'Usaldus arvudes', items: [{ value: '350+', label: 'müüdud objekti' }] },
  cta: { heading: 'Valmis müüma?', body: 'Võtke täna ühendust.', cta: ctaLink },
  testimonials: {
    heading: 'Kliendilood',
    items: [{ quote: 'Müük läks sujuvalt.', author: 'Mari Maasikas', role: 'Metsaomanik' }],
  },
  faq: {
    heading: 'Korduma kippuvad küsimused',
    items: [{ question: 'Kas raie on lubatud?', answer: 'Jah, vastavalt majandusplaanile.' }],
  },
}

interface BlockSeed {
  readonly type: PageBlockType
  readonly configJson?: string | null
}

let testDb: SqliteTestDb
let repos: CoreRepositories

beforeEach(() => {
  testDb = createSqliteTestDb()
  repos = createCoreRepositories(testDb.database, {
    isikukoodCodec: nodeIsikukoodCodec,
    batch: sqliteBatchRunner(testDb.raw),
  })
})

afterEach(() => {
  testDb.close()
})

async function seedPage(slug: string): Promise<string> {
  const doc = await repos.create({
    collection: 'pages',
    data: { title: `Leht ${slug}`, slug },
  })
  return doc.id
}

async function seedBlocks(pageId: string, blocks: readonly BlockSeed[]): Promise<void> {
  for (const [ordinal, block] of blocks.entries()) {
    await repos.create({
      collection: 'page-blocks',
      data: { pageId, type: block.type, ordinal, configJson: block.configJson ?? null },
    })
  }
}

/** Mirrors the builder action's replace-all write: delete rows, reinsert with 0..n ordinals. */
async function replaceBlocks(pageId: string, blocks: readonly BlockSeed[]): Promise<void> {
  const { docs } = await repos.find({
    collection: 'page-blocks',
    where: { pageId: { equals: pageId } },
    pagination: false,
  })
  for (const doc of docs) {
    await repos.delete({ collection: 'page-blocks', id: doc.id })
  }
  await seedBlocks(pageId, blocks)
}

async function readBlocks(pageId: string): Promise<
  { id: string; type: PageBlockType; ordinal: number; configJson: unknown }[]
> {
  const { docs } = await repos.find({
    collection: 'page-blocks',
    where: { pageId: { equals: pageId } },
    sort: 'ordinal',
    pagination: false,
  })
  return docs.map((doc) => ({
    id: doc.id,
    type: doc.type,
    ordinal: doc.ordinal,
    configJson: doc.configJson,
  }))
}

async function nextVersion(pageId: string): Promise<number> {
  const { docs } = await repos.find({
    collection: 'page-versions',
    where: { pageId: { equals: pageId } },
    sort: '-version',
    limit: 1,
  })
  return (docs[0]?.version ?? 0) + 1
}

describe('page_blocks ordinal integrity', () => {
  it('keeps ordinals contiguous at 0..n after a replace-all write', async () => {
    const pageId = await seedPage('esimene')

    await replaceBlocks(pageId, [
      { type: 'hero', configJson: serializeBlockConfig(parseBlockConfig('hero', validConfigs.hero)) },
      { type: 'text', configJson: serializeBlockConfig(parseBlockConfig('text', validConfigs.text)) },
      { type: 'cta', configJson: serializeBlockConfig(parseBlockConfig('cta', validConfigs.cta)) },
    ])
    await replaceBlocks(pageId, [
      { type: 'stats', configJson: serializeBlockConfig(parseBlockConfig('stats', validConfigs.stats)) },
      { type: 'faq', configJson: serializeBlockConfig(parseBlockConfig('faq', validConfigs.faq)) },
    ])

    const blocks = await readBlocks(pageId)
    expect(blocks.map((block) => block.ordinal)).toEqual([0, 1])
    expect(blocks.map((block) => block.type)).toEqual(['stats', 'faq'])
  })

  it('reads blocks in ordinal order regardless of row insertion order', async () => {
    const pageId = await seedPage('jarjekord')
    const ordered: BlockSeed[] = [
      { type: 'hero' },
      { type: 'text' },
      { type: 'cta' },
    ]

    for (const seed of [...ordered].reverse()) {
      const ordinal = ordered.indexOf(seed)
      await repos.create({
        collection: 'page-blocks',
        data: { pageId, type: seed.type, ordinal },
      })
    }

    const blocks = await readBlocks(pageId)
    expect(blocks.map((block) => block.type)).toEqual(['hero', 'text', 'cta'])
  })

  it('scopes ordinals and rows per page', async () => {
    const firstPage = await seedPage('leht-yks')
    const secondPage = await seedPage('leht-kaks')

    await seedBlocks(firstPage, [{ type: 'hero' }, { type: 'text' }])
    await seedBlocks(secondPage, [{ type: 'faq' }])

    const firstBlocks = await readBlocks(firstPage)
    const secondBlocks = await readBlocks(secondPage)
    expect(firstBlocks.map((block) => block.type)).toEqual(['hero', 'text'])
    expect(secondBlocks.map((block) => block.type)).toEqual(['faq'])
    expect(secondBlocks.map((block) => block.ordinal)).toEqual([0])
  })

  it('rejects a type outside the registry with the schema CHECK error', async () => {
    const pageId = await seedPage('skeem')
    const unknownType = 'banner' as string

    await expect(
      repos.create({
        collection: 'page-blocks',
        data: { pageId, type: unknownType as PageBlockType, ordinal: 0 },
      }),
    ).rejects.toThrow(/page_blocks_type_check/)
  })

  it.each([...pageBlockTypes])(
    'round-trips a validated %s config through the configJson column',
    async (type) => {
      const config = parseBlockConfig(type, validConfigs[type])
      const pageId = await seedPage(`konfig-${type}`)

      await seedBlocks(pageId, [{ type, configJson: serializeBlockConfig(config) }])

      const [block] = await readBlocks(pageId)
      expect(typeof block?.configJson).toBe('string')
      expect(parseBlockConfigJson(type, String(block?.configJson))).toEqual(config)
    },
  )

  it('stores a null config column as null', async () => {
    const pageId = await seedPage('ilma-konfigita')

    await seedBlocks(pageId, [{ type: 'hero', configJson: null }])

    const [block] = await readBlocks(pageId)
    expect(block?.configJson).toBeNull()
  })
})

describe('page_versions snapshot integrity', () => {
  it('creates append-only snapshots with monotonic per-page versions', async () => {
    const pageId = await seedPage('versioonid')
    const snapshotJson = JSON.stringify([
      { type: 'hero', config: parseBlockConfig('hero', validConfigs.hero) },
    ])

    const first = await nextVersion(pageId)
    await repos.create({
      collection: 'page-versions',
      data: { pageId, version: first, snapshotJson },
    })
    const second = await nextVersion(pageId)
    await repos.create({
      collection: 'page-versions',
      data: { pageId, version: second, label: 'Teine avaldamine', snapshotJson },
    })

    const { docs } = await repos.find({
      collection: 'page-versions',
      where: { pageId: { equals: pageId } },
      sort: '-version',
      pagination: false,
    })
    expect(docs.map((doc) => doc.version)).toEqual([second, first])
    expect(docs[0]?.label).toBe('Teine avaldamine')
  })

  it('rejects a duplicate version number for the same page', async () => {
    const pageId = await seedPage('duplikaat')
    await repos.create({
      collection: 'page-versions',
      data: { pageId, version: 1, snapshotJson: '[]' },
    })

    await expect(
      repos.create({
        collection: 'page-versions',
        data: { pageId, version: 1, snapshotJson: '[]' },
      }),
    ).rejects.toThrow(/UNIQUE constraint failed: page_versions\.page_id, page_versions\.version/)
  })

  it('scopes version numbers per page', async () => {
    const firstPage = await seedPage('versioon-yks')
    const secondPage = await seedPage('versioon-kaks')

    await repos.create({
      collection: 'page-versions',
      data: { pageId: firstPage, version: 1, snapshotJson: '[]' },
    })
    await repos.create({
      collection: 'page-versions',
      data: { pageId: secondPage, version: 1, snapshotJson: '[]' },
    })

    const { docs } = await repos.find({
      collection: 'page-versions',
      where: { pageId: { equals: firstPage } },
      pagination: false,
    })
    expect(docs).toHaveLength(1)
  })

  it('round-trips the snapshot payload through the snapshotJson column', async () => {
    const pageId = await seedPage('snapshot')
    const blocks = [
      { type: 'hero', config: parseBlockConfig('hero', validConfigs.hero) },
      { type: 'cards', config: parseBlockConfig('cards', validConfigs.cards) },
    ]

    await repos.create({
      collection: 'page-versions',
      data: { pageId, version: 1, snapshotJson: JSON.stringify(blocks) },
    })

    const { docs } = await repos.find({
      collection: 'page-versions',
      where: { pageId: { equals: pageId } },
      pagination: false,
    })
    const snapshotJson = docs[0]?.snapshotJson
    expect(typeof snapshotJson).toBe('string')
    expect(JSON.parse(String(snapshotJson))).toEqual(blocks)
  })
})
