// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { PageEditor, type PageEditorProps } from '../PageEditor'
import type { BuilderBlock } from '../builder-types'

const actionMocks = vi.hoisted(() => ({
  restorePageVersionAction: vi.fn(),
  savePageAction: vi.fn(),
  savePageBlocksAction: vi.fn(),
}))

vi.mock('../../../../../_actions/content', () => ({
  restorePageVersionAction: actionMocks.restorePageVersionAction,
  savePageAction: actionMocks.savePageAction,
  savePageBlocksAction: actionMocks.savePageBlocksAction,
}))

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

const heroBlock: BuilderBlock = {
  id: 'block-hero',
  type: 'hero',
  config: {
    heading: 'Müü metsa',
    overlayStrength: 80,
    primaryCta: { label: 'Alusta', href: '/oksjonid' },
  },
}

const textBlock: BuilderBlock = {
  id: 'block-text',
  type: 'text',
  config: { body: 'Sisu lõik' },
}

const baseProps: PageEditorProps = {
  pageId: 'page-1',
  title: 'Meist',
  slug: 'meist',
  seoTitle: '',
  seoDescription: '',
  status: 'draft',
  publishedAtInput: '',
  redirectOffer: null,
  initialBlocks: [heroBlock, textBlock],
  versions: [
    {
      id: 'version-1',
      version: 1,
      label: null,
      createdAt: '2026-09-01T09:00:00.000Z',
      blocks: [{ type: 'hero', config: { heading: 'Pealkiri', primaryCta: { label: 'A', href: '/' } } }],
    },
  ],
  savedBlocks: [
    { type: 'hero', config: { heading: 'Müü metsa', primaryCta: { label: 'Alusta', href: '/oksjonid' } } },
  ],
}

let container: HTMLDivElement
let root: Root

async function mountEditor(props: PageEditorProps = baseProps): Promise<void> {
  await act(async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    root.render(createElement(PageEditor, props))
    await Promise.resolve()
  })
}

async function unmountEditor(): Promise<void> {
  await act(async () => {
    root.unmount()
    await Promise.resolve()
  })
  container.remove()
}

beforeEach(() => {
  actionMocks.savePageAction.mockReset()
  actionMocks.savePageBlocksAction.mockReset()
  actionMocks.savePageAction.mockResolvedValue(undefined)
  actionMocks.savePageBlocksAction.mockResolvedValue(undefined)
})

afterEach(async () => {
  await unmountEditor()
})

function button(label: string): HTMLButtonElement {
  const button = [...container.querySelectorAll<HTMLButtonElement>('button')].find(
    (candidate) => candidate.textContent === label,
  )
  if (button === undefined) throw new Error(`button ${label} not found`)
  return button
}

function buttonWithText(fragment: string): HTMLButtonElement {
  const button = [...container.querySelectorAll<HTMLButtonElement>('button')].find(
    (candidate) => candidate.textContent.includes(fragment),
  )
  if (button === undefined) throw new Error(`button containing ${fragment} not found`)
  return button
}

function metaForm(): HTMLFormElement {
  const form = container.querySelector('form')
  if (form === null) throw new Error('meta form not found')
  return form
}

function blocksForm(): HTMLFormElement {
  const forms = [...container.querySelectorAll('form')]
  const form = forms.find((candidate) => candidate.querySelector('input[name="blocks"]'))
  if (!form) throw new Error('blocks form not found')
  return form
}

async function click(element: HTMLElement): Promise<void> {
  await act(async () => {
    element.click()
    await Promise.resolve()
  })
}

async function submit(form: HTMLFormElement): Promise<void> {
  await act(async () => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await Promise.resolve()
  })
}

function lastFormData(mock: ReturnType<typeof vi.fn>): FormData {
  const call = mock.mock.calls.at(-1)
  if (!call) throw new Error('expected the action to be called')
  return call[0] as FormData
}

function storedBlocks(): { type: string; config: Record<string, unknown> }[] {
  const payload = lastFormData(actionMocks.savePageBlocksAction).get('blocks')
  if (typeof payload !== 'string') throw new Error('blocks payload missing')
  return JSON.parse(payload) as { type: string; config: Record<string, unknown> }[]
}

async function setTextarea(value: string): Promise<void> {
  const textarea = blocksForm().querySelector<HTMLTextAreaElement>('textarea')
  if (textarea === null) throw new Error('JSON textarea not found')
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(
      textarea,
      value,
    )
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    await Promise.resolve()
  })
}

function openDrawer(): HTMLElement {
  const dialog = document.body.querySelector<HTMLElement>('[role="dialog"]')
  if (dialog === null) throw new Error('settings drawer not opened')
  return dialog
}

function drawerButton(dialog: HTMLElement, label: string): HTMLButtonElement {
  const button = [...dialog.querySelectorAll<HTMLButtonElement>('button')].find(
    (candidate) => candidate.textContent === label,
  )
  if (button === undefined) throw new Error(`drawer button ${label} not found`)
  return button
}

async function typeIntoInput(input: HTMLInputElement, value: string): Promise<void> {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(
      input,
      value,
    )
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await Promise.resolve()
  })
}

async function typeEditorHtml(dialog: HTMLElement, html: string): Promise<void> {
  const editor = dialog.querySelector<HTMLElement>('[role="textbox"]')
  if (editor === null) throw new Error('rich text editor not found in drawer')
  await act(async () => {
    editor.innerHTML = html
    editor.dispatchEvent(new Event('input', { bubbles: true }))
    await Promise.resolve()
  })
}

describe('PageEditor publish branches', () => {
  it('saves a draft through the mustand branch', async () => {
    await mountEditor()

    await click(button('Salvesta mustandina'))
    await submit(metaForm())

    const formData = lastFormData(actionMocks.savePageAction)
    expect(formData.get('id')).toBe('page-1')
    expect(formData.get('status')).toBe('draft')
    expect(formData.get('intent')).toBe('')
    expect(formData.get('title')).toBe('Meist')
    expect(actionMocks.savePageBlocksAction).not.toHaveBeenCalled()
  })

  it('publishes through the avalda branch', async () => {
    await mountEditor()

    await click(button('Avalda'))
    await submit(metaForm())

    const formData = lastFormData(actionMocks.savePageAction)
    expect(formData.get('status')).toBe('published')
    expect(formData.get('intent')).toBe('')
  })

  it('schedules through the ajasta branch when a publish time is set', async () => {
    await mountEditor({ ...baseProps, publishedAtInput: '2026-12-01T10:00' })

    await click(button('Ajasta'))
    await submit(metaForm())

    const formData = lastFormData(actionMocks.savePageAction)
    expect(formData.get('status')).toBe('published')
    expect(formData.get('intent')).toBe('schedule')
    expect(formData.get('publishAt')).toBe('2026-12-01T10:00')
  })

  it('disables the ajasta branch without a publish time', async () => {
    await mountEditor()

    const ajasta = button('Ajasta')
    expect(ajasta.disabled).toBe(true)
    await click(ajasta)
    await submit(metaForm())

    const formData = lastFormData(actionMocks.savePageAction)
    expect(formData.get('intent')).toBe('')
  })
})

describe('PageEditor block builder wiring', () => {
  it('saves the reordered blocks payload through savePageBlocksAction', async () => {
    await mountEditor()

    const moveUpButtons = [...container.querySelectorAll<HTMLButtonElement>('button[aria-label="Teisalda üles"]')]
    const secondUp = moveUpButtons[1]
    if (secondUp === undefined) throw new Error('second move-up button not found')
    await click(secondUp)
    await submit(blocksForm())

    const formData = lastFormData(actionMocks.savePageBlocksAction)
    expect(formData.get('pageId')).toBe('page-1')
    expect(storedBlocks().map((entry) => entry.type)).toEqual(['text', 'hero'])
    expect(actionMocks.savePageAction).not.toHaveBeenCalled()
  })

  it('adds a block from the registry menu with its default config', async () => {
    await mountEditor()

    await click(button('Lisa blokk'))
    await click(buttonWithText('Oksjonite ticker'))
    await submit(blocksForm())

    expect(storedBlocks().map((entry) => entry.type)).toEqual(['hero', 'text', 'ticker'])
    expect(storedBlocks()[2]?.config).toEqual({ limit: 4, objectType: 'koik', autoRefreshSeconds: 0 })
  })

  it('keeps the JSON textarea behind the Kuva JSON disclosure', async () => {
    await mountEditor()

    const details = blocksForm().querySelector('details')
    if (details === null) throw new Error('Kuva JSON disclosure not found')
    expect(details.querySelector('textarea')).not.toBeNull()
    expect(details.open).toBe(false)

    await click(details.querySelector('summary') ?? details)
    expect(details.open).toBe(true)
  })

  it('applies edited JSON to the builder state and reports schema errors', async () => {
    await mountEditor()
    const summary = blocksForm().querySelector<HTMLElement>('details summary')
    if (summary === null) throw new Error('Kuva JSON summary not found')
    await click(summary)

    await setTextarea('[{nope')
    await click(button('Rakenda JSON'))
    expect(container.textContent).toContain('Paigutus peab olema korrektne JSON.')

    await setTextarea(JSON.stringify([{ type: 'ticker', config: {} }]))
    await click(button('Rakenda JSON'))
    await submit(blocksForm())

    expect(storedBlocks()).toEqual([
      { type: 'ticker', config: { limit: 4, objectType: 'koik', autoRefreshSeconds: 0 } },
    ])
  })
})

describe('PageEditor rich text block fields', () => {
  it('edits the text block body in the rich text editor and stores sanitized HTML', async () => {
    await mountEditor()

    const muudaButtons = [...container.querySelectorAll<HTMLButtonElement>('button')].filter(
      (candidate) => candidate.textContent === 'Muuda',
    )
    const textBlockEdit = muudaButtons[1]
    if (textBlockEdit === undefined) throw new Error('text block Muuda button not found')
    await click(textBlockEdit)

    const dialog = openDrawer()
    expect(dialog.querySelector('[role="toolbar"]')).not.toBeNull()
    await typeEditorHtml(dialog, '<p>Uus sisu</p><script>alert(1)</script><b>rasvane</b>')
    await click(drawerButton(dialog, 'Salvesta'))

    await submit(blocksForm())
    const stored = storedBlocks().find((entry) => entry.type === 'text')
    expect(stored?.config.body).toBe('<p>Uus sisu</p><strong>rasvane</strong>')
  })

  it('binds accordion item fields to indexed draft paths with the rich text editor', async () => {
    await mountEditor()

    await click(button('Lisa blokk'))
    await click(buttonWithText('Akordion'))

    const muudaButtons = [...container.querySelectorAll<HTMLButtonElement>('button')].filter(
      (candidate) => candidate.textContent === 'Muuda',
    )
    const accordionEdit = muudaButtons.at(-1)
    if (accordionEdit === undefined) throw new Error('accordion Muuda button not found')
    await click(accordionEdit)

    const dialog = openDrawer()
    await click(drawerButton(dialog, 'Lisa rida'))

    const title = document.getElementById('block-field-items.0.title') as HTMLInputElement | null
    if (title === null) throw new Error('indexed accordion title field not found')
    await typeIntoInput(title, 'Esimene')

    await typeEditorHtml(dialog, '<p>Klapp</p>')
    await click(drawerButton(dialog, 'Salvesta'))

    await submit(blocksForm())
    const stored = storedBlocks().find((entry) => entry.type === 'accordion')
    expect(stored?.config.items).toEqual([{ title: 'Esimene', content: '<p>Klapp</p>' }])
  })
})

describe('PageEditor versions drawer wiring', () => {
  it('opens the Ajavedu drawer with the parsed versions', async () => {
    await mountEditor()

    await click(button('Ajavedu'))

    const dialog = document.body.querySelector<HTMLElement>('[role="dialog"]')
    if (dialog === null) throw new Error('versions drawer not opened')
    expect(dialog.textContent).toContain('Versioonid')
    expect(dialog.textContent).toContain('Versioon 1')
    expect(actionMocks.restorePageVersionAction).not.toHaveBeenCalled()
  })
})
