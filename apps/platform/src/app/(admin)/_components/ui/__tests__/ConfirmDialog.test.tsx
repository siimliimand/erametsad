// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ConfirmDialog, type ConfirmDialogProps } from '../ConfirmDialog'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

const onCloseMock = vi.fn()
const onConfirmMock = vi.fn()

type ReasonProps = Extract<ConfirmDialogProps, { variant: 'reason' }>
type KeywordProps = Extract<ConfirmDialogProps, { variant: 'keyword' }>

function reasonProps(overrides: Partial<ReasonProps> = {}): ReasonProps {
  return {
    open: true,
    onClose: onCloseMock,
    title: 'Päringu keeldumine',
    variant: 'reason',
    reasonLabel: 'Keeldumise põhjus',
    confirmLabel: 'Keeldu',
    onConfirm: onConfirmMock,
    ...overrides,
  }
}

function keywordProps(overrides: Partial<KeywordProps> = {}): KeywordProps {
  return {
    open: true,
    onClose: onCloseMock,
    title: 'Hoolduse kustutamine',
    variant: 'keyword',
    keyword: 'HOOLDUS',
    confirmLabel: 'Kustuta',
    onConfirm: onConfirmMock,
    ...overrides,
  }
}

let container: HTMLDivElement
let root: Root

async function mount(props: ConfirmDialogProps): Promise<void> {
  await act(async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    root.render(createElement(ConfirmDialog, props))
    await Promise.resolve()
  })
}

async function rerender(props: ConfirmDialogProps): Promise<void> {
  await act(async () => {
    root.render(createElement(ConfirmDialog, props))
    await Promise.resolve()
  })
}

afterEach(() => {
  act(() => {
    root.unmount()
  })
  container.remove()
  document.body.textContent = ''
  onCloseMock.mockReset()
  onConfirmMock.mockReset()
})

function guardTextarea(): HTMLTextAreaElement {
  const el = document.body.querySelector<HTMLTextAreaElement>('[role="dialog"] textarea')
  if (el === null) throw new Error('reason textarea not found')
  return el
}

function guardInput(): HTMLInputElement {
  const el = document.body.querySelector<HTMLInputElement>(
    '[role="dialog"] input[type="text"]',
  )
  if (el === null) throw new Error('keyword input not found')
  return el
}

function buttonByLabel(label: string): HTMLButtonElement {
  const el = [...document.body.querySelectorAll<HTMLButtonElement>('button')].find(
    (button) => button.textContent.trim() === label,
  )
  if (el === undefined) throw new Error(`button not found: ${label}`)
  return el
}

async function typeTextarea(value: string): Promise<void> {
  const textarea = guardTextarea()
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(
      textarea,
      value,
    )
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    await Promise.resolve()
  })
}

async function typeInput(value: string): Promise<void> {
  const input = guardInput()
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(
      input,
      value,
    )
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await Promise.resolve()
  })
}

async function clickButton(label: string): Promise<void> {
  await act(async () => {
    buttonByLabel(label).click()
    await Promise.resolve()
  })
}

describe('ConfirmDialog reason variant', () => {
  it('disables confirm until the reason reaches the minimum length', async () => {
    await mount(reasonProps())
    const confirm = buttonByLabel('Keeldu')
    expect(confirm.disabled).toBe(true)

    await typeTextarea('abcd')
    expect(buttonByLabel('Keeldu').disabled).toBe(true)

    await typeTextarea('abcde')
    expect(buttonByLabel('Keeldu').disabled).toBe(false)
  })

  it('counts the trimmed value and flags the input while too short', async () => {
    await mount(reasonProps())
    await typeTextarea(' ab ')
    const textarea = guardTextarea()
    expect(buttonByLabel('Keeldu').disabled).toBe(true)
    expect(textarea.getAttribute('aria-invalid')).toBe('true')
    expect(document.body.textContent).toContain(
      'Põhjus on kohustuslik (vähemalt 5 tähemärki).',
    )

    await typeTextarea('  palun  ')
    expect(guardTextarea().getAttribute('aria-invalid')).toBe('false')
    expect(document.body.textContent).not.toContain(
      'Põhjus on kohustuslik (vähemalt 5 tähemärki).',
    )
  })

  it('passes the trimmed reason to onConfirm', async () => {
    await mount(reasonProps())
    await typeTextarea('  palun kontrolli  ')
    await clickButton('Keeldu')
    expect(onConfirmMock).toHaveBeenCalledTimes(1)
    expect(onConfirmMock).toHaveBeenCalledWith('palun kontrolli')
    expect(onCloseMock).not.toHaveBeenCalled()
  })

  it('honours a custom minLength', async () => {
    await mount(reasonProps({ minLength: 3 }))
    await typeTextarea('ab')
    expect(buttonByLabel('Keeldu').disabled).toBe(true)
    expect(document.body.textContent).toContain(
      'Põhjus on kohustuslik (vähemalt 3 tähemärki).',
    )

    await typeTextarea('abc')
    expect(buttonByLabel('Keeldu').disabled).toBe(false)
    expect(document.body.textContent).not.toContain(
      'Põhjus on kohustuslik (vähemalt 3 tähemärki).',
    )
  })

  it('closes from the cancel button and resets the input on reopen', async () => {
    await mount(reasonProps())
    await typeTextarea('liiga lühike')
    await clickButton('Tühista')
    expect(onCloseMock).toHaveBeenCalledTimes(1)

    await rerender(reasonProps({ open: false }))
    await rerender(reasonProps())
    expect(guardTextarea().value).toBe('')
    expect(buttonByLabel('Keeldu').disabled).toBe(true)
  })
})

describe('ConfirmDialog keyword variant', () => {
  it('enables confirm only on a case-insensitive exact match', async () => {
    await mount(keywordProps())
    expect(buttonByLabel('Kustuta').disabled).toBe(true)

    await typeInput('hoolduss')
    expect(buttonByLabel('Kustuta').disabled).toBe(true)

    await typeInput('hooldus')
    expect(buttonByLabel('Kustuta').disabled).toBe(false)

    await typeInput('Hooldus ')
    expect(buttonByLabel('Kustuta').disabled).toBe(false)

    await typeInput('hooldus2')
    expect(buttonByLabel('Kustuta').disabled).toBe(true)
  })

  it('shows the default keyword label', async () => {
    await mount(keywordProps())
    expect(document.body.textContent).toContain('Trüki kinnitussõna: HOOLDUS')
  })

  it('calls onConfirm without arguments and resets on reopen', async () => {
    await mount(keywordProps())
    await typeInput('hooldus')
    await clickButton('Kustuta')
    expect(onConfirmMock).toHaveBeenCalledTimes(1)
    expect(onConfirmMock).toHaveBeenCalledWith()

    await rerender(keywordProps({ open: false }))
    await rerender(keywordProps())
    expect(guardInput().value).toBe('')
    expect(buttonByLabel('Kustuta').disabled).toBe(true)
  })
})
