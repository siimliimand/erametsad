// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { TemplateEditorModal } from '../TemplateEditorModal'

import { ToastProvider } from '@/app/(admin)/_components/ui/Toast'

const actions = vi.hoisted(() => ({
  testRender: vi.fn((_id: string) =>
    Promise.resolve({ ok: true, html: '<p>Tere, Test Testov</p>', error: null }),
  ),
  saveTemplateDraft: vi.fn((_formData: FormData): Promise<void> => Promise.resolve()),
}))

vi.mock('@/app/(admin)/_actions/contracts', () => ({
  testRenderTemplateAction: actions.testRender,
  saveTemplateDraftAction: actions.saveTemplateDraft,
}))

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root

interface EditorMountProps {
  templateId?: string
  initialSourceContent?: string | null
  initialSourceFormat?: 'html' | 'txt' | null
  nextVersion?: string
}

async function mountEditor(props: EditorMountProps = {}, withToast = false): Promise<void> {
  await act(async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    const editor = createElement(TemplateEditorModal, {
      templateId: props.templateId ?? 'tpl-1',
      name: 'Raamleping',
      version: '3.1',
      initialSourceContent: props.initialSourceContent ?? null,
      initialSourceFormat: props.initialSourceFormat ?? null,
      ...(props.nextVersion === undefined ? {} : { nextVersion: props.nextVersion }),
    })
    root.render(withToast ? createElement(ToastProvider, null, editor) : editor)
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
  actions.testRender.mockClear()
  actions.saveTemplateDraft.mockClear()
})

function dialog(): HTMLElement {
  const el = document.body.querySelector<HTMLElement>('[role="dialog"]')
  if (el === null) throw new Error('dialog not found')
  return el
}

function dialogCount(): number {
  return document.body.querySelectorAll('[role="dialog"]').length
}

function drawer(): HTMLElement {
  // Identified by its labelled heading — the drawer has no aria-label.
  const el = [...document.body.querySelectorAll<HTMLElement>('[role="dialog"]')].find(
    (element) => element.querySelector('h2')?.textContent === 'Testrender — Raamleping (v3.1)',
  )
  if (el === undefined) throw new Error('test-render drawer not found')
  return el
}

function editorTextarea(): HTMLTextAreaElement {
  const el = document.body.querySelector<HTMLTextAreaElement>('[role="dialog"] textarea')
  if (el === null) throw new Error('editor textarea not found')
  return el
}

function buttonByLabel(label: string, scope: ParentNode = document.body): HTMLButtonElement {
  const el = [...scope.querySelectorAll<HTMLButtonElement>('button')].find(
    (button) => button.textContent.trim() === label,
  )
  if (el === undefined) throw new Error(`button not found: ${label}`)
  return el
}

function chip(token: string): HTMLButtonElement {
  const label = `Sisesta kohatäide {{${token}}}`
  const el = document.body.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)
  if (el === null) throw new Error(`chip not found: ${label}`)
  return el
}

async function click(element: HTMLElement): Promise<void> {
  await act(async () => {
    element.click()
    await Promise.resolve()
  })
}

async function pressEscape(): Promise<void> {
  await act(async () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await Promise.resolve()
  })
}

async function setDraft(value: string, start: number, end = start): Promise<void> {
  const area = editorTextarea()
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(
      area,
      value,
    )
    area.dispatchEvent(new Event('input', { bubbles: true }))
    area.focus()
    area.setSelectionRange(start, end)
    await Promise.resolve()
  })
}

// Caret restoration defers to the next animation frame after the insert.
async function nextFrame(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 25))
  })
}

/** Transition-driven updates (drawer fetch) need a macrotask to settle. */
async function flushTransitions(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

async function openEditor(): Promise<void> {
  await click(buttonByLabel('Muuda redaktoris'))
}

function versionInput(): HTMLInputElement {
  // The footer "Uus versioon" input is the only input inside the dialog.
  const el = dialog().querySelector<HTMLInputElement>('input')
  if (el === null) throw new Error('version input not found')
  return el
}

function toastRegion(): HTMLElement {
  const el = document.body.querySelector<HTMLElement>('[role="status"]')
  if (el === null) throw new Error('toast region not found')
  return el
}

/** Mirrors the NEXT_REDIRECT digest a redirecting server action rejects with. */
function nextRedirect(url: string): Error {
  const error = new Error(`NEXT_REDIRECT:${url}`) as Error & { digest: string }
  error.digest = `NEXT_REDIRECT;replace;${url};307`
  return error
}

describe('TemplateEditorModal opening', () => {
  it('opens from the trigger with a 720px dialog titled by template and version', async () => {
    await mountEditor()
    expect(dialogCount()).toBe(0)
    await openEditor()
    expect(dialogCount()).toBe(1)
    expect(dialog().querySelector('h2')?.textContent).toBe('Mall: Raamleping (v3.1)')
    expect(dialog().className).toContain('max-w-[720px]')
    expect(editorTextarea().placeholder).toBe('Kirjuta või kleebi malli lähtetekst siia')
  })

  it('closes on Escape', async () => {
    await mountEditor()
    await openEditor()
    await pressEscape()
    expect(dialogCount()).toBe(0)
  })

  it('closes from a backdrop click but not from clicks inside the panel', async () => {
    await mountEditor()
    await openEditor()
    await click(dialog())
    expect(dialogCount()).toBe(1)
    const backdrop = dialog().parentElement
    if (backdrop === null) throw new Error('backdrop not found')
    await click(backdrop)
    expect(dialogCount()).toBe(0)
  })

  it('closes from the footer Sulge button', async () => {
    await mountEditor()
    await openEditor()
    await click(buttonByLabel('Sulge', dialog()))
    expect(dialogCount()).toBe(0)
  })
})

describe('TemplateEditorModal chip insertion', () => {
  it('inserts the token at the cursor and parks the caret after it', async () => {
    await mountEditor()
    await openEditor()
    await setDraft('Lepingu tekst', 8)
    await click(chip('bid.amount'))
    await nextFrame()
    const area = editorTextarea()
    expect(area.value).toBe('Lepingu {{bid.amount}}tekst')
    expect(area.selectionStart).toBe(22)
    expect(area.selectionEnd).toBe(22)
    expect(document.activeElement).toBe(area)
  })

  it('replaces the selected range with the token', async () => {
    await mountEditor()
    await openEditor()
    await setDraft('Vananimi ja tekst', 4, 8)
    await click(chip('bidder.name'))
    await nextFrame()
    const area = editorTextarea()
    expect(area.value).toBe('Vana{{bidder.name}} ja tekst')
    expect(area.selectionStart).toBe(19)
    expect(area.selectionEnd).toBe(19)
  })

  it('starts each editing session with an empty draft', async () => {
    await mountEditor()
    await openEditor()
    await setDraft('{{date.today}}', 14)
    expect(editorTextarea().value).toBe('{{date.today}}')
    await click(buttonByLabel('Sulge', dialog()))
    await openEditor()
    expect(editorTextarea().value).toBe('')
  })
})

describe('TemplateEditorModal test render', () => {
  it('opens the test-render drawer with the fixture output', async () => {
    await mountEditor()
    await openEditor()
    await click(buttonByLabel('Testrender näidisandmetega', dialog()))
    await flushTransitions()
    expect(actions.testRender).toHaveBeenCalledTimes(1)
    expect(actions.testRender).toHaveBeenCalledWith('tpl-1')
    const preview = drawer()
    const frame = preview.querySelector('iframe')
    expect(frame?.getAttribute('srcdoc')).toBe('<p>Tere, Test Testov</p>')
  })
})

describe('TemplateEditorModal head source reload', () => {
  it('opens pre-filled with the head source and the suggested next version', async () => {
    await mountEditor({
      initialSourceContent: '<p>Raamlepingu lähtetekst</p>',
      initialSourceFormat: 'html',
      nextVersion: '3.2',
    })
    await openEditor()
    expect(editorTextarea().value).toBe('<p>Raamlepingu lähtetekst</p>')
    expect(versionInput().value).toBe('3.2')
  })

  it('reloads the head source fresh after reopening, discarding draft edits', async () => {
    await mountEditor({
      initialSourceContent: '<p>Päise tekst</p>',
      initialSourceFormat: 'txt',
      nextVersion: '3.2',
    })
    await openEditor()
    await setDraft('<p>Muudetud mustand</p>', 5)
    expect(editorTextarea().value).toBe('<p>Muudetud mustand</p>')
    await click(buttonByLabel('Sulge', dialog()))
    await openEditor()
    expect(editorTextarea().value).toBe('<p>Päise tekst</p>')
    expect(versionInput().value).toBe('3.2')
  })
})

describe('TemplateEditorModal chip insertion across reopen', () => {
  it('inserts chips in both sessions starting from the reloaded head source', async () => {
    await mountEditor({ initialSourceContent: 'Lepingu tekst', nextVersion: '3.2' })
    await openEditor()
    await setDraft('Lepingu tekst', 8)
    await click(chip('bid.amount'))
    await nextFrame()
    expect(editorTextarea().value).toBe('Lepingu {{bid.amount}}tekst')

    await click(buttonByLabel('Sulge', dialog()))
    await openEditor()
    expect(editorTextarea().value).toBe('Lepingu tekst')
    await setDraft('Lepingu tekst', 0)
    await click(chip('lot.id'))
    await nextFrame()
    expect(editorTextarea().value).toBe('{{lot.id}}Lepingu tekst')
  })
})

describe('TemplateEditorModal save flow', () => {
  it('submits id, source, format and version, then closes with a success toast', async () => {
    await mountEditor(
      {
        initialSourceContent: '<p>Päise tekst</p>',
        initialSourceFormat: 'html',
        nextVersion: '3.2',
      },
      true,
    )
    await openEditor()
    await setDraft('<p>Uus lähtetekst</p>', 5)
    actions.saveTemplateDraft.mockRejectedValueOnce(
      nextRedirect('/admin/contracts/templates?teade=Mustand%20salvestatud%20(versioon%203.2).'),
    )

    await click(buttonByLabel('Salvesta', dialog()))
    await flushTransitions()

    expect(actions.saveTemplateDraft).toHaveBeenCalledTimes(1)
    const call = actions.saveTemplateDraft.mock.calls[0]
    if (call === undefined) throw new Error('saveTemplateDraft was not called')
    const [submitted] = call
    expect(submitted.get('id')).toBe('tpl-1')
    expect(submitted.get('sourceContent')).toBe('<p>Uus lähtetekst</p>')
    expect(submitted.get('sourceFormat')).toBe('html')
    expect(submitted.get('version')).toBe('3.2')
    expect(dialogCount()).toBe(0)
    expect(toastRegion().textContent).toContain('Mustand salvestatud (versioon 3.2).')
  })

  it('keeps the modal open and shows the server error toast on a ?viga redirect', async () => {
    await mountEditor(
      {
        initialSourceContent: '<p>Päise tekst</p>',
        initialSourceFormat: 'html',
        nextVersion: '3.2',
      },
      true,
    )
    await openEditor()
    actions.saveTemplateDraft.mockRejectedValueOnce(
      nextRedirect(
        '/admin/contracts/templates?viga=Versioon%20%223.2%22%20on%20selle%20malli%20jaoks%20juba%20kasutusel.',
      ),
    )

    await click(buttonByLabel('Salvesta', dialog()))
    await flushTransitions()

    expect(actions.saveTemplateDraft).toHaveBeenCalledTimes(1)
    expect(dialogCount()).toBe(1)
    expect(editorTextarea().value).toBe('<p>Päise tekst</p>')
    const region = toastRegion().textContent
    expect(region).toContain('Mustandi salvestamine ebaõnnestus.')
    expect(region).toContain('Versioon "3.2" on selle malli jaoks juba kasutusel.')
  })

  it('keeps the modal open when the action fails without a redirect digest', async () => {
    await mountEditor({ nextVersion: '3.2' }, true)
    await openEditor()
    await setDraft('Lähtetekst', 5)
    actions.saveTemplateDraft.mockRejectedValueOnce(new Error('võrgu viga'))

    await click(buttonByLabel('Salvesta', dialog()))
    await flushTransitions()

    expect(dialogCount()).toBe(1)
    expect(toastRegion().textContent).toContain('Mustandi salvestamine ebaõnnestus.')
  })
})
