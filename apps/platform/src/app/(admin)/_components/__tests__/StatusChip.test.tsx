import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { StatusChip, type StatusChipVariant } from '../StatusChip'

function chipHtml(status: StatusChipVariant): string {
  return renderToString(createElement(StatusChip, { status }))
}

describe('StatusChip variants', () => {
  it('renders the auction lifecycle pills with labels and a status dot', () => {
    const cases: [StatusChipVariant, string][] = [
      ['draft', 'Mustand'],
      ['scheduled', 'Ajastatud'],
      ['active', 'Aktiivne'],
      ['ending', 'Lõpeb'],
      ['ended', 'Lõppenud'],
      ['appraised', 'Hinnatud'],
      ['unsold', 'Müümata'],
      ['contract', 'Leping'],
      ['completed', 'Teostatud'],
      ['archived', 'Arhiivis'],
    ]
    for (const [status, label] of cases) {
      const html = chipHtml(status)
      expect(html).toContain('rounded-pill')
      expect(html).toContain(label)
      expect(html).toContain('h-1.5 w-1.5')
    }
  })

  it('keeps the unsold pill as the outlined neutral variant', () => {
    const html = chipHtml('unsold')
    expect(html).toContain('border-[var(--st-unsold)]')
    expect(html).toContain('bg-transparent')
    expect(html).toContain('bg-[var(--st-unsold)]')
  })

  it('renders the user domain pills', () => {
    const cases: [StatusChipVariant, string][] = [
      ['user:active', 'Aktiivne'],
      ['user:suspended', 'Peatatud'],
      ['user:banned', 'Keelatud'],
    ]
    for (const [status, label] of cases) {
      const html = chipHtml(status)
      expect(html).toContain(label)
      expect(html).toContain('h-1.5 w-1.5')
    }
  })

  it('renders contract lifecycle glyphs instead of a dot', () => {
    const cases: [StatusChipVariant, string, string][] = [
      ['contract:prepared', '◻', 'Koostatud'],
      ['contract:sent', '▣', 'Saadetud'],
      ['contract:signed', '✓', 'Allkirjastatud'],
      ['contract:voided', '✕', 'Tühistatud'],
    ]
    for (const [status, glyph, label] of cases) {
      const html = chipHtml(status)
      expect(html).toContain(glyph)
      expect(html).toContain(label)
      expect(html).not.toContain('h-1.5 w-1.5')
    }
  })

  it('renders the lead domain pills', () => {
    const cases: [StatusChipVariant, string][] = [
      ['lead:new', 'Uus'],
      ['lead:contacted', 'Ühenduses'],
      ['lead:qualified', 'Kvalifitseeritud'],
      ['lead:contract', 'Leping'],
      ['lead:disqualified', 'Diskvalifitseeritud'],
    ]
    for (const [status, label] of cases) {
      const html = chipHtml(status)
      expect(html).toContain(label)
      expect(html).toContain('h-1.5 w-1.5')
    }
    expect(chipHtml('lead:new')).toContain('bg-info-light text-info')
  })

  it('renders the content domain pills', () => {
    expect(chipHtml('content:draft')).toContain('Mustand')
    expect(chipHtml('content:published')).toContain('Avaldatud')
  })

  it('renders the company access request pills', () => {
    const cases: [StatusChipVariant, string][] = [
      ['company:pending', 'Ootel'],
      ['company:approved', 'Nõustutud'],
      ['company:rejected', 'Keeldutud'],
      ['company:held', 'Hoitud'],
    ]
    for (const [status, label] of cases) {
      const html = chipHtml(status)
      expect(html).toContain(label)
      expect(html).toContain('h-1.5 w-1.5')
    }
  })

  it('maps danger-toned variants to the shared danger tokens', () => {
    for (const status of [
      'user:banned',
      'contract:voided',
      'lead:disqualified',
      'company:rejected',
    ] as const) {
      expect(chipHtml(status)).toContain('bg-danger-light text-danger')
    }
  })
})
