import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LotCard } from '../components/content/LotCard'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-08-27T12:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

const baseProps = {
  image: { src: '/images/lot.jpg', alt: 'Metsamaa' },
  title: 'Metsamaa Tartumaal',
  alghind: 12500,
  county: 'Tartumaa',
  area: 12.5,
  endsAt: '2026-09-05T12:00:00Z',
  status: 'active' as const,
}

// et locale may group thousands with a no-break space; normalize to plain
// spaces so string matchers compare reliably.
function priceText(value: number): string {
  return `${value.toLocaleString('et')} €`.replace(/\s+/g, ' ')
}

describe('LotCard', () => {
  it('renders the minimal legacy presentation with base props only', () => {
    render(<LotCard {...baseProps} />)

    expect(screen.getByText('Metsamaa Tartumaal')).toBeDefined()
    expect(screen.getByText('Aktiivne')).toBeDefined()
    expect(screen.getByText('Tartumaa, 12.5 ha')).toBeDefined()
    expect(screen.getByText('Aega jäänud')).toBeDefined()
    expect(screen.getByText(/9p 0h 0m 0s/)).toBeDefined()
    expect(screen.getByText(priceText(12500))).toBeDefined()
  })

  it('keeps the legacy presentation when speciesNames is an empty array', () => {
    render(<LotCard {...baseProps} speciesNames={[]} />)

    expect(screen.getByText('Tartumaa, 12.5 ha')).toBeDefined()
    expect(screen.queryByText('Alghind')).toBeNull()
  })

  it('renders no badge, metadata grid, price label or CTA in legacy mode', () => {
    render(<LotCard {...baseProps} href="/lots/test" />)

    expect(screen.queryByText('Raieõigus')).toBeNull()
    expect(screen.queryByText(/vald/)).toBeNull()
    expect(screen.queryByText(/m³/)).toBeNull()
    expect(screen.queryByText('Alghind')).toBeNull()
    expect(screen.queryByText('Vaata lähemalt')).toBeNull()
  })

  it('wraps the whole legacy card in a single link when href is given', () => {
    const { container } = render(<LotCard {...baseProps} href="/lots/test" />)

    const links = container.querySelectorAll('a')
    expect(links.length).toBe(1)

    const link = links[0]!
    expect(link.getAttribute('href')).toBe('/lots/test')
    expect(link.contains(screen.getByText('Metsamaa Tartumaal'))).toBe(true)
    expect(link.contains(screen.getByText('Tartumaa, 12.5 ha'))).toBe(true)
    expect(link.contains(screen.getByText(priceText(12500)))).toBe(true)
    expect(link.contains(screen.getByText(/9p 0h 0m 0s/))).toBe(true)
    expect(container.querySelector('button')).toBeNull()
  })

  it('shows "Lõppenud {year}" instead of a countdown in legacy archive', () => {
    render(<LotCard {...baseProps} archive endYear={2025} />)

    expect(screen.getByText('Lõppenud 2025')).toBeDefined()
    expect(screen.queryByText('Aega jäänud')).toBeNull()
    expect(screen.queryByText(/9p 0h 0m 0s/)).toBeNull()
  })

  it('renders badge, metadata cells, price label and CTA with all props', () => {
    render(
      <LotCard
        {...baseProps}
        typeLabel="Raieõigus"
        parish="Tartu"
        speciesNames={['mänd', 'kuusk']}
        volumeM3={320}
        href="/lots/test"
      />,
    )

    expect(screen.getByText('Raieõigus')).toBeDefined()
    expect(screen.getByText('Tartu vald, Tartumaa')).toBeDefined()
    expect(screen.getByText('12.5 ha')).toBeDefined()
    expect(screen.getByText('mänd, kuusk')).toBeDefined()
    expect(screen.getByText('320 m³')).toBeDefined()
    expect(screen.getByText('Alghind')).toBeDefined()
    expect(screen.getByText(priceText(12500))).toBeDefined()
    expect(screen.getByText('Vaata lähemalt')).toBeDefined()
  })

  it('renders the overlay countdown pill without the "Aega jäänud" label', () => {
    render(
      <LotCard
        {...baseProps}
        typeLabel="Raieõigus"
        speciesNames={['mänd']}
        href="/lots/test"
      />,
    )

    expect(screen.queryByText('Aega jäänud')).toBeNull()
    expect(screen.getByText(/9p 0h 0m 0s/)).toBeDefined()
  })

  it('wraps the whole card in one link with the CTA span inside it', () => {
    const { container } = render(
      <LotCard
        {...baseProps}
        typeLabel="Raieõigus"
        parish="Tartu"
        speciesNames={['mänd', 'kuusk']}
        volumeM3={320}
        href="/lots/test"
      />,
    )

    const links = container.querySelectorAll('a')
    expect(links.length).toBe(1)

    const link = links[0]!
    expect(link.getAttribute('href')).toBe('/lots/test')
    expect(link.contains(screen.getByText('Raieõigus'))).toBe(true)
    expect(link.contains(screen.getByText('Tartu vald, Tartumaa'))).toBe(true)
    expect(link.contains(screen.getByText(priceText(12500)))).toBe(true)

    const cta = screen.getByText('Vaata lähemalt')
    expect(cta.tagName).toBe('SPAN')
    expect(cta.closest('a')).toBe(link)
    expect(container.querySelector('button')).toBeNull()
  })

  it('renders no CTA span without href', () => {
    render(
      <LotCard
        {...baseProps}
        typeLabel="Raieõigus"
        parish="Tartu"
        speciesNames={['mänd', 'kuusk']}
        volumeM3={320}
      />,
    )

    expect(screen.queryByText('Vaata lähemalt')).toBeNull()
    expect(screen.getByText('Metsamaa Tartumaal')).toBeDefined()
  })

  it('renders a custom ctaLabel inside the card link', () => {
    const { container } = render(
      <LotCard
        {...baseProps}
        typeLabel="Raieõigus"
        speciesNames={['mänd']}
        volumeM3={320}
        ctaLabel="Ava oksjon"
        href="/lots/test"
      />,
    )

    const cta = screen.getByText('Ava oksjon')
    expect(cta.tagName).toBe('SPAN')
    expect(cta.closest('a')).toBe(container.querySelector('a'))
  })

  it('falls back to county alone in the grid when parish is absent', () => {
    render(
      <LotCard
        {...baseProps}
        typeLabel="Raieõigus"
        speciesNames={['mänd']}
        volumeM3={320}
        href="/lots/test"
      />,
    )

    expect(screen.getByText('Tartumaa')).toBeDefined()
    expect(screen.queryByText(/vald/)).toBeNull()
    expect(screen.getByText('12.5 ha')).toBeDefined()
    expect(screen.getByText('320 m³')).toBeDefined()
  })

  it('collapses the area cell when area is 0', () => {
    render(
      <LotCard
        {...baseProps}
        area={0}
        typeLabel="Raieõigus"
        parish="Tartu"
        speciesNames={['mänd', 'kuusk']}
        volumeM3={320}
        href="/lots/test"
      />,
    )

    expect(screen.queryByText('0 ha')).toBeNull()
    expect(screen.getByText('Tartu vald, Tartumaa')).toBeDefined()
    expect(screen.getByText('mänd, kuusk')).toBeDefined()
    expect(screen.getByText('320 m³')).toBeDefined()
  })

  it('collapses the species cell when speciesNames is empty', () => {
    render(
      <LotCard
        {...baseProps}
        typeLabel="Raieõigus"
        parish="Tartu"
        speciesNames={[]}
        volumeM3={320}
        href="/lots/test"
      />,
    )

    expect(screen.queryByText(/mänd/)).toBeNull()
    expect(screen.getByText('Tartu vald, Tartumaa')).toBeDefined()
    expect(screen.getByText('12.5 ha')).toBeDefined()
    expect(screen.getByText('320 m³')).toBeDefined()
  })

  it('collapses the volume cell when volumeM3 is absent', () => {
    render(
      <LotCard
        {...baseProps}
        typeLabel="Raieõigus"
        parish="Tartu"
        speciesNames={['mänd', 'kuusk']}
        href="/lots/test"
      />,
    )

    expect(screen.queryByText(/m³/)).toBeNull()
    expect(screen.getByText('Tartu vald, Tartumaa')).toBeDefined()
    expect(screen.getByText('12.5 ha')).toBeDefined()
    expect(screen.getByText('mänd, kuusk')).toBeDefined()
  })

  it('shows "Lõppenud {year}" overlay and "Lõpphind" final price in archive', () => {
    render(
      <LotCard
        {...baseProps}
        typeLabel="Raieõigus"
        parish="Tartu"
        speciesNames={['mänd']}
        volumeM3={320}
        archive
        endYear={2025}
        finalPrice={9000}
        href="/lots/test"
      />,
    )

    expect(screen.getByText('Lõppenud 2025')).toBeDefined()
    expect(screen.getByText('Lõpphind')).toBeDefined()
    expect(screen.queryByText('Alghind')).toBeNull()
    expect(screen.getByText(priceText(9000))).toBeDefined()
    expect(screen.getByText('Vaata lähemalt')).toBeDefined()
  })

  it('does not render a live countdown when archived', () => {
    render(
      <LotCard
        {...baseProps}
        typeLabel="Raieõigus"
        parish="Tartu"
        speciesNames={['mänd']}
        volumeM3={320}
        archive
        endYear={2025}
        finalPrice={9000}
        href="/lots/test"
      />,
    )

    expect(screen.queryByText('Aega jäänud')).toBeNull()
    expect(screen.queryByText(/9p 0h 0m 0s/)).toBeNull()
    expect(screen.getByText('Lõppenud')).toBeDefined()
  })
})
