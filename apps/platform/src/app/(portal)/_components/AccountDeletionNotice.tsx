'use client'

import { useEffect, useState } from 'react'

import {
  accountDeletionStatusAction,
  cancelAccountDeletionAction,
  type AccountDeletionState,
} from '@/app/(admin)/_actions/users'

function isRedirectSignal(error: unknown): boolean {
  const digest = (error as { digest?: unknown } | null)?.digest
  return typeof digest === 'string' && digest.startsWith('NEXT_REDIRECT')
}

/**
 * Portal notice for a pending account deletion (spec delta admin-people):
 * during the 14-day cooling-off the user sees the state and can cancel the
 * request. Renders nothing when no pending request exists.
 */
export function AccountDeletionNotice() {
  const [state, setState] = useState<AccountDeletionState | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    accountDeletionStatusAction()
      .then((status) => {
        if (!cancelled) setState(status)
      })
      .catch(() => {
        // No status feed: the notice stays hidden.
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (state?.pending !== true) return null

  const cancel = () => {
    setCancelling(true)
    setError(null)
    cancelAccountDeletionAction()
      .then((result) => {
        if (result.ok) {
          setState({ pending: false, requestedAt: null, coolingOffUntil: null })
        } else {
          setError(result.error)
          setCancelling(false)
        }
      })
      .catch((caught: unknown) => {
        if (isRedirectSignal(caught)) return
        setError('Kustutustaotluse tühistamine ebaõnnestus.')
        setCancelling(false)
      })
  }

  return (
    <section
      role="status"
      className="border-b border-border bg-cta px-4 py-2 font-heading text-bodySm font-semibold text-ink md:px-6"
    >
      <div className="mx-auto flex w-full max-w-container-xl flex-wrap items-center gap-sm">
        <span className="min-w-0 flex-1">
          Teie konto kustutamistaotlus on ootel. Lõplik kustutamine toimub pärast 14-päevast
          jääaega{state.coolingOffUntil ? ` (${state.coolingOffUntil})` : ''}.
        </span>
        <button
          type="button"
          onClick={cancel}
          disabled={cancelling}
          className="inline-flex shrink-0 items-center rounded-pill bg-bgPage px-3 py-1 text-label font-bold text-ink transition-transform duration-hover ease-hover hover:-translate-y-px hover:shadow-card disabled:cursor-not-allowed disabled:opacity-60"
        >
          {cancelling ? 'Tühistamine…' : 'TÜHISTA KUSTUTAMINE'}
        </button>
        {error ? (
          <span role="alert" className="text-bodySm font-normal text-danger">
            {error}
          </span>
        ) : null}
      </div>
    </section>
  )
}
