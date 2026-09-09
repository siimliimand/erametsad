// @vitest-environment jsdom
import { act, createElement, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { moveLeadStatusAction } from '../../../../_actions/ops'
import { LeadsKanban, type KanbanCardView } from '../LeadsKanban'

const state = vi.hoisted(() => ({ refresh: vi.fn() }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: state.refresh }),
}))

vi.mock('next/link', () => ({
  default: (props: { href: string; role?: string; children?: ReactNode }) =>
    createElement('a', { href: props.href, role: props.role }, props.children),
}))

vi.mock('../../../../_actions/ops', () => ({
  moveLeadStatusAction: vi.fn(),
}))

const moveAction = vi.mocked(moveLeadStatusAction)

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

const LEAD_ID = 'abcd1234ef567890'

function makeCard(overrides: Partial<KanbanCardView> = {}): KanbanCardView {
  return {
    id: LEAD_ID,
    contactName: 'Mari Maasikas',
    formName: 'Metsamajanduskava',
    cadastr: '78402:003:0210',
    countyName: 'Harju',
    status: 'new',
    assignedSpecialistId: 'spec-1',
    assignedSpecialistName: 'Mari Maasikas',
    sla: null,
    nextActionAt: null,
    duplicateOfId: null,
    mine: false,
    ...overrides,
  }
}

let container: HTMLDivElement
let root: Root

async function mountKanban(cards: KanbanCardView[]): Promise<void> {
  await act(async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    root.render(createElement(LeadsKanban, { cards }))
    await Promise.resolve()
  })
}

async function unmountKanban(): Promise<void> {
  await act(async () => {
    root.unmount()
    await Promise.resolve()
  })
  container.remove()
}

afterEach(async () => {
  await unmountKanban()
  moveAction.mockReset()
  state.refresh.mockClear()
})

function queryCard(index = 0): HTMLDivElement {
  const card = container.querySelectorAll<HTMLDivElement>('[role="group"]')[index]
  if (card === undefined) throw new Error(`kanban card ${String(index)} not found`)
  return card
}

function queryMenu(): HTMLDivElement {
  const menu = container.querySelector<HTMLDivElement>('[role="menu"]')
  if (menu === null) throw new Error('card menu not found')
  return menu
}

function menuItems(): HTMLElement[] {
  return [...queryMenu().querySelectorAll<HTMLElement>('[role="menuitem"]')]
}

function menuItem(label: string): HTMLElement {
  const item = menuItems().find((element) => element.textContent === label)
  if (item === undefined) throw new Error(`menu item "${label}" not found`)
  return item
}

async function pressKey(element: EventTarget, key: string): Promise<void> {
  await act(async () => {
    element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
    await Promise.resolve()
  })
}

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
}

async function click(element: HTMLElement): Promise<void> {
  await act(async () => {
    element.click()
    await Promise.resolve()
  })
  await flush()
}

function columnCardLabels(columnLabel: string): string[] {
  const section = [...container.querySelectorAll('section')].find(
    (candidate) => candidate.querySelector('h3')?.textContent === columnLabel,
  )
  if (section === undefined) throw new Error(`column "${columnLabel}" not found`)
  return [...section.querySelectorAll('[role="group"]')].map(
    (card) => card.getAttribute('aria-label') ?? '',
  )
}

function alertText(): string {
  const alert = container.querySelector('[role="alert"]')
  if (alert === null) throw new Error('error alert not found')
  return alert.textContent
}

function queryDialog(): HTMLDivElement {
  const dialog = container.querySelector<HTMLDivElement>('[role="dialog"]')
  if (dialog === null) throw new Error('note dialog not found')
  return dialog
}

function dialogButton(label: string): HTMLButtonElement {
  const button = [...queryDialog().querySelectorAll('button')].find(
    (candidate) => candidate.textContent === label,
  )
  if (button === undefined) throw new Error(`dialog button "${label}" not found`)
  return button
}

async function typeNote(value: string): Promise<void> {
  const textarea = queryDialog().querySelector('textarea')
  if (textarea === null) throw new Error('note textarea not found')
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(
      textarea,
      value,
    )
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    await Promise.resolve()
  })
}

describe('kanban card metadata', () => {
  it('renders the demo-parity card content and announces the keyboard affordance', async () => {
    await mountKanban([makeCard()])
    const card = queryCard()

    expect(card.getAttribute('aria-label')).toBe(
      'Juhtlõige #abcd1234 Mari Maasikas. Enter avab teisaldamise menüü.',
    )
    const nameLink = card.querySelector('a')
    expect(nameLink?.getAttribute('href')).toBe(`/admin/leads/${LEAD_ID}`)
    expect(nameLink?.textContent).toBe('Mari Maasikas')
    expect(card.textContent).toContain('#abcd1234')
    expect(card.querySelector('[title="Katastritunnus"]')?.textContent).toBe(
      '78402:003:0210',
    )
    expect(card.querySelector('[title="Maakond"]')?.textContent).toBe('Harju')
    expect(card.textContent).toContain('Metsamajanduskava')
    expect(card.querySelector('[title="Mari Maasikas"]')?.textContent).toBe('MM')
  })

  it('omits the county chip when the lead has no county yet', async () => {
    await mountKanban([makeCard({ countyName: null })])
    expect(queryCard().querySelector('[title="Maakond"]')).toBeNull()
  })

  it('renders SLA level badges, the next action and the unassigned pill', async () => {
    await mountKanban([
      makeCard({
        id: '11111111aaaaaaaa',
        contactName: 'Priit Põhjamets',
        sla: { level: 'red', label: 'SLA ületatud 51 h' },
        nextActionAt: '08.09.2026, 12:00',
        assignedSpecialistId: null,
        assignedSpecialistName: null,
      }),
      makeCard({
        id: '22222222bbbbbbbb',
        contactName: 'Anu Kask',
        status: 'contacted',
        sla: { level: 'amber', label: '→ 26 h' },
      }),
    ])

    const red = queryCard(0)
    expect(red.textContent).toContain('SLA ületatud 51 h')
    expect(red.querySelector('.bg-danger-light')).not.toBeNull()
    expect(red.textContent).toContain('Järgmine tegevus: 08.09.2026, 12:00')
    expect(red.textContent).toContain('määramata')

    expect(queryCard(1).querySelector('.bg-info-light')).not.toBeNull()
  })

  it('links a possible duplicate lead by its short id', async () => {
    await mountKanban([makeCard({ duplicateOfId: 'dcba4321ffffffff' })])
    const card = queryCard()

    expect(card.textContent).toContain('võimalik duplikaat')
    const duplicateLink = [...card.querySelectorAll('a')].find(
      (anchor) => anchor.getAttribute('href') === '/admin/leads/dcba4321ffffffff',
    )
    expect(duplicateLink?.textContent).toBe('#dcba4321')
  })

  it('marks the viewer’s own card with a primary border', async () => {
    await mountKanban([
      makeCard({ mine: true }),
      makeCard({ id: '22222222bbbbbbbb', status: 'contacted', mine: false }),
    ])

    expect(queryCard(0).classList.contains('border-primary')).toBe(true)
    expect(queryCard(1).classList.contains('border-primary')).toBe(false)
  })
})

describe('keyboard move menu', () => {
  it.each(['Enter', ' ', 'ArrowDown'])(
    'opens the move menu on %s and lists every other column',
    async (key) => {
      await mountKanban([makeCard()])
      await pressKey(queryCard(), key)

      expect(queryMenu().getAttribute('aria-label')).toBe(
        'Liiguta juhtlõige teise etappi',
      )
      expect(menuItems().map((item) => item.textContent)).toEqual([
        'Võetud ühendust',
        'Kvalifitseeritud',
        'Leping',
        'Mittekvalifitseeritud',
        'Ava detailvaade',
      ])
      expect(document.activeElement).toBe(menuItems()[0])
    },
  )

  it('ignores move keys that start on inner card elements or unmapped keys', async () => {
    await mountKanban([makeCard()])
    const card = queryCard()
    const nameLink = card.querySelector('a')
    if (nameLink === null) throw new Error('contact name link not found')

    await pressKey(nameLink, 'Enter')
    expect(container.querySelector('[role="menu"]')).toBeNull()

    await pressKey(card, 'ArrowRight')
    expect(container.querySelector('[role="menu"]')).toBeNull()
  })

  it('navigates menu items with arrow, Home and End keys', async () => {
    await mountKanban([makeCard()])
    await pressKey(queryCard(), 'Enter')
    const items = menuItems()
    expect(document.activeElement).toBe(items[0])

    await pressKey(queryMenu(), 'ArrowDown')
    expect(document.activeElement).toBe(items[1])

    await pressKey(queryMenu(), 'ArrowUp')
    await pressKey(queryMenu(), 'ArrowUp')
    expect(document.activeElement).toBe(items[4])

    await pressKey(queryMenu(), 'Home')
    expect(document.activeElement).toBe(items[0])

    await pressKey(queryMenu(), 'End')
    expect(document.activeElement).toBe(items[4])
  })

  it('moves the card, dispatches the action and refreshes on success', async () => {
    moveAction.mockResolvedValue({ ok: true })
    await mountKanban([makeCard()])
    await pressKey(queryCard(), 'Enter')
    await click(menuItem('Võetud ühendust'))

    expect(moveAction).toHaveBeenCalledTimes(1)
    expect(moveAction).toHaveBeenCalledWith({ leadId: LEAD_ID, status: 'contacted' })
    expect(container.querySelector('[role="menu"]')).toBeNull()
    expect(columnCardLabels('Võetud ühendust')).toHaveLength(1)
    expect(columnCardLabels('Uus')).toHaveLength(0)
    expect(state.refresh).toHaveBeenCalledTimes(1)
  })

  it('reverts the optimistic move and shows the error when the action fails', async () => {
    moveAction.mockResolvedValue({
      ok: false,
      error: 'Juhtlõige ei ole teie tööpiirkonnas.',
    })
    await mountKanban([makeCard()])
    await pressKey(queryCard(), 'Enter')
    await click(menuItem('Leping'))

    expect(columnCardLabels('Uus')).toHaveLength(1)
    expect(columnCardLabels('Leping')).toHaveLength(0)
    expect(alertText()).toBe('Juhtlõige ei ole teie tööpiirkonnas.')
    expect(state.refresh).not.toHaveBeenCalled()
  })

  it('closes on Escape and restores focus to the card', async () => {
    await mountKanban([makeCard()])
    const card = queryCard()
    await pressKey(card, 'Enter')
    await pressKey(document, 'Escape')

    expect(container.querySelector('[role="menu"]')).toBeNull()
    expect(document.activeElement).toBe(card)
  })

  it('disables the menu trigger while a move is pending', async () => {
    let resolveMove: (result: { ok: boolean; error?: string }) => void = () =>
      undefined
    moveAction.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveMove = resolve
        }),
    )
    await mountKanban([makeCard()])
    await pressKey(queryCard(), 'Enter')
    await click(menuItem('Võetud ühendust'))

    const trigger = container.querySelector<HTMLButtonElement>(
      '[aria-haspopup="menu"]',
    )
    expect(trigger?.disabled).toBe(true)

    resolveMove({ ok: true })
    await flush()
    expect(trigger?.disabled).toBe(false)
  })
})

describe('qualification and rejection notes', () => {
  it('collects a qualification note of at least five characters first', async () => {
    moveAction.mockResolvedValue({ ok: true })
    await mountKanban([makeCard({ status: 'contacted' })])
    await pressKey(queryCard(), 'Enter')
    await click(menuItem('Kvalifitseeritud'))

    expect(queryDialog().textContent).toContain('Kvalifitseerimise märkus')
    expect(moveAction).not.toHaveBeenCalled()

    await typeNote('okei')
    await click(dialogButton('Kinnita'))
    expect(alertText()).toBe(
      'Kvalifitseerimise märkus on kohustuslik (vähemalt 5 tähemärki).',
    )
    expect(moveAction).not.toHaveBeenCalled()

    await typeNote('Mets hindamisel, ootame tulemusi')
    await click(dialogButton('Kinnita'))
    expect(moveAction).toHaveBeenCalledTimes(1)
    expect(moveAction).toHaveBeenCalledWith({
      leadId: LEAD_ID,
      status: 'qualified',
      note: 'Mets hindamisel, ootame tulemusi',
    })
  })

  it('collects a typed rejection reason for Mittekvalifitseeritud', async () => {
    moveAction.mockResolvedValue({ ok: true })
    await mountKanban([makeCard({ status: 'contacted' })])
    await pressKey(queryCard(), 'Enter')
    await click(menuItem('Mittekvalifitseeritud'))

    expect(queryDialog().textContent).toContain('Tagasilükkamise põhjus')
    await typeNote('Klient loobus teenusest')
    await click(dialogButton('Kinnita'))

    expect(moveAction).toHaveBeenCalledTimes(1)
    expect(moveAction).toHaveBeenCalledWith({
      leadId: LEAD_ID,
      status: 'disqualified',
      note: 'Klient loobus teenusest',
    })
  })

  it('keeps the card in place when the note dialog is cancelled', async () => {
    await mountKanban([makeCard({ status: 'contacted' })])
    await pressKey(queryCard(), 'Enter')
    await click(menuItem('Kvalifitseeritud'))
    await click(dialogButton('Tühista'))

    expect(container.querySelector('[role="dialog"]')).toBeNull()
    expect(moveAction).not.toHaveBeenCalled()
    expect(columnCardLabels('Võetud ühendust')).toHaveLength(1)
  })
})

describe('card menu button', () => {
  it('toggles the menu and offers the detail view link', async () => {
    await mountKanban([makeCard()])
    const trigger = container.querySelector<HTMLButtonElement>(
      '[aria-haspopup="menu"]',
    )
    if (trigger === null) throw new Error('card menu trigger not found')

    await click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    const detailLink = menuItem('Ava detailvaade')
    expect(detailLink.getAttribute('href')).toBe(`/admin/leads/${LEAD_ID}`)

    await click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(container.querySelector('[role="menu"]')).toBeNull()
  })
})
