// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AuctionsTable, type AuctionsTableProps } from '../AuctionsTable'
import { makeTableRow } from './fixtures'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

const noopAction = vi.fn((): Promise<void> => Promise.resolve())

const baseProps: AuctionsTableProps = {
  rows: [makeTableRow()],
  sorts: {},
  csvHref: '/admin/auctions/csv',
  roleCanWrite: true,
  roleCanExport: false,
  bulkScheduleAction: noopAction,
  duplicateAction: noopAction,
  endManuallyAction: noopAction,
  archiveAction: noopAction,
  relistAction: noopAction,
}

const COLUMNS_STORAGE_KEY = 'erametsad.admin.auctions.columns'

let container: HTMLDivElement
let root: Root

async function mountTable(
  props: Partial<AuctionsTableProps> = {},
): Promise<void> {
  await act(async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    root.render(
      createElement(AuctionsTable, { ...baseProps, ...props }),
    )
    await Promise.resolve()
  })
}

async function unmountTable(): Promise<void> {
  await act(async () => {
    root.unmount()
    await Promise.resolve()
  })
  container.remove()
}

afterEach(async () => {
  await unmountTable()
  window.localStorage.clear()
  noopAction.mockClear()
})

function headerLabels(): string[] {
  return [...container.querySelectorAll<HTMLTableCellElement>('thead th')].map(
    (th) => th.textContent,
  )
}

function bodyText(): string {
  return container.querySelector('tbody')?.textContent ?? ''
}

function chooserCheckbox(index: number): HTMLInputElement {
  const boxes = container.querySelectorAll<HTMLInputElement>(
    '[role="dialog"] input[type="checkbox"]',
  )
  const box = boxes[index]
  if (box === undefined) throw new Error(`chooser checkbox ${String(index)} not found`)
  return box
}

function bulkBarLinks(): HTMLAnchorElement[] {
  return [...container.querySelectorAll<HTMLAnchorElement>('[role="status"] a')]
}

function bulkBarLink(label: string): HTMLAnchorElement {
  const link = bulkBarLinks().find(
    (entry) => entry.textContent === label,
  )
  if (link === undefined) throw new Error(`bulk bar link "${label}" not found`)
  return link
}

async function click(element: HTMLElement): Promise<void> {
  await act(async () => {
    element.click()
    await Promise.resolve()
  })
}

async function pressKey(
  init: KeyboardEventInit,
  target: EventTarget = window,
): Promise<void> {
  await act(async () => {
    target.dispatchEvent(new KeyboardEvent('keydown', init))
    await Promise.resolve()
  })
}

/** Replaces the unforgeable jsdom location with a plain writable stub. */
function stubLocation(): { href: string } {
  const stub = { href: 'http://localhost/admin/auctions' }
  Object.defineProperty(window, 'location', {
    value: stub,
    configurable: true,
    writable: true,
  })
  return stub
}

describe('AuctionsTable Veerud column chooser', () => {
  it('renders every optional column by default', async () => {
    await mountTable()
    expect(headerLabels()).toEqual([
      'Vali',
      'ID',
      'Nimi',
      'Tüüp',
      'Olek',
      'Maakond',
      'ha / m³',
      'Alghind',
      'Pakkumisi',
      'Lõpp',
      'Uuendatud',
      'Spetsialist',
      'Tegevused',
    ])
  })

  it('renders the fixed ha / m³ column from the row label', async () => {
    await mountTable({
      rows: [
        makeTableRow(),
        makeTableRow({ id: 'a1b2c3d4-0000-0000-0000-000000000002', areaVolumeLabel: null }),
      ],
    })
    const cells = [...container.querySelectorAll<HTMLTableCellElement>('tbody tr')].map(
      (tr) => tr.querySelectorAll('td')[6]?.textContent,
    )
    expect(cells).toEqual(['12,4 ha / 980 m³', '—'])
  })

  it('renders the Uuendatud cell server-side', async () => {
    await mountTable()
    expect(bodyText()).toContain('1.01.2026 12:00')
  })

  it('hides header and cells of an unchecked column and persists the ordered choice', async () => {
    await mountTable({
      rows: [makeTableRow({ title: 'Metsamaja oksjon' })],
    })
    const trigger = container.querySelector<HTMLButtonElement>(
      '[aria-haspopup="dialog"]',
    )
    if (trigger === null) throw new Error('chooser trigger not found')
    await click(trigger)

    // Chooser order: Tüüp, Maakond, Alghind, Pakkumisi, Lõpp, Uuendatud,
    // Spetsialist.
    await click(chooserCheckbox(1))

    expect(headerLabels()).not.toContain('Maakond')
    expect(bodyText()).not.toContain('Harjumaa')
    expect(window.localStorage.getItem(COLUMNS_STORAGE_KEY)).toBe(
      JSON.stringify([
        'objectType',
        'minBidCents',
        'bidCount',
        'endsAt',
        'updatedAt',
        'specialistName',
      ]),
    )
  })

  it('hides the toggleable Uuendatud column on request', async () => {
    await mountTable()
    const trigger = container.querySelector<HTMLButtonElement>(
      '[aria-haspopup="dialog"]',
    )
    if (trigger === null) throw new Error('chooser trigger not found')
    await click(trigger)
    await click(chooserCheckbox(5))

    expect(headerLabels()).not.toContain('Uuendatud')
    expect(bodyText()).not.toContain('1.01.2026 12:00')
  })

  it('restores the persisted choice after a remount', async () => {
    await mountTable({ rows: [makeTableRow({ title: 'Metsamaja oksjon' })] })
    const trigger = container.querySelector<HTMLButtonElement>(
      '[aria-haspopup="dialog"]',
    )
    if (trigger === null) throw new Error('chooser trigger not found')
    await click(trigger)
    await click(chooserCheckbox(1))
    await unmountTable()

    await mountTable({ rows: [makeTableRow({ title: 'Metsamaja oksjon' })] })
    expect(headerLabels()).not.toContain('Maakond')
    expect(bodyText()).not.toContain('Harjumaa')
  })

  it('falls back to the default set on corrupt stored values', async () => {
    window.localStorage.setItem(COLUMNS_STORAGE_KEY, '{not json')
    await mountTable()
    expect(headerLabels()).toContain('Maakond')
    await unmountTable()

    window.localStorage.setItem(COLUMNS_STORAGE_KEY, '"just a string"')
    await mountTable()
    expect(headerLabels()).toContain('Maakond')
  })
})

describe('AuctionsTable row selection tint', () => {
  it('tints a selected row and clears the tint on deselect', async () => {
    await mountTable()
    const checkbox = container.querySelector<HTMLInputElement>(
      'tbody input[type="checkbox"]',
    )
    if (checkbox === null) throw new Error('row checkbox not found')

    await click(checkbox)
    const row = container.querySelector('tbody tr')
    expect(row?.className).toContain('[&>td]:bg-primaryLight')

    await click(checkbox)
    expect(container.querySelector('tbody tr')?.className).not.toContain(
      '[&>td]:bg-primaryLight',
    )
  })
})

describe('AuctionsTable bulk export links', () => {
  it('Ekspordi valitud exports exactly the selected ids', async () => {
    await mountTable({
      roleCanExport: true,
      rows: [
        makeTableRow(),
        makeTableRow({
          id: 'a1b2c3d4-0000-0000-0000-000000000002',
          title: 'Saaremaa metskinnistu',
        }),
      ],
    })
    const checkboxes = [
      ...container.querySelectorAll<HTMLInputElement>(
        'tbody input[type="checkbox"]',
      ),
    ]
    const [firstCheckbox, secondCheckbox] = checkboxes
    if (firstCheckbox === undefined || secondCheckbox === undefined) {
      throw new Error('row checkboxes not found')
    }
    await click(firstCheckbox)
    await click(secondCheckbox)

    expect(bulkBarLink('Ekspordi valitud').getAttribute('href')).toBe(
      '/api/v1/admin/auctions/export?ids=a1b2c3d4-0000-0000-0000-000000000001%2Ca1b2c3d4-0000-0000-0000-000000000002',
    )
  })

  it('Ekspordi filtreeritud keeps the filter query', async () => {
    const csvHref = '/api/v1/admin/auctions/export?status=active&q=mets'
    await mountTable({ roleCanExport: true, csvHref })
    const checkbox = container.querySelector<HTMLInputElement>(
      'tbody input[type="checkbox"]',
    )
    if (checkbox === null) throw new Error('row checkbox not found')
    await click(checkbox)

    expect(bulkBarLink('Ekspordi filtreeritud').getAttribute('href')).toBe(
      csvHref,
    )
  })

  it('renders no bulk export links without the export role', async () => {
    await mountTable({ roleCanExport: false })
    const checkbox = container.querySelector<HTMLInputElement>(
      'tbody input[type="checkbox"]',
    )
    if (checkbox === null) throw new Error('row checkbox not found')
    await click(checkbox)

    // The bulk bar itself is visible (Ajasta avaldimine), but the export
    // links stay hidden behind `auctions:export`.
    expect(container.querySelector('[role="status"]')).not.toBeNull()
    expect(bulkBarLinks()).toHaveLength(0)
  })
})

describe('AuctionsTable global shortcut', () => {
  it('opens the create flow on ⌘N and Ctrl+N', async () => {
    const location = stubLocation()
    await mountTable()

    await pressKey({ key: 'n', metaKey: true, cancelable: true })
    expect(location.href).toBe('/admin/auctions/new')

    await pressKey({ key: 'n', ctrlKey: true, cancelable: true })
    expect(location.href).toBe('/admin/auctions/new')
  })

  it('stays inert while typing in a form field', async () => {
    const location = stubLocation()
    await mountTable()
    const input = document.createElement('input')
    container.appendChild(input)
    input.focus()

    await pressKey(
      { key: 'n', metaKey: true, cancelable: true, bubbles: true },
      input,
    )
    expect(location.href).toBe('http://localhost/admin/auctions')
  })

  it('registers no shortcut and no selection column without the write role', async () => {
    const location = stubLocation()
    await mountTable({ roleCanWrite: false })

    expect(headerLabels()).not.toContain('Vali')
    expect(
      container.querySelector('tbody input[type="checkbox"]'),
    ).toBeNull()

    await pressKey({ key: 'n', ctrlKey: true, cancelable: true })
    expect(location.href).toBe('http://localhost/admin/auctions')
  })
})
