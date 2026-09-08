import { describe, expect, it, vi } from 'vitest'

import { insertTemplateTokenAtCursor } from '../TemplateEditorModal'

// The component module pulls in the "use server" actions file; keep the pure
// unit test free of its Node-hostile import graph (next/cache, repositories).
vi.mock('@/app/(admin)/_actions/contracts', () => ({
  testRenderTemplateAction: vi.fn(),
}))

describe('insertTemplateTokenAtCursor', () => {
  it('inserts at the start and lands the caret after the token', () => {
    const result = insertTemplateTokenAtCursor('Lepingu tekst', 0, 0, '{{bid.amount}}')
    expect(result.value).toBe('{{bid.amount}}Lepingu tekst')
    expect(result.caretStart).toBe(14)
    expect(result.caretEnd).toBe(14)
  })

  it('inserts in the middle and keeps the tail intact', () => {
    const result = insertTemplateTokenAtCursor('Lepingu tekst', 8, 8, '{{nimi}}')
    expect(result.value).toBe('Lepingu {{nimi}}tekst')
    expect(result.caretStart).toBe(16)
    expect(result.caretEnd).toBe(16)
  })

  it('appends at the end when both selections are null', () => {
    const result = insertTemplateTokenAtCursor('Vanatekst', null, null, '{{date.today}}')
    expect(result.value).toBe('Vanatekst{{date.today}}')
    expect(result.caretStart).toBe(23)
    expect(result.caretEnd).toBe(23)
  })

  it('replaces the selected range with the token', () => {
    const result = insertTemplateTokenAtCursor('Vananimi ja tekst', 4, 8, '{{bidder.name}}')
    expect(result.value).toBe('Vana{{bidder.name}} ja tekst')
    expect(result.caretStart).toBe(19)
    expect(result.caretEnd).toBe(19)
  })

  it('inserts inside multiline content and counts the caret across newlines', () => {
    const result = insertTemplateTokenAtCursor('Pealkiri\nSisu siin', 9, 9, '{{lot.name}}')
    expect(result.value).toBe('Pealkiri\n{{lot.name}}Sisu siin')
    expect(result.caretStart).toBe(21)
    expect(result.caretEnd).toBe(21)
  })

  it('builds the whole value from the token when the draft is empty', () => {
    const result = insertTemplateTokenAtCursor('', null, null, '{{fee.total}}')
    expect(result.value).toBe('{{fee.total}}')
    expect(result.caretStart).toBe(13)
    expect(result.caretEnd).toBe(13)
  })

  it('normalizes an inverted selection to a collapsed cursor', () => {
    const result = insertTemplateTokenAtCursor('ABCDEF', 4, 1, '{{t}}')
    expect(result.value).toBe('ABCD{{t}}EF')
    expect(result.caretStart).toBe(9)
    expect(result.caretEnd).toBe(9)
  })

  it('parks the caret after the token, never at the old selection end', () => {
    const result = insertTemplateTokenAtCursor('Kliendi andmed', 0, 14, '{{company.legalName}}')
    expect(result.caretStart).toBe(result.caretEnd)
    expect(result.caretStart).toBe('{{company.legalName}}'.length)
  })
})
