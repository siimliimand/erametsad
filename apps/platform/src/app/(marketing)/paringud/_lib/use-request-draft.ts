import { useCallback } from 'react'

const DRAFT_TTL_MS = 24 * 60 * 60 * 1000

const draftKey = (formName: string): string => `erametsad:request-draft:${formName}`

interface DraftEnvelope {
  savedAt: number
  value: Record<string, unknown>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export interface RequestDraftApi {
  /** Returns the stored draft or null (missing, expired, corrupt, or no storage). */
  readDraft: () => Record<string, unknown> | null
  writeDraft: (value: Record<string, unknown>) => void
  clearDraft: () => void
}

/**
 * localStorage draft keyed per formName with a 24 h TTL. Every accessor is
 * SSR-safe (no storage access during render) and swallow storage failures.
 * Callers decide what goes in; the request-form kit never stores the consent
 * checkbox state or the selected file.
 */
export function useRequestDraft(formName: string): RequestDraftApi {
  const readDraft = useCallback((): Record<string, unknown> | null => {
    if (typeof window === 'undefined') return null
    try {
      const raw = window.localStorage.getItem(draftKey(formName))
      if (raw === null) return null
      const parsed: unknown = JSON.parse(raw)
      if (!isRecord(parsed) || typeof parsed.savedAt !== 'number' || !isRecord(parsed.value)) {
        return null
      }
      if (Date.now() - parsed.savedAt > DRAFT_TTL_MS) {
        window.localStorage.removeItem(draftKey(formName))
        return null
      }
      return parsed.value
    } catch {
      return null
    }
  }, [formName])

  const writeDraft = useCallback(
    (value: Record<string, unknown>): void => {
      if (typeof window === 'undefined') return
      try {
        const envelope: DraftEnvelope = { savedAt: Date.now(), value }
        window.localStorage.setItem(draftKey(formName), JSON.stringify(envelope))
      } catch {
        // Quota exceeded or storage unavailable: drafts are best-effort.
      }
    },
    [formName],
  )

  const clearDraft = useCallback((): void => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.removeItem(draftKey(formName))
    } catch {
      // Storage unavailable: nothing to clear.
    }
  }, [formName])

  return { readDraft, writeDraft, clearDraft }
}
