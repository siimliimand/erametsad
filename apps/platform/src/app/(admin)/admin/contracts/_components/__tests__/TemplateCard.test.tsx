// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { TemplateCard, type TemplateCardData } from '../../templates/_components/TemplateCard'
import type { TemplateVersionEntry } from '../../templates/_components/TemplateVersionHistory'

const actions = vi.hoisted(() => ({
  activate: vi.fn((_formData: FormData): Promise<void> => Promise.resolve()),
  deactivate: vi.fn((_formData: FormData): Promise<void> => Promise.resolve()),
  testRender: vi.fn((_id: string) =>
    Promise.resolve({ ok: true, html: '<p>Tere</p>', error: null }),
  ),
}))

vi.mock('@/app/(admin)/_actions/contracts', () => ({
  activateContractTemplateAction: actions.activate,
  deactivateContractTemplateAction: actions.deactivate,
  testRenderTemplateAction: actions.testRender,
}))

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

function version(id: string, versionNumber: string, active = false): TemplateVersionEntry {
  return {
    id,
    version: versionNumber,
    createdAt: '2026-08-01T09:00:00.000Z',
    updatedAt: '2026-08-01T09:00:00.000Z',
    active,
  }
}

function cardData(overrides: Partial<TemplateCardData> = {}): TemplateCardData {
  return {
    id: 'tpl-1',
    name: 'Raamleping 2026',
    type: 'framework',
    lifecycle: 'active',
    tokens: [
      { key: 'bidder.name' },
      { key: 'lot.id' },
      { key: 'bid.amount' },
      { key: 'date.today' },
      { key: 'fee.total' },
    ],
    updatedAt: '2026-09-01T10:00:00.000Z',
    versions: [
      version('tv-4', '3.1', true),
      version('tv-3', '2.0'),
      version('tv-2', '1.0'),
      version('tv-1', '0.9'),
    ],
    ...overrides,
  }
}

let container: HTMLDivElement
let root: Root

async function mountCard(card: TemplateCardData): Promise<void> {
  await act(async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    root.render(createElement(TemplateCard, { card }))
    await Promise.resolve()
  })
}

afterEach(() => {
  act(() => {
    root.unmount()
  })
  container.remove()
  // OverlayPortal renders into document.body, so portal residue needs a sweep.
  document.body.textContent = ''
  document.body.style.overflow = ''
  actions.activate.mockClear()
  actions.deactivate.mockClear()
  actions.testRender.mockClear()
})

function article(): HTMLElement {
  const el = container.querySelector<HTMLElement>('article')
  if (el === null) throw new Error('template card not found')
  return el
}

// The collapsed history still lives in the DOM, so exact-match counts must
// separate chip spans (head) from the history rows that duplicate versions.
function countSpansWithText(text: string, scope: ParentNode): number {
  return [...scope.querySelectorAll('span')].filter((el) => el.textContent === text).length
}

function historyDetails(scope: ParentNode): HTMLDetailsElement {
  const el = [...scope.querySelectorAll('details')].find((details) =>
    details.querySelector('summary')?.textContent.includes('Ajalugu'),
  )
  if (el === undefined) throw new Error('history details not found')
  return el
}

function buttonByLabel(label: string, scope: ParentNode): HTMLButtonElement {
  const el = [...scope.querySelectorAll<HTMLButtonElement>('button')].find(
    (button) => button.textContent.trim() === label,
  )
  if (el === undefined) throw new Error(`button not found: ${label}`)
  return el
}

async function click(element: HTMLElement): Promise<void> {
  await act(async () => {
    element.click()
    await Promise.resolve()
  })
}

describe('TemplateCard head', () => {
  it('renders the name, the three newest version chips, the active pill and type label', async () => {
    await mountCard(cardData())
    const card = article()
    expect(card.querySelector('h3')?.textContent).toBe('Raamleping 2026')
    expect(countSpansWithText('v3.1', card)).toBe(2)
    expect(countSpansWithText('v2.0', card)).toBe(2)
    expect(countSpansWithText('v1.0', card)).toBe(2)
    expect(countSpansWithText('v0.9', card)).toBe(1)
    expect(countSpansWithText('Aktiivne', card)).toBe(1)
    expect(countSpansWithText('Raamleping', card)).toBe(1)
    expect(card.textContent).toContain('Muudetud:')
    expect(card.textContent).toContain('Testrender')
  })

  it('shows the deactivation path with a required reason for the active version', async () => {
    await mountCard(cardData())
    const card = article()
    const summaries = [...card.querySelectorAll('summary')].map((el) => el.textContent)
    expect(summaries).toContain('Deaktiveeri')
    const reason = card.querySelector<HTMLTextAreaElement>('textarea[name="reason"]')
    expect(reason?.required).toBe(true)
    expect(Number(reason?.getAttribute('minlength'))).toBeGreaterThanOrEqual(5)
    expect(actions.activate).not.toHaveBeenCalled()
    expect(actions.deactivate).not.toHaveBeenCalled()
  })

  it('keeps the token line at four visible tokens plus a hidden counter', async () => {
    await mountCard(cardData())
    const line = article().querySelector('p')
    expect(line?.textContent).toBe('{{bidder.name}} {{lot.id}} {{bid.amount}} {{date.today}} +1')
  })

  it('states when a template has no tokens', async () => {
    await mountCard(cardData({ tokens: [] }))
    expect(article().querySelector('p')?.textContent).toBe('Kohatäited puuduvad')
  })

  it('renders nothing without versions', async () => {
    await mountCard(cardData({ versions: [] }))
    expect(container.querySelector('article')).toBeNull()
  })
})

describe('TemplateCard version history', () => {
  it('collapses the history behind a summary and expands it on toggle', async () => {
    await mountCard(cardData())
    const history = historyDetails(article())
    expect(history.open).toBe(false)
    expect(history.querySelector('summary')?.textContent).toBe('Ajalugu (4)')

    const summary = history.querySelector('summary')
    if (summary === null) throw new Error('history summary not found')
    await click(summary)
    expect(history.open).toBe(true)

    const rows = [...history.querySelectorAll('li')]
    expect(rows).toHaveLength(4)
    expect(rows[0]?.textContent).toContain('v3.1')
    expect(rows[0]?.textContent).toContain('· aktiivne')
    expect(rows[3]?.textContent).toContain('v0.9')
    expect(rows[3]?.textContent).not.toContain('aktiivne')
  })
})

describe('TemplateCard lifecycle actions', () => {
  it('shows the draft pill, the type label and the activation action for a draft template', async () => {
    await mountCard(
      cardData({
        name: 'Lotileping',
        type: 'auction',
        lifecycle: 'draft',
        versions: [version('tv-9', '1.0'), version('tv-8', '0.9')],
      }),
    )
    const card = article()
    expect(countSpansWithText('Mustand', card)).toBe(1)
    expect(countSpansWithText('Oksjonileping', card)).toBe(1)
    expect(countSpansWithText('v1.0', card)).toBe(2)
    expect(countSpansWithText('v0.9', card)).toBe(2)
    expect(buttonByLabel('Aktiveeri', card)).toBeInstanceOf(HTMLButtonElement)
    expect(actions.activate).not.toHaveBeenCalled()
  })
})
