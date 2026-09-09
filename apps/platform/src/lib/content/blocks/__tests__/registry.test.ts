import { describe, expect, it } from 'vitest'

import { blockRegistry, getBlockTypeDefinition, getBlockTypeLabel, listBlockTypes } from '../registry'
import type { BlockConfig } from '../registry'
import {
  BlockConfigError,
  parseBlockConfig,
  parseBlockConfigJson,
  safeParseBlockConfig,
  serializeBlockConfig,
} from '../serialize'

import { pageBlockTypes, type PageBlockType } from '@/lib/data/schema'

const ctaLink = { label: 'Küsi pakkumist', href: '/kontakt' }

const validRawConfigs: Record<PageBlockType, unknown> = {
  hero: {
    kicker: 'Metsa müük',
    heading: 'Müü oma mets hoolitsetult',
    body: 'Võtame kogu protsessi enda kanda.',
    overlayStrength: 40,
    image: '/uploads/hero.jpg',
    primaryCta: { label: 'Vaata oksjoneid', href: '/oksjonid' },
    secondaryCta: ctaLink,
  },
  text: { heading: 'Mis me teeme', body: 'Esimene lõik.\n\nTeine lõik.' },
  cards: {
    heading: 'Kuidas müük käib',
    intro: 'Kolm lihtsat sammu.',
    columns: 3,
    items: [
      { title: 'Raieõigus', icon: 'axe', description: 'Esita pakkumus\nJälgige oksjonit', href: '/oksjonid' },
      { title: 'Hindamine', icon: 'coins' },
      { title: 'Lepingu sõlmimine', icon: 'file-text' },
    ],
  },
  accordion: {
    heading: 'Protsess',
    items: [
      { title: 'Kuidas see käib?', content: 'Vali objekt ja esita pakkumus.', defaultOpen: true },
    ],
  },
  form: {
    heading: 'Küsi hinnapakkumist',
    description: 'Vastame kahe tööpäeva jooksul.',
    type: 'kava',
    paigutus: 'heledal',
    slug: 'metsa-hindamine',
  },
  ticker: {
    heading: 'Aktiivsed oksjonid',
    linkLabel: 'Kõik oksjonid',
    linkHref: '/oksjonid',
    limit: 3,
    objectType: 'raieoigus',
    autoRefreshSeconds: 30,
  },
  stats: {
    heading: 'Usaldus arvudes',
    items: [
      { value: '350', label: 'müüdud objekti', suffix: '+', source: 'staatiline' },
    ],
  },
  cta: { heading: 'Valmis müüma?', body: 'Võtke täna ühendust.', cta: ctaLink, style: 'amber' },
  testimonials: { heading: 'Kliendilood', limit: 3 },
  faq: {
    heading: 'Korduma kippuvad küsimused',
    items: [{ question: 'Kas raie on lubatud?', answer: 'Jah, vastavalt majandusplaanile.' }],
  },
}

const invalidRawConfigs: Record<PageBlockType, unknown[]> = {
  hero: [
    {},
    { heading: 'Pealkiri' },
    { primaryCta: ctaLink },
    { heading: 42, primaryCta: ctaLink },
    { heading: 'Pealkiri', primaryCta: { label: '', href: '/oksjonid' } },
    { heading: 'Pealkiri', primaryCta: { label: 'OK', href: 99 } },
    { heading: '   ', primaryCta: ctaLink },
    { heading: 'Pealkiri', primaryCta: ctaLink, overlayStrength: 81 },
    { heading: 'Pealkiri', primaryCta: ctaLink, overlayStrength: -1 },
    { heading: 'Pealkiri', primaryCta: ctaLink, overlayStrength: 12.5 },
    { heading: 'Pealkiri', primaryCta: ctaLink, body: 'a'.repeat(301) },
  ],
  text: [{}, { heading: 'Pealkiri' }, { body: '' }, { body: 123 }],
  cards: [
    {},
    { items: [] },
    { items: [{ title: '' }] },
    { items: [{ title: 'Kaart' }], columns: 5 },
    { heading: 1, items: [{ title: 'Kaart' }] },
    { items: [{ title: 'Kaart' }, { title: 'Ikoon' }, { title: 'Kolmas' }, { title: 'Neljas' }] },
    { items: [{ title: 'Kaart', icon: 'rocket' }] },
  ],
  accordion: [
    {},
    { items: [] },
    { items: [{ title: 'Rida' }] },
    { items: [{ title: 'Rida', content: 7 }] },
    { items: [{ title: 'Rida', content: 'Sisu', defaultOpen: 'jah' }] },
  ],
  form: [
    {},
    { heading: 'Vorm' },
    { slug: '' },
    { slug: 7 },
    { slug: 'kontakt', type: 'muu' },
    { slug: 'kontakt', paigutus: 'keskel' },
  ],
  ticker: [
    { heading: 'Ticker', limit: 0 },
    { heading: 'Ticker', limit: 1 },
    { heading: 'Ticker', limit: 9 },
    { heading: 'Ticker', limit: 1.5 },
    { heading: 9 },
    { heading: 'Ticker', objectType: 'kinnistud' },
    { heading: 'Ticker', autoRefreshSeconds: -5 },
    { heading: 'Ticker', autoRefreshSeconds: 3601 },
  ],
  stats: [
    {},
    { items: [] },
    { items: [{ value: 5, label: 'külast' }] },
    { items: [{ value: '350+', label: '' }] },
    { items: [{ value: '350', label: 'külast', suffix: 'kr' }] },
    { items: [{ value: '350', label: 'külast', source: 'wiki' }] },
  ],
  cta: [{}, { cta: ctaLink }, { heading: '', cta: ctaLink }, { heading: 'CTA' }, { heading: 'CTA', cta: ctaLink, style: 'sinine' }],
  testimonials: [
    { heading: 'Kliendilood', limit: 0 },
    { heading: 'Kliendilood', limit: 13 },
    { heading: 'Kliendilood', limit: 2.5 },
  ],
  faq: [{}, { items: [] }, { items: [{ question: 'Küsimus?' }] }, { items: [{ question: 'Küsimus?', answer: '' }] }],
}

function parseResult(type: PageBlockType, raw: unknown) {
  return safeParseBlockConfig(type, raw)
}

function parsedData(type: PageBlockType, raw: unknown): BlockConfig {
  return parseBlockConfig(type, raw)
}

describe('block registry structure', () => {
  it('covers exactly the DB page block types, so unknown types have no contract', () => {
    expect(Object.keys(blockRegistry).sort()).toEqual([...pageBlockTypes].sort())
  })

  it('gives every type a schema, an Estonian label and Estonian meta', () => {
    for (const definition of listBlockTypes()) {
      expect(typeof definition.schema.safeParse).toBe('function')
      expect(definition.label.length).toBeGreaterThan(0)
      expect(definition.meta.description.length).toBeGreaterThan(0)
      expect(definition.meta.icon.length).toBeGreaterThan(0)
    }
  })

  it('exposes the Estonian admin labels', () => {
    expect(getBlockTypeLabel('hero')).toBe('Hero päis')
    expect(getBlockTypeLabel('cards')).toBe('Kaardid')
    expect(getBlockTypeLabel('faq')).toBe('KKK')
    expect(getBlockTypeDefinition('cta').label).toBe('CTA-riba')
  })

  it('lists all ten types', () => {
    expect(listBlockTypes()).toHaveLength(pageBlockTypes.length)
  })
})

describe('per-type config validation', () => {
  it.each([...pageBlockTypes])('accepts a valid %s config', (type) => {
    const result = parseResult(type, validRawConfigs[type])
    expect(result.success).toBe(true)
  })

  it.each([...pageBlockTypes])('rejects invalid %s configs with typed issues', (type) => {
    for (const raw of invalidRawConfigs[type]) {
      const result = parseResult(type, raw)
      expect(result.success, `${type} rejects ${JSON.stringify(raw)}`).toBe(false)
      if (!result.success) {
        expect(result.error).toBeInstanceOf(BlockConfigError)
        expect(result.error.blockType).toBe(type)
        expect(result.error.issues.length).toBeGreaterThan(0)
        expect(result.error.issues[0]?.message.length).toBeGreaterThan(0)
      }
    }
  })

  it('rejects oversized values at the schema caps', () => {
    expect(parseResult('hero', { heading: 'a'.repeat(201), primaryCta: ctaLink }).success).toBe(false)

    const threeCards = Array.from({ length: 3 }, (_, index) => ({ title: `Kaart ${String(index + 1)}` }))
    expect(parseResult('cards', { items: threeCards }).success).toBe(true)
    const fourCards = [...threeCards, { title: 'Kaart 4' }]
    expect(parseResult('cards', { items: fourCards }).success).toBe(false)

    expect(parseResult('ticker', { limit: 8 }).success).toBe(true)
    expect(parseResult('ticker', { limit: 9 }).success).toBe(false)
    expect(parseResult('ticker', { limit: 1 }).success).toBe(false)

    expect(parseResult('testimonials', { limit: 12 }).success).toBe(true)
    expect(parseResult('testimonials', { limit: 13 }).success).toBe(false)

    expect(
      parseResult('hero', { heading: 'Pealkiri', primaryCta: ctaLink, body: 'a'.repeat(300) }).success,
    ).toBe(true)
    expect(
      parseResult('hero', { heading: 'Pealkiri', primaryCta: ctaLink, body: 'a'.repeat(301) }).success,
    ).toBe(false)
  })

  it('applies schema defaults for the spec-11 settings', () => {
    const hero = parsedData('hero', { heading: 'Hero', primaryCta: ctaLink })
    expect(hero).toMatchObject({ overlayStrength: 80 })

    const cards = parsedData('cards', { items: [{ title: 'Kaart' }] })
    expect(cards).toMatchObject({ columns: 3 })

    const ticker = parsedData('ticker', {})
    expect(ticker).toMatchObject({ limit: 4, objectType: 'koik', autoRefreshSeconds: 0 })

    const form = parsedData('form', { slug: 'kontakt' })
    expect(form).toMatchObject({ type: 'pohivorm', paigutus: 'kaardil' })

    const stats = parseBlockConfig('stats', { items: [{ value: '350', label: 'müüdud' }] })
    expect(stats.items[0]).toMatchObject({ source: 'staatiline' })

    const cta = parsedData('cta', { heading: 'CTA', cta: ctaLink })
    expect(cta).toMatchObject({ style: 'green' })

    const testimonials = parsedData('testimonials', {})
    expect(testimonials).toMatchObject({ limit: 6 })
  })

  it('keeps the spec-11 enums closed', () => {
    expect(
      parseBlockConfig('cards', { items: [{ title: 'Kaart', icon: 'axe' }] }).items[0],
    ).toMatchObject({ icon: 'axe' })
    expect(parseResult('cards', { items: [{ title: 'Kaart', icon: 'raket' }] }).success).toBe(false)

    expect(parseResult('stats', { items: [{ value: '5', label: 'l', suffix: 'kr' }] }).success).toBe(false)
    expect(
      parseBlockConfig('stats', { items: [{ value: '5', label: 'l', suffix: '€' }] }).items[0],
    ).toMatchObject({ suffix: '€' })

    expect(
      parseResult('ticker', { objectType: 'metsa' }).success,
    ).toBe(false)
    expect(parsedData('ticker', { objectType: 'kinnistu' })).toMatchObject({ objectType: 'kinnistu' })

    expect(parseResult('cta', { heading: 'CTA', cta: ctaLink, style: 'sinine' }).success).toBe(false)
    expect(parsedData('cta', { heading: 'CTA', cta: ctaLink, style: 'amber' })).toMatchObject({
      style: 'amber',
    })
  })

  it('records the accordion default-open flag per item', () => {
    const accordion = parseBlockConfig('accordion', {
      items: [{ title: 'Rida', content: 'Sisu', defaultOpen: true }],
    })
    expect(accordion.items[0]).toMatchObject({ defaultOpen: true })

    const closed = parseBlockConfig('accordion', { items: [{ title: 'Rida', content: 'Sisu' }] })
    expect(closed.items[0]?.defaultOpen).toBeUndefined()
  })

  it('sources testimonials from the collection through heading and limit only', () => {
    const config = parsedData('testimonials', { heading: 'Kliendilood', limit: 4 })
    expect(config).toEqual({ heading: 'Kliendilood', limit: 4 })
    // Manual items are gone: the schema strips them instead of validating.
    expect(parsedData('testimonials', { items: [{ quote: 'Tsitaat', author: 'Mari' }] })).toEqual({
      limit: 6,
    })
  })

  it('trims text fields and rejects whitespace-only required text', () => {
    const hero = parsedData('hero', { heading: '  Tere  ', primaryCta: ctaLink })
    expect(hero).toMatchObject({ heading: 'Tere' })

    expect(parseResult('hero', { heading: '   ', primaryCta: ctaLink }).success).toBe(false)
  })

  it('reports Estonian issue messages at dotted paths', () => {
    const result = parseResult('hero', {})
    expect(result.success).toBe(false)
    if (result.success) return

    const headingIssue = result.error.issues.find((issue) => issue.path === 'heading')
    expect(headingIssue?.message).toBe('Hero pealkiri on kohustuslik.')

    const ctaIssue = result.error.issues.find((issue) => issue.path === 'primaryCta')
    expect(ctaIssue).toBeDefined()
  })

  it('rejects empty item lists with the Estonian builder hint', () => {
    const result = parseResult('cards', { items: [] })
    expect(result.success).toBe(false)
    if (result.success) return

    expect(result.error.issues.some((issue) => issue.message === 'Lisa vähemalt üks kaart.')).toBe(true)

    const faqResult = parseResult('faq', { items: [] })
    expect(faqResult.success).toBe(false)
    if (faqResult.success) return
    expect(faqResult.error.issues.some((issue) => issue.message === 'Lisa vähemalt üks küsimus.')).toBe(true)
  })

  it('throws BlockConfigError from the throwing parse variant', () => {
    expect(() => parseBlockConfig('text', {})).toThrow(BlockConfigError)

    const config = parseBlockConfig('text', { heading: 'Pealkiri', body: 'Sisu' })
    expect(config).toEqual({ heading: 'Pealkiri', body: 'Sisu' })
  })
})

describe('config JSON round trip', () => {
  it.each([...pageBlockTypes])('round-trips a valid %s config through TEXT-JSON', (type) => {
    const config = parsedData(type, validRawConfigs[type])
    const json = serializeBlockConfig(config)
    expect(typeof json).toBe('string')
    expect(parseBlockConfigJson(type, json)).toEqual(config)
  })

  it('returns null for a null or blank column value', () => {
    expect(parseBlockConfigJson('text', null)).toBeNull()
    expect(parseBlockConfigJson('text', '')).toBeNull()
    expect(parseBlockConfigJson('text', '   ')).toBeNull()
  })

  it('throws BlockConfigError on malformed JSON with an Estonian message', () => {
    try {
      parseBlockConfigJson('hero', '{nope')
      expect.unreachable('malformed JSON must throw')
    } catch (error) {
      expect(error).toBeInstanceOf(BlockConfigError)
      const configError = error as BlockConfigError
      expect(configError.blockType).toBe('hero')
      expect(configError.issues[0]).toEqual({ path: '', message: 'Config ei ole kehtiv JSON.' })
    }
  })

  it('throws BlockConfigError when the decoded JSON misses the schema', () => {
    expect(() => parseBlockConfigJson('hero', JSON.stringify({}))).toThrow(BlockConfigError)
    expect(() => parseBlockConfigJson('hero', JSON.stringify({ heading: 1 }))).toThrow(BlockConfigError)
  })
})
