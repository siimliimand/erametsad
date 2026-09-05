// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  useRequestDraft,
  type RequestDraftApi,
} from '../../_lib/use-request-draft'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

const draftKey = (formName: string): string => `erametsad:request-draft:${formName}`

interface Envelope {
  savedAt: number
  value: Record<string, unknown>
}

function seedDraft(formName: string, envelope: Envelope): void {
  window.localStorage.setItem(draftKey(formName), JSON.stringify(envelope))
}

function readEnvelope(formName: string): Envelope {
  const raw = window.localStorage.getItem(draftKey(formName))
  if (raw === null) throw new Error(`missing draft: ${draftKey(formName)}`)
  return JSON.parse(raw) as unknown as Envelope
}

let container: HTMLDivElement
let root: Root
let api: RequestDraftApi | null = null

function DraftHarness({
  formName,
  onReady,
}: {
  formName: string
  onReady: (draftApi: RequestDraftApi) => void
}) {
  onReady(useRequestDraft(formName))
  return null
}

async function mountHarness(formName: string): Promise<void> {
  api = null
  await act(async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    root.render(
      createElement(DraftHarness, {
        formName,
        onReady: (draftApi: RequestDraftApi) => {
          api = draftApi
        },
      }),
    )
    await Promise.resolve()
  })
}

function requiredApi(): RequestDraftApi {
  if (api === null) throw new Error('draft api was not captured')
  return api
}

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  act(() => {
    root.unmount()
  })
  container.remove()
  vi.unstubAllGlobals()
})

describe('useRequestDraft storage envelope', () => {
  it('round-trips a draft through localStorage with a savedAt envelope', async () => {
    await mountHarness('kava-1')
    const draft = requiredApi()

    act(() => {
      draft.writeDraft({ name: 'Mari Maasikas', services: ['hooldamine'] })
    })

    const stored = readEnvelope('kava-1')
    expect(typeof stored.savedAt).toBe('number')
    expect(stored.value).toEqual({ name: 'Mari Maasikas', services: ['hooldamine'] })
    expect(draft.readDraft()).toEqual({ name: 'Mari Maasikas', services: ['hooldamine'] })
  })

  it('keys drafts per formName so two forms never collide', async () => {
    await mountHarness('kava-1')
    requiredApi().writeDraft({ name: 'Kava' })
    await mountHarness('hooldusraie-1')
    const other = requiredApi()

    expect(other.readDraft()).toBeNull()
    other.writeDraft({ name: 'Raie' })

    expect(readEnvelope('kava-1').value).toEqual({ name: 'Kava' })
    expect(readEnvelope('hooldusraie-1').value).toEqual({ name: 'Raie' })
  })

  it('clearDraft removes only the current form key', async () => {
    await mountHarness('kava-1')
    const draft = requiredApi()
    draft.writeDraft({ name: 'Mari' })
    window.localStorage.setItem(draftKey('istutamine-1'), JSON.stringify({ savedAt: 1, value: {} }))

    act(() => {
      draft.clearDraft()
    })

    expect(window.localStorage.getItem(draftKey('kava-1'))).toBeNull()
    expect(window.localStorage.getItem(draftKey('istutamine-1'))).not.toBeNull()
  })
})

describe('useRequestDraft rejects unusable drafts', () => {
  it.each([
    ['corrupt JSON', 'not-json{'],
    ['non-object JSON', JSON.stringify('string')],
    ['array JSON', JSON.stringify([{ name: 'Mari' }])],
    ['envelope without savedAt', JSON.stringify({ value: { name: 'Mari' } })],
    ['envelope without value', JSON.stringify({ savedAt: Date.now() })],
  ])('returns null for %s', async (_label, raw) => {
    await mountHarness('kava-1')
    window.localStorage.setItem(draftKey('kava-1'), raw)

    expect(requiredApi().readDraft()).toBeNull()
  })

  it('drops drafts older than 24 h and removes them from storage', async () => {
    await mountHarness('kava-1')
    seedDraft('kava-1', {
      savedAt: Date.now() - 25 * 60 * 60 * 1000,
      value: { name: 'Vananie' },
    })

    expect(requiredApi().readDraft()).toBeNull()
    expect(window.localStorage.getItem(draftKey('kava-1'))).toBeNull()
  })

  it('still serves drafts just inside the 24 h TTL', async () => {
    await mountHarness('kava-1')
    seedDraft('kava-1', {
      savedAt: Date.now() - 23 * 60 * 60 * 1000,
      value: { name: 'Friske' },
    })

    expect(requiredApi().readDraft()).toEqual({ name: 'Friske' })
  })

  it('returns null when storage has no draft for the form', async () => {
    await mountHarness('kava-1')

    expect(requiredApi().readDraft()).toBeNull()
  })
})

describe('useRequestDraft storage failures', () => {
  it('swallows quota errors on write', async () => {
    await mountHarness('kava-1')
    const draft = requiredApi()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota exceeded', 'QuotaExceededError')
    })

    expect(() => draft.writeDraft({ name: 'Mari' })).not.toThrow()
    expect(window.localStorage.getItem(draftKey('kava-1'))).toBeNull()
    vi.restoreAllMocks()
  })

  it('swallows storage errors on clear', async () => {
    await mountHarness('kava-1')
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })

    expect(() => requiredApi().clearDraft()).not.toThrow()
    vi.restoreAllMocks()
  })
})

describe('useRequestDraft SSR safety', () => {
  it('never touches storage at render time', async () => {
    await mountHarness('kava-1')

    expect(window.localStorage.length).toBe(0)
  })

  it('no-ops every accessor when window is unavailable (server)', async () => {
    await mountHarness('kava-1')
    const draft = requiredApi()
    vi.stubGlobal('window', undefined)
    expect(typeof window).toBe('undefined')

    expect(draft.readDraft()).toBeNull()
    expect(() => draft.writeDraft({ name: 'Mari' })).not.toThrow()
    expect(() => draft.clearDraft()).not.toThrow()
    // Restore window before afterEach unmounts the React root.
    vi.unstubAllGlobals()
  })
})
