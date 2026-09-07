'use client'

import { CircleCheck, Info, TriangleAlert } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

export type ToastTone = 'success' | 'error' | 'info'

export interface ToastInput {
  tone?: ToastTone
  title: string
  /** Secondary line under the title (the demo audit subline). */
  description?: string
  /** Auto-dismiss delay in ms. */
  durationMs?: number
  /** One-shot save-ping dot for save confirmations (03-auction-editor affordance). */
  ping?: boolean
}

export type PushToast = (toast: ToastInput | string) => void

const ToastContext = createContext<PushToast | null>(null)

// Demo pages disagree (09-leads 3200ms ... 05-sealed 4200ms); normalized on
// the settings save toast value (13-settings), the longest-running save case.
const DEFAULT_DURATION_MS = 3600
const MAX_TOASTS = 3

interface ActiveToast {
  key: number
  tone: ToastTone
  title: string
  description?: string | undefined
  ping: boolean
}

const toneBorderClass: Record<ToastTone, string> = {
  success: 'border-l-accent',
  error: 'border-l-danger',
  info: 'border-l-info',
}

const toneIconClass: Record<ToastTone, string> = {
  success: 'text-accent',
  error: 'text-dangerLight',
  info: 'text-infoLight',
}

function toneIcon(tone: ToastTone): ReactNode {
  if (tone === 'success') return <CircleCheck className="h-4 w-4" />
  if (tone === 'error') return <TriangleAlert className="h-4 w-4" />
  return <Info className="h-4 w-4" />
}

/**
 * Feedback toasts (13-settings demo .toast): dark ink surface, tone stripe,
 * bottom-center above every overlay (--z-toast). Passive status region, so
 * it stays outside the overlay escape/focus stack.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ActiveToast[]>([])
  const nextKey = useRef(0)
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  useEffect(() => {
    const pending = timers.current
    return () => {
      for (const timer of pending.values()) clearTimeout(timer)
      pending.clear()
    }
  }, [])

  const dismiss = useCallback((key: number) => {
    const timer = timers.current.get(key)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(key)
    }
    setToasts((current) => current.filter((toast) => toast.key !== key))
  }, [])

  const pushToast = useCallback<PushToast>(
    (input) => {
      const toast: ToastInput = typeof input === 'string' ? { title: input } : input
      const key = nextKey.current++
      setToasts((current) => [
        ...current.slice(-(MAX_TOASTS - 1)),
        {
          key,
          tone: toast.tone ?? 'info',
          title: toast.title,
          description: toast.description,
          ping: toast.ping ?? false,
        },
      ])
      timers.current.set(
        key,
        setTimeout(() => {
          dismiss(key)
        }, toast.durationMs ?? DEFAULT_DURATION_MS),
      )
    },
    [dismiss],
  )

  return (
    <ToastContext.Provider value={pushToast}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed bottom-6 left-1/2 z-[var(--z-toast)] flex w-[min(420px,calc(100vw-32px))] -translate-x-1/2 flex-col items-stretch gap-2"
      >
        {toasts.map((toast) => (
          <div
            key={toast.key}
            className={`pointer-events-auto flex animate-[modal-in_0.2s_ease-out] items-start gap-2.5 rounded-card border-l-[3px] bg-ink px-4 py-3 text-inkInverse shadow-modal ${toneBorderClass[toast.tone]}`}
          >
            <span className={`mt-0.5 shrink-0 [&>svg]:h-4 [&>svg]:w-4 ${toneIconClass[toast.tone]}`}>
              {toneIcon(toast.tone)}
            </span>
            {toast.ping && (
              <span
                aria-hidden="true"
                className="mt-[5px] h-2 w-2 shrink-0 animate-[save-ping_0.6s_ease-out] rounded-pill bg-statusActive"
              />
            )}
            <span className="flex min-w-0 flex-col gap-px">
              <span className="text-bodySm font-semibold">{toast.title}</span>
              {toast.description ? (
                <span className="text-label text-primaryLight">{toast.description}</span>
              ) : null}
            </span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): PushToast {
  const pushToast = useContext(ToastContext)
  if (!pushToast) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return pushToast
}
