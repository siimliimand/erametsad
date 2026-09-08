import { PageBlocks, type LotCardProps, type PageBlockView } from '@erametsad/ui'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { parseBlockConfig } from '@/lib/content/blocks'
import { pageBlockTypes, type PageBlockType } from '@/lib/data/schema'

const ctaLink = { label: 'Vaata oksjoneid', href: '/oksjonid' }

const validConfigs: Record<PageBlockType, unknown> = {
  hero: {
    kicker: 'Metsa müük',
    heading: 'Müü oma mets hoolitsetult',
    body: 'Võtame kogu protsessi enda kanda.',
    image: '/uploads/hero.jpg',
    primaryCta: ctaLink,
  },
  text: { heading: 'Mis me teeme', body: 'Esimene lõik.\n\nTeine lõik.' },
  cards: {
    heading: 'Kuidas müük käib',
    intro: 'Kolm lihtsat sammu.',
    items: [{ title: 'Raieõigus', description: 'Esita pakkumus\nJälgige oksjonit', href: '/oksjonid' }],
  },
  accordion: {
    heading: 'Protsess',
    items: [{ title: 'Kuidas müük käib?', content: 'Vali objekt ja esita pakkumus.' }],
  },
  form: { heading: 'Küsi hinnapakkumist', description: 'Vastame kahe tööpäeva jooksul.', slug: 'metsa-hindamine' },
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

const lot = (title: string): LotCardProps => ({
  image: { src: '/uploads/lot.jpg', alt: title },
  title,
  alghind: 12500,
  county: 'Tartumaa',
  area: 12.5,
  endsAt: '2026-12-01T12:00:00Z',
  status: 'active',
})

function view(type: PageBlockType, config: unknown, id: string): PageBlockView {
  return { id, type, config }
}

function renderHtml(blocks: readonly PageBlockView[], tickerLots: readonly LotCardProps[] = []): string {
  return renderToString(<PageBlocks blocks={blocks} tickerLots={tickerLots} />)
}

function parsedView(type: PageBlockType, id: string): PageBlockView {
  return view(type, parseBlockConfig(type, validConfigs[type]), id)
}

describe('PageBlocks per-type rendering', () => {
  it('renders a hero with kicker, texts, image and both CTAs', () => {
    const html = renderHtml([
      view('hero', parseBlockConfig('hero', validConfigs.hero), 'hero-1'),
    ])

    expect(html).toContain('Metsa müük')
    expect(html).toContain('<h1')
    expect(html).toContain('Müü oma mets hoolitsetult')
    expect(html).toContain('Võtame kogu protsessi enda kanda.')
    expect(html).toContain('src="/uploads/hero.jpg"')
    expect(html).toContain('href="/oksjonid"')
    expect(html).toContain('Vaata oksjoneid')
  })

  it('renders a text block with heading and blank-line separated paragraphs', () => {
    const html = renderHtml([parsedView('text', 'text-1')])

    expect(html).toContain('Mis me teeme')
    expect(html).toContain('<p>Esimene lõik.</p>')
    expect(html).toContain('<p>Teine lõik.</p>')
  })

  it('renders cards with heading, intro, linked titles and description bullets', () => {
    const html = renderHtml([parsedView('cards', 'cards-1')])

    expect(html).toContain('Kuidas müük käib')
    expect(html).toContain('Kolm lihtsat sammu.')
    expect(html).toContain('<a href="/oksjonid"')
    expect(html).toContain('Raieõigus')
    expect(html).toContain('<li>Esita pakkumus</li>')
    expect(html).toContain('<li>Jälgige oksjonit</li>')
  })

  it('renders accordion items with their hidden content in the markup', () => {
    const html = renderHtml([parsedView('accordion', 'accordion-1')])

    expect(html).toContain('Protsess')
    expect(html).toContain('Kuidas müük käib?')
    expect(html).toContain('Vali objekt ja esita pakkumus.')
    expect(html).toContain('aria-expanded="false"')
  })

  it('renders a form block with the lead form fields', () => {
    const html = renderHtml([parsedView('form', 'form-1')])

    expect(html).toContain('Küsi hinnapakkumist')
    expect(html).toContain('Vastame kahe tööpäeva jooksul.')
    expect(html).toContain('Nimi')
    expect(html).toContain('Telefon')
    expect(html).toContain('Nõustun andmete töötlemisega')
    expect(html).toContain('Saada')
  })

  it('renders the ticker empty state without lots', () => {
    const html = renderHtml([parsedView('ticker', 'ticker-1')])

    expect(html).toContain('Aktiivsed oksjonid')
    expect(html).toContain('Kõik oksjonid')
    expect(html).toContain('Hetkel aktiivseid oksjoneid pole')
  })

  it('slices ticker lots to the block limit', () => {
    const config = parseBlockConfig('ticker', { heading: 'Aktiivsed oksjonid', limit: 1 })
    const html = renderHtml(
      [view('ticker', config, 'ticker-1')],
      [lot('Raieõigus Tartumaal'), lot('Metskinnistu Võrumaal')],
    )

    expect(html).toContain('Raieõigus Tartumaal')
    expect(html).not.toContain('Metskinnistu Võrumaal')
  })

  it('renders stats items as value and label pairs', () => {
    const html = renderHtml([parsedView('stats', 'stats-1')])

    expect(html).toContain('Usaldus arvudes')
    expect(html).toContain('350+')
    expect(html).toContain('müüdud objekti')
  })

  it('renders a CTA band with body and action link', () => {
    const html = renderHtml([parsedView('cta', 'cta-1')])

    expect(html).toContain('Valmis müüma?')
    expect(html).toContain('Võtke täna ühendust.')
    expect(html).toContain('href="/oksjonid"')
    expect(html).toContain('Vaata oksjoneid')
  })

  it('renders testimonials with quote, author and role', () => {
    const html = renderHtml([parsedView('testimonials', 'testimonials-1')])

    expect(html).toContain('Kliendilood')
    expect(html).toContain('Müük läks sujuvalt.')
    expect(html).toContain('Mari Maasikas')
    expect(html).toContain('Metsaomanik')
  })

  it('renders FAQ items as accordion entries', () => {
    const html = renderHtml([parsedView('faq', 'faq-1')])

    expect(html).toContain('Korduma kippuvad küsimused')
    expect(html).toContain('Kas raie on lubatud?')
    expect(html).toContain('Jah, vastavalt majandusplaanile.')
    expect(html).toContain('aria-expanded="false"')
  })
})

describe('PageBlocks degradation', () => {
  it('skips an unknown block type but keeps valid neighbours in order', () => {
    const html = renderHtml([
      parsedView('text', 'korras-1'),
      { id: 'tundmatu', type: 'banner', config: { heading: 'Reklaam' } },
      parsedView('cta', 'korras-2'),
    ])

    expect(html).toContain('Mis me teeme')
    expect(html).toContain('Valmis müüma?')
    expect(html).not.toContain('Reklaam')
    expect(html.indexOf('Mis me teeme')).toBeLessThan(html.indexOf('Valmis müüma?'))
  })

  it('skips a block whose config misses a required field', () => {
    const html = renderHtml([
      { id: 'katki-hero', type: 'hero', config: { heading: 'Pealkiri ilma nuputa' } },
      parsedView('text', 'korras'),
    ])

    expect(html).not.toContain('Pealkiri ilma nuputa')
    expect(html).toContain('Mis me teeme')
  })

  it('renders an empty block list to nothing', () => {
    expect(renderHtml([])).toBe('')
  })
})

describe('registry and renderer contract', () => {
  it.each([...pageBlockTypes])('renders a valid %s config from the registry', (type) => {
    const html = renderHtml([parsedView(type, `leping-${type}`)])

    expect(html.length).toBeGreaterThan(0)
  })
})
